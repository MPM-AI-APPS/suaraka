import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertUser } from "@/db/queries";

/** Fixed identity used when NEXT_PUBLIC_DISABLE_LOGIN=true */
const GUEST = {
  id: "local-user",
  email: "local@suaraka.local",
  displayName: "Reader",
} as const;

export async function requireUser(req?: NextRequest) {
  void req;

  // ── No-auth mode ──────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true") {
    const user = await upsertUser(GUEST);
    return { user, session: null };
  }

  // ── Normal auth mode ──────────────────────────────────────────────
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const user = await upsertUser({
    id: session.user.id,
    email: session.user.email || "",
    displayName: session.user.name || session.user.email || "Reader",
  });
  return { user, session };
}
