import { Link } from 'react-router';
import { Info } from 'lucide-react';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import type { Risk, RiskSeverity, RiskStatus } from '../../domain/types';
import { RISK_STATUS_LABELS, SEVERITY_BANDS, SEVERITY_LABELS } from '../../domain/riskConfig';
import { assessRisk } from '../../domain/risks';
import { cx } from '../../lib/cx';
import { riskPaths } from './riskPaths';
import { SEVERITY_STYLE } from './riskStyles';

const STATUS_TONES: Record<RiskStatus, BadgeTone> = {
  identified: 'neutral',
  'under-assessment': 'brand',
  'response-planned': 'brand',
  'in-progress': 'teal',
  monitoring: 'teal',
  closed: 'neutral',
  materialised: 'red',
};

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  return <Badge tone={SEVERITY_STYLE[severity].badge}>{SEVERITY_LABELS[severity]}</Badge>;
}

export function RiskStatusBadge({ status }: { status: RiskStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{RISK_STATUS_LABELS[status]}</Badge>;
}

/** "12 · High", with the calculation available to assistive technology. */
export function RiskScore({ risk }: { risk: Pick<Risk, 'probability' | 'impact'> }) {
  const { score, severity } = assessRisk(risk);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-semibold text-slate-900 tabular-nums" title={`${risk.probability} × ${risk.impact}`}>
        {score}
      </span>
      <SeverityBadge severity={severity} />
    </span>
  );
}

/** Short explanation of the scoring model, shown on the form, detail and matrix pages. */
export function ScoringGuide({ className }: { className?: string }) {
  return (
    <div className={cx('rounded-md bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200 ring-inset', className)}>
      <p className="flex items-start gap-1.5">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <span>
          <strong className="font-semibold text-slate-800">Score = probability × impact</strong> (each rated 1–5, so 1–25). The
          score is calculated automatically and sets the severity band:
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 pl-5.5" aria-label="Severity bands">
        {SEVERITY_BANDS.map((band) => (
          <li key={band.severity} className="flex items-center gap-1.5">
            <span className={cx('h-2.5 w-2.5 rounded-sm', SEVERITY_STYLE[band.severity].swatch)} aria-hidden="true" />
            <span>
              {band.label} {band.min}–{band.max}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Note shown in other modules' delete dialogs when risks link to the record being deleted. */
export function RiskUnlinkNote({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return null;
  return (
    <p className="mt-3">
      {risks.length === 1 ? 'Risk ' : 'Risks '}
      {risks.map((r, i) => (
        <span key={r.id}>
          {i > 0 && ', '}
          <Link to={riskPaths.detail(r.id)} className="font-medium text-brand-700 underline underline-offset-2">
            {r.identifier}
          </Link>
        </span>
      ))}{' '}
      {risks.length === 1 ? 'links' : 'link'} to it. The link will be removed from {risks.length === 1 ? 'that risk' : 'those risks'}; the
      {risks.length === 1 ? ' risk itself is' : ' risks themselves are'} kept.
    </p>
  );
}

