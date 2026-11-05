/**
 * The plans that run on the supplements engine. Everything plan-specific that
 * is not data — paths, tab label, copy — lives here, so the pages are shared.
 */

export type PlanKey = 'supplements' | 'care';

export const PLAN_KEYS: readonly PlanKey[] = ['supplements', 'care'];

export function isPlanKey(v: unknown): v is PlanKey {
  return v === 'supplements' || v === 'care';
}

export type PlanCopy = {
  key: PlanKey;
  /** Base path; sub-pages are `${path}/edit`, `${path}/facts`, `${path}/history`. */
  path: string;
  /** Panel heading on the Today page. */
  name: string;
  /** Bottom-nav label. */
  tabLabel: string;
  title: string;
  editTitle: string;
  /** [singular, plural] */
  itemNoun: [string, string];
  /** "taken" / "done" in the progress count. */
  tickWord: string;
  /** Heading of the facts page. */
  factsTitle: string;
  /** Button text linking to the facts page. */
  factsLink: string;
  /** Label of the dose field in the editor. */
  doseLabel: string;
  disclaimer: string;
};

export const PLANS: Record<PlanKey, PlanCopy> = {
  supplements: {
    key: 'supplements',
    path: '/supplements',
    name: 'Supplements',
    tabLabel: 'Pills',
    title: 'Weekly Supplement Plan',
    editTitle: 'Edit supplement plan',
    itemNoun: ['supplement', 'supplements'],
    tickWord: 'taken',
    factsTitle: 'Supplement Facts',
    factsLink: 'Supplement facts',
    doseLabel: 'Dose',
    disclaimer: 'General information, not medical advice — check your plan with a pharmacist.',
  },
  care: {
    key: 'care',
    path: '/care',
    name: 'Care',
    tabLabel: 'Care',
    title: 'Weekly Care Routine',
    editTitle: 'Edit care routine',
    itemNoun: ['step', 'steps'],
    tickWord: 'done',
    factsTitle: 'Products & rules',
    factsLink: 'Products & rules',
    doseLabel: 'Amount / how',
    disclaimer: 'General information, not medical advice — check your routine with a dermatologist.',
  },
};
