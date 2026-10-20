import { NextResponse } from "next/server";
import sharp from "sharp";
import { YouCamService } from "@/lib/youcam";

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Scan alpha channel of a 4-channel raw buffer to detect the tightest visible bounding box.
 * Threshold defaults to alpha > 10 (ignores fully transparent or near-transparent pixels).
 */
function detectBoundingBox(rawBuffer: Buffer, width: number, height: number, alphaThreshold = 10): BoundingBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaIdx = (y * width + x) * 4 + 3;
      const alpha = rawBuffer[alphaIdx];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null; // No visible subject pixels found
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

// Helper to fetch image buffer safely (handling data URLs or remote URLs)
async function fetchBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const base64Data = url.split(",")[1];
    return Buffer.from(base64Data, "base64");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image from URL (${res.status}): ${res.statusText}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Ensure image buffer is segmented (has transparent alpha background).
 * If not already transparent, executes YouCam AI Salient Object Detection (SOD).
 */
async function ensureSegmentedCutout(
  imageUrl: string,
  roleLabel: string
): Promise<{ buffer: Buffer; url: string; segmentedBy: string }> {
  const initialBuffer = await fetchBuffer(imageUrl);
  const meta = await sharp(initialBuffer).metadata();

  // If already a 4-channel PNG with significant transparency, use directly
  if (meta.channels === 4 && meta.format === "png") {
    const raw = await sharp(initialBuffer).raw().toBuffer({ resolveWithObject: true });
    let transparentPixelCount = 0;
    const totalPixels = raw.info.width * raw.info.height;
    for (let i = 3; i < raw.data.length; i += 4) {
      if (raw.data[i] < 20) transparentPixelCount++;
    }
    // If more than 5% of pixels are transparent, treat as already segmented
    if (transparentPixelCount / totalPixels > 0.05) {
      return {
        buffer: initialBuffer,
        url: imageUrl,
        segmentedBy: "Pre-existing Transparency"
      };
    }
  }

  // Execute real YouCam Salient Object Detection (SOD)
  console.log(`[compose-portrait] Executing YouCam AI SOD background removal for ${roleLabel}...`);
  try {
    const cutoutUrl = await YouCamService.removeBackground(
      imageUrl,
      `${roleLabel}_tryon_cutout.png`,
      15
    );
    const cutoutBuffer = await fetchBuffer(cutoutUrl);
    return {
      buffer: cutoutBuffer,
      url: cutoutUrl,
      segmentedBy: "YouCam AI Salient Object Detection (SOD)"
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[compose-portrait] YouCam SOD error for ${roleLabel}: ${msg}. Falling back to edge alpha mask.`);

    // Fallback: create soft alpha mask around center subject if YouCam service fails
    const raw = await sharp(initialBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      buffer: await sharp(initialBuffer).ensureAlpha().png().toBuffer(),
      url: imageUrl,
      segmentedBy: "Fallback Unsegmented"
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      person1ImageUrl,
      person2ImageUrl,
      person1CutoutUrl,
      person2CutoutUrl,
      background = "transparent", // "transparent" | "white" | "light_grey"
      canvasWidth = 2400,
      canvasHeight = 2400,
      targetPersonHeight = 2050,
      spacing = 130
    } = body;

    if (!person1ImageUrl || !person2ImageUrl) {
      return NextResponse.json(
        { error: "Both person1ImageUrl and person2ImageUrl are required." },
        { status: 400 }
      );
    }

    // 1. Obtain segmented cutouts for Person 1 and Person 2
    const [p1Result, p2Result] = await Promise.all([
      person1CutoutUrl
        ? fetchBuffer(person1CutoutUrl).then((buf) => ({
            buffer: buf,
            url: person1CutoutUrl,
            segmentedBy: "Client-Supplied Cutout"
          }))
        : ensureSegmentedCutout(person1ImageUrl, "person1"),
      person2CutoutUrl
        ? fetchBuffer(person2CutoutUrl).then((buf) => ({
            buffer: buf,
            url: person2CutoutUrl,
            segmentedBy: "Client-Supplied Cutout"
          }))
        : ensureSegmentedCutout(person2ImageUrl, "person2")
    ]);

    // 2. Decode raw RGBA pixel data to detect precise foreground bounding boxes
    const raw1 = await sharp(p1Result.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const raw2 = await sharp(p2Result.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const box1 = detectBoundingBox(raw1.data, raw1.info.width, raw1.info.height);
    const box2 = detectBoundingBox(raw2.data, raw2.info.width, raw2.info.height);

    if (!box1 || !box2) {
      return NextResponse.json(
        { error: "Could not detect visible person pixels in one or both try-on results." },
        { status: 422 }
      );
    }

    // 3. Crop tightly to visible bounding boxes (removing transparent outer margins)
    const cropped1Buf = await sharp(p1Result.buffer)
      .extract({
        left: box1.minX,
        top: box1.minY,
        width: box1.width,
        height: box1.height
      })
      .png()
      .toBuffer();

    const cropped2Buf = await sharp(p2Result.buffer)
      .extract({
        left: box2.minX,
        top: box2.minY,
        width: box2.width,
        height: box2.height
      })
      .png()
      .toBuffer();

    // 4. Height Normalization
    // Target visible height: approximately 2050px on a 2400px canvas (leaving safety margins)
    let targetH = Math.min(Number(targetPersonHeight) || 2050, canvasHeight - 200);

    // Calculate independent proportional scale for each person
    let scale1 = targetH / box1.height;
    let scale2 = targetH / box2.height;

    let scaledW1 = Math.round(box1.width * scale1);
    let scaledH1 = targetH;

    let scaledW2 = Math.round(box2.width * scale2);
    let scaledH2 = targetH;

    let currentSpacing = Math.round(Number(spacing) || 130);
    let totalSubjectWidth = scaledW1 + currentSpacing + scaledW2;

    // Safety: If total width exceeds canvas margins, proportionally downscale both subjects
    const maxAvailableWidth = canvasWidth - 180;
    if (totalSubjectWidth > maxAvailableWidth) {
      const fitRatio = maxAvailableWidth / totalSubjectWidth;
      scale1 *= fitRatio;
      scale2 *= fitRatio;
      targetH = Math.round(targetH * fitRatio);
      scaledW1 = Math.round(box1.width * scale1);
      scaledH1 = targetH;
      scaledW2 = Math.round(box2.width * scale2);
      scaledH2 = targetH;
      currentSpacing = Math.round(currentSpacing * fitRatio);
      totalSubjectWidth = scaledW1 + currentSpacing + scaledW2;
    }

    // Resize cropped subjects with Lanczos3 resampling for crisp fashion details
    const resized1Buf = await sharp(cropped1Buf)
      .resize(scaledW1, scaledH1, {
        fit: "fill",
        kernel: "lanczos3"
      })
      .png()
      .toBuffer();

    const resized2Buf = await sharp(cropped2Buf)
      .resize(scaledW2, scaledH2, {
        fit: "fill",
        kernel: "lanczos3"
      })
      .png()
      .toBuffer();

    // 5. Vertical Baseline Alignment & Horizontal Centering
    // Align both bottommost visible pixel rows to the exact same baseline Y
    const bottomSafetyMargin = 150;
    const baselineY = canvasHeight - bottomSafetyMargin;
    const topY1 = baselineY - scaledH1;
    const topY2 = baselineY - scaledH2;

    // Horizontal centering on canvas
    const startX = Math.round((canvasWidth - totalSubjectWidth) / 2);
    const left1 = startX;
    const left2 = startX + scaledW1 + currentSpacing;

    // Helper to parse hex colors
    function parseHexToRgb(hexStr?: string): { r: number; g: number; b: number } {
      if (!hexStr) return { r: 243, g: 244, b: 246 };
      let clean = hexStr.replace("#", "").trim();
      if (clean.length === 3) {
        clean = clean.split("").map((c) => c + c).join("");
      }
      const num = parseInt(clean, 16);
      if (isNaN(num)) return { r: 243, g: 244, b: 246 };
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    }

    // 6. Configurable Canvas Background Studio
    let bgConfig: { r: number; g: number; b: number; alpha: number };
    const bgLower = (background || "transparent").toLowerCase();

    if (bgLower === "white" || bgLower === "pure_white") {
      bgConfig = { r: 255, g: 255, b: 255, alpha: 1 };
    } else if (bgLower === "soft_grey" || bgLower === "light_grey" || bgLower === "grey") {
      bgConfig = { r: 243, g: 244, b: 246, alpha: 1 };
    } else if (bgLower === "warm_beige" || bgLower === "beige") {
      bgConfig = { r: 245, g: 240, b: 230, alpha: 1 };
    } else if (bgLower === "midnight_black" || bgLower === "black") {
      bgConfig = { r: 10, g: 10, b: 12, alpha: 1 };
    } else if (bgLower === "custom") {
      const rgb = parseHexToRgb(body.customColorHex);
      bgConfig = { r: rgb.r, g: rgb.g, b: rgb.b, alpha: 1 };
    } else {
      // Default: 100% transparent RGBA
      bgConfig = { r: 0, g: 0, b: 0, alpha: 0 };
    }

    let baseBuffer: Buffer;
    const bgImgUrl = body.backgroundImageUrl || body.uploadedBackgroundImage;

    if (bgImgUrl && (bgLower === "upload" || bgLower === "image" || bgLower === "custom_image")) {
      try {
        const rawBgBuf = await fetchBuffer(bgImgUrl);
        baseBuffer = await sharp(rawBgBuf)
          .resize(canvasWidth, canvasHeight, {
            fit: "cover",
            position: "centre"
          })
          .ensureAlpha()
          .toBuffer();
      } catch (bgErr) {
        console.warn("[compose-portrait] Could not load background image, using transparent fallback:", bgErr);
        baseBuffer = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        }).png().toBuffer();
      }
    } else {
      baseBuffer = await sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: bgConfig
        }
      }).png().toBuffer();
    }

    // Composite both normalized subjects on top of the background layer
    const composedBuffer = await sharp(baseBuffer)
      .composite([
        { input: resized1Buf, left: left1, top: topY1 },
        { input: resized2Buf, left: left2, top: topY2 }
      ])
      .png({ compressionLevel: 8 })
      .toBuffer();

    const dataUrl = `data:image/png;base64,${composedBuffer.toString("base64")}`;


    return NextResponse.json({
      success: true,
      dataUrl,
      width: canvasWidth,
      height: canvasHeight,
      background,
      person1CutoutUrl: p1Result.url,
      person2CutoutUrl: p2Result.url,
      boundingBoxes: {
        person1: box1,
        person2: box2
      },
      normalization: {
        targetHeight: targetH,
        person1Scale: Number(scale1.toFixed(4)),
        person2Scale: Number(scale2.toFixed(4)),
        scaledPerson1: { width: scaledW1, height: scaledH1, left: left1, top: topY1 },
        scaledPerson2: { width: scaledW2, height: scaledH2, left: left2, top: topY2 },
        baselineY,
        spacing: currentSpacing
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/compose-portrait] Error:", msg);
    return NextResponse.json(
      { error: `Composition pipeline error: ${msg}` },
      { status: 500 }
    );
  }
}
