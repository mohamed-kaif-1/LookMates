import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { canAddCrewParticipant, canRemoveCrewParticipant } from "@/lib/crew-validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;
    if (typeof name !== "string" || !name.trim() || name.length > 80) {
      return NextResponse.json({ error: "Name must be 1 to 80 characters." }, { status: 400 });
    }

    const db = getDb();
    if (!id.startsWith("crew_")) {
      return NextResponse.json({ error: "Participant management is only available for CrewMatch sessions." }, { status: 400 });
    }
    const session = db.prepare("SELECT id FROM sessions WHERE id = ?").get(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const count = (db.prepare("SELECT COUNT(*) AS count FROM participants WHERE session_id = ?").get(id) as { count: number }).count;
    if (!canAddCrewParticipant(count)) {
      return NextResponse.json({ error: "A crew can have at most eight participants." }, { status: 400 });
    }

    const participant = {
      id: `crewpart_${uuidv4().slice(0, 12)}`,
      role: `crew_${count + 1}`,
      display_name: name.trim(),
      photo_data: "",
    };

    db.prepare(`
      INSERT INTO participants (id, session_id, role, display_name, photo_data, created_at)
      VALUES (?, ?, ?, ?, '', ?)
    `).run(participant.id, id, participant.role, participant.display_name, new Date().toISOString());

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    console.error("[POST participants]", error);
    return NextResponse.json({ error: "Failed to add participant." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { participantId, name, photoData, action } = body;

    if (!participantId || typeof participantId !== "string") {
      return NextResponse.json({ error: "participantId is required." }, { status: 400 });
    }

    const db = getDb();

    // Check if updating name
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.length > 80) {
        return NextResponse.json({ error: "Name must be 1 to 80 characters." }, { status: 400 });
      }
      const result = db.prepare("UPDATE participants SET display_name = ? WHERE id = ? AND session_id = ?").run(name.trim(), participantId, id);
      if (!result.changes) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    // Check if updating or removing photo
    if (action === "remove_photo") {
      db.prepare("UPDATE participants SET photo_data = '' WHERE id = ? AND session_id = ?").run(participantId, id);
      db.prepare("DELETE FROM tryon_jobs WHERE participant_id = ? AND session_id = ?").run(participantId, id);
      db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(id);
    } else if (photoData !== undefined) {
      if (typeof photoData !== "string" || (!photoData.startsWith("data:image/") && !photoData.startsWith("http"))) {
        return NextResponse.json({ error: "Invalid photo format. Base64 JPEG, PNG or WebP required." }, { status: 400 });
      }
      if (photoData.length > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "Photo exceeds maximum limit of 10MB." }, { status: 400 });
      }
      db.prepare("UPDATE participants SET photo_data = ? WHERE id = ? AND session_id = ?").run(photoData, participantId, id);
      // Invalidate existing try-on and composition
      db.prepare("DELETE FROM tryon_jobs WHERE participant_id = ? AND session_id = ?").run(participantId, id);
      db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH participants]", error);
    return NextResponse.json({ error: "Failed to update participant." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { participantId } = await request.json();
    const db = getDb();

    if (!id.startsWith("crew_")) {
      return NextResponse.json({ error: "Participant management is only available for CrewMatch sessions." }, { status: 400 });
    }

    const count = (db.prepare("SELECT COUNT(*) AS count FROM participants WHERE session_id = ?").get(id) as { count: number }).count;
    if (!canRemoveCrewParticipant(count)) {
      return NextResponse.json({ error: "A crew needs at least three participants." }, { status: 400 });
    }

    db.exec("BEGIN IMMEDIATE");
    let changes: number;
    try {
      db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(id, participantId);
      db.prepare("DELETE FROM garment_assignments WHERE session_id = ? AND participant_id = ?").run(id, participantId);
      const result = db.prepare("DELETE FROM participants WHERE session_id = ? AND id = ?").run(id, participantId);
      changes = result.changes;
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    if (!changes) return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE participants]", error);
    return NextResponse.json({ error: "Failed to remove participant." }, { status: 500 });
  }
}
