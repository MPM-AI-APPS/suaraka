import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { books, chapters } from "@/db/schema";
import { requireUser } from "../../_lib/session";
import { remove } from "@/lib/storage";
import { z } from "zod";

export const runtime = "nodejs";

async function loadOwned(userId: string, bookId: string) {
  const db = getDb();
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
  });
  return book ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId } = await params;

  const book = await loadOwned(guard.user.id, bookId);
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const db = getDb();
  const chapterRows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .orderBy(asc(chapters.index));

  return NextResponse.json({
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      language: book.language as "en" | "id",
      pageCount: book.pageCount,
      wordCount: book.wordCount,
      status: book.status,
      isFavorite: book.isFavorite,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    },
    chapters: chapterRows.map((c) => {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      return {
        id: c.id,
        index: c.index,
        title: c.title,
        wordCount: c.wordCount,
        audioStatus: c.audioStatus,
        audioDurationSec: c.audioDurationSec,
        audioUrl:
          c.audioStatus === "ready"
            ? `${basePath}/api/books/${bookId}/chapters/${c.id}/audio`
            : null,
      };
    }),
  });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isFavorite: z.boolean().optional(),
  shelfId: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId } = await params;

  const book = await loadOwned(guard.user.id, bookId);
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(books)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(books.id, bookId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId } = await params;

  const book = await loadOwned(guard.user.id, bookId);
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const db = getDb();
  await db.delete(books).where(eq(books.id, bookId));
  await remove(`users/${guard.user.id}/books/${bookId}`);
  return NextResponse.json({ ok: true });
}
