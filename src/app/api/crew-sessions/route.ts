import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { validateCrewParticipants } from "@/lib/crew-validation";

type CrewInput = { name: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const participants = body.participants;
    if (typeof body.occasion !== "string" || !body.occasion.trim()) {
      return NextResponse.json({ error: "An occasion is required." }, { status: 400 });
    }
    const participantError = validateCrewParticipants(participants);
    if (participantError) return NextResponse.json({ error: participantError }, { status: 400 });

    const now = new Date().toISOString();
    const sessionId = `crew_${uuidv4().slice(0, 12)}`;
    const db = getDb();
    let created: Array<{ id: string; role: string; display_name: string; photo_data: string }>;

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(`
        INSERT INTO sessions (
          id, occasion, style_preferences, combined_budget, currency,
          preferred_colors, dress_code, notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(
        sessionId,
        body.occasion.trim(),
        String(body.stylePreferences || "Coordinated"),
        Number(body.combinedBudget) || 0,
        body.currency || "INR",
        body.preferredColors || "",
        body.dressCode || "",
        body.notes || "",
        now,
        now
      );

      const insert = db.prepare("INSERT INTO participants (id, session_id, role, display_name, photo_data, created_at) VALUES (?, ?, ?, ?, '', ?)");
      created = (participants as CrewInput[]).map((p, i) => {
        const id = `crewpart_${uuidv4().slice(0, 12)}`;
        insert.run(id, sessionId, `crew_${i + 1}`, p.name.trim(), now);
        return { id, role: `crew_${i + 1}`, display_name: p.name.trim(), photo_data: "" };
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    return NextResponse.json({ success: true, sessionId, participants: created }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/crew-sessions]", error);
    return NextResponse.json({ error: "Failed to create crew session." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT s.id, s.occasion, s.style_preferences, s.dress_code, s.created_at, s.updated_at,
             COUNT(p.id) as participant_count
      FROM sessions s
      LEFT JOIN participants p ON p.session_id = s.id
      WHERE s.id LIKE 'crew_%'
      GROUP BY s.id
      ORDER BY s.updated_at DESC
      LIMIT 20
    `).all();

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[GET /api/crew-sessions]", error);
    return NextResponse.json({ error: "Failed to load crew sessions." }, { status: 500 });
  }
}
