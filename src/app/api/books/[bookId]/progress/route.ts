import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { books, progress } from "@/db/schema";
import { requireUser } from "@/app/api/_lib/session";
import { newId } from "@/lib/utils";

export const runtime = "nodejs";

const schema = z.object({
  chapterId: z.string().optional(),
  positionSec: z.number().min(0),
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

  const existing = await db.query.progress.findFirst({
    where: and(eq(progress.userId, guard.user.id), eq(progress.bookId, bookId)),
  });

  if (existing) {
    await db
      .update(progress)
      .set({
        chapterId: parsed.data.chapterId ?? existing.chapterId,
        positionSec: parsed.data.positionSec,
        updatedAt: new Date(),
      })
      .where(eq(progress.id, existing.id));
  } else {
    await db.insert(progress).values({
      id: newId("pr"),
      userId: guard.user.id,
      bookId,
      chapterId: parsed.data.chapterId ?? null,
      positionSec: parsed.data.positionSec,
    });
  }

  return NextResponse.json({ ok: true });
}
