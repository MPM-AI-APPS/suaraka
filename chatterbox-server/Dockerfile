FROM python:3.11-slim

WORKDIR /app

# System deps for torchaudio
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install PyTorch (CUDA 12.1) + deps
RUN pip install --no-cache-dir \
    torch torchaudio --index-url https://download.pytorch.org/whl/cu121 && \
    pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Directories for voices and job files
RUN mkdir -p /data/voices /data/jobs
ENV VOICES_DIR=/data/voices
ENV JOBS_DIR=/data/jobs
ENV PORT=8100

EXPOSE 8100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
