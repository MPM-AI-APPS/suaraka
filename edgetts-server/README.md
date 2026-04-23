# Chatterbox TTS Server

A self-hosted FastAPI server wrapping the [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox) Python library for text-to-speech synthesis with voice cloning support.

## Models

| Model | Params | Languages | Best For |
|---|---|---|---|
| ChatterboxTTS | 500M | English | General TTS with CFG & exaggeration tuning |
| ChatterboxMultilingualTTS | 500M | 23+ | Multi-language synthesis |

The server auto-selects the model based on the `language` parameter: English uses the standard model, other languages use the multilingual model. Indonesian (`id`) is aliased to Malay (`ms`).

## Quick Start

### Local (requires CUDA GPU)

```bash
pip install -r requirements.txt
python main.py
```

### Docker

```bash
docker build -t chatterbox-server .
docker run --gpus all -p 8100:8100 -v ./voices:/data/voices chatterbox-server
```

## API Endpoints

### `GET /health`
Health check.

### `GET /voices`
List available voice references (files in `VOICES_DIR`).

### `POST /voices/upload`
Upload a reference audio clip for voice cloning.
- Form fields: `name` (string), `file` (audio file)

### `POST /audio/speech`
Synchronous TTS for short text (≤ 3000 chars).

```json
{
  "input": "Hello, world!",
  "voice": "default",
  "language": "en",
  "response_format": "wav",
  "exaggeration": 0.5,
  "cfg_weight": 0.5,
  "temperature": 0.8
}
```

Returns audio stream (`audio/wav` or `audio/mpeg`).

### `POST /audio/speech/long`
Async TTS job for long text. Splits into chunks, processes in background.

Same body as `/audio/speech`. Returns:
```json
{
  "job_id": "uuid",
  "status": "pending",
  "total_chunks": 5,
  "status_url": "/audio/speech/long/{job_id}"
}
```

### `GET /audio/speech/long/{job_id}`
Poll job status. Returns `status`: `pending` | `processing` | `completed` | `failed`.

### `GET /audio/speech/long/{job_id}/download`
Download completed audio.

## Voice Cloning

1. Upload a 5–15 second reference audio clip:
   ```bash
   curl -F "name=my-voice" -F "file=@reference.wav" http://localhost:8100/voices/upload
   ```

2. Use the voice name in synthesis:
   ```bash
   curl -X POST http://localhost:8100/audio/speech \
     -H "Content-Type: application/json" \
     -d '{"input": "Hello!", "voice": "my-voice"}' \
     --output output.wav
   ```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DEVICE` | `cuda` (if available) | PyTorch device |
| `PORT` | `8100` | Server port |
| `VOICES_DIR` | `./voices` | Directory for reference audio files |
| `JOBS_DIR` | `./jobs` | Temp storage for long-text job outputs |
| `MAX_SHORT_CHARS` | `3000` | Max chars for sync `/audio/speech` |
| `LONG_CHUNK_SIZE` | `2500` | Chunk size for long text splitting |

## Parameters

| Parameter | Range | Default | Description |
|---|---|---|---|
| `exaggeration` | 0.25 – 2.0 | 0.5 | Emotion intensity (0.5 = neutral) |
| `cfg_weight` | 0.0 – 1.0 | 0.5 | Pace control (lower = faster, 0 for language transfer) |
| `temperature` | 0.05 – 5.0 | 0.8 | Sampling randomness |
