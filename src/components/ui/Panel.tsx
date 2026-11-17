import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface PanelProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Heading level for the title; defaults to h2. */
  as?: 'h2' | 'h3';
  /** Removes inner padding, e.g. for edge-to-edge tables. */
  flush?: boolean;
}

/** Bordered content container with an optional titled header. */
export function Panel({ title, description, actions, children, className, as: Heading = 'h2', flush }: PanelProps) {
  return (
    <section className={cx('rounded-lg bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            {title && <Heading className="text-sm font-semibold text-slate-900">{title}</Heading>}
            {description && <div className="mt-0.5 text-sm text-slate-500">{description}</div>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : 'px-5 py-5'}>{children}</div>
    </section>
  );
}
