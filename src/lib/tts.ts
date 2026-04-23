/**
 * Edge TTS client.
 *
 * Calls the lightweight TTS server (chatterbox-server/) which wraps
 * Microsoft Edge's online text-to-speech via the edge-tts Python library.
 * No GPU required.
 *
 * Endpoints consumed:
 *   GET  /voices          → list available voices
 *   POST /speech          → generate audio (returns audio/mpeg)
 */

export interface TtsVoice {
  name: string;
  gender?: string;
  locale?: string;
  language?: string;
}

export interface TtsSynthesizeInput {
  text: string;
  voice?: string;
  rate?: string;   // e.g. "+20%", "-10%"
  pitch?: string;  // e.g. "+5Hz", "-2Hz"
  volume?: string; // e.g. "+0%"
}

export interface TtsSynthesizeResult {
  audio: Buffer;
  mime: "audio/mpeg";
  durationSec?: number;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function baseUrl() {
  const url = process.env.CHATTERBOX_BASE_URL;
  if (!url) throw new Error("CHATTERBOX_BASE_URL is not configured.");
  return url.replace(/\/$/, "");
}

const FALLBACK_VOICES: TtsVoice[] = [
  { name: "en-US-AriaNeural", gender: "Female", locale: "en-US", language: "en" },
  { name: "en-US-GuyNeural", gender: "Male", locale: "en-US", language: "en" },
  { name: "id-ID-ArdiNeural", gender: "Male", locale: "id-ID", language: "id" },
  { name: "id-ID-GadisNeural", gender: "Female", locale: "id-ID", language: "id" },
];

// ---------------------------------------------------------------------------
// Voice listing
// ---------------------------------------------------------------------------

export async function listVoices(language?: string): Promise<TtsVoice[]> {
  try {
    const qs = language ? `?language=${language}` : "";
    const res = await fetch(`${baseUrl()}/voices${qs}`);
    if (!res.ok) return FALLBACK_VOICES;
    const json = (await res.json()) as TtsVoice[];
    return json.length > 0 ? json : FALLBACK_VOICES;
  } catch {
    return FALLBACK_VOICES;
  }
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

export async function synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeResult> {
  const body: Record<string, string> = {
    input: input.text,
    voice: input.voice ?? "en-US-AriaNeural",
  };
  if (input.rate) body.rate = input.rate;
  if (input.pitch) body.pitch = input.pitch;
  if (input.volume) body.volume = input.volume;

  const res = await fetch(`${baseUrl()}/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Edge TTS failed (${res.status}): ${msg}`);
  }

  const ab = await res.arrayBuffer();
  return { audio: Buffer.from(ab), mime: "audio/mpeg" };
}
