import assert from "node:assert/strict";
import { test } from "node:test";
const { loadImageInput } = await import("../src/lib/image-input.ts");

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=";

test("accepts a valid, supported image data URI", async () => {
  const image = await loadImageInput(onePixelPng);

  assert.equal(image.contentType, "image/png");
  assert.ok(image.buffer.length > 0);
});

test("rejects image content that does not match its MIME type", async () => {
  await assert.rejects(
    loadImageInput("data:image/png;base64,SGVsbG8="),
    /Image content does not match its declared file type/
  );
});

test("rejects untrusted and non-HTTPS remote image URLs", async () => {
  await assert.rejects(
    loadImageInput("https://127.0.0.1/private.png"),
    /Remote image host is not allowed/
  );
  await assert.rejects(
    loadImageInput("http://images.unsplash.com/photo.png"),
    /Remote image host is not allowed/
  );
});
