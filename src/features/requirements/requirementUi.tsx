import { Link } from 'react-router';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import type { RequirementPriority, RequirementStatus, RequirementType } from '../../domain/types';
import { PRIORITY_LABELS, REQUIREMENT_TYPE_DETAILS, STATUS_LABELS } from '../../domain/requirementConfig';
import { PROCESS_TYPE_LABELS, type StepLocation } from '../../domain/processes';
import { processPaths } from '../processes/processPaths';

const PRIORITY_TONES: Record<RequirementPriority, BadgeTone> = {
  must: 'brand',
  should: 'teal',
  could: 'neutral',
  wont: 'neutral',
};

const STATUS_TONES: Record<RequirementStatus, BadgeTone> = {
  draft: 'neutral',
  proposed: 'brand',
  'under-review': 'amber',
  approved: 'green',
  implemented: 'teal',
  deferred: 'neutral',
  rejected: 'red',
};

export function PriorityBadge({ priority }: { priority: RequirementPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function StatusBadge({ status }: { status: RequirementStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function TypeLabel({ type }: { type: RequirementType }) {
  return (
    <abbr title={`${REQUIREMENT_TYPE_DETAILS[type].label} requirement`} className="no-underline">
      {REQUIREMENT_TYPE_DETAILS[type].short}
    </abbr>
  );
}

/** "Process name (AS-IS) — step 3: Activity", linking to the process. */
export function StepReference({ location }: { location: StepLocation }) {
  return (
    <>
      <Link to={processPaths.detail(location.process.id)} className="font-medium text-slate-800 hover:text-brand-700 hover:underline">
        {location.process.name}
      </Link>{' '}
      <span className="text-slate-500">({PROCESS_TYPE_LABELS[location.process.type]})</span>
      <span className="text-slate-600">
        {' '}
        — step {location.number}: {location.step.name}
      </span>
    </>
  );
}

