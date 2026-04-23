import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { books, chapters } from "@/db/schema";
import { requireUser } from "../_lib/session";
import { extractPdf, guessMeta } from "@/lib/pdf";
import { saveBuffer } from "@/lib/storage";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  const db = getDb();
  const rows = await db
    .select()
    .from(books)
    .where(eq(books.userId, guard.user.id))
    .orderBy(desc(books.updatedAt));

  return NextResponse.json({
    books: rows.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      language: b.language as "en" | "id",
      pageCount: b.pageCount,
      wordCount: b.wordCount,
      status: b.status,
      isFavorite: b.isFavorite,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file missing" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bookId = newId("bk");
  const pdfPath = `users/${guard.user.id}/books/${bookId}/source.pdf`;
  await saveBuffer(pdfPath, buffer);

  let extracted;
  try {
    extracted = await extractPdf(buffer);
  } catch (err) {
    console.error("PDF extract failed", err);
    return NextResponse.json({ error: "could not parse PDF" }, { status: 422 });
  }

  const meta = guessMeta(extracted.text);
  const title =
    meta.title?.slice(0, 160) ||
    file.name.replace(/\.pdf$/i, "").slice(0, 160) ||
    "Untitled";

  const db = getDb();
  const [book] = await db
    .insert(books)
    .values({
      id: bookId,
      userId: guard.user.id,
      title,
      author: meta.author ?? null,
      language: detectLanguage(extracted.text),
      pdfPath,
      pageCount: extracted.pageCount,
      wordCount: extracted.wordCount,
      extractedText: extracted.text,
      status: "ready",
    })
    .returning();

  if (extracted.chapters.length > 0) {
    await db.insert(chapters).values(
      extracted.chapters.map((c) => ({
        id: newId("ch"),
        bookId,
        index: c.index,
        title: c.title.slice(0, 200),
        text: c.text,
        wordCount: c.wordCount,
      }))
    );
  }

  return NextResponse.json({
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      language: book.language,
      pageCount: book.pageCount,
      wordCount: book.wordCount,
      status: book.status,
      isFavorite: book.isFavorite,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    },
  });
}

function detectLanguage(text: string): "en" | "id" {
  const sample = text.slice(0, 4000).toLowerCase();
  const idHits = (sample.match(/\b(dan|yang|tidak|dengan|adalah|untuk|ini|itu|dalam|pada|dari)\b/g) || []).length;
  const enHits = (sample.match(/\b(the|and|of|to|in|a|is|that|for|it|on)\b/g) || []).length;
  return idHits > enHits ? "id" : "en";
}
