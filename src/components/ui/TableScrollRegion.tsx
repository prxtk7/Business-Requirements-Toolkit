import type { ReactNode } from 'react';

interface TableScrollRegionProps {
  /** Accessible name announced when the region receives focus, e.g. "Requirements table". */
  label: string;
  children: ReactNode;
}

/**
 * Horizontal scroll container for wide data tables.
 *
 * Focusable so keyboard users can scroll it with the arrow keys even when the
 * visible cells contain nothing focusable, and named (role="region") so screen
 * readers announce what the focused area is. `relative` keeps visually hidden
 * text inside the table positioned within the scroll area, so it cannot widen
 * the page on narrow screens.
 */
export function TableScrollRegion({ label, children }: TableScrollRegionProps) {
  return (
    // A focusable scroll container is the WCAG-recommended pattern (scrollable-region-focusable).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto focus-visible:outline-offset-[-2px]">
      {children}
    </div>
  );
}
