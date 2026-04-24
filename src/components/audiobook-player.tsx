"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Headphones,
  Languages,
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Sparkles,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { api, type PageSummary, type VoiceItem } from "@/lib/api";
import { formatDuration } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Feature flag                                                        */
/* ------------------------------------------------------------------ */

const AUDIO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUDIO !== "false";

export type PlayerMode = "audio" | "text";

/* ------------------------------------------------------------------ */
/* Speed helpers                                                       */
/* ------------------------------------------------------------------ */

const SPEED_MARKS = [
  { value: -50, label: "0.5×" },
  { value: -25, label: "0.75×" },
  { value: 0, label: "1×" },
  { value: 25, label: "1.25×" },
  { value: 50, label: "1.5×" },
  { value: 100, label: "2×" },
];

function rateToSlider(rate: string): number {
  const n = parseInt(rate, 10);
  return isNaN(n) ? 0 : n;
}

function sliderToRate(v: number): string {
  return v >= 0 ? `+${v}%` : `${v}%`;
}

function nearestSpeedLabel(v: number): string {
  let best = SPEED_MARKS[0];
  for (const m of SPEED_MARKS) {
    if (Math.abs(m.value - v) < Math.abs(best.value - v)) best = m;
  }
  return best.label;
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  bookId: string;
  language: "en" | "id";
  pages: PageSummary[];
  mode: PlayerMode;
  onModeChange: (mode: PlayerMode) => void;
  onPageChange?: (pageId: string) => void;
}

type Mode = PlayerMode;

export function AudiobookPlayer({ bookId, language, pages, mode, onModeChange, onPageChange }: Props) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Page navigation
  const [pageIdx, setPageIdx] = useState(0);

  // Voice & speed
  const [voiceLang, setVoiceLang] = useState<"en" | "id">(language);
  const [voice, setVoice] = useState("en-US-AriaNeural");
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [speedVal, setSpeedVal] = useState(0); // slider value (-50 to 100)

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const autoplayRef = useRef(false);

  // Mode: audio or text — controlled by parent
  // (kept as local alias for readability)

  // Translation
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Reformat
  const [reformattedText, setReformattedText] = useState<string | null>(null);
  const [reformatting, setReformatting] = useState(false);
  const [showReformat, setShowReformat] = useState(false);

  // Track which settings the current audioUrl was generated with
  const [audioVoice, setAudioVoice] = useState("");
  const [audioSpeed, setAudioSpeed] = useState(0);

  // Track pending autoplay after generation
  const shouldAutoplayAfterGenerate = useRef(false);

  const page = pages[pageIdx];

  // Keep ref in sync
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  // Fetch voices when voice language changes
  useEffect(() => {
    api
      .listVoices(voiceLang)
      .then((list) => {
        if (list.length > 0) {
          setVoices(list);
          // Preserve the current voice if it exists in the new list;
          // otherwise fall back to the first available voice.
          setVoice((cur) =>
            list.some((v) => v.name === cur) ? cur : list[0].name
          );
        } else {
          setVoices([]);
          setVoice(voiceLang === "id" ? "id-ID-ArdiNeural" : "en-US-AriaNeural");
        }
      })
      .catch(() => {
        setVoices([]);
      });
  }, [voiceLang]);

  // Reset state when page changes
  useEffect(() => {
    setPosition(0);
    setDuration(0);
    setPlaying(false);
    setAudioUrl(pages[pageIdx]?.audioUrl ?? null);
    setTranslatedText(null);
    setShowTranslation(false);
    setReformattedText(null);
    setShowReformat(false);

    // Notify parent of active page
    const pid = pages[pageIdx]?.id;
    if (pid) onPageChange?.(pid);

    // If the page already has audio, sync voice selector to match
    const existingVoice = pages[pageIdx]?.audioVoice;
    const existingLang = pages[pageIdx]?.audioVoiceLang;
    if (existingVoice && existingLang) {
      setAudioVoice(existingVoice);
      setAudioSpeed(0);
      // Set both lang and voice immediately — the fetch effect will preserve
      // the voice if it's in the new list (via functional state update)
      setVoice(existingVoice);
      setVoiceLang(existingLang);
    } else {
      setAudioVoice("");
      setAudioSpeed(0);
    }
  }, [pageIdx, pages]);

  // When audioUrl changes, explicitly call load() so onLoadedMetadata fires reliably
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    a.load();
  }, [audioUrl]);

  // After audioUrl is set, auto-play if flagged
  useEffect(() => {
    if (!audioUrl) return;
    if (shouldAutoplayAfterGenerate.current) {
      shouldAutoplayAfterGenerate.current = false;
      // Wait for the audio element to be ready
      const tryPlay = () => {
        const a = audioRef.current;
        if (a) {
          a.play().catch(() => {});
        }
      };
      // Small timeout to let the audio element mount/update src
      setTimeout(tryPlay, 100);
    }
  }, [audioUrl]);

  const generate = useCallback(
    async (andPlay = false) => {
      if (!page) return;
      setGenerating(true);
      shouldAutoplayAfterGenerate.current = andPlay;
      try {
        const r = await api.generatePage(bookId, page.id, {
          voice,
          rate: sliderToRate(speedVal),
        });
        setAudioUrl(r.audioUrl + `?t=${Date.now()}`);
        if (r.durationSec) setDuration(r.durationSec);
        setAudioVoice(voice);
        setAudioSpeed(speedVal);
        toast.success(t.book.ready);
      } catch (e) {
        console.error(e);
        shouldAutoplayAfterGenerate.current = false;
        toast.error("Narration failed.");
      } finally {
        setGenerating(false);
      }
    },
    [bookId, page, voice, speedVal, t.book.ready]
  );

  // Handle autoplay: when page changes via autoplay, generate & play
  const prevPageIdxRef = useRef(pageIdx);
  useEffect(() => {
    if (pageIdx !== prevPageIdxRef.current) {
      prevPageIdxRef.current = pageIdx;
      const currentPage = pages[pageIdx];
      if (autoplayRef.current && currentPage) {
        if (currentPage.audioUrl) {
          // Audio already exists, auto-play it
          shouldAutoplayAfterGenerate.current = true;
          setAudioUrl(currentPage.audioUrl + `?t=${Date.now()}`);
        } else {
          // Need to generate first
          generate(true);
        }
      }
    }
  }, [pageIdx, pages, generate]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !audioUrl) return generate(true);
    if (playing) a.pause();
    else a.play();
  };

  const seek = (v: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = v;
    setPosition(v);
  };

  const onAudioEnded = () => {
    setPlaying(false);
    if (autoplay && pageIdx < pages.length - 1) {
      setPageIdx(pageIdx + 1);
    }
  };

  const handleTranslate = async () => {
    if (!page) return;
    if (translatedText) {
      setShowTranslation(!showTranslation);
      return;
    }
    setTranslating(true);
    try {
      const targetLang = language === "en" ? "id" : "en";
      const r = await api.translatePage(bookId, page.id, targetLang);
      setTranslatedText(r.translated);
      setShowTranslation(true);
    } catch {
      toast.error("Translation failed.");
    } finally {
      setTranslating(false);
    }
  };

  const handleReformat = async () => {
    if (!page) return;
    if (reformattedText) {
      setShowReformat(!showReformat);
      return;
    }
    setReformatting(true);
    try {
      const r = await api.reformatPage(bookId, page.id);
      setReformattedText(r.reformatted);
      setShowReformat(true);
    } catch {
      toast.error("Reformat failed.");
    } finally {
      setReformatting(false);
    }
  };

  /** The text to actually display in reading mode */
  const displayText = showTranslation && translatedText
    ? translatedText
    : showReformat && reformattedText
      ? reformattedText
      : page?.text ?? "";

  const voiceDisplay = voices.find((v) => v.name === voice);
  const settingsChanged = audioUrl !== null && (audioVoice !== voice || audioSpeed !== speedVal);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle — hidden when audio is disabled */}
      {AUDIO_ENABLED && (
        <div className="flex gap-1 rounded-xl border border-border/60 bg-card/60 p-1">
          <button
            onClick={() => onModeChange("audio")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === "audio"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary/60"
            }`}
          >
            <Headphones className="h-4 w-4" />
            {t.book.audioMode}
          </button>
          <button
            onClick={() => onModeChange("text")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === "text"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-secondary/60"
            }`}
          >
            <Type className="h-4 w-4" />
            {t.book.textMode}
          </button>
        </div>
      )}

      {/* Page list */}
      <div className="suaraka-glass rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-heading text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {t.book.pages}
          </div>
          <Badge variant="outline">{pages.length}</Badge>
        </div>
        <div className="suaraka-scroll max-h-64 overflow-y-auto pr-1">
          <ul className="flex flex-col gap-1">
            {pages.map((p, i) => (
              <li key={p.id}>
                <button
                  onClick={() => setPageIdx(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                    i === pageIdx
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-secondary/60"
                  }`}
                >
                  <span className="line-clamp-1">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {String(p.pageNumber).padStart(2, "0")}
                    </span>{" "}
                    Page {p.pageNumber}
                  </span>
                  {p.audioStatus === "ready" && (
                    <Badge variant="success">{t.book.ready}</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ============================================================ */}
      {/* AUDIO MODE                                                     */}
      {/* ============================================================ */}
      {mode === "audio" && (
        <div className="suaraka-glass rounded-2xl p-5">
          <div className="mb-1 font-heading text-lg tracking-tight">
            {page ? `Page ${page.pageNumber}` : "—"}
          </div>
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {page?.wordCount ?? 0} words · {voice}
          </div>

          {audioUrl ? (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={(e) =>
                setPosition((e.target as HTMLAudioElement).currentTime)
              }
              onLoadedMetadata={(e) =>
                setDuration((e.target as HTMLAudioElement).duration)
              }
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={onAudioEnded}
            />
          ) : null}

          {/* Seek slider */}
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

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={pageIdx === 0}
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
              aria-label="Previous page"
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
              disabled={pageIdx >= pages.length - 1}
              onClick={() =>
                setPageIdx((i) => Math.min(pages.length - 1, i + 1))
              }
              aria-label="Next page"
            >
              <SkipForward />
            </Button>
            {/* Autoplay toggle */}
            <Button
              variant={autoplay ? "default" : "ghost"}
              size="icon"
              onClick={() => setAutoplay(!autoplay)}
              aria-label={t.book.autoplay}
              title={t.book.autoplay}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </div>

          {!audioUrl && !generating && (
            <Button
              onClick={() => generate(true)}
              variant="outline"
              className="mt-4 w-full rounded-full"
            >
              <Sparkles /> {t.book.generate}
            </Button>
          )}

          {settingsChanged && !generating && (
            <Button
              onClick={() => generate(true)}
              variant="outline"
              className="mt-4 w-full rounded-full"
            >
              <Sparkles /> Regenerate with new settings
            </Button>
          )}

          {generating && (
            <div className="mt-4 space-y-1">
              <Progress value={40} />
              <div className="text-center text-xs text-muted-foreground">
                {t.book.generating}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-5 grid gap-4 border-t border-border/60 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Voice language */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t.book.voiceLanguage}
                </div>
                <Select value={voiceLang} onValueChange={(v) => setVoiceLang(v as "en" | "id")}>
                  <SelectTrigger>
                    {voiceLang === "en" ? "English" : "Bahasa Indonesia"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Voice */}
              <div>
                <div className="mb-1 text-xs text-muted-foreground">
                  {t.book.voice}
                </div>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    {voiceDisplay
                      ? `${voiceDisplay.name}${voiceDisplay.gender ? ` · ${voiceDisplay.gender}` : ""}`
                      : voice}
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((v) => (
                      <SelectItem key={v.name} value={v.name}>
                        {v.name}
                        {v.gender ? ` · ${v.gender}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Speed slider */}
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.book.speed}</span>
                <span className="font-mono">{nearestSpeedLabel(speedVal)}</span>
              </div>
              <Slider
                value={speedVal}
                min={-50}
                max={100}
                step={25}
                onValueChange={setSpeedVal}
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TEXT MODE                                                       */}
      {/* ============================================================ */}
      {mode === "text" && (
        <div className="suaraka-glass rounded-2xl p-5">
          {/* Header: page title + nav */}
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="font-heading text-lg tracking-tight">
                {page ? `Page ${page.pageNumber}` : "—"}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {page?.wordCount ?? 0} words
                {showTranslation && translatedText && " · translated"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Translate toggle */}
              <Button
                variant={showTranslation ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={handleTranslate}
                disabled={translating || reformatting}
              >
                {translating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4" />
                )}
                {translating
                  ? t.book.translating
                  : showTranslation
                    ? t.book.originalText
                    : t.book.translate}
              </Button>
              <Button
                variant={showReformat ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={handleReformat}
                disabled={reformatting || translating}
              >
                {reformatting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {reformatting
                  ? t.book.reformatting
                  : showReformat
                    ? t.book.originalText
                    : t.book.reformat}
              </Button>
              {/* Page navigation */}
              <Button
                variant="ghost"
                size="icon"
                disabled={pageIdx === 0}
                onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                aria-label="Previous page"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pageIdx >= pages.length - 1}
                onClick={() =>
                  setPageIdx((i) => Math.min(pages.length - 1, i + 1))
                }
                aria-label="Next page"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Reading area — optimised for long-form reading comfort */}
          <div className="suaraka-scroll max-h-[72vh] overflow-y-auto rounded-2xl bg-[hsl(var(--card))] px-6 py-8 shadow-inner ring-1 ring-border/30 md:px-10 lg:px-14">
            <div
              className="mx-auto max-w-[68ch] whitespace-pre-wrap wrap-break-word text-[1.0625rem] leading-[1.85] tracking-[0.01em] text-foreground/90 selection:bg-primary/20"
              style={{ fontVariantLigatures: "common-ligatures", wordSpacing: "0.04em" }}
            >
              {displayText}
            </div>
          </div>

          {/* Bottom pagination bar */}
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <button
              disabled={pageIdx === 0}
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
              className="rounded-lg px-3 py-1.5 transition hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-30"
            >
              ← {pageIdx > 0 ? `Page ${pages[pageIdx - 1]?.pageNumber}` : ""}
            </button>
            <span className="font-mono">
              {pageIdx + 1} / {pages.length}
            </span>
            <button
              disabled={pageIdx >= pages.length - 1}
              onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}
              className="rounded-lg px-3 py-1.5 transition hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-30"
            >
              {pageIdx < pages.length - 1 ? `Page ${pages[pageIdx + 1]?.pageNumber}` : ""} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
