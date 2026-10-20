import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { participantId, role, photoData, action } = body;

    const db = getDb();

    // Check if handling the optional Reference Couple Photo
    if (role === "reference") {
      if (action === "remove" || !photoData) {
        db.prepare("UPDATE sessions SET reference_photo_data = NULL WHERE id = ?").run(sessionId);
        return NextResponse.json({
          success: true,
          message: "Reference photo removed successfully."
        });
      }

      // Validate image format
      if (typeof photoData !== "string" || (!photoData.startsWith("data:image/") && !photoData.startsWith("http"))) {
        return NextResponse.json({ error: "Invalid image format. Expected PNG, JPEG or WebP image." }, { status: 400 });
      }

      // Validate size limit (approx 10MB base64)
      if (photoData.length > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "Image file exceeds maximum limit of 10MB." }, { status: 400 });
      }

      db.prepare("UPDATE sessions SET reference_photo_data = ? WHERE id = ?").run(photoData, sessionId);
      return NextResponse.json({
        success: true,
        message: "Reference couple photo uploaded and saved successfully."
      });
    }

    if (!photoData) {
      return NextResponse.json({ error: "No photo data provided." }, { status: 400 });
    }

    if (!participantId && !role) {
      return NextResponse.json({ error: "Participant ID or role ('person1' | 'person2') required." }, { status: 400 });
    }

    // Validate image format: base64 data URL or HTTP URL
    if (typeof photoData !== "string" || (!photoData.startsWith("data:image/") && !photoData.startsWith("http"))) {
      return NextResponse.json({ error: "Invalid image format. Expected PNG, JPEG or WebP image." }, { status: 400 });
    }

    // Validate size limit (approx 10MB base64)
    if (photoData.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Image file exceeds maximum limit of 10MB." }, { status: 400 });
    }

    // Verify participant belongs to this session
    let participant;
    if (participantId) {
      participant = db.prepare("SELECT * FROM participants WHERE id = ? AND session_id = ?").get(participantId, sessionId);
    } else {
      participant = db.prepare("SELECT * FROM participants WHERE role = ? AND session_id = ?").get(role, sessionId);
    }

    if (!participant) {
      return NextResponse.json({ error: "Participant not found in this session." }, { status: 404 });
    }

    // Update participant photo
    const targetId = (participant as { id: string }).id;
    db.prepare("UPDATE participants SET photo_data = ? WHERE id = ?").run(photoData, targetId);

    // If an existing try-on job exists for this participant, invalidate it as required by Phase 9
    db.prepare("DELETE FROM tryon_jobs WHERE participant_id = ? AND session_id = ?").run(targetId, sessionId);
    db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(sessionId);

    return NextResponse.json({
      success: true,
      participantId: targetId,
      message: "Photo uploaded and associated successfully."
    });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/photos] Error:", error);
    return NextResponse.json({ error: "Failed to upload photo." }, { status: 500 });
  }
}
