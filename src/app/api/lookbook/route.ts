import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";


export async function GET() {
  try {
    const db = getDb();
    const looks = db.prepare("SELECT * FROM saved_looks ORDER BY created_at DESC").all();
    return NextResponse.json({ looks });
  } catch (error: unknown) {
    console.error("[GET /api/lookbook] Error:", error);
    return NextResponse.json({ error: "Failed to fetch lookbook." }, { status: 500 });
  }
}
