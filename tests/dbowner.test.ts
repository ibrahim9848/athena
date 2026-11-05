import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-ignore - plain .mjs module shared with the CLI scripts
import { OWNER_STALE_MS, assertNoForeignOwner, claimDatabase } from '../src/db/ddl.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-owner-'));
const dbPath = path.join(dir, 'app.db');
const ownerFile = `${dbPath}.owner`;

function writeOwner(host: string, heartbeat: number) {
  fs.writeFileSync(ownerFile, JSON.stringify({ host, pid: 4242, heartbeat }));
}

afterEach(() => fs.rmSync(ownerFile, { force: true }));

describe('database owner lock (cross-host guard)', () => {
  it('allows opening when nobody owns the database', () => {
    expect(() => assertNoForeignOwner(dbPath, 'windows-pc')).not.toThrow();
  });

  it('refuses a different host while the owner heartbeat is fresh', () => {
    writeOwner('athena-container', Date.now());
    expect(() => assertNoForeignOwner(dbPath, 'windows-pc')).toThrow(/in use by the Athena server/);
  });

  it('allows the same host (SQLite locking works there)', () => {
    writeOwner('athena-container', Date.now());
    expect(() => assertNoForeignOwner(dbPath, 'athena-container')).not.toThrow();
  });

  it('ignores a stale heartbeat from a server that is gone', () => {
    const now = Date.now();
    writeOwner('athena-container', now - OWNER_STALE_MS - 1000);
    expect(() => assertNoForeignOwner(dbPath, 'windows-pc', now)).not.toThrow();
  });

  it('claim writes this process as owner and release removes only its own claim', () => {
    const release = claimDatabase(dbPath, 'test-host');
    const owner = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
    expect(owner).toMatchObject({ host: 'test-host', pid: process.pid });
    expect(() => assertNoForeignOwner(dbPath, 'other-host')).toThrow();
    release();
    expect(fs.existsSync(ownerFile)).toBe(false);
  });

  it('release leaves a claim taken over by another host alone', () => {
    const release = claimDatabase(dbPath, 'test-host');
    writeOwner('someone-else', Date.now());
    release();
    expect(fs.existsSync(ownerFile)).toBe(true);
  });

  it('in-memory databases are never locked', () => {
    expect(() => assertNoForeignOwner(':memory:', 'x')).not.toThrow();
    expect(claimDatabase(':memory:', 'x')).toBeTypeOf('function');
  });
});
