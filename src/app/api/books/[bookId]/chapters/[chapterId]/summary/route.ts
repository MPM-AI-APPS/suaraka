import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { books, chapters, insights } from "@/db/schema";
import { requireUser } from "@/app/api/_lib/session";
import { summarizeChapter } from "@/lib/llm";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_LOCALES = new Set(["en", "id"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId, chapterId } = await params;

  const body = await req.json().catch(() => ({})) as { locale?: string };
  const db = getDb();
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, guard.user.id)),
  });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.bookId, bookId)),
  });
  if (!chapter) return NextResponse.json({ error: "not found" }, { status: 404 });

  const locale = (VALID_LOCALES.has(body.locale ?? "") ? body.locale : book.language) as "en" | "id";

  try {
    const result = await summarizeChapter(chapter.text, locale);
    await db.insert(insights).values({
      id: newId("ins"),
      bookId,
      chapterId,
      kind: "summary",
      content: result,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("summary failed", err);
    return NextResponse.json({ error: "summary failed" }, { status: 502 });
  }
}
