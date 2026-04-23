import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

declare global {
  var __suaraka_pool__: Pool | undefined;
  var __suaraka_db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export function getDb() {
  if (globalThis.__suaraka_db__) return globalThis.__suaraka_db__;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured for Suaraka.");

  const pool =
    globalThis.__suaraka_pool__ ?? new Pool({ connectionString: databaseUrl });

  if (!globalThis.__suaraka_pool__) {
    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
    globalThis.__suaraka_pool__ = pool;
  }

  const db = drizzle(pool, { schema });
  globalThis.__suaraka_db__ = db;
  return db;
}
