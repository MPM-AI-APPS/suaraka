import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { books, pages } from "@/db/schema";
import { requireUser } from "@/app/api/_lib/session";
import { translateText } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_TARGETS = new Set(["en", "id"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string; pageId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId, pageId } = await params;

  const body = (await req.json().catch(() => ({}))) as { target?: string };
  const target = VALID_TARGETS.has(body.target ?? "") ? (body.target as "en" | "id") : "en";

  const db = getDb();
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, guard.user.id)),
  });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const page = await db.query.pages.findFirst({
    where: and(eq(pages.id, pageId), eq(pages.bookId, bookId)),
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const translated = await translateText(page.text, target);
    return NextResponse.json({ translated, target });
  } catch (err) {
    console.error("translation failed", err);
    return NextResponse.json({ error: "translation failed" }, { status: 502 });
  }
}
