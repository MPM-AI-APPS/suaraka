"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudiobookPlayer } from "@/components/audiobook-player";
import { BookAssistant } from "@/components/book-assistant";
import { api, type BookSummary, type ChapterSummary } from "@/lib/api";
import { toast } from "sonner";

export default function BookPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<BookSummary | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChapterId, setActiveChapterId] = useState<string | undefined>();

  useEffect(() => {
    api
      .getBook(bookId)
      .then((r) => {
        setBook(r.book);
        setChapters(r.chapters);
        setActiveChapterId(r.chapters[0]?.id);
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <AudiobookPlayer
          bookId={book.id}
          language={book.language}
          chapters={chapters}
        />
        <BookAssistant bookId={book.id} currentChapterId={activeChapterId} />
      </div>
    </div>
  );
}
