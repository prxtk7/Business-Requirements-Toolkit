import { Badge, type BadgeTone } from '../../components/ui/Badge';
import type { Level, ProcessType } from '../../domain/types';
import { LEVEL_LABELS } from '../../domain/types';
import { PROCESS_TYPE_LABELS } from '../../domain/processes';
import { COMPARISON_LABELS, type ComparisonCategory } from '../../domain/processComparison';

export function ProcessTypeBadge({ type }: { type: ProcessType }) {
  return <Badge tone={type === 'as-is' ? 'neutral' : 'brand'}>{PROCESS_TYPE_LABELS[type]}</Badge>;
}

const CHANGE_TONES: Record<ComparisonCategory, BadgeTone> = {
  unchanged: 'neutral',
  modified: 'brand',
  new: 'green',
  automated: 'teal',
  removed: 'amber',
};

export function ChangeBadge({ change }: { change: ComparisonCategory }) {
  return <Badge tone={CHANGE_TONES[change]}>{COMPARISON_LABELS[change]}</Badge>;
}

const LEVEL_TONES: Record<Level, BadgeTone> = { high: 'amber', medium: 'brand', low: 'neutral' };

export function LevelBadge({ level, kind }: { level: Level; kind: 'severity' | 'priority' }) {
  return (
    <Badge tone={LEVEL_TONES[level]}>
      {LEVEL_LABELS[level]} {kind}
    </Badge>
  );
}

