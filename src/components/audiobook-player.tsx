"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, SkipBack, SkipForward, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api, type ChapterSummary, type VoiceItem } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "sonner";

interface Props {
  bookId: string;
  language: "en" | "id";
  chapters: ChapterSummary[];
}

export function AudiobookPlayer({ bookId, language, chapters }: Props) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [voice, setVoice] = useState("default");
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [exaggeration, setExaggeration] = useState(1.0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const chapter = chapters[chapterIdx];

  // Fetch available voices once on mount
  useEffect(() => {
    api.listVoices().then((list) => {
      if (list.length > 0) {
        setVoices(list);
        setVoice(list[0].name);
      }
    }).catch(() => {
      // keep default state — voice selector will be empty until resolved
    });
    // intentionally runs only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset / preload audio when chapter changes
  useEffect(() => {
    setPosition(0);
    setDuration(0);
    setPlaying(false);
    setAudioUrl(chapters[chapterIdx]?.audioUrl ?? null);
  }, [chapterIdx, chapters]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = 1;
  }, [audioUrl]);

  const generate = async () => {
    if (!chapter) return;
    setGenerating(true);
    try {
      const r = await api.generateChapter(bookId, chapter.id, {
        voice,
        exaggeration,
      });
      setAudioUrl(r.audioUrl);
      if (r.durationSec) setDuration(r.durationSec);
      toast.success(t.book.ready);
    } catch (e) {
      console.error(e);
      toast.error("Narration failed.");
    } finally {
      setGenerating(false);
    }
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !audioUrl) return generate();
    if (playing) a.pause();
    else a.play();
  };

  const seek = (v: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = v;
    setPosition(v);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Chapter list */}
      <div className="suaraka-glass rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-heading text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t.book.chapters}
          </div>
          <Badge variant="outline">{chapters.length}</Badge>
        </div>
        <div className="suaraka-scroll max-h-64 overflow-y-auto pr-1">
          <ul className="flex flex-col gap-1">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => setChapterIdx(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    i === chapterIdx
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="line-clamp-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>{" "}
                    {c.title}
                  </span>
                  {c.audioStatus === "ready" && <Badge variant="success">{t.book.ready}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Player */}
      <div className="suaraka-glass rounded-2xl p-5">
        <div className="mb-1 font-heading text-lg tracking-tight">
          {chapter?.title ?? "—"}
        </div>
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {chapter?.wordCount ?? 0} words · {voice}
        </div>

        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={(e) => setPosition((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              if (chapterIdx < chapters.length - 1) setChapterIdx(chapterIdx + 1);
            }}
          />
        ) : null}

        <div className="mb-3 flex items-center gap-3">
          <span className="w-12 font-mono text-xs text-muted-foreground">
            {formatDuration(position)}
          </span>
          <Slider
            value={position}
            max={Math.max(duration, 1)}
            step={0.1}
            onValueChange={seek}
            disabled={!audioUrl}
          />
          <span className="w-12 text-right font-mono text-xs text-muted-foreground">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={chapterIdx === 0}
            onClick={() => setChapterIdx((i) => Math.max(0, i - 1))}
            aria-label="Previous chapter"
          >
            <SkipBack />
          </Button>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full p-0"
            onClick={toggle}
            disabled={generating}
            aria-label={playing ? t.book.pause : t.book.play}
          >
            {generating ? (
              <Loader2 className="animate-spin" />
            ) : playing ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={chapterIdx >= chapters.length - 1}
            onClick={() => setChapterIdx((i) => Math.min(chapters.length - 1, i + 1))}
            aria-label="Next chapter"
          >
            <SkipForward />
          </Button>
        </div>

        {!audioUrl && !generating && (
          <Button
            onClick={generate}
            variant="outline"
            className="mt-4 w-full rounded-full"
          >
            <Sparkles /> {t.book.generate}
          </Button>
        )}

        {generating && (
          <div className="mt-4 space-y-1">
            <Progress value={40} />
            <div className="text-center text-xs text-muted-foreground">{t.book.generating}</div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-5 grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t.book.voice}</span>
            </div>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-input px-3 text-sm"
            >
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Emotion</span>
              <span className="font-mono">{exaggeration.toFixed(2)}</span>
            </div>
            <Slider
              value={exaggeration}
              min={0.25}
              max={2}
              step={0.05}
              onValueChange={setExaggeration}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
