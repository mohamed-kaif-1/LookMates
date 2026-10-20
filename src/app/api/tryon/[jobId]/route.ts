import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { YouCamService } from "@/lib/youcam";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const db = getDb();

    const job = db.prepare(`
      SELECT tj.*, p.role, p.display_name, p.photo_data,
             g.name as garment_name, g.image_url as garment_image, g.category as garment_category
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      JOIN garments g ON tj.garment_id = g.id
      WHERE tj.id = ?
    `).get(jobId) as {
      id: string;
      session_id: string;
      provider_job_id: string;
      status: string;
      result_image_url: string;
      garment_image: string;
    } | undefined;

    if (!job) {
      return NextResponse.json({ error: "Try-on job not found." }, { status: 404 });
    }

    // If still in processing/submitting state, poll YouCam
    if (job.status === "processing" || job.status === "submitting" || job.status === "queued") {
      const pollResult = await YouCamService.pollClothTask(
        job.provider_job_id,
        job.garment_image // used for fallback preview if mock
      );

      if (pollResult.status !== job.status || pollResult.resultImageUrl !== job.result_image_url) {
        db.prepare(`
          UPDATE tryon_jobs 
          SET status = ?, result_image_url = ?, error_code = ?, error_message = ?, updated_at = ?
          WHERE id = ?
        `).run(
          pollResult.status,
          pollResult.resultImageUrl || null,
          pollResult.errorCode || null,
          pollResult.errorMessage || null,
          new Date().toISOString(),
          job.id
        );

        // Update local object
        job.status = pollResult.status;
        job.result_image_url = pollResult.resultImageUrl || "";
      }
    }

    return NextResponse.json({ job });
  } catch (error: unknown) {
    console.error("[GET /api/tryon/[jobId]] Error:", error);
    return NextResponse.json({ error: "Failed to poll job status." }, { status: 500 });
  }
}
