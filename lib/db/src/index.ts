import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazily initialize so importing this module never throws at evaluation time.
// The error surfaces only when a query is actually executed — by which point
// the API server has already loaded .env and DATABASE_URL is set.
let _pool: pg.Pool | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

function getPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to add it to your .env file?",
      );
    }
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as never)[prop as keyof pg.Pool];
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle(getPool(), { schema });
    }
    return (_db as never)[prop as keyof typeof _db];
  },
});

export * from "./schema";
