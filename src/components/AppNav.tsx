'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  {
    href: '/',
    label: 'Today',
    match: (p: string) => p === '/',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6.5 10v9h11v-9" />
      </svg>
    ),
  },
  {
    href: '/supplements',
    label: 'Pills',
    match: (p: string) => p.startsWith('/supplements'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="9" width="18" height="7" rx="3.5" />
        <path d="M12 9v7" />
      </svg>
    ),
  },
  {
    href: '/workouts',
    label: 'Train',
    match: (p: string) => p.startsWith('/workouts'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 12h10" />
        <rect x="3" y="8" width="3" height="8" rx="1" />
        <rect x="18" y="8" width="3" height="8" rx="1" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    match: (p: string) => p.startsWith('/settings') || p.startsWith('/admin'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.3 6.3l1.6 1.6M16.1 16.1l1.6 1.6M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6" />
      </svg>
    ),
  },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul>
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} aria-current={item.match(pathname) ? 'page' : undefined}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
