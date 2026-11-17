import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import type { Requirement } from '../../domain/types';
import { REQUIREMENT_TYPE_DETAILS, categoryLabel } from '../../domain/requirementConfig';
import { compareIdentifiers, findDependents } from '../../domain/requirements';
import { buildTraceabilityRow } from '../../domain/traceability';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, pluralise } from '../../lib/format';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { DeleteRequirementDialog } from './DeleteRequirementDialog';
import { PriorityBadge, StatusBadge, StepReference } from './requirementUi';
import { requirementPaths } from './requirementPaths';

function Gap({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-amber-800">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </p>
  );
}

function RequirementLinks({ items }: { items: Requirement[] }) {
  return (
    <ul className="space-y-1.5">
      {[...items]
        .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
        .map((r) => (
          <li key={r.id} className="text-sm">
            <Link to={requirementPaths.detail(r.id)} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
              {r.identifier}
            </Link>{' '}
            <span className="text-slate-700">{r.title}</span> <StatusBadge status={r.status} />
          </li>
        ))}
    </ul>
  );
}

export function RequirementDetailPage() {
  const { requirementId = '' } = useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const requirement = workspace.requirements.find((r) => r.id === requirementId);
  useDocumentTitle(requirement ? `${requirement.identifier} ${requirement.title}` : 'Requirement not found');

  if (!requirement) {
    return (
      <NotFoundPage
        title="Requirement not found"
        message="This requirement may have been deleted, or the link is incorrect."
        backTo={{ to: requirementPaths.list, label: 'Back to requirements' }}
      />
    );
  }

  const trace = buildTraceabilityRow(workspace, requirement);
  const dependents = findDependents(workspace.requirements, requirement.id);
  const steps = [...trace.asIsSteps, ...trace.toBeSteps];

  return (
    <>
      <PageHeader
        eyebrow={`Requirements Management · ${requirement.identifier}`}
        title={requirement.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {REQUIREMENT_TYPE_DETAILS[requirement.type].label} · {categoryLabel(requirement.type, requirement.category)}
            </span>
            <PriorityBadge priority={requirement.priority} />
            <StatusBadge status={requirement.status} />
          </span>
        }
        back={{ to: requirementPaths.list, label: 'All requirements' }}
        actions={
          <>
            <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <ButtonLink to={requirementPaths.edit(requirement.id)} variant="primary" icon={Pencil}>
              Edit requirement
            </ButtonLink>
          </>
        }
      />

      {trace.brokenReferences > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
          {trace.brokenReferences} stored link(s) point to records that no longer exist. Edit the requirement to review its links.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Description and rationale">
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{requirement.description}</p>
            <h3 className="mt-4 text-xs font-semibold tracking-wider text-slate-500 uppercase">Business rationale</h3>
            {requirement.rationale ? (
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-700">{requirement.rationale}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500 italic">No rationale recorded.</p>
            )}
          </Panel>

          <Panel title="Related business objectives">
            {trace.objectives.length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-5">
                {trace.objectives.map((o) => (
                  <li key={o.id} className="pl-1 text-sm text-slate-700 marker:text-slate-400">
                    <Link to={`/overview#objective-${o.id}`} className="hover:text-brand-700 hover:underline">
                      {o.text}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Gap>Traceability gap: not linked to any project objective.</Gap>
            )}
          </Panel>

          <Panel title="Related process steps">
            {steps.length > 0 ? (
              <ul className="space-y-2">
                {steps.map((location) => (
                  <li key={location.step.id} className="text-sm">
                    <StepReference location={location} />
                  </li>
                ))}
              </ul>
            ) : (
              <Gap>Traceability gap: not linked to any AS-IS or TO-BE process step.</Gap>
            )}
          </Panel>

          <Panel title="Dependencies">
            <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Depends on</h3>
            <div className="mt-2">
              {trace.dependencies.length > 0 ? (
                <RequirementLinks items={trace.dependencies} />
              ) : (
                <p className="text-sm text-slate-500 italic">No dependencies.</p>
              )}
            </div>
            <h3 className="mt-5 text-xs font-semibold tracking-wider text-slate-500 uppercase">Required by</h3>
            <div className="mt-2">
              {dependents.length > 0 ? (
                <RequirementLinks items={dependents} />
              ) : (
                <p className="text-sm text-slate-500 italic">No other requirement depends on this one.</p>
              )}
            </div>
          </Panel>

          <Panel
            title="User stories"
            description="Stories that deliver this requirement. Their priority and status are managed separately."
            actions={
              <ButtonLink to={`/user-stories/new?requirement=${requirement.id}`} size="sm" icon={Plus}>
                New linked story
              </ButtonLink>
            }
          >
            {trace.stories.length > 0 ? (
              <ul className="space-y-1.5">
                {trace.stories.map((s) => (
                  <li key={s.id} className="text-sm">
                    <Link to={`/user-stories/${s.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                      {s.identifier}
                    </Link>{' '}
                    <span className="text-slate-700">{s.title}</span>{' '}
                    <span className="text-xs text-slate-500">({pluralise(s.criteria.length, 'acceptance criterion', 'acceptance criteria')})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Gap>Coverage gap: no user story is linked to this requirement yet.</Gap>
            )}
          </Panel>

          <Panel title="Acceptance criteria / verification notes">
            {requirement.acceptanceCriteria.length > 0 ? (
              <ol className="list-decimal space-y-2 pl-5">
                {requirement.acceptanceCriteria.map((c, i) => (
                  <li key={i} className="pl-1 text-sm leading-relaxed text-slate-700 marker:text-slate-400">
                    {c}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500 italic">No acceptance criteria recorded yet.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Requirement overview">
            <dl className="space-y-3 text-sm">
              {(
                [
                  ['Identifier', <span key="Identifier" className="font-mono font-semibold">{requirement.identifier}</span>],
                  ['Type', REQUIREMENT_TYPE_DETAILS[requirement.type].label],
                  ['Category', categoryLabel(requirement.type, requirement.category)],
                  ['Priority', <PriorityBadge key="Priority" priority={requirement.priority} />],
                  ['Status', <StatusBadge key="Status" status={requirement.status} />],
                ] as [string, ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Stakeholder source">
            {trace.stakeholder ? (
              <p className="text-sm">
                <Link to={`/stakeholders/${trace.stakeholder.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {trace.stakeholder.name}
                </Link>
                <span className="block text-slate-500">{trace.stakeholder.role}</span>
              </p>
            ) : (
              <Gap>Traceability gap: no source stakeholder recorded.</Gap>
            )}
          </Panel>

          <Panel title="Change history">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900">{formatDateTime(requirement.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-slate-900">{formatDateTime(requirement.updatedAt)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">Only creation and last-update times are recorded; a full revision log is not kept.</p>
          </Panel>
        </div>
      </div>

      <DeleteRequirementDialog
        requirement={confirmDelete ? requirement : null}
        onClose={() => setConfirmDelete(false)}
        onDeleted={() => navigate(requirementPaths.list, { replace: true })}
      />
    </>
  );
}
