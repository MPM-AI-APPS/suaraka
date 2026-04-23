import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertUser } from "@/db/queries";

export async function requireUser(req?: NextRequest) {
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
  void req;
  return { user, session };
}
