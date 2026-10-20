import { NextResponse } from "next/server";
import { YouCamService } from "@/lib/youcam";
import sharp from "sharp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, role = "person" } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Image URL or base64 data string is required for segmentation." },
        { status: 400 }
      );
    }

    // Try YouCam AI Salient Object Detection (SOD) first (official hackathon partner API)
    try {
      const cutoutUrl = await YouCamService.removeBackground(
        imageUrl,
        `${role}_cutout.jpg`,
        15
      );

      return NextResponse.json({
        success: true,
        cutoutUrl,
        provider: "YouCam AI Salient Object Detection (SOD)",
        isRealApi: true
      });
    } catch (youcamErr: unknown) {
      const errMsg = youcamErr instanceof Error ? youcamErr.message : String(youcamErr);
      console.warn(`[POST /api/segment] YouCam SOD attempt notice: ${errMsg}. Evaluating fallback.`);

      // Fallback: If image is already transparent or requires server-side fallback
      // Check if image buffer already has an alpha channel with transparency
      let imageBuffer: Buffer;
      if (imageUrl.startsWith("data:")) {
        const base64Data = imageUrl.split(",")[1];
        imageBuffer = Buffer.from(base64Data, "base64");
      } else {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) {
          throw new Error(`Failed to download source image for segmentation: ${fetchRes.statusText}`);
        }
        imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
      }

      const meta = await sharp(imageBuffer).metadata();
      // If already transparent RGBA PNG, pass it through directly
      if (meta.channels === 4 && meta.format === "png") {
        const raw = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });
        let hasTrans = false;
        for (let i = 3; i < raw.data.length; i += 4) {
          if (raw.data[i] < 240) {
            hasTrans = true;
            break;
          }
        }
        if (hasTrans) {
          return NextResponse.json({
            success: true,
            cutoutUrl: imageUrl,
            provider: "Transparent Alpha Passthrough",
            isRealApi: false
          });
        }
      }

      // If YouCam failed and no transparency exists, return the error clearly as requested:
      // "If background removal fails, report the failure rather than silently using the unprocessed image."
      return NextResponse.json(
        {
          error: `Background removal failed: ${errMsg}`,
          provider: "YouCam AI SOD"
        },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/segment] Fatal error:", msg);
    return NextResponse.json(
      { error: `Segmentation error: ${msg}` },
      { status: 500 }
    );
  }
}
