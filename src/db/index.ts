import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
// @ts-ignore - plain .mjs module shared with the CLI scripts
import { applySchema, assertNoForeignOwner, claimDatabase } from './ddl.mjs';

export type Db = BetterSQLite3Database<typeof schema>;
type Instance = { db: Db; sqlite: Database.Database };

function createDb(): Instance {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    assertNoForeignOwner(dbPath);
  }
  const sqlite = new Database(dbPath);
  applySchema(sqlite);
  claimDatabase(dbPath);
  return { db: drizzle(sqlite, { schema }), sqlite };
}

// Survive Next.js dev-mode module reloads with a single connection.
const globalForDb = globalThis as unknown as { __athenaDb?: Instance };

function instance(): Instance {
  return globalForDb.__athenaDb ?? (globalForDb.__athenaDb = createDb());
}

/**
 * Opened on first use rather than at import: `next build` imports these
 * modules while collecting pages and must never touch the live database.
 */
function lazy<T extends object>(pick: (i: Instance) => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const target = pick(instance());
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export const db: Db = lazy((i) => i.db);
export const sqlite: Database.Database = lazy((i) => i.sqlite);
