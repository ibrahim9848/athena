import { formatYmd } from '@/lib/dates';

export type ProgressPoint = {
  /** YYYY-MM-DD in the user's timezone. */
  date: string;
  weightKg: number;
  reps: number;
  e1rm: number;
};

const W = 560;
const H = 280;
const PAD_LEFT = 48;
const PAD_RIGHT = 20;
const PAD_TOP = 28;
const PAD_BOTTOM = 32;

const TICK_FONT = {
  fontSize: 12,
  fill: 'var(--ink-2)',
  fontFamily: 'var(--font-label)',
} as const;

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function shortDate(ymd: string): string {
  return formatYmd(ymd, { day: 'numeric', month: 'short' });
}

/**
 * Server-rendered estimated-1RM line chart. Pure inline SVG, no client JS;
 * all colours come from the CSS custom properties so dark mode just works.
 */
export function ProgressChart({ points }: { points: ProgressPoint[] }) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.e1rm);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let yMin = dataMin * 0.95;
  let yMax = dataMax * 1.05;
  if (yMax - yMin < 1e-6) {
    // Flat series (every session the same e1rm): open the domain up a little.
    yMin -= 1;
    yMax += 1;
  }

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number): number =>
    points.length === 1 ? PAD_LEFT + plotW / 2 : PAD_LEFT + (i * plotW) / (points.length - 1);
  const y = (v: number): number => PAD_TOP + plotH * (1 - (v - yMin) / (yMax - yMin));

  const first = points[0];
  const last = points[points.length - 1];
  const poly = points.map((p, i) => `${x(i).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(' ');
  const lastX = x(points.length - 1);
  const lastY = y(last.e1rm);
  const showMinTick = dataMax - dataMin > 1e-6;

  // Subtle horizontal gridlines at the lowest, middle and highest session values.
  const gridValues = showMinTick ? [dataMin, (dataMin + dataMax) / 2, dataMax] : [dataMax];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Estimated one-rep max over ${points.length} sessions, from ${round1(
        first.e1rm,
      )} kg on ${shortDate(first.date)} to ${round1(last.e1rm)} kg on ${shortDate(last.date)}.`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {gridValues.map((v) => (
        <line
          key={v}
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={y(v)}
          y2={y(v)}
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}

      {/* padded axes */}
      <line
        x1={PAD_LEFT}
        x2={PAD_LEFT}
        y1={PAD_TOP}
        y2={H - PAD_BOTTOM}
        stroke="var(--line)"
        strokeWidth={1.5}
      />
      <line
        x1={PAD_LEFT}
        x2={W - PAD_RIGHT}
        y1={H - PAD_BOTTOM}
        y2={H - PAD_BOTTOM}
        stroke="var(--line)"
        strokeWidth={1.5}
      />

      {/* y-axis tick labels at the min and max session values */}
      <text x={PAD_LEFT - 8} y={y(dataMax)} textAnchor="end" dominantBaseline="middle" {...TICK_FONT}>
        {round1(dataMax)}
      </text>
      {showMinTick ? (
        <text x={PAD_LEFT - 8} y={y(dataMin)} textAnchor="end" dominantBaseline="middle" {...TICK_FONT}>
          {round1(dataMin)}
        </text>
      ) : null}

      {/* first / last session date labels */}
      <text x={PAD_LEFT} y={H - 10} textAnchor="start" {...TICK_FONT}>
        {shortDate(first.date)}
      </text>
      {points.length > 1 ? (
        <text x={W - PAD_RIGHT} y={H - 10} textAnchor="end" {...TICK_FONT}>
          {shortDate(last.date)}
        </text>
      ) : null}

      <polyline
        points={poly}
        fill="none"
        stroke="var(--muscle)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.e1rm)} r={4} fill="var(--muscle)" />
      ))}

      {/* annotate the latest point with its estimated 1RM */}
      <text
        x={Math.min(lastX + 2, W - PAD_RIGHT)}
        y={Math.max(14, lastY - 12)}
        textAnchor="end"
        fontSize={12}
        fontWeight={600}
        fill="var(--ink)"
        fontFamily="var(--font-label)"
      >
        {round1(last.e1rm)} kg
      </text>
    </svg>
  );
}
