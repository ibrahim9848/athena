'use client';

import { useEffect, useState } from 'react';

type Theme = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'athena-theme';

const OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Per-device theme override. "Auto" follows prefers-color-scheme; "Light" and
 * "Dark" pin the theme via `data-theme` on <html> (see globals.css) and are
 * remembered in localStorage, which the root layout's inline script replays
 * before first paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch {
      // Storage unavailable (private mode etc.) — stay on auto.
    }
  }, []);

  function apply(value: Theme) {
    setTheme(value);
    try {
      if (value === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore: the theme still applies for this page view.
    }
    if (value === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
  }

  return (
    <div role="group" aria-label="Theme" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={theme === opt.value ? 'btn btn-dark' : 'btn'}
          aria-pressed={theme === opt.value}
          onClick={() => apply(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
