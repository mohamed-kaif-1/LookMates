import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Validate safe URL protocol
    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "LookMates/1.0"
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.statusText}` }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (error: unknown) {
    console.error("[GET /api/proxy-image] Error:", error);
    return NextResponse.json({ error: "Failed to proxy image." }, { status: 500 });
  }
}
