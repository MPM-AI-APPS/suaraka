import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { books, pages } from "@/db/schema";
import { requireUser } from "@/app/api/_lib/session";
import { synthesize } from "@/lib/tts";
import { saveBuffer } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  voice: z.string().default("en-US-AriaNeural"),
  rate: z.string().optional(),
  pitch: z.string().optional(),
  volume: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string; pageId: string }> }
) {
  const guard = await requireUser();
  if ("error" in guard) return guard.error;
  const { bookId, pageId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, guard.user.id)),
  });
  if (!book) return NextResponse.json({ error: "not found" }, { status: 404 });

  const page = await db.query.pages.findFirst({
    where: and(eq(pages.id, pageId), eq(pages.bookId, bookId)),
  });
  if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .update(pages)
    .set({ audioStatus: "generating" })
    .where(eq(pages.id, pageId));

  try {
    const result = await synthesize({
      text: page.text,
      voice: parsed.data.voice,
      rate: parsed.data.rate,
      pitch: parsed.data.pitch,
      volume: parsed.data.volume,
    });

    const ext = result.mime === "audio/mpeg" ? "mp3" : "wav";
    const audioPath = `users/${guard.user.id}/books/${bookId}/audio/${pageId}.${ext}`;
    await saveBuffer(audioPath, result.audio);

    await db
      .update(pages)
      .set({
        audioPath,
        audioDurationSec: result.durationSec ?? null,
        audioVoice: parsed.data.voice,
        audioStatus: "ready",
      })
      .where(eq(pages.id, pageId));

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    return NextResponse.json({
      audioUrl: `${basePath}/api/books/${bookId}/pages/${pageId}/audio`,
      durationSec: result.durationSec,
    });
  } catch (err) {
    console.error("TTS failed", err);
    await db
      .update(pages)
      .set({ audioStatus: "failed" })
      .where(eq(pages.id, pageId));
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }
}
