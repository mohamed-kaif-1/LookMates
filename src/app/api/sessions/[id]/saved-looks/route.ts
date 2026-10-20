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
    const { title, occasion, garmentNames, person1Image, person2Image, coupleImage } = body;

    if (!coupleImage) {
      return NextResponse.json({ error: "coupleImage is required." }, { status: 400 });
    }

    const db = getDb();
    const lookId = `look_${uuidv4().substring(0, 10)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO saved_looks (
        id, session_id, title, occasion, garment_names,
        person1_image, person2_image, couple_image, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lookId,
      sessionId,
      title || "Coordinated Couple Look",
      occasion || "Special Occasion",
      garmentNames || "Coordinated Outfits",
      person1Image || null,
      person2Image || null,
      coupleImage,
      now,
      now
    );

    const savedLook = db.prepare("SELECT * FROM saved_looks WHERE id = ?").get(lookId);
    return NextResponse.json({ success: true, savedLook });
  } catch (error: unknown) {
    console.error("[POST /api/sessions/[id]/saved-looks] Error:", error);
    return NextResponse.json({ error: "Failed to save look to Lookbook." }, { status: 500 });
  }
}
