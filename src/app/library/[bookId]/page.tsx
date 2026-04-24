"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart, LayoutPanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudiobookPlayer } from "@/components/audiobook-player";
import { BookAssistant } from "@/components/book-assistant";
import { api, type BookSummary, type PageSummary } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "sonner";

const AUDIO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUDIO !== "false";

export default function BookPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { t } = useI18n();
  const [book, setBook] = useState<BookSummary | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePageId, setActivePageId] = useState<string | undefined>();
  const [mode, setMode] = useState<"audio" | "text">(AUDIO_ENABLED ? "audio" : "text");
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    api
      .getBook(bookId)
      .then((r) => {
        setBook(r.book);
        setPages(r.pages);
        setActivePageId(r.pages[0]?.id);
      })
      .catch(() => toast.error("Failed to load book"))
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) {
    return (
      <div className="h-[60vh] animate-pulse rounded-2xl border border-border/60 bg-card/60" />
    );
  }

  if (!book) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">Book not found.</p>
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <Link href="/library">
            <ArrowLeft /> Back to library
          </Link>
        </Button>
      </div>
    );
  }

  const onToggleFav = async () => {
    await api.updateBook(book.id, { isFavorite: !book.isFavorite });
    setBook({ ...book, isFavorite: !book.isFavorite });
  };

  return (
    <div className="flex flex-col gap-6 suaraka-reveal">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link href="/library">
            <ArrowLeft /> Library
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Favorite" onClick={onToggleFav}>
          <Heart className={book.isFavorite ? "fill-primary text-primary" : ""} />
        </Button>
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{book.language.toUpperCase()}</Badge>
          <Badge variant="outline">{book.pageCount} pages</Badge>
          <Badge variant="outline">{book.wordCount.toLocaleString()} words</Badge>
          <Badge
            variant={
              book.status === "ready"
                ? "success"
                : book.status === "failed"
                  ? "warning"
                  : "secondary"
            }
          >
            {book.status}
          </Badge>
        </div>
        <h1 className="font-heading text-3xl tracking-tight md:text-4xl">{book.title}</h1>
        {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
      </header>

      <div
        className={
          mode === "text"
            ? "flex flex-col gap-5"
            : "grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start"
        }
      >
        <AudiobookPlayer
          bookId={book.id}
          language={book.language}
          pages={pages}
          mode={mode}
          onModeChange={setMode}
          onPageChange={setActivePageId}
        />

        {/* In audio mode: always-visible sidebar. In text mode: collapsible panel below. */}
        {mode === "audio" ? (
          <BookAssistant bookId={book.id} currentPageId={activePageId} />
        ) : (
          <div className="suaraka-glass rounded-2xl overflow-hidden">
            <button
              onClick={() => setAssistantOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-sm font-medium hover:bg-secondary/40 transition"
            >
              <span className="flex items-center gap-2">
                <LayoutPanelLeft className="h-4 w-4 text-primary" />
                {t.book.assistantPanel}
              </span>
              <span className="text-muted-foreground">{assistantOpen ? "▲" : "▼"}</span>
            </button>
            {assistantOpen && (
              <div className="border-t border-border/60 p-4">
                <BookAssistant bookId={book.id} currentPageId={activePageId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
