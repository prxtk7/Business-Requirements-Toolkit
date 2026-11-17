import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { IMPACT_LABELS, PROBABILITY_LABELS, RESPONSE_DETAILS, riskCategoryLabel } from '../../domain/riskConfig';
import { assessRisk } from '../../domain/risks';
import { findStep, type StepLocation } from '../../domain/processes';
import { compareIdentifiers } from '../../domain/requirements';
import { compareStoryIdentifiers } from '../../domain/userStories';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/format';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { StepReference } from '../requirements/requirementUi';
import { DeleteRiskDialog } from './DeleteRiskDialog';
import { RiskStatusBadge, ScoringGuide, SeverityBadge } from './riskUi';
import { riskPaths } from './riskPaths';

function Prose({ text, empty }: { text: string; empty: string }) {
  return text ? (
    <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{text}</p>
  ) : (
    <p className="text-sm text-slate-500 italic">{empty}</p>
  );
}

function LinkGroup({ title, children, count }: { title: string; children: ReactNode; count: number }) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h3>
      {count === 0 ? <p className="mt-1 text-sm text-slate-500">None linked</p> : <ul className="mt-1.5 space-y-1 text-sm">{children}</ul>}
    </div>
  );
}

export function RiskDetailPage() {
  const { riskId = '' } = useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const risk = workspace.risks.find((r) => r.id === riskId);
  useDocumentTitle(risk ? `${risk.identifier} ${risk.title}` : 'Risk not found');

  if (!risk) {
    return <NotFoundPage title="Risk not found" message="This risk may have been deleted, or the link is incorrect." backTo={{ to: riskPaths.list, label: 'Back to risk register' }} />;
  }

  const { score, severity } = assessRisk(risk);
  const owner = risk.owner.stakeholderId ? workspace.stakeholders.find((s) => s.id === risk.owner.stakeholderId) : undefined;
  const stakeholders = workspace.stakeholders.filter((s) => risk.links.stakeholderIds.includes(s.id));
  const objectives = workspace.project.objectives.filter((o) => risk.links.objectiveIds.includes(o.id));
  const steps = risk.links.stepIds.map((id) => findStep(workspace, id)).filter((s): s is StepLocation => s !== undefined);
  const asIs = steps.filter((s) => s.process.type === 'as-is');
  const toBe = steps.filter((s) => s.process.type === 'to-be');
  const requirements = workspace.requirements.filter((r) => risk.links.requirementIds.includes(r.id)).sort((a, b) => compareIdentifiers(a.identifier, b.identifier));
  const stories = workspace.userStories.filter((s) => risk.links.storyIds.includes(s.id)).sort((a, b) => compareStoryIdentifiers(a.identifier, b.identifier));

  return (
    <>
      <PageHeader
        eyebrow={`Risk Management · ${risk.identifier}`}
        title={risk.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{riskCategoryLabel(risk.category)}</span>
            <SeverityBadge severity={severity} />
            <RiskStatusBadge status={risk.status} />
          </span>
        }
        back={{ to: riskPaths.list, label: 'Risk register' }}
        actions={
          <>
            <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <ButtonLink to={riskPaths.edit(risk.id)} variant="primary" icon={Pencil}>
              Edit risk
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Risk description" description="What could happen, and why.">
            <Prose text={risk.description} empty="No description recorded." />
          </Panel>

          <Panel title="Risk assessment" description="How serious it would be.">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Probability</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  <span className="text-lg font-semibold tabular-nums">{risk.probability}</span> — {PROBABILITY_LABELS[risk.probability]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Impact</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  <span className="text-lg font-semibold tabular-nums">{risk.impact}</span> — {IMPACT_LABELS[risk.impact]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Score</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm">
                  <span className="text-slate-600 tabular-nums">
                    {risk.probability} × {risk.impact} =
                  </span>
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">{score}</span>
                  <SeverityBadge severity={severity} />
                </dd>
              </div>
            </dl>
            <ScoringGuide className="mt-4" />
          </Panel>

          <Panel title="Response strategy" description="How the risk will be addressed.">
            <p className="text-sm text-slate-900">
              <span className="font-semibold">{RESPONSE_DETAILS[risk.response].label}</span>{' '}
              <span className="text-slate-600">— {RESPONSE_DETAILS[risk.response].description}</span>
            </p>
          </Panel>

          <Panel title="Mitigation plan" description="What we are doing to prevent it or reduce its effect.">
            <Prose text={risk.mitigation} empty={risk.response === 'accept' ? 'No mitigation: the risk is accepted.' : 'No mitigation plan recorded.'} />
          </Panel>

          <Panel title="Contingency plan" description="What happens if it occurs.">
            <Prose text={risk.contingency} empty="No contingency plan recorded." />
          </Panel>

          <Panel title="Related project records">
            <div className="grid gap-5 md:grid-cols-2">
              <LinkGroup title="Stakeholders" count={stakeholders.length}>
                {stakeholders.map((s) => (
                  <li key={s.id}>
                    <Link to={`/stakeholders/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      {s.name}
                    </Link>{' '}
                    <span className="text-slate-500">— {s.role}</span>
                  </li>
                ))}
              </LinkGroup>
              <LinkGroup title="Project objectives" count={objectives.length}>
                {objectives.map((o) => (
                  <li key={o.id}>
                    <Link to={`/overview#objective-${o.id}`} className="text-slate-700 hover:text-brand-700 hover:underline">
                      {o.text}
                    </Link>
                  </li>
                ))}
              </LinkGroup>
              <LinkGroup title="AS-IS process steps" count={asIs.length}>
                {asIs.map((s) => (
                  <li key={s.step.id}>
                    <StepReference location={s} />
                  </li>
                ))}
              </LinkGroup>
              <LinkGroup title="TO-BE process steps" count={toBe.length}>
                {toBe.map((s) => (
                  <li key={s.step.id}>
                    <StepReference location={s} />
                  </li>
                ))}
              </LinkGroup>
              <LinkGroup title="Requirements" count={requirements.length}>
                {requirements.map((r) => (
                  <li key={r.id}>
                    <Link to={`/requirements/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                      {r.identifier}
                    </Link>{' '}
                    <span className="text-slate-700">{r.title}</span>
                  </li>
                ))}
              </LinkGroup>
              <LinkGroup title="User stories" count={stories.length}>
                {stories.map((s) => (
                  <li key={s.id}>
                    <Link to={`/user-stories/${s.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                      {s.identifier}
                    </Link>{' '}
                    <span className="text-slate-700">{s.title}</span>
                  </li>
                ))}
              </LinkGroup>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Risk overview">
            <dl className="space-y-3 text-sm">
              {(
                [
                  ['Risk ID', <span key="Risk ID" className="font-mono font-semibold">{risk.identifier}</span>],
                  ['Category', riskCategoryLabel(risk.category)],
                  ['Score', <span key="Score" className="font-semibold tabular-nums">{score}</span>],
                  ['Severity', <SeverityBadge key="Severity" severity={severity} />],
                  ['Response', RESPONSE_DETAILS[risk.response].label],
                  ['Status', <RiskStatusBadge key="Status" status={risk.status} />],
                ] as [string, ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Ownership" description="Who is responsible.">
            {risk.owner.stakeholderId === null ? (
              <>
                <p className="text-sm font-medium text-slate-900">{risk.owner.customName}</p>
                <p className="mt-1 text-sm text-slate-500">Custom owner — not a record in the stakeholder register.</p>
              </>
            ) : owner ? (
              <p className="text-sm">
                <Link to={`/stakeholders/${owner.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {owner.name}
                </Link>
                <span className="block text-slate-500">{owner.role}</span>
              </p>
            ) : (
              <p className="text-sm text-amber-800">The owner's stakeholder record no longer exists. Edit the risk to assign an owner.</p>
            )}
          </Panel>

          <Panel title="Risk history">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900">{formatDateTime(risk.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-slate-900">{formatDateTime(risk.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      <DeleteRiskDialog risk={confirmDelete ? risk : null} onClose={() => setConfirmDelete(false)} onDeleted={() => navigate(riskPaths.list, { replace: true })} />
    </>
  );
}
