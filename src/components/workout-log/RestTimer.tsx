'use client';

import { useEffect, useRef, useState } from 'react';
import { formatSeconds } from '@/lib/dates';

/**
 * Rest countdown, fixed above the bottom nav. The remaining time is always
 * recomputed from an `endsAt` timestamp (every 250 ms and on visibilitychange),
 * never accumulated from interval ticks, so a locked screen does not pause it.
 * At zero it vibrates / notifies if permitted, then asks the parent to hide it
 * after 3 s.
 */
export function RestTimer({
  exerciseName,
  endsAt,
  onExtend,
  onSkip,
  onDone,
}: {
  exerciseName: string;
  /** Epoch ms (Date.now() based) when the rest ends. */
  endsAt: number;
  onExtend: () => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState<number>(() => Date.now());
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const over = now >= endsAt;
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  // Fire once per endsAt when the countdown crosses zero, hide 3 s later.
  // `over` only flips when endsAt or the zero crossing changes, so this does
  // not re-run on every 250 ms tick.
  useEffect(() => {
    if (!over) return;
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {
        // not available (e.g. iOS Safari) — ignore
      }
    }
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.showNotification('Rest over', { body: exerciseName, tag: 'rest-timer' }))
        .catch(() => undefined);
    }
    const t = window.setTimeout(() => onDoneRef.current(), 3000);
    return () => window.clearTimeout(t);
  }, [over, endsAt, exerciseName]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <div className="wrap">
        <div
          className="card"
          role="timer"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.22)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <span
              className="label"
              aria-live="polite"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {over ? 'Rest over' : 'Rest'} · {exerciseName}
            </span>
            <span className="setdose tnum" style={{ textAlign: 'left' }}>
              {formatSeconds(remaining)}
            </span>
          </div>
          <button type="button" className="btn" onClick={onExtend}>
            +30 s
          </button>
          <button type="button" className="btn" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
