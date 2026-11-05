/**
 * Seed data shape checks that the facts page relies on. The facts page renders
 * each watch-for line as "<b>Label:</b> text" when it has a colon, so a colon
 * deep inside a sentence would turn the whole sentence bold.
 */
import { describe, expect, it } from 'vitest';
// @ts-ignore - plain .mjs module shared with the CLI scripts
import { buildSeed } from '../scripts/seed-data.mjs';

type SeedItem = { name: string; watchFor?: string | null };

describe('seed data', () => {
  it('watch-for labels are short', () => {
    const seed = buildSeed();
    const items: SeedItem[] = [...seed.supplements, ...seed.care.supplements];
    for (const item of items) {
      for (const line of (item.watchFor ?? '').split('\n')) {
        const label = /^([^:]+):/.exec(line.trim())?.[1];
        if (label) expect(label.length, `${item.name}: "${label.slice(0, 40)}…"`).toBeLessThanOrEqual(24);
      }
    }
  });
});
