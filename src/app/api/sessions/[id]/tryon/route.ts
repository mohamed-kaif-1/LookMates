import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { YouCamService } from "@/lib/youcam";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const { targetParticipantId } = body; // Optional: specify target participant for retry single person

    const db = getDb();
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Get participants
    let participantsQuery = "SELECT * FROM participants WHERE session_id = ?";
    const queryParams: unknown[] = [sessionId];
    if (targetParticipantId) {
      participantsQuery += " AND id = ?";
      queryParams.push(targetParticipantId);
    }
    const participants = db.prepare(participantsQuery).all(...queryParams) as Array<{
      id: string;
      role: string;
      display_name: string;
      photo_data: string;
    }>;

    if (participants.length === 0) {
      return NextResponse.json({ error: "No participants found for try-on." }, { status: 400 });
    }

    const createdJobs = [];

    for (const participant of participants) {
      if (!participant.photo_data) {
        return NextResponse.json(
          { error: `Missing photo for ${participant.display_name || participant.role}. Please upload both photos first.` },
          { status: 400 }
        );
      }

      // Find assigned garments for this participant
      const assignment = db.prepare(`
        SELECT ga.*, g.id as g_id, g.name, g.category, g.image_url
        FROM garment_assignments ga
        JOIN garments g ON ga.garment_id = g.id
        WHERE ga.session_id = ? AND ga.participant_id = ?
        ORDER BY ga.created_at DESC
        LIMIT 1
      `).get(sessionId, participant.id) as {
        g_id: string;
        name: string;
        category: string;
        image_url: string;
      } | undefined;

      if (!assignment) {
        return NextResponse.json(
          { error: `No garment assigned to ${participant.display_name || participant.role}. Please assign garments first.` },
          { status: 400 }
        );
      }

      // Check if this participant already has a SUCCEEDED try-on job with this exact garment
      const existingSuccess = db.prepare(`
        SELECT * FROM tryon_jobs 
        WHERE session_id = ? AND participant_id = ? AND garment_id = ? AND status = 'succeeded'
      `).get(sessionId, participant.id, assignment.g_id) as Record<string, unknown> | undefined;

      // If already succeeded and we are not forcing a specific retry, keep existing result!
      if (existingSuccess && !targetParticipantId) {
        createdJobs.push(existingSuccess);
        continue;
      }

      // Map garment category to YouCam official snake_case category
      const clothCategory = YouCamService.mapGarmentCategory(assignment.category);

      // Submit task to YouCam service
      const youCamResult = await YouCamService.submitClothTask({
        userPhotoUrl: participant.photo_data,
        garmentPhotoUrl: assignment.image_url,
        garmentCategory: clothCategory
      });

      const jobId = `job_${uuidv4().substring(0, 10)}`;
      const now = new Date().toISOString();

      // Clean up previous jobs for this participant
      db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, participant.id);

      // Insert new try-on job
      db.prepare(`
        INSERT INTO tryon_jobs (
          id, session_id, participant_id, garment_id, provider_job_id,
          status, result_image_url, error_code, error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        jobId,
        sessionId,
        participant.id,
        assignment.g_id,
        youCamResult.taskId || null,
        youCamResult.status,
        youCamResult.resultImageUrl || null,
        youCamResult.errorCode || null,
        youCamResult.errorMessage || null,
        now,
        now
      );

      const jobRecord = db.prepare(`
        SELECT tj.*, p.role, p.display_name, g.name as garment_name, g.image_url as garment_image, g.category as garment_category
        FROM tryon_jobs tj
        JOIN participants p ON tj.participant_id = p.id
        JOIN garments g ON tj.garment_id = g.id
        WHERE tj.id = ?
      `).get(jobId);

      createdJobs.push(jobRecord);
    }

    return NextResponse.json({
      success: true,
      jobs: createdJobs
    });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/tryon] Error:", error);
    return NextResponse.json({ error: "Failed to initiate YouCam try-on." }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const db = getDb();

    const jobs = db.prepare(`
      SELECT tj.*, p.role, p.display_name, p.photo_data,
             g.name as garment_name, g.image_url as garment_image, g.category as garment_category
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      JOIN garments g ON tj.garment_id = g.id
      WHERE tj.session_id = ?
      ORDER BY tj.created_at ASC
    `).all(sessionId);

    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    console.error("[GET /api/sessions/[id]/tryon] Error:", error);
    return NextResponse.json({ error: "Failed to fetch try-on jobs." }, { status: 500 });
  }
}
