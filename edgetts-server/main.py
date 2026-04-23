"""
Suaraka TTS Server — Edge TTS

A lightweight FastAPI server wrapping the edge-tts Python library
(Microsoft Edge online text-to-speech). No GPU required.

Endpoints:
  GET  /health
  GET  /voices          (list available voices, optional ?language= filter)
  POST /speech          (generate audio from text)
"""

from __future__ import annotations

import asyncio
import io
import os
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("tts-server")

app = FastAPI(title="Suaraka TTS Server", version="2.0.0")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SpeechRequest(BaseModel):
    input: str = Field(..., min_length=1, description="Text to synthesize")
    voice: str = Field(default="en-US-AriaNeural", description="Edge TTS voice short name")
    rate: str = Field(default="+0%", description="Speech rate (e.g. +20%, -10%)")
    volume: str = Field(default="+0%", description="Volume adjustment")
    pitch: str = Field(default="+0Hz", description="Pitch adjustment")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "engine": "edge-tts"}


@app.get("/voices")
async def list_voices(language: Optional[str] = None):
    """List available Edge TTS voices, optionally filtered by language code."""
    import edge_tts

    try:
        all_voices = await edge_tts.list_voices()
    except Exception as e:
        log.exception("Failed to list edge-tts voices")
        raise HTTPException(502, f"Edge TTS voice listing failed: {e}")

    result = []
    for v in sorted(all_voices, key=lambda x: x["ShortName"]):
        lang_code = v["Locale"].split("-")[0]  # e.g. "en" from "en-US"
        if language and lang_code != language:
            continue
        result.append({
            "name": v["ShortName"],
            "gender": v.get("Gender", ""),
            "locale": v.get("Locale", ""),
            "language": lang_code,
        })
    return result


@app.post("/speech")
async def speech(req: SpeechRequest):
    """Generate speech using Microsoft Edge TTS."""
    import edge_tts

    log.info("Edge-TTS: %d chars, voice=%s, rate=%s", len(req.input), req.voice, req.rate)
    try:
        communicate = edge_tts.Communicate(
            req.input,
            req.voice,
            rate=req.rate,
            volume=req.volume,
            pitch=req.pitch,
        )
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        buf.seek(0)
    except Exception as e:
        log.exception("Edge-TTS generation failed")
        raise HTTPException(500, f"Edge TTS failed: {e}")

    if buf.getbuffer().nbytes == 0:
        raise HTTPException(500, "Edge TTS returned empty audio.")

    return StreamingResponse(buf, media_type="audio/mpeg")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8100")))
