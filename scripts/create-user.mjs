#!/usr/bin/env node
/**
 * Create a user from the command line.
 *
 *   npm run create-user -- --username ibrahim --role owner
 *   node scripts/create-user.mjs --username sara --display-name "Sara" --timezone Asia/Riyadh
 *
 * Prompts for the password twice with hidden input. For non-interactive use
 * pass --password (visible in your shell history — prefer the prompt).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import { applySchema } from '../src/db/ddl.mjs';

const USAGE = `Usage: npm run create-user -- --username <name> [options]

Options:
  --username <name>       required; 2-32 chars of a-z 0-9 _ . -
  --role <owner|member>   default: member
  --display-name <name>   default: the username
  --timezone <iana tz>    default: Asia/Riyadh
  --password <password>   skip the prompt (non-interactive use)
  -h, --help              show this help`;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/* ---------- argument parsing ---------- */

function parseArgs(argv) {
  const known = new Set(['username', 'role', 'display-name', 'timezone', 'password']);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    if (!arg.startsWith('--')) fail(`Unexpected argument '${arg}'.\n\n${USAGE}`);
    let name = arg.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq !== -1) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    } else {
      value = argv[++i];
    }
    if (!known.has(name)) fail(`Unknown option '--${name}'.\n\n${USAGE}`);
    if (value === undefined) fail(`Option '--${name}' needs a value.`);
    out[name] = value;
  }
  return out;
}

/* ---------- password prompts ---------- */

/** Hidden prompt: raw stdin with muted output (only the question is printed). */
function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          // Ctrl-C
          cleanup();
          process.stdout.write('\n');
          process.exit(130);
        } else if (ch === '\r' || ch === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1);
        } else if (ch >= ' ') {
          value += ch;
        }
      }
    };
    stdin.on('data', onData);
  });
}

/** Visible prompt via readline (fallback when stdin is not a TTY). */
function promptVisible(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

async function askPassword() {
  if (process.stdin.isTTY) {
    const first = await promptHidden('Password: ');
    const second = await promptHidden('Repeat password: ');
    if (first !== second) fail('Passwords do not match. Nothing was created.');
    return first;
  }
  console.error('Warning: stdin is not a TTY, so the password will be visible as you type.');
  return promptVisible('Password: ');
}

/* ---------- main ---------- */

const args = parseArgs(process.argv.slice(2));

const username = args.username;
if (!username) fail(`--username is required.\n\n${USAGE}`);
if (!/^[a-z0-9_.-]{2,32}$/.test(username)) {
  fail(`Invalid username '${username}'. Use 2-32 characters of a-z, 0-9, '_', '.' or '-'.`);
}

const role = args.role ?? 'member';
if (role !== 'owner' && role !== 'member') fail(`--role must be 'owner' or 'member', got '${role}'.`);

const displayName = args['display-name'] ?? username;

const timezone = args.timezone ?? 'Asia/Riyadh';
try {
  new Intl.DateTimeFormat('en-US', { timeZone: timezone });
} catch {
  fail(`'${timezone}' is not a valid IANA timezone (expected something like 'Asia/Riyadh').`);
}

const password = args.password ?? (await askPassword());
if (!password) fail('Password must not be empty. Nothing was created.');

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
try {
  applySchema(db);

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    fail(`A user named '${username}' already exists. Pick another username, or reset their password from /admin.`);
  }

  const passwordHash = await argon2.hash(password);
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, timezone, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), username, passwordHash, displayName, timezone, role, new Date().toISOString());

  console.log(`Created ${role} '${username}' (display name '${displayName}', timezone ${timezone}).`);
  console.log(`Database: ${dbPath}`);
  console.log(`Next: npm run seed -- --user ${username}   (loads the default plans)`);
} catch (err) {
  if (err && /UNIQUE constraint failed: users\.username/.test(String(err.message))) {
    fail(`A user named '${username}' already exists. Pick another username, or reset their password from /admin.`);
  }
  throw err;
} finally {
  db.close();
}
