import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { YouCamService } from "@/lib/youcam";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const db = getDb();

    const job = db.prepare(`
      SELECT tj.*, p.photo_data, g.image_url, g.category
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      JOIN garments g ON tj.garment_id = g.id
      WHERE tj.id = ?
    `).get(jobId) as {
      id: string;
      session_id: string;
      participant_id: string;
      garment_id: string;
      photo_data: string;
      image_url: string;
      category: string;
    } | undefined;

    if (!job) {
      return NextResponse.json({ error: "Try-on job not found." }, { status: 404 });
    }

    // Map category to YouCam official snake_case category
    const clothCategory = YouCamService.mapGarmentCategory(job.category);

    // Resubmit to YouCam
    const youCamResult = await YouCamService.submitClothTask({
      userPhotoUrl: job.photo_data,
      garmentPhotoUrl: job.image_url,
      garmentCategory: clothCategory
    });

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE tryon_jobs 
      SET provider_job_id = ?, status = ?, result_image_url = ?, error_code = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `).run(
      youCamResult.taskId || null,
      youCamResult.status,
      youCamResult.resultImageUrl || null,
      youCamResult.errorCode || null,
      youCamResult.errorMessage || null,
      now,
      job.id
    );

    const updatedJob = db.prepare(`
      SELECT tj.*, p.role, p.display_name, g.name as garment_name, g.image_url as garment_image, g.category as garment_category
      FROM tryon_jobs tj
      JOIN participants p ON tj.participant_id = p.id
      JOIN garments g ON tj.garment_id = g.id
      WHERE tj.id = ?
    `).get(job.id);

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (error: unknown) {
    console.error("[POST /api/tryon/[jobId]/retry] Error:", error);
    return NextResponse.json({ error: "Failed to retry try-on job." }, { status: 500 });
  }
}
