import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { books, chapters } from "@/db/schema";
import { requireUser } from "@/app/api/_lib/session";
import { readBuffer } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapterId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId, chapterId } = await params;

  const db = getDb();
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, guard.user.id)),
  });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.bookId, bookId)),
  });
  if (!chapter?.audioPath) {
    return NextResponse.json({ error: "not generated" }, { status: 404 });
  }

  const buf = await readBuffer(chapter.audioPath);
  const mime = chapter.audioPath.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}
