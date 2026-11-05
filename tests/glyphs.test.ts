/**
 * The care product glyphs share the seven-day box with the pills, so they must
 * fit the pill glyph box (plan: "same box as .pill.round", 12px tall) — a taller
 * glyph makes every day cell taller and pushes the day's plan off a phone screen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

/** Declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

function pxOf(declarations: string, property: string): number | null {
  const m = new RegExp(`(?:^|[;\\s])${property}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(declarations);
  return m ? Number(m[1]) : null;
}

describe('care glyphs', () => {
  it('fit the pill box', () => {
    for (const form of ['drop', 'tube', 'bottle', 'tool']) {
      const decls = rule(`.pill.${form}`);
      expect(decls, `.pill.${form} is defined`).not.toBe('');
      expect(pxOf(decls, 'height'), `.pill.${form} height`).not.toBeNull();
      expect(pxOf(decls, 'height')!, `.pill.${form} height`).toBeLessThanOrEqual(12);
      // Vertical margins would add to the row height too.
      expect(decls, `.pill.${form} margin`).not.toMatch(/(?:^|[;\s])margin(?:-top|-bottom)?:/);
    }
  });

  it('draw the drop point-up, not as a map pin', () => {
    // A square with one sharp corner, rotated so that corner points up: the
    // sharp corner is top-left and the turn is +45deg (the map-pin recipe is
    // bottom-left sharp with -45deg).
    const decls = rule('.pill.drop');
    expect(decls).toMatch(/border-radius:\s*0 50% 50% 50%/);
    expect(decls).toMatch(/transform:\s*rotate\(45deg\)/);
  });
});
