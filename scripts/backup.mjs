#!/usr/bin/env node
/**
 * Back up the SQLite database (same logic as src/server/backup.ts, which the
 * in-app 03:00 scheduler uses).
 *
 *   npm run backup
 *
 * Uses better-sqlite3's online backup (`sqlite3 .backup` semantics, safe while
 * the app is running) to <db dir>/backups/app-YYYY-MM-DD.db and keeps the
 * newest 30 backups.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const KEEP = 30;

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');

let db;
try {
  db = new Database(dbPath, { fileMustExist: true });
} catch {
  console.error(`Error: no database at ${dbPath} — nothing to back up.`);
  process.exit(1);
}

try {
  const dir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(dir, `app-${stamp}.db`);
  await db.backup(dest);

  const files = fs
    .readdirSync(dir)
    .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  while (files.length > KEEP) {
    fs.unlinkSync(path.join(dir, files.shift()));
  }

  console.log(dest);
} finally {
  db.close();
}
