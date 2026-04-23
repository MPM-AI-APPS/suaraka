"""
Chatterbox TTS — FastAPI Server

A self-hosted REST API wrapping the resemble-ai/chatterbox Python library.
Exposes OpenAI-compatible endpoints for TTS synthesis with voice cloning support.

Models loaded on demand (lazy):
  - ChatterboxTTS          (English, 500M, CFG + exaggeration tuning)
  - ChatterboxMultilingualTTS (23 languages, 500M)

Endpoints:
  GET  /health
  GET  /voices
  POST /voices/upload
  POST /audio/speech             (sync, short text)
  POST /audio/speech/long        (async job for long text)
  GET  /audio/speech/long/{id}   (poll job status)
  GET  /audio/speech/long/{id}/download
"""

from __future__ import annotations

import io
import os
import uuid
import time
import logging
import threading
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torchaudio as ta
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
VOICES_DIR = Path(os.environ.get("VOICES_DIR", "./voices"))
JOBS_DIR = Path(os.environ.get("JOBS_DIR", "./jobs"))
MODEL_DEVICE = os.environ.get("DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
MAX_SHORT_CHARS = int(os.environ.get("MAX_SHORT_CHARS", "3000"))
LONG_CHUNK_SIZE = int(os.environ.get("LONG_CHUNK_SIZE", "2500"))

VOICES_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("chatterbox-server")

# ---------------------------------------------------------------------------
# Model singletons (lazy-loaded)
# ---------------------------------------------------------------------------
_en_model = None
_en_lock = threading.Lock()

_mtl_model = None
_mtl_lock = threading.Lock()

MULTILINGUAL_LANGUAGES = {
    "ar", "da", "de", "el", "en", "es", "fi", "fr", "he", "hi",
    "it", "ja", "ko", "ms", "nl", "no", "pl", "pt", "ru", "sv",
    "sw", "tr", "zh",
}

# Indonesian → fall back to Malay (ms) since they're mutually intelligible
LANGUAGE_ALIAS = {"id": "ms"}


def get_en_model():
    global _en_model
    if _en_model is None:
        with _en_lock:
            if _en_model is None:
                from chatterbox.tts import ChatterboxTTS
                log.info("Loading ChatterboxTTS (English) on %s …", MODEL_DEVICE)
                _en_model = ChatterboxTTS.from_pretrained(device=MODEL_DEVICE)
                log.info("ChatterboxTTS loaded (sr=%d)", _en_model.sr)
    return _en_model


def get_mtl_model():
    global _mtl_model
    if _mtl_model is None:
        with _mtl_lock:
            if _mtl_model is None:
                from chatterbox.mtl_tts import ChatterboxMultilingualTTS
                log.info("Loading ChatterboxMultilingualTTS on %s …", MODEL_DEVICE)
                _mtl_model = ChatterboxMultilingualTTS.from_pretrained(device=MODEL_DEVICE)
                log.info("ChatterboxMultilingualTTS loaded (sr=%d)", _mtl_model.sr)
    return _mtl_model


# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
jobs: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def resolve_voice_path(voice: str) -> Optional[str]:
    """Return the path to a reference audio file for voice cloning, or None for default voice."""
    if not voice or voice == "default":
        return None
    # Check voices directory for matching file
    for ext in ("wav", "flac", "mp3", "ogg"):
        p = VOICES_DIR / f"{voice}.{ext}"
        if p.exists():
            return str(p)
    # Also accept full filename
    p = VOICES_DIR / voice
    if p.exists():
        return str(p)
    return None


def wav_tensor_to_bytes(wav: torch.Tensor, sr: int, fmt: str = "wav") -> bytes:
    """Convert a waveform tensor to audio bytes."""
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)  # (1, T)
    buf = io.BytesIO()
    if fmt == "wav":
        ta.save(buf, wav, sr, format="wav")
    elif fmt == "mp3":
        ta.save(buf, wav, sr, format="mp3")
    else:
        ta.save(buf, wav, sr, format="wav")
    buf.seek(0)
    return buf.read()


def synthesize_chunk(
    text: str,
    voice: Optional[str] = None,
    language: Optional[str] = None,
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    temperature: float = 0.8,
) -> tuple[torch.Tensor, int]:
    """Synthesize a single text chunk. Returns (wav_tensor, sample_rate)."""
    audio_prompt = resolve_voice_path(voice) if voice else None
    lang = LANGUAGE_ALIAS.get(language, language) if language else None

    # Use multilingual model for non-English languages
    if lang and lang != "en" and lang in MULTILINGUAL_LANGUAGES:
        model = get_mtl_model()
        kwargs: dict = {
            "exaggeration": exaggeration,
            "cfg_weight": cfg_weight,
            "temperature": temperature,
        }
        if audio_prompt:
            kwargs["audio_prompt_path"] = audio_prompt
        wav = model.generate(text, language_id=lang, **kwargs)
        return wav, model.sr

    # English model
    model = get_en_model()
    kwargs = {
        "exaggeration": exaggeration,
        "cfg_weight": cfg_weight,
        "temperature": temperature,
    }
    if audio_prompt:
        kwargs["audio_prompt_path"] = audio_prompt
    wav = model.generate(text, **kwargs)
    return wav, model.sr


def split_text(text: str, max_chars: int = LONG_CHUNK_SIZE) -> list[str]:
    """Split long text into sentence-aware chunks."""
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: list[str] = []
    current = ""
    for s in sentences:
        if len(current) + len(s) + 1 > max_chars and current:
            chunks.append(current.strip())
            current = s
        else:
            current = f"{current} {s}" if current else s
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text]


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Chatterbox TTS Server", version="1.0.0")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SpeechRequest(BaseModel):
    input: str = Field(..., min_length=1, description="Text to synthesize")
    voice: str = Field(default="default", description="Voice name (reference audio filename)")
    language: Optional[str] = Field(default=None, description="Language code (en, id, fr, …)")
    response_format: str = Field(default="wav", pattern="^(wav|mp3)$")
    exaggeration: float = Field(default=0.5, ge=0.25, le=2.0)
    cfg_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    temperature: float = Field(default=0.8, ge=0.05, le=5.0)


class LongSpeechRequest(BaseModel):
    input: str = Field(..., min_length=1, description="Long text to synthesize")
    voice: str = Field(default="default")
    language: Optional[str] = Field(default=None)
    response_format: str = Field(default="wav", pattern="^(wav|mp3)$")
    exaggeration: float = Field(default=0.5, ge=0.25, le=2.0)
    cfg_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    temperature: float = Field(default=0.8, ge=0.05, le=5.0)


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending | chunking | processing | completed | failed | cancelled
    total_chunks: int = 0
    completed_chunks: int = 0
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "device": MODEL_DEVICE}


@app.get("/voices")
def list_voices():
    """List available voice references from the voices directory."""
    voice_list = [{"name": "default"}]
    if VOICES_DIR.exists():
        for f in sorted(VOICES_DIR.iterdir()):
            if f.is_file() and f.suffix.lower() in (".wav", ".flac", ".mp3", ".ogg"):
                voice_list.append({"name": f.stem})
    return voice_list


@app.post("/voices/upload")
async def upload_voice(
    name: str = Form(..., min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$"),
    file: UploadFile = File(...),
):
    """Upload a reference audio clip to create a new voice."""
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "File must be an audio file.")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(400, "File too large (max 20 MB).")

    ext = Path(file.filename).suffix.lower() if file.filename else ".wav"
    if ext not in (".wav", ".flac", ".mp3", ".ogg"):
        ext = ".wav"

    dest = VOICES_DIR / f"{name}{ext}"
    dest.write_bytes(content)
    log.info("Voice uploaded: %s (%d bytes)", dest, len(content))
    return {"name": name, "file": str(dest)}


@app.post("/audio/speech")
def speech(req: SpeechRequest):
    """Synchronous TTS for short text (≤ MAX_SHORT_CHARS characters)."""
    if len(req.input) > MAX_SHORT_CHARS:
        raise HTTPException(
            400,
            f"Text too long ({len(req.input)} chars). "
            f"Use /audio/speech/long for text > {MAX_SHORT_CHARS} chars.",
        )

    log.info("Generating speech: %d chars, voice=%s, lang=%s", len(req.input), req.voice, req.language)
    try:
        wav, sr = synthesize_chunk(
            text=req.input,
            voice=req.voice,
            language=req.language,
            exaggeration=req.exaggeration,
            cfg_weight=req.cfg_weight,
            temperature=req.temperature,
        )
    except Exception as e:
        log.exception("TTS generation failed")
        raise HTTPException(500, f"Generation failed: {e}")

    audio_bytes = wav_tensor_to_bytes(wav, sr, req.response_format)
    mime = "audio/wav" if req.response_format == "wav" else "audio/mpeg"
    return StreamingResponse(io.BytesIO(audio_bytes), media_type=mime)


@app.post("/audio/speech/long")
def speech_long(req: LongSpeechRequest, background_tasks: BackgroundTasks):
    """Submit an async TTS job for long text."""
    job_id = str(uuid.uuid4())
    chunks = split_text(req.input)

    job = {
        "job_id": job_id,
        "status": "pending",
        "total_chunks": len(chunks),
        "completed_chunks": 0,
        "error": None,
        "created_at": time.time(),
    }
    jobs[job_id] = job

    background_tasks.add_task(
        _process_long_job,
        job_id=job_id,
        chunks=chunks,
        voice=req.voice,
        language=req.language,
        response_format=req.response_format,
        exaggeration=req.exaggeration,
        cfg_weight=req.cfg_weight,
        temperature=req.temperature,
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "total_chunks": len(chunks),
        "status_url": f"/audio/speech/long/{job_id}",
    }


@app.get("/audio/speech/long/{job_id}")
def speech_long_status(job_id: str):
    """Poll the status of a long-text TTS job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return JobStatus(**{k: job[k] for k in JobStatus.model_fields if k in job})


@app.get("/audio/speech/long/{job_id}/download")
def speech_long_download(job_id: str):
    """Download the completed audio for a long-text TTS job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    if job["status"] != "completed":
        raise HTTPException(409, f"Job not completed (status={job['status']}).")

    audio_path = JOBS_DIR / f"{job_id}.wav"
    if not audio_path.exists():
        audio_path = JOBS_DIR / f"{job_id}.mp3"
    if not audio_path.exists():
        raise HTTPException(500, "Audio file missing.")

    mime = "audio/wav" if audio_path.suffix == ".wav" else "audio/mpeg"
    return StreamingResponse(open(audio_path, "rb"), media_type=mime)


# ---------------------------------------------------------------------------
# Background job processor
# ---------------------------------------------------------------------------

def _process_long_job(
    job_id: str,
    chunks: list[str],
    voice: str,
    language: Optional[str],
    response_format: str,
    exaggeration: float,
    cfg_weight: float,
    temperature: float,
):
    job = jobs[job_id]
    job["status"] = "processing"
    wavs: list[torch.Tensor] = []
    sr = 24000  # will be overwritten

    try:
        for i, chunk in enumerate(chunks):
            log.info("Job %s: chunk %d/%d (%d chars)", job_id, i + 1, len(chunks), len(chunk))
            wav, sr = synthesize_chunk(
                text=chunk,
                voice=voice,
                language=language,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,
                temperature=temperature,
            )
            wavs.append(wav.squeeze(0) if wav.dim() > 1 else wav)
            job["completed_chunks"] = i + 1

        # Concatenate all chunks
        full_wav = torch.cat(wavs, dim=-1).unsqueeze(0)  # (1, T)
        ext = response_format if response_format in ("wav", "mp3") else "wav"
        out_path = JOBS_DIR / f"{job_id}.{ext}"
        ta.save(str(out_path), full_wav, sr, format=ext)

        job["status"] = "completed"
        log.info("Job %s completed: %s", job_id, out_path)

    except Exception as e:
        log.exception("Job %s failed", job_id)
        job["status"] = "failed"
        job["error"] = str(e)


# ---------------------------------------------------------------------------
# Startup / cleanup
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    log.info("Chatterbox TTS Server starting (device=%s)", MODEL_DEVICE)
    log.info("Voices dir: %s", VOICES_DIR.resolve())
    log.info("Jobs dir:   %s", JOBS_DIR.resolve())
    # Clean up old job files older than 1 hour
    cutoff = time.time() - 3600
    for f in JOBS_DIR.glob("*"):
        if f.is_file() and f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8100")))
