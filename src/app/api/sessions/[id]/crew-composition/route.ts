import { NextResponse } from "next/server";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { loadImageInput } from "@/lib/image-input";
import { v4 as uuidv4 } from "uuid";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id.startsWith("crew_")) {
      return NextResponse.json({ error: "Crew session required." }, { status: 400 });
    }

    const db = getDb();
    const people = db.prepare(`
      SELECT p.id, p.display_name, tj.id AS job_id, tj.result_image_url, tj.status, tj.garment_id,
        (SELECT ga.garment_id FROM garment_assignments ga WHERE ga.participant_id = p.id AND ga.session_id = p.session_id ORDER BY ga.created_at DESC LIMIT 1) AS current_garment
      FROM participants p
      LEFT JOIN tryon_jobs tj ON tj.participant_id = p.id AND tj.session_id = p.session_id
      WHERE p.session_id = ?
      ORDER BY p.created_at, p.id
    `).all(id) as Array<{
      id: string;
      display_name: string;
      job_id: string | null;
      result_image_url: string | null;
      status: string | null;
      garment_id: string | null;
      current_garment: string | null;
    }>;

    if (people.length < 3 || people.length > 8) {
      return NextResponse.json({ error: "A group composition needs three to eight participants." }, { status: 400 });
    }

    const valid = people.filter((p) => p.status === "succeeded" && p.result_image_url && p.garment_id === p.current_garment);
    if (valid.length !== people.length) {
      return NextResponse.json(
        { error: "Every participant needs a successful virtual try-on result for their currently assigned garment before composing the group." },
        { status: 409 }
      );
    }

    const columns = Math.min(people.length, people.length <= 4 ? people.length : 4);
    const rows = Math.ceil(people.length / columns);
    const cellW = 600;
    const cellH = 800;
    const gap = 24;
    const pad = 36;
    const width = columns * cellW + (columns - 1) * gap + pad * 2;
    const height = rows * cellH + (rows - 1) * gap + pad * 2;

    const layers = [];
    for (let i = 0; i < valid.length; i++) {
      const { buffer: input } = await loadImageInput(valid[i].result_image_url!);
      const tile = await sharp(input)
        .rotate()
        .resize(cellW, cellH, { fit: "contain", background: "#f0f4f8" })
        .png()
        .toBuffer();

      const col = i % columns;
      const row = Math.floor(i / columns);
      layers.push({
        input: tile,
        left: pad + col * (cellW + gap),
        top: pad + row * (cellH + gap),
      });
    }

    const out = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "#080b10",
      },
    })
      .composite(layers)
      .png()
      .toBuffer();

    const dataUrl = `data:image/png;base64,${out.toString("base64")}`;
    db.prepare("DELETE FROM couple_compositions WHERE session_id = ?").run(id);
    db.prepare(`
      INSERT INTO couple_compositions (id, session_id, image_data, status, created_at)
      VALUES (?, ?, ?, 'completed', ?)
    `).run(`crewcomp_${uuidv4().slice(0, 12)}`, id, dataUrl, new Date().toISOString());

    return NextResponse.json({ success: true, dataUrl, participantCount: people.length });
  } catch (error) {
    console.error("[POST crew-composition]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not compose the group preview." },
      { status: 422 }
    );
  }
}
