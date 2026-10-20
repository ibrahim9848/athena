import type { CSSProperties } from 'react';

const FORM_CLASS: Record<string, string> = {
  tablet: 'caplet',
  chewable: 'chew',
  softgel: 'softgel',
  capsule: 'capsule',
  scoop: 'scoop',
  other: 'round',
};

/** The reference pages' pill shapes, colour-driven via the --c custom property. */
export function PillGlyph({
  form,
  color,
  className,
}: {
  form: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pill ${FORM_CLASS[form] ?? 'round'}${className ? ` ${className}` : ''}`}
      style={{ '--c': color } as CSSProperties}
    />
  );
}
