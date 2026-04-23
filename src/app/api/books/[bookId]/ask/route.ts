import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { books } from "@/db/schema";
import { requireUser } from "@/app/api/_lib/session";
import { askBook } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_LOCALES = new Set(["en", "id"]);
const schema = z.object({
  question: z.string().min(1).max(1000),
  locale: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, guard.user.id)),
  });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const locale = (VALID_LOCALES.has(parsed.data.locale ?? "") ? parsed.data.locale : book.language) as "en" | "id";

  try {
    const answer = await askBook(
      parsed.data.question,
      book.extractedText || "",
      locale
    );
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("ask failed", err);
    return NextResponse.json({ error: "ask failed" }, { status: 502 });
  }
}
