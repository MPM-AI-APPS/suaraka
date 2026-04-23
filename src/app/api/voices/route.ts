import { requireUser } from "@/app/api/_lib/session";
import { listVoices } from "@/lib/tts";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await requireUser();
  const language = req.nextUrl.searchParams.get("language") ?? undefined;
  const voices = await listVoices(language);
  return NextResponse.json(voices);
}
