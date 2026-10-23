import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Reuse one connection pool across dev hot reloads.
const globalForDb = globalThis as unknown as { pg?: postgres.Sql };
// prepare: false is required by Supabase's transaction pooler (port 6543)
// and harmless on direct/session connections.
const client = globalForDb.pg ?? postgres(DATABASE_URL, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema });
export { client as sql };
