import type { BadgeTone } from '../../components/ui/Badge';
import type { RiskSeverity } from '../../domain/types';

/** Colours for each severity band: badge tone, matrix cell and legend swatch. */
export const SEVERITY_STYLE: Record<RiskSeverity, { badge: BadgeTone; cell: string; swatch: string }> = {
  low: { badge: 'green', cell: 'bg-emerald-50 text-emerald-900', swatch: 'bg-emerald-200' },
  medium: { badge: 'amber', cell: 'bg-amber-50 text-amber-900', swatch: 'bg-amber-200' },
  high: { badge: 'orange', cell: 'bg-orange-200/70 text-orange-950', swatch: 'bg-orange-300' },
  critical: { badge: 'red', cell: 'bg-red-100 text-red-900', swatch: 'bg-red-400' },
};
