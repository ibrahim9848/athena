import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
// @ts-ignore - plain .mjs module shared with the CLI scripts
import { applySchema } from './ddl.mjs';

export type Db = BetterSQLite3Database<typeof schema>;

function createDb(): { db: Db; sqlite: Database.Database } {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  applySchema(sqlite);
  return { db: drizzle(sqlite, { schema }), sqlite };
}

// Survive Next.js dev-mode module reloads with a single connection.
const globalForDb = globalThis as unknown as {
  __athenaDb?: { db: Db; sqlite: Database.Database };
};

const instance = globalForDb.__athenaDb ?? (globalForDb.__athenaDb = createDb());

export const db: Db = instance.db;
export const sqlite = instance.sqlite;
