import { Link } from 'react-router';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import type { Requirement, StoryStatus, VerificationStatus } from '../../domain/types';
import { STORY_STATUS_LABELS, VERIFICATION_LABELS } from '../../domain/storyConfig';
import { compareIdentifiers } from '../../domain/requirements';

const STATUS_TONES: Record<StoryStatus, BadgeTone> = {
  draft: 'neutral',
  proposed: 'brand',
  'under-review': 'amber',
  approved: 'green',
  ready: 'teal',
  implemented: 'teal',
  deferred: 'neutral',
};

const VERIFICATION_TONES: Record<VerificationStatus, BadgeTone> = {
  'not-tested': 'neutral',
  passed: 'green',
  failed: 'red',
  blocked: 'amber',
};

export function StoryStatusBadge({ status }: { status: StoryStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STORY_STATUS_LABELS[status]}</Badge>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return <Badge tone={VERIFICATION_TONES[status]}>{VERIFICATION_LABELS[status]}</Badge>;
}

/** Comma-separated identifier links to requirements. */
export function RequirementIdLinks({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0) return <span className="text-slate-500">—</span>;
  return (
    <>
      {[...requirements]
        .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
        .map((r, i) => (
          <span key={r.id}>
            {i > 0 && ', '}
            <Link to={`/requirements/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline" title={r.title}>
              {r.identifier}
            </Link>
          </span>
        ))}
    </>
  );
}

/** Shown wherever verification statuses appear, so they are not mistaken for automated test results. */
export const VERIFICATION_DISCLAIMER =
  'Verification status records the documented outcome of checking each criterion. This toolkit does not run tests against any system.';
