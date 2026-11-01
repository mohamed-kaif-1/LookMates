import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { participantId, garmentId, role, categoryKey } = body;

    if (!garmentId) {
      return NextResponse.json({ error: "garmentId is required." }, { status: 400 });
    }

    const db = getDb();

    // Verify session
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Resolve participantId if role passed
    let pId = participantId;
    if (!pId && role) {
      const part = db.prepare("SELECT id FROM participants WHERE session_id = ? AND role = ?").get(sessionId, role) as { id: string } | undefined;
      if (part) pId = part.id;
    }

    if (!pId) {
      return NextResponse.json({ error: "Participant could not be resolved." }, { status: 400 });
    }

    // Verify garment exists
    const garment = db.prepare("SELECT * FROM garments WHERE id = ?").get(garmentId) as { category: string } | undefined;
    if (!garment) {
      return NextResponse.json({ error: "Garment not found." }, { status: 404 });
    }

    const resolvedCategoryKey = categoryKey || garment.category;

    // Check if an assignment for this exact garment already exists
    const existingSameGarment = db.prepare(`
      SELECT * FROM garment_assignments 
      WHERE session_id = ? AND participant_id = ? AND garment_id = ?
    `).get(sessionId, pId, garmentId);

    if (existingSameGarment) {
      // Toggle off / remove
      db.prepare(`
        DELETE FROM garment_assignments 
        WHERE session_id = ? AND participant_id = ? AND garment_id = ?
      `).run(sessionId, pId, garmentId);

      db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, pId);
      db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(sessionId);

      return NextResponse.json({ success: true, action: "removed" });
    }

    // If an assignment in the SAME category already exists, replace it
    if (resolvedCategoryKey) {
      db.prepare(`
        DELETE FROM garment_assignments 
        WHERE session_id = ? AND participant_id = ? AND category_key = ?
      `).run(sessionId, pId, resolvedCategoryKey);
    }

    const assignmentId = `asgn_${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO garment_assignments (id, session_id, participant_id, garment_id, status, created_at, category_key)
      VALUES (?, ?, ?, ?, 'assigned', ?, ?)
    `).run(assignmentId, sessionId, pId, garmentId, new Date().toISOString(), resolvedCategoryKey);

    // Invalidate previous try-on job for this participant
    db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, pId);
    db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(sessionId);

    return NextResponse.json({ success: true, action: "assigned", assignmentId });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/assignments] Error:", error);
    return NextResponse.json({ error: "Failed to update garment assignment." }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const db = getDb();

    const assignments = db.prepare(`
      SELECT ga.id as assignment_id, ga.participant_id, ga.garment_id, ga.status, ga.category_key,
             p.role, p.display_name,
             g.name as garment_name, g.category, g.image_url, g.price, g.color, g.description, g.is_demo
      FROM garment_assignments ga
      JOIN participants p ON ga.participant_id = p.id
      JOIN garments g ON ga.garment_id = g.id
      WHERE ga.session_id = ?
      ORDER BY ga.created_at ASC
    `).all(sessionId);

    return NextResponse.json({ assignments });
  } catch (error: unknown) {
    console.error("[GET /api/sessions/[id]/assignments] Error:", error);
    return NextResponse.json({ error: "Failed to load garment assignments." }, { status: 500 });
  }
}
