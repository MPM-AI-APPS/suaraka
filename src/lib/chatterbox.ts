/**
 * Chatterbox TTS client — Chatterbox REST API v2.1
 *
 * Short text (≤ 3000 chars):  POST /audio/speech           → audio/wav (sync)
 * Long  text (> 3000 chars):  POST /audio/speech/long      → async job
 *                             GET  /audio/speech/long/{id} → poll status
 *                             GET  /audio/speech/long/{id}/download → audio
 *
 * Voice names come from the Chatterbox voice library (/voices).
 * The default OpenAI-compatible names (alloy, echo, …) work if no custom
 * voices have been uploaded.
 */

export interface ChatterboxVoice {
  name: string;
  language?: string;
}

/** Fallback list shown when the /voices call fails or returns nothing. */
export const FALLBACK_VOICES: ChatterboxVoice[] = [
  { name: "default" },
];

export interface SynthesizeInput {
  text: string;
  voice?: string;        // name in Chatterbox voice library; defaults to "default"
  language?: string;     // language code ("en", "id", "fr", …); auto-selects model
  exaggeration?: number; // 0.25 – 2.0  emotion intensity
  cfgWeight?: number;    // 0.0  – 1.0  pace control (higher = slower / more deliberate)
  temperature?: number;  // 0.05 – 5.0  sampling temperature
}

export interface SynthesizeResult {
  audio: Buffer;
  mime: "audio/wav" | "audio/mpeg";
  durationSec?: number;
}

// Text longer than this requires the async /audio/speech/long endpoint.
const LONG_TEXT_THRESHOLD = 3000;

// Long-text job polling settings
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 270_000; // 4.5 min (Next.js maxDuration is 300 s)

function baseUrl() {
  const url = process.env.CHATTERBOX_BASE_URL;
  if (!url) throw new Error("CHATTERBOX_BASE_URL is not configured.");
  return url.replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (process.env.CHATTERBOX_API_KEY) {
    h["Authorization"] = `Bearer ${process.env.CHATTERBOX_API_KEY}`;
  }
  return h;
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() };
}

/** Fetch the list of available voices from the library. Returns FALLBACK_VOICES on any error. */
export async function listVoices(): Promise<ChatterboxVoice[]> {
  try {
    const res = await fetch(`${baseUrl()}/voices`, { headers: authHeaders() });
    if (!res.ok) return FALLBACK_VOICES;
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      return (json as Array<{ name?: string; voice_name?: string }>).map((v) => ({
        name: (v.name ?? v.voice_name ?? String(v)).trim(),
      }));
    }
    // Some builds return { voices: [...] }
    if (json && Array.isArray(json.voices) && json.voices.length > 0) {
      return (json.voices as Array<{ name?: string }>).map((v) => ({
        name: (v.name ?? String(v)).trim(),
      }));
    }
    return FALLBACK_VOICES;
  } catch {
    return FALLBACK_VOICES;
  }
}

/** Generate speech. Routes to short or long-text API based on text length. */
export async function synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
  if (input.text.length > LONG_TEXT_THRESHOLD) {
    return synthesizeLong(input);
  }
  return synthesizeShort(input);
}

// ---------------------------------------------------------------------------
// Short text — POST /audio/speech
// ---------------------------------------------------------------------------
async function synthesizeShort(input: SynthesizeInput): Promise<SynthesizeResult> {
  const body: Record<string, unknown> = {
    input: input.text,
    voice: input.voice ?? "default",
    response_format: "wav",
  };
  if (input.language) body.language = input.language;
  if (input.exaggeration != null) body.exaggeration = input.exaggeration;
  if (input.cfgWeight != null) body.cfg_weight = input.cfgWeight;
  if (input.temperature != null) body.temperature = input.temperature;

  const res = await fetch(`${baseUrl()}/audio/speech`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Chatterbox TTS failed (${res.status}): ${msg}`);
  }

  const ab = await res.arrayBuffer();
  return { audio: Buffer.from(ab), mime: "audio/wav" };
}

// ---------------------------------------------------------------------------
// Long text — POST /audio/speech/long → poll → download
// ---------------------------------------------------------------------------
async function synthesizeLong(input: SynthesizeInput): Promise<SynthesizeResult> {
  // 1. Submit job
  const body: Record<string, unknown> = {
    input: input.text,
    voice: input.voice ?? "default",
    response_format: "mp3",
  };
  if (input.language) body.language = input.language;
  if (input.exaggeration != null) body.exaggeration = input.exaggeration;
  if (input.cfgWeight != null) body.cfg_weight = input.cfgWeight;
  if (input.temperature != null) body.temperature = input.temperature;

  const createRes = await fetch(`${baseUrl()}/audio/speech/long`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const msg = await createRes.text().catch(() => createRes.statusText);
    throw new Error(`Chatterbox long-TTS submit failed (${createRes.status}): ${msg}`);
  }

  const { job_id } = (await createRes.json()) as { job_id: string };
  if (!job_id) throw new Error("Chatterbox long-TTS: no job_id in response");

  // 2. Poll until completed / failed
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch(`${baseUrl()}/audio/speech/long/${job_id}`, {
      headers: authHeaders(),
    });
    if (!statusRes.ok) continue; // transient error — keep polling

    const { status } = (await statusRes.json()) as { status: string };
    if (status === "completed") break;
    if (status === "failed" || status === "cancelled") {
      throw new Error(`Chatterbox long-TTS job ${status} (job_id=${job_id})`);
    }
    // "pending" | "chunking" | "processing" | "paused" → keep waiting
  }

  // 3. Download the final audio
  const dlRes = await fetch(
    `${baseUrl()}/audio/speech/long/${job_id}/download`,
    { headers: authHeaders() }
  );
  if (!dlRes.ok) {
    throw new Error(`Chatterbox long-TTS download failed (${dlRes.status})`);
  }

  const ab = await dlRes.arrayBuffer();
  const contentType = dlRes.headers.get("content-type") ?? "audio/mpeg";
  const mime: SynthesizeResult["mime"] = contentType.includes("wav")
    ? "audio/wav"
    : "audio/mpeg";

  return { audio: Buffer.from(ab), mime };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
