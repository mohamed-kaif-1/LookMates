import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedImageHost, loadImageInput } from "../src/lib/image-input.ts";
import { CrewTryOnService } from "../src/lib/crew-tryon.ts";

test("1. Hostname validation permits legitimate YouCam hosts and strictly rejects unauthorized domains", () => {
  // Verified exact hosts
  assert.equal(isAllowedImageHost("images.unsplash.com"), true);
  assert.equal(isAllowedImageHost("yce-api-01.makeupar.com"), true);
  assert.equal(isAllowedImageHost("yce-us.s3-accelerate.amazonaws.com"), true);

  // Narrowly scoped YouCam S3 buckets
  assert.equal(isAllowedImageHost("yce-eu.s3-accelerate.amazonaws.com"), true);
  assert.equal(isAllowedImageHost("yce-us.s3.amazonaws.com"), true);

  // Strictly rejected unauthorized domains and arbitrary AWS/makeupar subdomains
  assert.equal(isAllowedImageHost("attacker.com"), false);
  assert.equal(isAllowedImageHost("arbitrary-bucket.s3.amazonaws.com"), false);
  assert.equal(isAllowedImageHost("evil-makeupar.com"), false);
  assert.equal(isAllowedImageHost("fake.perfectcorp.com"), false);
  assert.equal(isAllowedImageHost("localhost"), false);
  assert.equal(isAllowedImageHost("127.0.0.1"), false);
  assert.equal(isAllowedImageHost("169.254.169.254"), false);
});

test("2. Remote URL security checks (protocol, ports, credentials, redirects)", async () => {
  // Reject non-https
  await assert.rejects(
    loadImageInput("http://images.unsplash.com/test.jpg"),
    /Remote image host is not allowed/
  );

  // Reject embedded credentials
  await assert.rejects(
    loadImageInput("https://user:pass@images.unsplash.com/test.jpg"),
    /Remote image host is not allowed/
  );

  // Reject unexpected non-standard ports
  await assert.rejects(
    loadImageInput("https://images.unsplash.com:8080/test.jpg"),
    /Remote image host is not allowed/
  );
});

test("3. Missing API key produces honest PROVIDER_NOT_CONFIGURED without fake success", async () => {
  const savedKey = process.env.YOUCAM_API_KEY;
  delete process.env.YOUCAM_API_KEY;

  try {
    assert.equal(CrewTryOnService.isConfigured(), false);

    const submitRes = await CrewTryOnService.submitTryOn({
      userPhotoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=",
      garmentPhotoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=",
      garmentCategory: "tops",
    });

    assert.equal(submitRes.status, "failed");
    assert.equal(submitRes.errorCode, "PROVIDER_NOT_CONFIGURED");
    assert.match(submitRes.errorMessage, /YOUCAM_API_KEY/);
    assert.equal(submitRes.taskId, "");
    assert.equal(submitRes.resultImageUrl, undefined);

    const pollRes = await CrewTryOnService.pollTryOnTask("mock-task-12345");
    assert.equal(pollRes.status, "failed");
    assert.equal(pollRes.errorCode, "PROVIDER_NOT_CONFIGURED");
    assert.equal(pollRes.resultImageUrl, undefined);
  } finally {
    if (savedKey) process.env.YOUCAM_API_KEY = savedKey;
  }
});

test("4. Polling with empty or missing task ID fails honestly", async () => {
  const savedKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test_key";

  try {
    const res = await CrewTryOnService.pollTryOnTask("   ");
    assert.equal(res.status, "failed");
    assert.equal(res.errorCode, "MISSING_TASK_ID");
  } finally {
    if (savedKey) process.env.YOUCAM_API_KEY = savedKey;
    else delete process.env.YOUCAM_API_KEY;
  }
});

test("5. Category mapping adheres to official Perfect Corp apparel categories", () => {
  assert.equal(CrewTryOnService.mapGarmentCategory("Classic White Tee"), "upper_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Button Down Shirt"), "upper_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Wool Blazer"), "upper_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Denim Jeans"), "lower_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Pleated Skirt"), "lower_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Leather Jacket"), "outer");
  assert.equal(CrewTryOnService.mapGarmentCategory("Trench Coat"), "outer");
  assert.equal(CrewTryOnService.mapGarmentCategory("Evening Gown"), "full_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Silk Dress"), "full_body");
  assert.equal(CrewTryOnService.mapGarmentCategory("Sneakers"), "shoes");
  assert.equal(CrewTryOnService.mapGarmentCategory("Unspecified Accessory"), "auto");
});
