import fs from 'node:fs';
import path from 'node:path';
import { sqlite } from '@/db';

const KEEP = 30;

/** Online backup via better-sqlite3 (sqlite3 .backup semantics); keeps the last 30. */
export async function runBackup(): Promise<string> {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
  const dir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(dir, `app-${stamp}.db`);
  await sqlite.backup(dest);
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  while (files.length > KEEP) {
    fs.unlinkSync(path.join(dir, files.shift()!));
  }
  return dest;
}
