'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  vapidPublicKey: string | null;
  hasSubscription: boolean;
};

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationsCard({ vapidPublicKey, hasSubscription }: Props) {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
  }, []);

  const status =
    supported === null
      ? 'Checking…'
      : !supported
        ? 'Not supported in this browser'
        : permission === 'denied'
          ? 'Permission denied'
          : hasSubscription
            ? 'Enabled'
            : 'Not enabled';

  async function enable() {
    if (!vapidPublicKey || !supported) return;
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        if (perm === 'denied') setError('Notifications are blocked for this site.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!p256dh || !auth) throw new Error('The subscription is missing its keys.');
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh, auth } }),
      });
      if (!res.ok) throw new Error('Could not save the subscription on the server.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable reminders.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable reminders.');
    } finally {
      setBusy(false);
    }
  }

  const canEnable = supported === true && permission !== 'denied' && !!vapidPublicKey;

  return (
    <div className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="label">Status</span>
        <strong>{status}</strong>
      </div>
      {vapidPublicKey ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void enable()}
            disabled={busy || !canEnable}
          >
            {busy ? 'Working…' : 'Enable reminders'}
          </button>
          <button type="button" className="btn" onClick={() => void disable()} disabled={busy || !supported}>
            Disable on this device
          </button>
        </div>
      ) : (
        <p className="muted">Push keys are not configured on the server (.env VAPID_*).</p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      <p className="muted" style={{ fontSize: 14 }}>
        On iPhone: install Athena to your Home Screen first (Share → Add to Home Screen), then
        enable reminders here.
      </p>
    </div>
  );
}
