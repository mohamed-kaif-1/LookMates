import { isAllowedImageHost, loadImageInput } from "./image-input.ts";

export type CrewTryOnCategory = "upper_body" | "lower_body" | "full_body" | "shoes" | "outer" | "auto";

export interface CrewTryOnResult {
  taskId: string;
  status: "queued" | "submitting" | "processing" | "succeeded" | "failed";
  resultImageUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class CrewTryOnService {
  private static getApiKey(): string | undefined {
    return process.env.YOUCAM_API_KEY;
  }

  private static getBaseUrl(): string {
    return (process.env.YOUCAM_API_BASE_URL || "https://yce-api-01.makeupar.com").replace(/\/$/, "");
  }

  public static isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim());
  }

  public static mapGarmentCategory(cat: string): CrewTryOnCategory {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("top") || lower.includes("shirt") || lower.includes("tee") || lower.includes("blazer") || lower.includes("hoodie")) {
      return "upper_body";
    }
    if (lower.includes("bottom") || lower.includes("pant") || lower.includes("jean") || lower.includes("short") || lower.includes("skirt") || lower.includes("trouser")) {
      return "lower_body";
    }
    if (lower.includes("jacket") || lower.includes("coat") || lower.includes("outer") || lower.includes("overcoat") || lower.includes("cardigan")) {
      return "outer";
    }
    if (lower.includes("dress") || lower.includes("suit") || lower.includes("gown") || lower.includes("jumpsuit") || lower.includes("overall")) {
      return "full_body";
    }
    if (lower.includes("shoe") || lower.includes("sneaker") || lower.includes("boot") || lower.includes("heel") || lower.includes("sandal")) {
      return "shoes";
    }
    return "auto";
  }

  /**
   * Upload an image to Perfect Corp storage via the File API (POST /s2s/v2.0/file)
   * Request format: { files: [{ content_type, file_name, file_size }] }
   * Response format: { data: { files: [{ file_id, requests: [{ url, method }] }] } }
   * The Bearer token is strictly kept server-side and never forwarded to image-storage hosts.
   */
  public static async uploadImageToFileApi(imageInput: string, apiKey: string, baseUrl: string): Promise<string> {
    const { buffer, contentType } = await loadImageInput(imageInput);
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const fileName = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const initRes = await fetch(`${baseUrl}/s2s/v2.0/file`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [
          {
            content_type: contentType,
            file_name: fileName,
            file_size: buffer.length,
          },
        ],
      }),
    });

    if (!initRes.ok) {
      let errDetail = "";
      try {
        const errJson = await initRes.json();
        errDetail = errJson.message || errJson.error || "";
      } catch {
        // Fallback to text status if not JSON
      }
      throw new Error(`YouCam File API initialization failed (HTTP ${initRes.status}${errDetail ? `: ${errDetail}` : ""}).`);
    }

    const initData = await initRes.json();
    const fileEntry = Array.isArray(initData?.data?.files) ? initData.data.files[0] : undefined;
    const requestEntry = Array.isArray(fileEntry?.requests) ? fileEntry.requests[0] : undefined;

    // Resolve file_id: documented nested structure, with fallback
    const fileId = fileEntry?.file_id || (typeof initData?.data?.file_id === "string" ? initData.data.file_id : undefined);

    // Resolve upload URL and method: documented nested requests array, with fallback
    const uploadUrl = requestEntry?.url || (typeof initData?.data?.upload_url === "string" ? initData.data.upload_url : undefined);
    const uploadMethod = (requestEntry?.method || initData?.data?.upload_method || "PUT").toUpperCase();

    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
      throw new Error("YouCam File API response did not include a valid file_id.");
    }
    if (!uploadUrl || typeof uploadUrl !== "string") {
      throw new Error("YouCam File API response did not include a valid upload URL.");
    }

    let parsedUploadUrl: URL;
    try {
      parsedUploadUrl = new URL(uploadUrl);
    } catch {
      throw new Error("YouCam File API response included an invalid upload URL.");
    }

    if (
      parsedUploadUrl.protocol !== "https:" ||
      parsedUploadUrl.username ||
      parsedUploadUrl.password ||
      (parsedUploadUrl.port && parsedUploadUrl.port !== "443") ||
      !isAllowedImageHost(parsedUploadUrl.hostname)
    ) {
      throw new Error("YouCam File API upload destination is not an allowed HTTPS host.");
    }

    // Binary PUT directly to the pre-signed storage URL: DO NOT send Bearer token to storage host
    const putRes = await fetch(uploadUrl, {
      method: uploadMethod,
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
      },
      body: new Uint8Array(buffer),
    });

    if (!putRes.ok) {
      throw new Error(`Uploading image bytes to YouCam storage failed (HTTP ${putRes.status}).`);
    }

    return fileId;
  }

  /**
   * Submit an AI Clothes virtual try-on task via POST /s2s/v2.0/task/cloth
   * Uses only the documented schema fields: src_file_id, ref_file_id, garment_category.
   */
  public static async submitTryOn(input: {
    userPhotoUrl: string;
    garmentPhotoUrl: string;
    garmentCategory: string;
  }): Promise<CrewTryOnResult> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    if (!apiKey) {
      return {
        taskId: "",
        status: "failed",
        errorCode: "PROVIDER_NOT_CONFIGURED",
        errorMessage: "Virtual try-on requires YOUCAM_API_KEY to be configured in .env.local. Set YOUCAM_API_KEY and YOUCAM_API_BASE_URL to generate real try-ons.",
      };
    }

    try {
      const garmentCategory = this.mapGarmentCategory(input.garmentCategory);
      const [srcFileId, refFileId] = await Promise.all([
        this.uploadImageToFileApi(input.userPhotoUrl, apiKey, baseUrl),
        this.uploadImageToFileApi(input.garmentPhotoUrl, apiKey, baseUrl),
      ]);

      const endpoint = `${baseUrl}/s2s/v2.0/task/cloth`;
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          src_file_id: srcFileId,
          ref_file_id: refFileId,
          garment_category: garmentCategory,
        }),
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.message || errData.error || errMessage;
        } catch {
          // ignore json parse error
        }
        return {
          taskId: "",
          status: "failed",
          errorCode: `HTTP_${response.status}`,
          errorMessage: `YouCam Clothes API rejected task (${errMessage}).`,
        };
      }

      const resData = await response.json();
      const taskId = resData.data?.task_id || resData.task_id;

      if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
        return {
          taskId: "",
          status: "failed",
          errorCode: "NO_TASK_ID",
          errorMessage: "YouCam response did not include a valid task_id.",
        };
      }

      return {
        taskId,
        status: "processing",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        taskId: "",
        status: "failed",
        errorCode: "SUBMISSION_ERROR",
        errorMessage: msg,
      };
    }
  }

  /**
   * Poll status of an apparel try-on task via GET /s2s/v2.0/task/cloth/{taskId}
   * Terminal statuses:
   * - "success": returns result image URL from data.results.url
   * - "error" | "failed": returns provider error code and message
   * In-progress statuses: "running", "processing", "pending", "queued"
   */
  public static async pollTryOnTask(taskId: string): Promise<CrewTryOnResult> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    if (!apiKey) {
      return {
        taskId,
        status: "failed",
        errorCode: "PROVIDER_NOT_CONFIGURED",
        errorMessage: "Virtual try-on is unavailable because YOUCAM_API_KEY is not configured.",
      };
    }

    if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
      return {
        taskId,
        status: "failed",
        errorCode: "MISSING_TASK_ID",
        errorMessage: "Cannot poll try-on status without a valid provider task ID.",
      };
    }

    try {
      const endpoint = `${baseUrl}/s2s/v2.0/task/cloth/${encodeURIComponent(taskId)}`;
      const response = await fetch(endpoint, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          taskId,
          status: "failed",
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Polling task failed with HTTP ${response.status}.`,
        };
      }

      const data = await response.json();
      const taskData = data.data || data;
      const rawStatus = (taskData.task_status || taskData.status || "").toLowerCase();

      if (rawStatus === "success" || rawStatus === "succeeded" || rawStatus === "done") {
        const resultUrl = taskData.results?.url || taskData.result_url || taskData.image_url;
        if (!resultUrl || typeof resultUrl !== "string") {
          return {
            taskId,
            status: "failed",
            errorCode: "NO_RESULT_URL",
            errorMessage: "YouCam task succeeded but did not return a valid result URL.",
          };
        }

        let parsedResultUrl: URL;
        try {
          parsedResultUrl = new URL(resultUrl);
        } catch {
          return {
            taskId,
            status: "failed",
            errorCode: "INVALID_RESULT_URL",
            errorMessage: "YouCam task returned a malformed result URL.",
          };
        }

        if (
          parsedResultUrl.protocol !== "https:" ||
          parsedResultUrl.username ||
          parsedResultUrl.password ||
          (parsedResultUrl.port && parsedResultUrl.port !== "443") ||
          !isAllowedImageHost(parsedResultUrl.hostname)
        ) {
          return {
            taskId,
            status: "failed",
            errorCode: "UNTRUSTED_RESULT_HOST",
            errorMessage: "YouCam task returned a result image from an unpermitted host.",
          };
        }

        return {
          taskId,
          status: "succeeded",
          resultImageUrl: resultUrl,
        };
      }

      if (rawStatus === "error" || rawStatus === "failed") {
        return {
          taskId,
          status: "failed",
          errorCode: taskData.error_code || "TASK_FAILED",
          errorMessage: taskData.error_message || taskData.error || "YouCam virtual try-on task execution failed.",
        };
      }

      return {
        taskId,
        status: "processing",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        taskId,
        status: "failed",
        errorCode: "POLL_EXCEPTION",
        errorMessage: msg,
      };
    }
  }
}
