import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const participants = db.prepare("SELECT * FROM participants WHERE session_id = ?").all(id);
    const assignments = db.prepare(`
      SELECT ga.*, g.name as garment_name, g.category, g.image_url, g.price, g.color
      FROM garment_assignments ga
      JOIN garments g ON ga.garment_id = g.id
      WHERE ga.session_id = ?
    `).all(id);

    const tryonJobs = db.prepare("SELECT * FROM tryon_jobs WHERE session_id = ? ORDER BY created_at DESC").all(id);
    const composition = db.prepare("SELECT * FROM couple_compositions WHERE session_id = ? ORDER BY created_at DESC LIMIT 1").get(id);

    return NextResponse.json({
      session,
      participants,
      assignments,
      tryonJobs,
      composition
    });
  } catch (error: unknown) {
    console.error("[GET /api/sessions/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to fetch session." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    const fieldMapping: Record<string, string> = {
      occasion: "occasion",
      stylePreferences: "style_preferences",
      style_preferences: "style_preferences",
      combinedBudget: "combined_budget",
      combined_budget: "combined_budget",
      currency: "currency",
      preferredColors: "preferred_colors",
      preferred_colors: "preferred_colors",
      excludedColors: "excluded_colors",
      excluded_colors: "excluded_colors",
      venue: "venue",
      weatherOrSeason: "weather_or_season",
      weather_or_season: "weather_or_season",
      dressCode: "dress_code",
      dress_code: "dress_code",
      person1Preference: "person1_preference",
      person1_preference: "person1_preference",
      person2Preference: "person2_preference",
      person2_preference: "person2_preference",
      notes: "notes",
      status: "status",
      referencePhotoData: "reference_photo_data",
      reference_photo_data: "reference_photo_data",
      lockedRecommendationId: "locked_recommendation_id",
      locked_recommendation_id: "locked_recommendation_id",
      lockedRecommendationData: "locked_recommendation_data",
      locked_recommendation_data: "locked_recommendation_data",
      backgroundSetting: "background_setting",
      background_setting: "background_setting",
      customBackgroundImage: "custom_background_image",
      custom_background_image: "custom_background_image",
      customColorHex: "custom_color_hex",
      custom_color_hex: "custom_color_hex"
    };

    const handledCols = new Set<string>();
    for (const [key, col] of Object.entries(fieldMapping)) {
      if (key in body && !handledCols.has(col)) {
        updates.push(`${col} = ?`);
        values.push(body[key]);
        handledCols.add(col);
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[PATCH /api/sessions/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to update session." }, { status: 500 });
  }
}
