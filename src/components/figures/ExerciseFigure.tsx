'use client';

/**
 * Animated exercise figures (spec 7.4 option 2), ported from the reference
 * page's hand-written engine in src/lib/pose-engine.js.
 *
 * - <FiguresProvider> holds the shared playing/paused state.
 * - <PauseFiguresButton> is the reference's ".motion" pill button.
 * - <ExerciseFigure> mounts one animated figure for a known exercise name,
 *   falls back to a stored illustration SVG, or renders nothing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ---------- shared playing/paused context ---------- */

type FiguresContextValue = { playing: boolean; toggle: () => void };

const FiguresContext = createContext<FiguresContextValue>({
  playing: true,
  toggle: () => {},
});

export function FiguresProvider({ children }: { children: ReactNode }) {
  // SSR-safe default: play. Corrected after mount from prefers-reduced-motion.
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setPlaying(false);
      }
    } catch {
      /* matchMedia unavailable: keep playing */
    }
  }, []);

  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const value = useMemo(() => ({ playing, toggle }), [playing, toggle]);

  return <FiguresContext.Provider value={value}>{children}</FiguresContext.Provider>;
}

/* ---------- pause/play pill button (reference header's ".motion") ---------- */

export function PauseFiguresButton() {
  const { playing, toggle } = useContext(FiguresContext);
  return (
    <button
      className="motion"
      type="button"
      aria-pressed={!playing ? 'true' : 'false'}
      onClick={toggle}
    >
      {playing ? (
        <svg className="i-pause" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="2.5" y="2" width="3" height="10" rx="1" />
          <rect x="8.5" y="2" width="3" height="10" rx="1" />
        </svg>
      ) : (
        <svg className="i-play" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3.5 2.2v9.6a.8.8 0 0 0 1.2.7l7.6-4.8a.8.8 0 0 0 0-1.4L4.7 1.5a.8.8 0 0 0-1.2.7z" />
        </svg>
      )}
      <span className="lbl">{playing ? 'Pause figures' : 'Play figures'}</span>
    </button>
  );
}

/* ---------- exercise name -> engine id ---------- */

// Keys are lower-cased seeded exercise names; values are ids verified against
// the EX[...] definitions in src/lib/pose-engine.js (the engine is the source
// of truth — all 16 ids exist there).
const NAME_TO_EX: Record<string, string> = {
  'chest press': 'chest-press',
  'incline chest press': 'incline-press',
  'shoulder press': 'shoulder-press',
  'cable lateral raise': 'cable-lateral-raise',
  'triceps pushdown': 'triceps-pushdown',
  'leg press': 'leg-press',
  'seated leg curl': 'leg-curl',
  'leg extension': 'leg-extension',
  'hip thrust machine': 'hip-thrust',
  'standing calf raise': 'calf-raise',
  'ab crunch machine': 'ab-crunch',
  'lat pulldown': 'lat-pulldown',
  'seated row': 'seated-row',
  'rear-delt fly': 'rear-delt-fly',
  'biceps curl machine': 'biceps-curl',
  'straight-arm pulldown': 'straight-arm-pulldown',
};

const VIEW_LABEL: Record<string, string> = {
  side: 'Side view',
  front: 'Front view',
  top: 'From above',
};

type Fig = {
  draw: (t: number, mode: string) => void;
  tAt: (ms: number) => number;
  view?: string;
};

/* ---------- one animated figure ---------- */

export function ExerciseFigure({
  name,
  view,
  illustrationSvg,
}: {
  name: string;
  view?: string | null;
  illustrationSvg?: string | null;
}) {
  const { playing } = useContext(FiguresContext);
  // A stored illustration always wins over the engine's name match, so a
  // custom exercise that shares a seeded name still shows its own SVG.
  const id = illustrationSvg ? null : (NAME_TO_EX[name.trim().toLowerCase()] ?? null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const figRef = useRef<Fig | null>(null);
  const playingRef = useRef(playing);
  const visibleRef = useRef(true);
  const [failed, setFailed] = useState(false);
  const [engineView, setEngineView] = useState<string | null>(null);

  // Redraw once in "static" mode whenever the figures are paused.
  useEffect(() => {
    playingRef.current = playing;
    if (!playing && figRef.current) {
      figRef.current.draw(1, 'static');
    }
  }, [playing]);

  useEffect(() => {
    if (!id) return;
    const svg = svgRef.current;
    if (!svg) return;

    let cancelled = false;
    let raf = 0;
    let io: IntersectionObserver | null = null;
    let last = 0;

    void (async () => {
      let fig: Fig;
      try {
        const PF = (await import('@/lib/pose-engine')).default;
        if (cancelled) return;
        fig = PF.mount(svg, id);
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      figRef.current = fig;
      if (fig.view) setEngineView(fig.view);

      // Sensible frame right away; the loop takes over while playing.
      fig.draw(1, 'static');

      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              visibleRef.current = entry.isIntersecting;
            }
          },
          { rootMargin: '60px' }
        );
        io.observe(svg);
      } else {
        visibleRef.current = true;
      }

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (playingRef.current && visibleRef.current && now - last > 30) {
          last = now;
          fig.draw(fig.tAt(now), 'anim');
        }
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      figRef.current = null;
    };
  }, [id]);

  if (id) {
    if (failed) return null;
    const viewKey = view ? view.trim().toLowerCase() : '';
    const label = engineView ?? (viewKey ? (VIEW_LABEL[viewKey] ?? null) : null);
    return (
      <div className="art">
        {label ? <span className="view">{label}</span> : null}
        <svg ref={svgRef} className="pose" role="img" aria-label={name} />
      </div>
    );
  }

  if (illustrationSvg) {
    // Trusted, user-authored SVG stored on the exercise row.
    return <div className="art" dangerouslySetInnerHTML={{ __html: illustrationSvg }} />;
  }

  return null;
}
