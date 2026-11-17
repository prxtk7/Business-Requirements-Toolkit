import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  /** Heading level for the title; h1 when the empty state is the whole page. */
  headingLevel?: 'h1' | 'h2';
}

export function EmptyState({ icon: Icon, title, description, action, headingLevel: Heading = 'h2' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <Icon aria-hidden="true" className="h-5 w-5 text-slate-500" />
      </div>
      <Heading className="mt-4 text-base font-semibold text-slate-900">{title}</Heading>
      <div className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{description}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
