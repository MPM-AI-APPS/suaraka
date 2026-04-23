import { requireUser } from "@/app/api/_lib/session";
import { listVoices } from "@/lib/chatterbox";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  await requireUser();
  const voices = await listVoices();
  return NextResponse.json(voices);
}
