/**
 * Workout math unit tests, against the seeded Thu–Sat program (SPEC 11.2).
 */
import { describe, expect, it } from 'vitest';
import {
  daySummary,
  epley1Rm,
  estimateMinutes,
  formatDaySummary,
  formatRest,
  type SummaryInput,
} from '@/lib/workout';

/** Thursday "Push": sets 4/3/3/4/3, rests 120/90/120/60/60. */
const PUSH: SummaryInput[] = [
  { sets: 4, restSeconds: 120 }, // Chest press
  { sets: 3, restSeconds: 90 }, // Incline chest press
  { sets: 3, restSeconds: 120 }, // Shoulder press
  { sets: 4, restSeconds: 60 }, // Cable lateral raise
  { sets: 3, restSeconds: 60 }, // Triceps pushdown
];

/** Friday "Legs + core". */
const LEGS: SummaryInput[] = [
  { sets: 4, restSeconds: 150 }, // Leg press
  { sets: 3, restSeconds: 90 }, // Seated leg curl
  { sets: 3, restSeconds: 90 }, // Leg extension
  { sets: 3, restSeconds: 120 }, // Hip thrust machine
  { sets: 4, restSeconds: 60 }, // Standing calf raise
  { sets: 3, restSeconds: 60 }, // Ab crunch machine
];

describe('estimateMinutes / daySummary', () => {
  it('Push day: 17 sets, 2295 s of work, about 40 min', () => {
    const seconds = PUSH.reduce((acc, it) => acc + it.sets * (45 + it.restSeconds), 0);
    expect(seconds).toBe(2295);
    expect(estimateMinutes(PUSH)).toBe(40);
    expect(daySummary(PUSH)).toEqual({ exercises: 5, sets: 17, minutes: 40 });
  });

  it('Legs day: 6 exercises, 20 sets', () => {
    const summary = daySummary(LEGS);
    expect(summary.exercises).toBe(6);
    expect(summary.sets).toBe(20);
    // 2820 s -> 47 min -> rounded to the nearest 5 = 45
    expect(summary.minutes).toBe(45);
  });
});

describe('formatDaySummary', () => {
  it('matches the reference wording for the Push day', () => {
    expect(formatDaySummary(PUSH)).toBe('5 exercises · 17 sets · about 40 min');
  });

  it('uses the singular for one exercise', () => {
    expect(formatDaySummary([{ sets: 3, restSeconds: 60 }])).toBe(
      '1 exercise · 3 sets · about 5 min',
    );
  });
});

describe('epley1Rm', () => {
  it('estimates 1RM via Epley for multi-rep sets', () => {
    expect(epley1Rm(100, 10)).toBe(100 * (1 + 10 / 3e1));
    expect(epley1Rm(100, 10)).toBeCloseTo(133.33, 1);
  });

  it('a single at 80 kg is already a 1RM', () => {
    expect(epley1Rm(80, 1)).toBe(80);
  });
});

describe('formatRest', () => {
  it('formats seconds as "Rest m:ss"', () => {
    expect(formatRest(90)).toBe('Rest 1:30');
    expect(formatRest(120)).toBe('Rest 2:00');
    expect(formatRest(150)).toBe('Rest 2:30');
    expect(formatRest(60)).toBe('Rest 1:00');
  });
});
