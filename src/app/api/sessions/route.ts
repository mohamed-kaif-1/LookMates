import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      occasion,
      stylePreferences,
      combinedBudget,
      currency = "INR",
      preferredColors,
      excludedColors,
      venue,
      weatherOrSeason,
      dressCode,
      person1Preference,
      person2Preference,
      notes
    } = body;

    if (!occasion || !stylePreferences || !combinedBudget) {
      return NextResponse.json(
        { error: "Occasion, styling preference, and combined budget are required." },
        { status: 400 }
      );
    }

    const sessionId = `ses_${uuidv4().substring(0, 12)}`;
    const now = new Date().toISOString();
    const db = getDb();

    // Insert session
    const insertSession = db.prepare(`
      INSERT INTO sessions (
        id, occasion, style_preferences, combined_budget, currency,
        preferred_colors, excluded_colors, venue, weather_or_season,
        dress_code, person1_preference, person2_preference, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);

    insertSession.run(
      sessionId,
      occasion,
      stylePreferences,
      Number(combinedBudget),
      currency,
      preferredColors || "",
      excludedColors || "",
      venue || "",
      weatherOrSeason || "",
      dressCode || "",
      person1Preference || "",
      person2Preference || "",
      notes || "",
      now,
      now
    );

    // Initialize two participants
    const insertParticipant = db.prepare(`
      INSERT INTO participants (id, session_id, role, display_name, photo_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const p1Id = `part_p1_${uuidv4().substring(0, 8)}`;
    const p2Id = `part_p2_${uuidv4().substring(0, 8)}`;

    insertParticipant.run(p1Id, sessionId, "person1", "Person 1", "", now);
    insertParticipant.run(p2Id, sessionId, "person2", "Person 2", "", now);

    return NextResponse.json({
      success: true,
      sessionId,
      participants: {
        person1: { id: p1Id, role: "person1", displayName: "Person 1" },
        person2: { id: p2Id, role: "person2", displayName: "Person 2" }
      }
    });
  } catch (error: unknown) {
    console.error("[POST /api/sessions] Error:", error);
    return NextResponse.json({ error: "Failed to create styling session." }, { status: 500 });
  }
}
