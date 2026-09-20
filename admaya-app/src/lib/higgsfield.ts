import "server-only";

// ─── Higgsfield API Integration ──────────────────────────────────────────────
// Auth: Authorization: Key <KEY_ID>:<KEY_SECRET>
// Lifecycle: POST to model endpoint → returns { request_id, status_url }
//            then poll status_url until status = "completed" | "failed"
//            completed response includes { output: [{ url: string }] }

// Overridable so tests can point at a local fake instead of the billed API.
const hfBase = () => process.env.HIGGSFIELD_BASE_URL ?? "https://api.higgsfield.ai";

function authHeader(): string {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error("HIGGSFIELD_API_KEY is not set in environment");
  return `Key ${key}`;
}

function defaultModel(): string {
  return process.env.HIGGSFIELD_MODEL ?? "bytedance/seedance-2.5/text-to-video";
}

export interface HFSubmitResponse {
  request_id: string;
  status: string;
  status_url: string;
  cancel_url?: string;
}

export interface HFStatusResponse {
  request_id: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  output?: Array<{ url: string; content_type?: string }>;
  error?: string;
  eta?: number;
  progress?: number;
}

export interface HFGenerateResult {
  requestId: string;
  videoUrl: string | null;
  /** Seconds the provider actually renders (it only supports 5 or 10), which can be shorter than the template's length. */
  renderedSeconds?: number;
  status: "completed" | "failed" | "timeout";
  error?: string;
}

/** Seedance renders 5 or 10 seconds; longer templates are rendered at 10. */
export function renderSecondsFor(durationSeconds?: number): 5 | 10 {
  return durationSeconds && durationSeconds >= 10 ? 10 : 5;
}

/** Submit a text-to-video job. Returns immediately with a request_id. */
export async function submitVideoGeneration(opts: {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
}): Promise<HFSubmitResponse> {
  const model = defaultModel();
  const url = `${hfBase()}/${model}`;

  const dur = renderSecondsFor(opts.durationSeconds);

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    duration: dur,
    aspect_ratio: opts.aspectRatio ?? "9:16",
    resolution: opts.resolution ?? "720p",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    const detail = (errBody.detail as string) ?? `HTTP ${res.status}`;

    if (detail === "not_enough_credits") {
      throw new HFCreditsError("Higgsfield account has insufficient credits. Please top up at console.higgsfield.ai");
    }
    throw new Error(`Higgsfield submit failed: ${detail}`);
  }

  return res.json() as Promise<HFSubmitResponse>;
}

/** Poll the status URL until the job is done. Max wait: ~5 minutes. */
export async function pollVideoStatus(
  statusUrl: string,
  opts: { maxWaitMs?: number; pollIntervalMs?: number } = {}
): Promise<HFStatusResponse> {
  const maxWait = opts.maxWaitMs ?? 5 * 60 * 1000; // 5 minutes
  const interval = opts.pollIntervalMs ?? (Number(process.env.HIGGSFIELD_POLL_MS) || 4000); // poll every 4s
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));

    const res = await fetch(statusUrl, {
      headers: { "Authorization": authHeader() },
    });

    if (!res.ok) continue; // transient error — keep polling

    const data = await res.json() as HFStatusResponse;

    if (data.status === "completed" || data.status === "failed") {
      return data;
    }
    // still queued/processing — keep going
  }

  return { request_id: "", status: "timeout" };
}

/** Check the status of a request by request_id */
export async function checkVideoStatus(requestId: string): Promise<HFStatusResponse> {
  const url = `${hfBase()}/requests/${requestId}/status`;
  const res = await fetch(url, {
    headers: { "Authorization": authHeader() },
  });
  if (!res.ok) {
    throw new Error(`Status check failed: HTTP ${res.status}`);
  }
  return res.json() as Promise<HFStatusResponse>;
}

/**
 * High-level: submit + poll until done. Returns the video URL or null.
 * On credit errors or other failures, logs and returns null.
 */
export async function generateVideo(prompt: string, durationSeconds: number): Promise<HFGenerateResult> {
  try {
    const submitted = await submitVideoGeneration({
      prompt,
      durationSeconds,
      aspectRatio: "9:16",
      resolution: "720p",
    });

    console.log(`[higgsfield] Job submitted: ${submitted.request_id}`);

    const final = await pollVideoStatus(submitted.status_url);

    if (final.status === "completed" && final.output?.[0]?.url) {
      console.log(`[higgsfield] Job complete: ${submitted.request_id} → ${final.output[0].url}`);
      return { requestId: submitted.request_id, videoUrl: final.output[0].url, status: "completed", renderedSeconds: renderSecondsFor(durationSeconds) };
    }

    if (final.status === "timeout") {
      console.warn(`[higgsfield] Job timed out: ${submitted.request_id}`);
      return { requestId: submitted.request_id, videoUrl: null, status: "timeout", error: "Render timed out (> 5 min)" };
    }

    const errMsg = final.error ?? "Unknown error from Higgsfield";
    console.error(`[higgsfield] Job failed: ${submitted.request_id} — ${errMsg}`);
    return { requestId: submitted.request_id, videoUrl: null, status: "failed", error: errMsg };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[higgsfield] Generation error: ${msg}`);
    return { requestId: "", videoUrl: null, status: "failed", error: msg };
  }
}

/** Returns true if HIGGSFIELD_API_KEY is configured. */
export function isHiggsfieldConfigured(): boolean {
  return Boolean(process.env.HIGGSFIELD_API_KEY);
}

export class HFCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HFCreditsError";
  }
}
