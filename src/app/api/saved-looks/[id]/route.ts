import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db.prepare("SELECT id FROM saved_looks WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json({ error: "Look not found." }, { status: 404 });
    }

    db.prepare("DELETE FROM saved_looks WHERE id = ?").run(id);
    return NextResponse.json({ success: true, message: "Look deleted successfully." });
  } catch (error: unknown) {
    console.error("[DELETE /api/saved-looks/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to delete look." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || title.trim() === "") {
      return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM saved_looks WHERE id = ?").get(id);
    if (!existing) {
      return NextResponse.json({ error: "Look not found." }, { status: 404 });
    }

    db.prepare("UPDATE saved_looks SET title = ?, updated_at = ? WHERE id = ?").run(
      title.trim(),
      new Date().toISOString(),
      id
    );

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (error: unknown) {
    console.error("[PATCH /api/saved-looks/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to rename look." }, { status: 500 });
  }
}
