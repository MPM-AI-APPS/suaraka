"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { api, type BookSummary } from "@/lib/api";
import { toast } from "sonner";

export default function LibraryPage() {
  const { t } = useI18n();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);

  useEffect(() => {
    api
      .listBooks()
      .then((r) => setBooks(r.books))
      .catch(() => toast.error("Failed to load library"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (onlyFav && !b.isFavorite) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        (b.author?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [books, query, onlyFav]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this book?")) return;
    await api.deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    toast.success("Deleted");
  };

  const onToggleFav = async (b: BookSummary) => {
    await api.updateBook(b.id, { isFavorite: !b.isFavorite });
    setBooks((prev) => prev.map((x) => (x.id === b.id ? { ...x, isFavorite: !x.isFavorite } : x)));
  };

  return (
    <div className="flex flex-col gap-6 suaraka-reveal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight md:text-4xl">{t.library.title}</h1>
          <p className="text-sm text-muted-foreground">{t.tagline}</p>
        </div>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/upload">
            <Plus /> {t.nav.upload}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.library.search}
            className="pl-9"
          />
        </div>
        <Button
          variant={onlyFav ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setOnlyFav((v) => !v)}
        >
          <Heart /> {t.library.favorites}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/60"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="suaraka-glass">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <CardTitle className="font-heading text-xl">{t.library.empty}</CardTitle>
            <CardDescription>{t.upload.subtitle}</CardDescription>
            <Button asChild className="rounded-full">
              <Link href="/upload">
                <Plus /> {t.library.emptyCta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <Card key={b.id} className="group suaraka-glass transition hover:shadow-md">
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/library/${b.id}`} className="block flex-1">
                    <div className="font-heading text-lg leading-tight tracking-tight">
                      {b.title}
                    </div>
                    {b.author && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{b.author}</div>
                    )}
                  </Link>
                  <button
                    onClick={() => onToggleFav(b)}
                    aria-label="Favorite"
                    className="text-muted-foreground transition hover:text-primary"
                  >
                    <Heart
                      className={b.isFavorite ? "fill-primary text-primary" : ""}
                    />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{b.language.toUpperCase()}</Badge>
                  <Badge variant="outline">{b.pageCount} pp</Badge>
                  <Badge
                    variant={
                      b.status === "ready"
                        ? "success"
                        : b.status === "failed"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={`/library/${b.id}`}>Open</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => onDelete(b.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
