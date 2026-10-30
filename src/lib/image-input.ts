const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Exact verified provider hostnames
const VERIFIED_EXACT_HOSTS = new Set([
  "images.unsplash.com",
  "yce-api-01.makeupar.com",
  "yce-us.s3-accelerate.amazonaws.com",
]);

// Narrowly scoped pattern for YouCam AWS S3 result buckets (e.g., yce-us.s3-accelerate.amazonaws.com)
// Enforces boundary check and only matches official yce- prefixed S3 buckets
const YOUCAM_S3_BUCKET_PATTERN = /^yce-[a-z0-9-]+\.s3(?:-accelerate)?\.amazonaws\.com$/;

export function isAllowedImageHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (VERIFIED_EXACT_HOSTS.has(lower)) {
    return true;
  }
  if (YOUCAM_S3_BUCKET_PATTERN.test(lower)) {
    return true;
  }
  const configuredHosts = process.env.YOUCAM_IMAGE_HOSTS?.split(",") ?? [];
  for (const host of configuredHosts) {
    const trimmed = host.trim().toLowerCase();
    if (trimmed && lower === trimmed) {
      return true;
    }
  }
  return false;
}

function decodeImageDataUri(input: string): { buffer: Buffer; contentType: string } {
  const match = input.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) {
    throw new Error("Image must be a base64 JPEG, PNG, or WebP data URI.");
  }

  const contentType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Image must be between 1 byte and 10 MB.");
  }
  validateImageSignature(buffer, contentType);
  return { buffer, contentType };
}

function validateImageSignature(buffer: Buffer, contentType: string): void {
  const valid =
    (contentType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (contentType === "image/png" && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) ||
    (contentType === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP");
  if (!valid) {
    throw new Error("Image content does not match its declared file type.");
  }
}

export async function loadImageInput(input: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (input.startsWith("data:")) {
    return decodeImageDataUri(input);
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(input);
  } catch {
    throw new Error("Image URL is invalid.");
  }

  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.username ||
    imageUrl.password ||
    (imageUrl.port && imageUrl.port !== "443") ||
    !isAllowedImageHost(imageUrl.hostname)
  ) {
    throw new Error("Remote image host is not allowed. Upload the image or configure its trusted HTTPS host.");
  }

  const response = await fetch(imageUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}.`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Remote resource is not a supported image.");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 10 MB limit.");
  }

  if (!response.body) {
    throw new Error("Image response did not include a body.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Image exceeds the 10 MB limit.");
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks);
  validateImageSignature(buffer, contentType);
  return { buffer, contentType };
}
