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
    const { imageData, referenceImageData, person1JobId, person2JobId } = body;

    if (!imageData) {
      return NextResponse.json({ error: "imageData is required." }, { status: 400 });
    }

    const db = getDb();
    const compId = `comp_${uuidv4().substring(0, 8)}`;

    db.prepare(`
      INSERT INTO couple_compositions (id, session_id, person1_job_id, person2_job_id, image_data, reference_image_data, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
    `).run(compId, sessionId, person1JobId || null, person2JobId || null, imageData, referenceImageData || null, new Date().toISOString());

    return NextResponse.json({ success: true, compositionId: compId });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/compositions] Error:", error);
    return NextResponse.json({ error: "Failed to save couple composition." }, { status: 500 });
  }
}
