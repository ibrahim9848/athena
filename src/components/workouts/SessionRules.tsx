import type { SessionRule } from '@/db/schema';

/** "warm_up" → "Warm up", "Warm up" → "Warm up". */
function ruleLabel(key: string): string {
  const cleaned = key.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return key;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** The "Every session" block: a dl of the program's session rules. */
export function SessionRules({ rules }: { rules: SessionRule[] }) {
  if (rules.length === 0) return null;
  return (
    <section className="rules" aria-labelledby="rules-h">
      <h2 className="label" id="rules-h">
        Every session
      </h2>
      <dl>
        {rules.map((rule) => (
          <div key={rule.id}>
            <dt>{ruleLabel(rule.key)}</dt>
            <dd>{rule.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
