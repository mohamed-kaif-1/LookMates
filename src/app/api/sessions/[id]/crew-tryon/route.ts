import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CrewTryOnService } from "@/lib/crew-tryon";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const { targetParticipantId } = body;

    const db = getDb();
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (!CrewTryOnService.isConfigured()) {
      return NextResponse.json(
        {
          error: "Virtual try-on requires YOUCAM_API_KEY to be configured on the server in .env.local. Add YOUCAM_API_KEY and YOUCAM_API_BASE_URL to generate real try-on results.",
          configured: false,
        },
        { status: 503 }
      );
    }

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
          { error: `Missing photo for ${participant.display_name || participant.role}. Every participant needs a photo before generating try-ons.` },
          { status: 400 }
        );
      }

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
          { error: `No garment assigned to ${participant.display_name || participant.role}. Please assign a garment first.` },
          { status: 400 }
        );
      }

      // Check if this participant already has a succeeded job for this garment
      const existingSuccess = db.prepare(`
        SELECT * FROM tryon_jobs
        WHERE session_id = ? AND participant_id = ? AND garment_id = ? AND status = 'succeeded'
      `).get(sessionId, participant.id, assignment.g_id) as Record<string, unknown> | undefined;

      if (existingSuccess && !targetParticipantId) {
        createdJobs.push(existingSuccess);
        continue;
      }

      const result = await CrewTryOnService.submitTryOn({
        userPhotoUrl: participant.photo_data,
        garmentPhotoUrl: assignment.image_url,
        garmentCategory: assignment.category,
      });

      const jobId = `job_${uuidv4().substring(0, 10)}`;
      const now = new Date().toISOString();

      db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, participant.id);

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
        result.taskId || null,
        result.status,
        result.resultImageUrl || null,
        result.errorCode || null,
        result.errorMessage || null,
        now,
        now
      );

      createdJobs.push({
        id: jobId,
        session_id: sessionId,
        participant_id: participant.id,
        garment_id: assignment.g_id,
        provider_job_id: result.taskId,
        status: result.status,
        result_image_url: result.resultImageUrl || null,
        error_message: result.errorMessage || null,
      });
    }

    return NextResponse.json({ success: true, jobs: createdJobs });
  } catch (error) {
    console.error("[POST /api/sessions/[id]/crew-tryon]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to run virtual try-on." }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    const db = getDb();

    const jobs = db.prepare("SELECT * FROM tryon_jobs WHERE session_id = ?").all(sessionId) as Array<{
      id: string;
      session_id: string;
      participant_id: string;
      garment_id: string;
      provider_job_id: string;
      status: string;
      result_image_url: string | null;
      error_message: string | null;
    }>;

    for (const job of jobs) {
      if ((job.status === "processing" || job.status === "submitting" || job.status === "queued") && job.provider_job_id) {
        const pollResult = await CrewTryOnService.pollTryOnTask(job.provider_job_id);
        if (pollResult.status !== job.status || pollResult.resultImageUrl !== job.result_image_url) {
          const now = new Date().toISOString();
          db.prepare(`
            UPDATE tryon_jobs
            SET status = ?, result_image_url = ?, error_code = ?, error_message = ?, updated_at = ?
            WHERE id = ?
          `).run(
            pollResult.status,
            pollResult.resultImageUrl || job.result_image_url,
            pollResult.errorCode || null,
            pollResult.errorMessage || job.error_message,
            now,
            job.id
          );
          job.status = pollResult.status;
          job.result_image_url = pollResult.resultImageUrl || job.result_image_url;
          job.error_message = pollResult.errorMessage || job.error_message;
        }
      }
    }

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("[GET /api/sessions/[id]/crew-tryon]", error);
    return NextResponse.json({ error: "Failed to fetch try-on status." }, { status: 500 });
  }
}
