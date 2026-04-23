import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

/** Ensure a user row exists for the given Keycloak identity. */
export async function upsertUser(input: {
  id: string;
  email: string;
  displayName: string;
}) {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.id, input.id) });
  if (existing) {
    await db
      .update(users)
      .set({ email: input.email, displayName: input.displayName, lastActive: new Date() })
      .where(eq(users.id, input.id));
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      displayName: input.displayName,
      lastActive: new Date(),
    })
    .returning();
  return created;
}
