/**
 * Client-side offline outbox. Mutations made while offline are queued in
 * IndexedDB and replayed against POST /api/sync when the connection returns.
 * Online, ops go straight to /api/sync so both paths share one code path.
 *
 * Ordering: if anything is already queued, new ops are appended to the queue
 * (after a flush attempt) instead of being posted directly, so a stale queued
 * op can never be replayed after a newer contradicting one.
 */

export type SyncOp =
  | { kind: 'tick'; ruleId: string; date: string; taken: boolean }
  | {
      kind: 'set';
      setId: string;
      weightKg?: number | null;
      reps?: number | null;
      done?: boolean;
    }
  | { kind: 'finish'; workoutId: string; notes?: string };

const DB_NAME = 'athena-outbox';
const STORE = 'ops';
/** Ops per POST; the server rejects oversized batches, so stay well under. */
const CHUNK = 200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueOps(ops: SyncOp[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const op of ops) store.add(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readAll(): Promise<{ keys: IDBValidKey[]; ops: SyncOp[] }> {
  const db = await openDb();
  const result = await new Promise<{ keys: IDBValidKey[]; ops: SyncOp[] }>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    tx.oncomplete = () => resolve({ keys: keysReq.result, ops: valsReq.result as SyncOp[] });
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return result;
}

async function removeKeys(keys: IDBValidKey[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const key of keys) store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearStore(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/**
 * POST one batch. 'applied' on 2xx (invalid ops are rejected per-op server-side
 * and must not be retried), 'rejected' on a non-network error such as 401
 * (do not queue: a later replay could run under a different signed-in user).
 * Throws on network failure.
 */
async function post(ops: SyncOp[]): Promise<'applied' | 'rejected'> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ops }),
  });
  return res.ok ? 'applied' : 'rejected';
}

async function hasQueued(): Promise<boolean> {
  try {
    const { keys } = await readAll();
    return keys.length > 0;
  } catch {
    return false;
  }
}

/**
 * Send ops now, or queue them if the network is down (or older ops are still
 * queued — ordering). Returns 'sent' when the server applied them.
 */
export async function sendOps(ops: SyncOp[]): Promise<'sent' | 'queued'> {
  await flushOutbox();
  if (await hasQueued()) {
    // Older ops are still pending; append so replay order stays correct.
    try {
      await queueOps(ops);
    } catch {
      // IndexedDB unavailable (private mode) -> nothing else we can do
    }
    return 'queued';
  }
  try {
    const result = await post(ops);
    return result === 'applied' ? 'sent' : 'queued';
  } catch {
    // network failure -> queue below
  }
  try {
    await queueOps(ops);
  } catch {
    // IndexedDB unavailable
  }
  return 'queued';
}

let flushing = false;
let onFlushed: (() => void) | null = null;

/**
 * Replay the outbox in insertion order, in chunks, removing only acknowledged
 * chunks; keeps the remainder on failure. Resolves true when queued ops were
 * applied on the server.
 */
export async function flushOutbox(): Promise<boolean> {
  if (flushing || typeof indexedDB === 'undefined') return false;
  flushing = true;
  let applied = false;
  try {
    const { keys, ops } = await readAll();
    for (let i = 0; i < ops.length; i += CHUNK) {
      const result = await post(ops.slice(i, i + CHUNK));
      if (result === 'rejected') {
        // e.g. signed out: keep the queue for a later flush under the right user
        break;
      }
      await removeKeys(keys.slice(i, i + CHUNK));
      applied = true;
    }
    if (applied) onFlushed?.();
  } catch {
    // still offline; try again on the next 'online' event
  } finally {
    flushing = false;
  }
  return applied;
}

/**
 * Drop everything queued. Called from the login screen so ops queued under a
 * previous session can never replay under a different user's session.
 */
export async function clearOutbox(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await clearStore();
  } catch {
    // nothing to clear / IndexedDB unavailable
  }
}

let initialized = false;

/**
 * Call once on app mount (PwaSetup does this). `onApplied` runs after queued
 * ops reach the server, so the shell can refresh server-rendered state.
 */
export function initOutbox(onApplied?: () => void): void {
  if (typeof window === 'undefined') return;
  if (onApplied) onFlushed = onApplied;
  if (initialized) return;
  initialized = true;
  window.addEventListener('online', () => void flushOutbox());
  void flushOutbox();
}
