#!/usr/bin/env node
/**
 * `npm run dev:local` — `next dev` against ./data/dev.db.
 *
 * While the Docker container runs, ./data/app.db belongs to it (see the owner
 * lock in src/db/ddl.mjs); a dev server on the host must use its own file.
 * DATABASE_PATH set in the environment still wins.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const env = { ...process.env, DATABASE_PATH: process.env.DATABASE_PATH || './data/dev.db' };

const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
