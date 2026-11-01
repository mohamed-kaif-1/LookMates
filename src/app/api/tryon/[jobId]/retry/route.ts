import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TryOnAdapter, type MultiGarmentItem } from "@/lib/tryonAdapter";
import { GarmentCategory } from "@/lib/categories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const db = getDb();

    const job = db.prepare(`
      SELECT tj.*, p.photo_data, p.role, p.display_name,
             g.image_url as single_garment_url, g.category as single_garment_cat, g.name as single_garment_name
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      LEFT JOIN garments g ON tj.garment_id = g.id
      WHERE tj.id = ?
    `).get(jobId) as {
      id: string;
      session_id: string;
      participant_id: string;
      garment_id: string;
      photo_data: string;
      role: string;
      display_name: string;
      single_garment_url?: string;
      single_garment_cat?: string;
      single_garment_name?: string;
      garment_data?: string;
      selected_categories?: string;
      intermediate_results?: string;
      status?: string;
      error_code?: string;
      error_message?: string;
      retry_count?: number;
    } | undefined;

    if (!job) {
      return NextResponse.json({ error: "Try-on job not found." }, { status: 404 });
    }

    if (!job.photo_data) {
      return NextResponse.json({ error: "Participant photo is missing." }, { status: 400 });
    }

    // Prevent endless retries of the same deterministic failure (limit: 3 attempts)
    const currentRetryCount = job.retry_count || 0;
    if (currentRetryCount >= 3 && job.status === "failed") {
      return NextResponse.json(
        {
          error: "Maximum retry limit (3 attempts) reached for this outfit configuration. Please adjust your garments or upload a new photo.",
          job
        },
        { status: 400 }
      );
    }

    // Reconstruct multi-garment item list
    let garmentsToTry: MultiGarmentItem[] = [];

    if (job.garment_data) {
      try {
        const parsed = JSON.parse(job.garment_data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          garmentsToTry = parsed;
        }
      } catch {}
    }

    if (garmentsToTry.length === 0 && job.single_garment_url) {
      garmentsToTry = [
        {
          category: (job.single_garment_cat || "shirt") as GarmentCategory,
          imageUrl: job.single_garment_url,
          name: job.single_garment_name
        }
      ];
    }

    if (garmentsToTry.length === 0) {
      return NextResponse.json({ error: "No garment data found for retry." }, { status: 400 });
    }

    // Inspect existing intermediate results to resume from the last succeeded step
    // Verify each intermediate step matches current request inputs before resuming
    let resumeIntermediates = undefined;
    if (job.intermediate_results) {
      try {
        const parsed = JSON.parse(job.intermediate_results);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const succeededPrefix = [];
          for (let i = 0; i < parsed.length; i++) {
            const step = parsed[i];
            const matchingGarment = garmentsToTry[i];
            if (
              step.status === "succeeded" &&
              step.imageUrl &&
              matchingGarment &&
              matchingGarment.category === step.category
            ) {
              succeededPrefix.push(step);
            } else {
              break;
            }
          }
          if (succeededPrefix.length > 0) {
            resumeIntermediates = succeededPrefix;
          }
        }
      } catch {}
    }

    // Re-execute via TryOnAdapter with intermediate resume support
    const adapterResult = await TryOnAdapter.executeMultiCategoryTryOn({
      userPhotoUrl: job.photo_data,
      garments: garmentsToTry,
      personRole: job.role,
      resumeFromIntermediate: resumeIntermediates
    });

    const now = new Date().toISOString();
    const selectedCatsJson = JSON.stringify(garmentsToTry.map((g) => g.category));
    const processedCatsJson = JSON.stringify(adapterResult.processedCategories);
    const unsupportedCatsJson = JSON.stringify(adapterResult.unsupportedCategories);
    const intermediateJson = JSON.stringify(adapterResult.intermediateResults);
    const provenanceJson = JSON.stringify(adapterResult.categoryProvenance || []);
    const metricsJson = JSON.stringify(adapterResult.metrics || null);

    db.prepare(`
      UPDATE tryon_jobs 
      SET provider_job_id = ?, status = ?, result_image_url = ?, error_code = ?, error_message = ?, updated_at = ?,
          selected_categories = ?, processed_categories = ?, unsupported_categories = ?, intermediate_results = ?,
          category_provenance = ?, metrics = ?, retry_count = ?
      WHERE id = ?
    `).run(
      adapterResult.taskId || null,
      adapterResult.status,
      adapterResult.finalImageUrl || null,
      adapterResult.status === "failed" ? "RETRY_ERROR" : null,
      adapterResult.errorMessage || (adapterResult.warnings.length > 0 ? adapterResult.warnings.join(" ") : null),
      now,
      selectedCatsJson,
      processedCatsJson,
      unsupportedCatsJson,
      intermediateJson,
      provenanceJson,
      metricsJson,
      currentRetryCount + 1,
      job.id
    );

    const updatedJob = db.prepare(`
      SELECT tj.*, p.role, p.display_name, p.photo_data
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      WHERE tj.id = ?
    `).get(job.id);

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (error: unknown) {
    console.error("[POST /api/tryon/[jobId]/retry] Error:", error);
    return NextResponse.json({ error: "Failed to retry try-on job." }, { status: 500 });
  }
}
