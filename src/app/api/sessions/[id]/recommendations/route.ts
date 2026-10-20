import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { StylingEngine } from "@/lib/stylist";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const { lockedItems } = body;

    const db = getDb();
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as {
      occasion: string;
      style_preferences: string;
      combined_budget: number;
      currency: string;
      preferred_colors: string;
      excluded_colors: string;
      venue: string;
      weather_or_season: string;
      dress_code: string;
      person1_preference: string;
      person2_preference: string;
    } | undefined;

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const recommendations = await StylingEngine.generateRecommendations({
      occasion: session.occasion,
      stylePreferences: session.style_preferences,
      combinedBudget: session.combined_budget,
      currency: session.currency,
      preferredColors: session.preferred_colors,
      excludedColors: session.excluded_colors,
      venue: session.venue,
      weatherOrSeason: session.weather_or_season,
      dressCode: session.dress_code,
      person1Preference: session.person1_preference,
      person2Preference: session.person2_preference,
      lockedItems
    });

    const recId = `rec_${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO styling_recommendations (id, session_id, recommendation_data, provider, created_at)
      VALUES (?, ?, ?, 'LookMates AI SmartMatch', ?)
    `).run(recId, sessionId, JSON.stringify(recommendations), new Date().toISOString());

    return NextResponse.json({
      success: true,
      recommendationId: recId,
      recommendations
    });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/recommendations] Error:", error);
    return NextResponse.json({ error: "Failed to generate styling recommendations." }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const db = getDb();

    const record = db.prepare(`
      SELECT * FROM styling_recommendations 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(sessionId) as { recommendation_data: string } | undefined;

    if (!record) {
      return NextResponse.json({ recommendations: [] });
    }

    return NextResponse.json({
      recommendations: JSON.parse(record.recommendation_data)
    });
  } catch (error: unknown) {
    console.error("[GET /api/sessions/[id]/recommendations] Error:", error);
    return NextResponse.json({ error: "Failed to retrieve recommendations." }, { status: 500 });
  }
}
