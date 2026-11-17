import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  /** Short label above the title identifying the module, e.g. "Stakeholder Analysis". */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

export function PageHeader({ title, eyebrow, description, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-8">
      {back && (
        <Link
          to={back.to}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 break-words">{title}</h1>
          {description && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
