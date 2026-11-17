import type { BadgeTone } from '../../components/ui/Badge';
import type { EngagementStrategy } from '../../domain/stakeholders';

/** Presentation mapping for engagement strategies (kept out of the domain layer). */
export const STRATEGY_STYLE: Record<EngagementStrategy, { badge: BadgeTone; cell: string; dot: string }> = {
  'manage-closely': { badge: 'brand', cell: 'bg-brand-100/60', dot: 'bg-brand-600' },
  'keep-satisfied': { badge: 'amber', cell: 'bg-amber-50/60', dot: 'bg-amber-500' },
  'keep-informed': { badge: 'teal', cell: 'bg-teal-50/60', dot: 'bg-teal-600' },
  monitor: { badge: 'neutral', cell: 'bg-slate-50', dot: 'bg-slate-400' },
};
