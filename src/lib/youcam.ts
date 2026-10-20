/**
 * LookMates — YouCam Apparel Virtual Try-On (VTO) Service
 * Official Documentation: https://yce.perfectcorp.com/ai-api/contents/fashion-api
 * S2S v2.0 Clothes API Specification
 */

export type YouCamGarmentCategory = "upper_body" | "lower_body" | "full_body" | "shoes" | "auto";

export interface YouCamTryOnInput {
  userPhotoUrl: string; // URL or base64 data URI
  garmentPhotoUrl: string; // URL or base64 data URI
  garmentCategory?: YouCamGarmentCategory | string;
  changeShoes?: boolean;
}

export interface YouCamTaskResponse {
  taskId: string;
  status: "queued" | "submitting" | "processing" | "succeeded" | "failed";
  resultImageUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  isRealApi: boolean;
}

export class YouCamService {
  private static getApiKey(): string | null {
    const key = process.env.YOUCAM_API_KEY;
    if (!key || key.trim() === "" || key.includes("your_youcam_bearer_token")) {
      return null;
    }
    return key.trim();
  }

  private static getBaseUrl(): string {
    return process.env.YOUCAM_API_BASE_URL || "https://yce-api-01.makeupar.com";
  }

  /**
   * Maps application category tags into YouCam official snake_case enum:
   * "upper_body" | "lower_body" | "full_body" | "shoes" | "auto"
   */
  public static mapGarmentCategory(cat?: string): YouCamGarmentCategory {
    if (!cat) return "auto";
    const c = cat.toLowerCase().replace(/[\s_-]+/g, "");
    if (
      c.includes("top") ||
      c.includes("shirt") ||
      c.includes("jacket") ||
      c.includes("blazer") ||
      c.includes("coat") ||
      c.includes("outer") ||
      c.includes("upper") ||
      c.includes("hoodie") ||
      c.includes("sweater")
    ) {
      return "upper_body";
    }
    if (
      c.includes("bottom") ||
      c.includes("trouser") ||
      c.includes("pant") ||
      c.includes("jean") ||
      c.includes("skirt") ||
      c.includes("short") ||
      c.includes("lower")
    ) {
      return "lower_body";
    }
    if (
      c.includes("dress") ||
      c.includes("gown") ||
      c.includes("suit") ||
      c.includes("full") ||
      c.includes("lehenga") ||
      c.includes("sari") ||
      c.includes("jumpsuit") ||
      c.includes("body")
    ) {
      return "full_body";
    }
    if (
      c.includes("shoe") ||
      c.includes("heel") ||
      c.includes("sneaker") ||
      c.includes("boot") ||
      c.includes("footwear")
    ) {
      return "shoes";
    }
    return "auto";
  }

  /**
   * Upload an image (base64 data URI or HTTP URL) to YouCam via /s2s/v2.0/file
   * Returns the official YouCam file_id to pass into task endpoints.
   */
  private static async uploadImageToYouCam(
    imageInput: string,
    defaultName: string,
    apiKey: string,
    baseUrl: string
  ): Promise<string> {
    let buffer: Buffer;
    let contentType = "image/jpeg";

    if (imageInput.startsWith("data:")) {
      const matches = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Invalid base64 data URI format.");
      }
      contentType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
    } else if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
      const res = await fetch(imageInput);
      if (!res.ok) {
        throw new Error(`Failed to download garment image from ${imageInput.substring(0, 40)}: HTTP ${res.status}`);
      }
      contentType = res.headers.get("content-type") || "image/jpeg";
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      throw new Error("Unsupported image input format. Expected base64 data URI or HTTP URL.");
    }

    if (buffer.length === 0) {
      throw new Error("Image buffer is empty.");
    }

    // Step 1: Initialize upload on YouCam File API
    const initRes = await fetch(`${baseUrl}/s2s/v2.0/file`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: [
          {
            file_name: defaultName,
            file_size: buffer.length,
            content_type: contentType
          }
        ]
      })
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`YouCam File API initialization failed (${initRes.status}): ${errText.substring(0, 150)}`);
    }

    const initData = await initRes.json();
    const fileInfo = initData?.data?.files?.[0];
    if (!fileInfo?.file_id || !fileInfo?.requests?.[0]?.url) {
      throw new Error("Malformed file initialization response from YouCam.");
    }

    // Step 2: Upload binary buffer directly to YouCam accelerated S3
    const uploadUrl = fileInfo.requests[0].url;
    const uploadMethod = fileInfo.requests[0].method || "PUT";

    const putRes = await fetch(uploadUrl, {
      method: uploadMethod,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString()
      },
      body: new Uint8Array(buffer)
    });

    if (!putRes.ok) {
      const putErr = await putRes.text();
      throw new Error(`YouCam S3 upload failed (${putRes.status}): ${putErr.substring(0, 150)}`);
    }

    return fileInfo.file_id;
  }

  /**
   * Submit an apparel try-on task to YouCam S2S v2.0
   */
  public static async submitClothTask(input: YouCamTryOnInput): Promise<YouCamTaskResponse> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    // Server-side validation
    if (!input.userPhotoUrl || input.userPhotoUrl.trim() === "") {
      return {
        taskId: "",
        status: "failed",
        errorCode: "MISSING_USER_PHOTO",
        errorMessage: "Participant source photo is required for virtual try-on.",
        isRealApi: Boolean(apiKey)
      };
    }

    if (!input.garmentPhotoUrl || input.garmentPhotoUrl.trim() === "") {
      return {
        taskId: "",
        status: "failed",
        errorCode: "MISSING_GARMENT_PHOTO",
        errorMessage: "Assigned garment image is required for virtual try-on.",
        isRealApi: Boolean(apiKey)
      };
    }

    // Map category to accepted snake_case value
    const category = this.mapGarmentCategory(input.garmentCategory);

    if (!apiKey) {
      console.warn("[YouCamService] YOUCAM_API_KEY not configured. Running demonstration fallback with realistic preview.");
      const mockTaskId = `mock-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      return {
        taskId: mockTaskId,
        status: "processing",
        isRealApi: false,
        errorMessage: "Running in mock mode. Add YOUCAM_API_KEY in .env.local for live API calls."
      };
    }

    try {
      // 1. Upload both user photo and garment photo to YouCam to get valid file_ids
      const srcFileId = await this.uploadImageToYouCam(
        input.userPhotoUrl,
        "source_person.jpg",
        apiKey,
        baseUrl
      );

      const refFileId = await this.uploadImageToYouCam(
        input.garmentPhotoUrl,
        "reference_garment.jpg",
        apiKey,
        baseUrl
      );

      // 2. Submit Cloth task with official YouCam S2S v2.0 schema
      const endpoint = `${baseUrl}/s2s/v2.0/task/cloth`;
      const payload = {
        src_file_id: srcFileId,
        ref_file_id: refFileId,
        garment_category: category,
        change_shoes: input.changeShoes ?? false
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[YouCamService] HTTP ${response.status} from YouCam: ${errorText.substring(0, 200)}`);
        return {
          taskId: "",
          status: "failed",
          errorCode: `HTTP_${response.status}`,
          errorMessage: `YouCam API Error (${response.status}): ${errorText.substring(0, 150)}`,
          isRealApi: true
        };
      }

      const data = await response.json();
      const taskId = data?.data?.task_id || data?.task_id;

      if (!taskId) {
        return {
          taskId: "",
          status: "failed",
          errorCode: "NO_TASK_ID",
          errorMessage: "YouCam response did not contain a valid task_id.",
          isRealApi: true
        };
      }

      return {
        taskId,
        status: "processing",
        isRealApi: true
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[YouCamService] Submission exception:", msg);
      return {
        taskId: "",
        status: "failed",
        errorCode: "SUBMISSION_ERROR",
        errorMessage: `Failed to initiate YouCam try-on: ${msg}`,
        isRealApi: true
      };
    }
  }

  /**
   * Poll status of an apparel try-on task
   */
  public static async pollClothTask(taskId: string, fallbackImageUrl?: string): Promise<YouCamTaskResponse> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    // If it's a mock demo task
    if (taskId.startsWith("mock-task-") || !apiKey) {
      return {
        taskId,
        status: "succeeded",
        resultImageUrl: fallbackImageUrl || "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
        isRealApi: false
      };
    }

    try {
      const endpoint = `${baseUrl}/s2s/v2.0/task/cloth/${taskId}`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          taskId,
          status: "failed",
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Poll failed (${response.status}): ${errorText.substring(0, 150)}`,
          isRealApi: true
        };
      }

      const data = await response.json();
      const taskData = data?.data || data;
      const statusStr = (taskData?.task_status || taskData?.status || "").toLowerCase();

      if (statusStr === "success" || statusStr === "succeeded") {
        const resultUrl =
          taskData?.results?.url ||
          (Array.isArray(taskData?.results) ? taskData.results[0]?.url : null) ||
          taskData?.result_url ||
          taskData?.image_url;

        if (!resultUrl) {
          return {
            taskId,
            status: "failed",
            errorCode: "NO_RESULT_URL",
            errorMessage: "Try-on completed but no result image URL was returned.",
            isRealApi: true
          };
        }

        return {
          taskId,
          status: "succeeded",
          resultImageUrl: resultUrl,
          isRealApi: true
        };
      } else if (statusStr === "error" || statusStr === "failed") {
        const errCode = taskData?.error_code || "TASK_FAILED";
        const errMsg =
          taskData?.error?.message ||
          taskData?.error_message ||
          (typeof taskData?.error === "string" ? taskData.error : null) ||
          "YouCam processing failed on this garment/photo combination.";

        return {
          taskId,
          status: "failed",
          errorCode: errCode,
          errorMessage: errMsg,
          isRealApi: true
        };
      } else {
        // running, processing, queued
        return {
          taskId,
          status: "processing",
          isRealApi: true
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        taskId,
        status: "failed",
        errorCode: "NETWORK_ERROR",
        errorMessage: `Poll error: ${msg}`,
        isRealApi: true
      };
    }
  }

  /**
   * Submit an AI Salient Object Detection (SOD) background removal task to YouCam S2S v2.0
   * Official endpoint: POST /s2s/v2.0/task/sod
   * Takes a public URL or uploads the file via YouCam File API to get a src_file_id
   */
  public static async submitSODTask(
    imageInput: string,
    defaultName = "person_cutout.jpg"
  ): Promise<{ taskId: string; status: "processing" | "failed"; errorCode?: string; errorMessage?: string; isRealApi: boolean }> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    if (!apiKey) {
      return {
        taskId: "",
        status: "failed",
        errorCode: "NO_API_KEY",
        errorMessage: "YOUCAM_API_KEY is not configured.",
        isRealApi: false
      };
    }

    try {
      let payload: Record<string, string>;

      if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
        // Can directly use src_file_url for public cloud URLs
        payload = { src_file_url: imageInput };
      } else {
        // Base64 data URI: upload to YouCam File API first to get src_file_id
        const fileId = await this.uploadImageToYouCam(imageInput, defaultName, apiKey, baseUrl);
        payload = { src_file_id: fileId };
      }

      const endpoint = `${baseUrl}/s2s/v2.0/task/sod`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[YouCamService] SOD HTTP ${response.status} from YouCam: ${errorText.substring(0, 200)}`);
        return {
          taskId: "",
          status: "failed",
          errorCode: `HTTP_${response.status}`,
          errorMessage: `YouCam SOD Error (${response.status}): ${errorText.substring(0, 150)}`,
          isRealApi: true
        };
      }

      const data = await response.json();
      const taskId = data?.data?.task_id || data?.task_id;

      if (!taskId) {
        return {
          taskId: "",
          status: "failed",
          errorCode: "NO_TASK_ID",
          errorMessage: "YouCam SOD response did not contain a valid task_id.",
          isRealApi: true
        };
      }

      return {
        taskId,
        status: "processing",
        isRealApi: true
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[YouCamService] SOD Submission exception:", msg);
      return {
        taskId: "",
        status: "failed",
        errorCode: "SUBMISSION_ERROR",
        errorMessage: `Failed to initiate YouCam background removal: ${msg}`,
        isRealApi: true
      };
    }
  }

  /**
   * Poll status of an AI Salient Object Detection (SOD) background removal task
   * Official endpoint: GET /s2s/v2.0/task/sod/{taskId}
   */
  public static async pollSODTask(taskId: string): Promise<YouCamTaskResponse> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    if (!apiKey) {
      return {
        taskId,
        status: "failed",
        errorCode: "NO_API_KEY",
        errorMessage: "YOUCAM_API_KEY is not configured.",
        isRealApi: false
      };
    }

    try {
      const endpoint = `${baseUrl}/s2s/v2.0/task/sod/${taskId}`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          taskId,
          status: "failed",
          errorCode: `HTTP_${response.status}`,
          errorMessage: `SOD Poll failed (${response.status}): ${errorText.substring(0, 150)}`,
          isRealApi: true
        };
      }

      const data = await response.json();
      const taskData = data?.data || data;
      const statusStr = (taskData?.task_status || taskData?.status || "").toLowerCase();

      if (statusStr === "success" || statusStr === "succeeded") {
        const resultUrl =
          taskData?.results?.url ||
          (Array.isArray(taskData?.results) ? taskData.results[0]?.url : null) ||
          taskData?.result_url;

        if (!resultUrl) {
          return {
            taskId,
            status: "failed",
            errorCode: "NO_RESULT_URL",
            errorMessage: "SOD completed but no cutout image URL was returned.",
            isRealApi: true
          };
        }

        return {
          taskId,
          status: "succeeded",
          resultImageUrl: resultUrl,
          isRealApi: true
        };
      } else if (statusStr === "error" || statusStr === "failed") {
        const errCode = taskData?.error_code || "TASK_FAILED";
        const errMsg =
          taskData?.error?.message ||
          taskData?.error_message ||
          (typeof taskData?.error === "string" ? taskData.error : null) ||
          "YouCam background removal failed on this image.";

        return {
          taskId,
          status: "failed",
          errorCode: errCode,
          errorMessage: errMsg,
          isRealApi: true
        };
      } else {
        return {
          taskId,
          status: "processing",
          isRealApi: true
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        taskId,
        status: "failed",
        errorCode: "NETWORK_ERROR",
        errorMessage: `SOD Poll error: ${msg}`,
        isRealApi: true
      };
    }
  }

  /**
   * End-to-end background removal using YouCam AI Salient Object Detection (SOD)
   * Submits task, polls until complete (or max attempts), returns transparent PNG URL.
   */
  public static async removeBackground(
    imageInput: string,
    defaultName = "person_cutout.jpg",
    maxAttempts = 15
  ): Promise<string> {
    const submission = await this.submitSODTask(imageInput, defaultName);
    if (submission.status === "failed" || !submission.taskId) {
      throw new Error(submission.errorMessage || "Failed to submit background removal task.");
    }

    const { taskId } = submission;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 1.5s delay between poll checks
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const poll = await this.pollSODTask(taskId);

      if (poll.status === "succeeded" && poll.resultImageUrl) {
        return poll.resultImageUrl;
      }
      if (poll.status === "failed") {
        throw new Error(poll.errorMessage || "Background removal task failed on YouCam server.");
      }
    }

    throw new Error("Background removal task timed out while processing.");
  }
}

