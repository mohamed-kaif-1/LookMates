import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TryOnAdapter, type MultiGarmentItem } from "@/lib/tryonAdapter";
import { GarmentCategory } from "@/lib/categories";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      targetParticipantId,
      outfitSelections // Optional explicit multi-category map: { [participantId or role]: MultiGarmentItem[] }
    } = body;

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
      try {
        if (!participant.photo_data) {
          const jobId = `job_${uuidv4().substring(0, 10)}`;
          const now = new Date().toISOString();
          db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, participant.id);
          db.prepare(`
            INSERT INTO tryon_jobs (
              id, session_id, participant_id, garment_id, provider_job_id,
              status, error_code, error_message, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(jobId, sessionId, participant.id, "none", null, "failed", "MISSING_PHOTO", `Missing photo for ${participant.display_name || participant.role}. Please upload source photo.`, now, now);
          
          const failedJob = db.prepare(`SELECT tj.*, p.role, p.display_name, p.photo_data FROM tryon_jobs tj JOIN participants p ON tj.participant_id = p.id WHERE tj.id = ?`).get(jobId);
          createdJobs.push(failedJob);
          continue;
        }

        // 1. Gather garments for this participant:
        let selectedGarments: MultiGarmentItem[] = [];

        if (outfitSelections) {
          const directList = outfitSelections[participant.id] || outfitSelections[participant.role];
          if (Array.isArray(directList) && directList.length > 0) {
            selectedGarments = directList;
          }
        }

        if (selectedGarments.length === 0) {
          // Query from DB garment_assignments
          const assignments = db.prepare(`
            SELECT ga.*, g.id as g_id, g.name, g.category, g.image_url, g.color
            FROM garment_assignments ga
            JOIN garments g ON ga.garment_id = g.id
            WHERE ga.session_id = ? AND ga.participant_id = ?
            ORDER BY ga.created_at ASC
          `).all(sessionId, participant.id) as Array<{
            g_id: string;
            name: string;
            category: string;
            image_url: string;
            color?: string;
            category_key?: string;
          }>;

          if (assignments.length > 0) {
            selectedGarments = assignments.map((a) => ({
              category: (a.category_key || a.category || "shirt") as GarmentCategory,
              imageUrl: a.image_url,
              name: a.name,
              color: a.color
            }));
          }
        }

        if (selectedGarments.length === 0) {
          const jobId = `job_${uuidv4().substring(0, 10)}`;
          const now = new Date().toISOString();
          db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, participant.id);
          db.prepare(`
            INSERT INTO tryon_jobs (
              id, session_id, participant_id, garment_id, provider_job_id,
              status, error_code, error_message, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(jobId, sessionId, participant.id, "none", null, "failed", "NO_GARMENTS", `No garments selected for ${participant.display_name || participant.role}. Please select at least one garment.`, now, now);
          
          const failedJob = db.prepare(`SELECT tj.*, p.role, p.display_name, p.photo_data FROM tryon_jobs tj JOIN participants p ON tj.participant_id = p.id WHERE tj.id = ?`).get(jobId);
          createdJobs.push(failedJob);
          continue;
        }

        // Check if this participant already has a SUCCEEDED try-on job and we're not explicitly targeting them
        const existingSuccess = db.prepare(`
          SELECT * FROM tryon_jobs 
          WHERE session_id = ? AND participant_id = ? AND status = 'succeeded'
        `).get(sessionId, participant.id) as Record<string, unknown> | undefined;

        if (existingSuccess && !targetParticipantId && !outfitSelections) {
          createdJobs.push(existingSuccess);
          continue;
        }

        // Execute Multi-Category Try-On through the adapter
        const adapterResult = await TryOnAdapter.executeMultiCategoryTryOn({
          userPhotoUrl: participant.photo_data,
          garments: selectedGarments,
          personRole: participant.role
        });

        const jobId = `job_${uuidv4().substring(0, 10)}`;
        const now = new Date().toISOString();

        // Clean up previous jobs for this participant only
        db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, participant.id);

        const firstGarment = selectedGarments[0];
        const selectedCatsJson = JSON.stringify(selectedGarments.map((g) => g.category));
        const processedCatsJson = JSON.stringify(adapterResult.processedCategories);
        const unsupportedCatsJson = JSON.stringify(adapterResult.unsupportedCategories);
        const intermediateJson = JSON.stringify(adapterResult.intermediateResults);
        const garmentDataJson = JSON.stringify(selectedGarments);
        const provenanceJson = JSON.stringify(adapterResult.categoryProvenance || []);
        const metricsJson = JSON.stringify(adapterResult.metrics || null);

        // Insert new try-on job with multi-category tracking and provenance
        db.prepare(`
          INSERT INTO tryon_jobs (
            id, session_id, participant_id, garment_id, provider_job_id,
            status, result_image_url, error_code, error_message, created_at, updated_at,
            selected_categories, processed_categories, unsupported_categories, intermediate_results, garment_data,
            category_provenance, metrics
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          jobId,
          sessionId,
          participant.id,
          firstGarment?.name || "multi-outfit",
          adapterResult.taskId || null,
          adapterResult.status,
          adapterResult.finalImageUrl || null,
          adapterResult.status === "failed" ? "TRYON_ERROR" : null,
          adapterResult.errorMessage || (adapterResult.warnings.length > 0 ? adapterResult.warnings.join(" ") : null),
          now,
          now,
          selectedCatsJson,
          processedCatsJson,
          unsupportedCatsJson,
          intermediateJson,
          garmentDataJson,
          provenanceJson,
          metricsJson
        );

        const jobRecord = db.prepare(`
          SELECT tj.*, p.role, p.display_name, p.photo_data
          FROM tryon_jobs tj
          JOIN participants p ON tj.participant_id = p.id
          WHERE tj.id = ?
        `).get(jobId);

        createdJobs.push(jobRecord);
      } catch (partErr: unknown) {
        console.error(`[POST /api/sessions/${sessionId}/tryon] Error for participant ${participant.id}:`, partErr);
        const jobId = `job_${uuidv4().substring(0, 10)}`;
        const now = new Date().toISOString();
        const msg = partErr instanceof Error ? partErr.message : String(partErr);
        db.prepare("DELETE FROM tryon_jobs WHERE session_id = ? AND participant_id = ?").run(sessionId, participant.id);
        db.prepare(`
          INSERT INTO tryon_jobs (
            id, session_id, participant_id, garment_id, provider_job_id,
            status, error_code, error_message, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(jobId, sessionId, participant.id, "error", null, "failed", "EXCEPTION", msg, now, now);

        const failedRecord = db.prepare(`SELECT tj.*, p.role, p.display_name, p.photo_data FROM tryon_jobs tj JOIN participants p ON tj.participant_id = p.id WHERE tj.id = ?`).get(jobId);
        createdJobs.push(failedRecord);
      }
    }

    return NextResponse.json({
      success: true,
      jobs: createdJobs
    });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/tryon] Error:", error);
    return NextResponse.json({ error: "Failed to initiate virtual try-on." }, { status: 500 });
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
      SELECT tj.*, p.role, p.display_name, p.photo_data
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      WHERE tj.session_id = ?
      ORDER BY tj.created_at ASC
    `).all(sessionId);

    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    console.error("[GET /api/sessions/[id]/tryon] Error:", error);
    return NextResponse.json({ error: "Failed to fetch try-on jobs." }, { status: 500 });
  }
}
