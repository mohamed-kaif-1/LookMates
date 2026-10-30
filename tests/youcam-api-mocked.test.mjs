import test from "node:test";
import assert from "node:assert/strict";
import { CrewTryOnService } from "../src/lib/crew-tryon.ts";

test("6. File API parses documented nested files array and handles binary PUT upload without forwarding Bearer token", async () => {
  const originalFetch = globalThis.fetch;
  let fileApiBody = null;
  let uploadMethodUsed = null;
  let uploadUrlUsed = null;
  let uploadHeaders = null;

  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.endsWith("/s2s/v2.0/file")) {
      fileApiBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          status: 200,
          data: {
            files: [
              {
                content_type: "image/png",
                file_name: "test.png",
                file_id: "official_file_id_xyz123",
                requests: [
                  {
                    method: "PUT",
                    url: "https://yce-us.s3-accelerate.amazonaws.com/upload-slot-test",
                  },
                ],
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (urlStr.includes("upload-slot-test")) {
      uploadMethodUsed = options.method;
      uploadUrlUsed = urlStr;
      uploadHeaders = options.headers;
      return new Response("", { status: 200 });
    }

    return originalFetch(url, options);
  };

  try {
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=";
    const fileId = await CrewTryOnService.uploadImageToFileApi(onePixelPng, "secret_bearer_key", "https://yce-api-01.makeupar.com");

    assert.equal(fileId, "official_file_id_xyz123");
    assert.ok(fileApiBody.files && Array.isArray(fileApiBody.files));
    assert.equal(fileApiBody.files[0].content_type, "image/png");
    assert.ok(fileApiBody.files[0].file_size > 0);
    assert.equal(uploadMethodUsed, "PUT");
    assert.equal(uploadUrlUsed, "https://yce-us.s3-accelerate.amazonaws.com/upload-slot-test");

    // Strictly verify Bearer token is NOT forwarded to S3 storage host
    assert.equal(uploadHeaders["Authorization"], undefined);
    assert.equal(uploadHeaders["authorization"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("7. File API rejects response when file_id or upload URL is missing, malformed, or untrusted", async () => {
  const originalFetch = globalThis.fetch;

  // Missing file_id
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        status: 200,
        data: { files: [{ requests: [{ method: "PUT", url: "https://yce-us.s3-accelerate.amazonaws.com/valid" }] }] },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=";
    await assert.rejects(
      CrewTryOnService.uploadImageToFileApi(onePixelPng, "key", "https://api.test"),
      /did not include a valid file_id/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Non-HTTPS upload URL
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        status: 200,
        data: { files: [{ file_id: "id_123", requests: [{ method: "PUT", url: "http://insecure.com/slot" }] }] },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=";
    await assert.rejects(
      CrewTryOnService.uploadImageToFileApi(onePixelPng, "key", "https://api.test"),
      /not an allowed HTTPS host|did not include a valid upload URL/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Untrusted storage host
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        status: 200,
        data: { files: [{ file_id: "id_123", requests: [{ method: "PUT", url: "https://attacker-controlled-host.com/slot" }] }] },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=";
    await assert.rejects(
      CrewTryOnService.uploadImageToFileApi(onePixelPng, "key", "https://api.test"),
      /not an allowed HTTPS host/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("8. Task submission transmits documented fields src_file_id, ref_file_id, and garment_category", async () => {
  const originalFetch = globalThis.fetch;
  let taskRequestBody = null;

  globalThis.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.endsWith("/s2s/v2.0/file")) {
      return new Response(
        JSON.stringify({
          data: {
            files: [
              {
                file_id: urlStr.includes("mock") ? "file_mock" : "file_12345",
                requests: [{ method: "PUT", url: "https://yce-us.s3-accelerate.amazonaws.com/test" }],
              },
            ],
          },
        }),
        { status: 200 }
      );
    }

    if (urlStr.includes("amazonaws.com/test")) {
      return new Response("", { status: 200 });
    }

    if (urlStr.endsWith("/s2s/v2.0/task/cloth")) {
      taskRequestBody = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          data: { task_id: "cloth_task_live_999" },
        }),
        { status: 200 }
      );
    }

    return originalFetch(url, options);
  };

  const savedKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "live_key_placeholder";

  try {
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WioAAAAASUVORK5CYII=";
    const result = await CrewTryOnService.submitTryOn({
      userPhotoUrl: onePixelPng,
      garmentPhotoUrl: onePixelPng,
      garmentCategory: "Silk Evening Gown",
    });

    assert.equal(result.status, "processing");
    assert.equal(result.taskId, "cloth_task_live_999");

    // Strictly verify documented fields
    assert.equal(typeof taskRequestBody.src_file_id, "string");
    assert.equal(typeof taskRequestBody.ref_file_id, "string");
    assert.equal(taskRequestBody.garment_category, "full_body");

    // Strictly verify NO undocumented legacy fields
    assert.equal(taskRequestBody.file_id_src, undefined);
    assert.equal(taskRequestBody.file_id_ref, undefined);
    assert.equal(taskRequestBody.cloth_category, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedKey) process.env.YOUCAM_API_KEY = savedKey;
    else delete process.env.YOUCAM_API_KEY;
  }
});

test("9. Polling handles terminal success, unpermitted host rejection, and error states honestly", async () => {
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "live_key";

  // Case A: Success state with allowed host
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        data: {
          task_status: "success",
          results: {
            url: "https://yce-us.s3-accelerate.amazonaws.com/demo/ttl30/result_gen_123.jpg",
          },
        },
      }),
      { status: 200 }
    );
  };

  try {
    const pollSuccess = await CrewTryOnService.pollTryOnTask("task_123");
    assert.equal(pollSuccess.status, "succeeded");
    assert.equal(pollSuccess.resultImageUrl, "https://yce-us.s3-accelerate.amazonaws.com/demo/ttl30/result_gen_123.jpg");
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Case B: Success state with unpermitted host
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        data: {
          task_status: "success",
          results: {
            url: "https://malicious-image-server.com/fake_result.jpg",
          },
        },
      }),
      { status: 200 }
    );
  };

  try {
    const pollUntrusted = await CrewTryOnService.pollTryOnTask("task_123");
    assert.equal(pollUntrusted.status, "failed");
    assert.equal(pollUntrusted.errorCode, "UNTRUSTED_RESULT_HOST");
    assert.equal(pollUntrusted.resultImageUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Case C: Error state
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        data: {
          task_status: "error",
          error_code: "BODY_NOT_DETECTED",
          error_message: "Full body was not clearly visible in the input image.",
        },
      }),
      { status: 200 }
    );
  };

  try {
    const pollError = await CrewTryOnService.pollTryOnTask("task_123");
    assert.equal(pollError.status, "failed");
    assert.equal(pollError.errorCode, "BODY_NOT_DETECTED");
    assert.equal(pollError.errorMessage, "Full body was not clearly visible in the input image.");
    assert.equal(pollError.resultImageUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedKey) process.env.YOUCAM_API_KEY = savedKey;
    else delete process.env.YOUCAM_API_KEY;
  }
});
