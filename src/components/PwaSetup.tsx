'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { flushOutbox, initOutbox } from '@/lib/outbox';

/**
 * App-shell plumbing, mounted once from the (app) layout:
 * - registers the service worker (offline cache + Web Push),
 * - boots the offline outbox (replays queued ops on 'online'),
 * - flushes the outbox whenever the tab becomes visible again,
 * - refreshes server-rendered state once queued ops have been applied.
 */
export function PwaSetup() {
  const router = useRouter();
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // registration can fail on http or in private mode; the app still works
      });
    }
    initOutbox(() => router.refresh());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void flushOutbox();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [router]);
  return null;
}
