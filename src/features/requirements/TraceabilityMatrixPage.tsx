import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, ListChecks, Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import type { RequirementPriority, RequirementStatus, RequirementType } from '../../domain/types';
import {
  PRIORITY_LABELS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DETAILS,
  STATUS_LABELS,
  isRequirementPriority,
  isRequirementStatus,
  isRequirementType,
} from '../../domain/requirementConfig';
import { EMPTY_FILTER, filterRequirements } from '../../domain/requirements';
import {
  buildTraceabilityMatrix,
  filterByGap,
  summariseTraceability,
  type GapFilter,
  type TraceabilityRow,
} from '../../domain/traceability';
import type { StepLocation } from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pluralise } from '../../lib/format';
import { processPaths } from '../processes/processPaths';
import { PriorityBadge, StatusBadge } from './requirementUi';
import { requirementPaths } from './requirementPaths';

const GAP_OPTIONS: { value: GapFilter; label: string }[] = [
  { value: 'all', label: 'All requirements' },
  { value: 'any-gap', label: 'With a stakeholder, objective or process gap' },
  { value: 'no-stakeholder', label: 'Without stakeholder source' },
  { value: 'no-objective', label: 'Without linked objective' },
  { value: 'no-process', label: 'Without process step' },
  { value: 'no-story', label: 'Without user story' },
];

const COLUMNS =
  'xl:grid xl:grid-cols-[5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_6.5rem_7rem] xl:gap-4';

function GapMarker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
      <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      {children}
    </span>
  );
}

/** A labelled cell: the label is visible when rows stack on small screens and read by screen readers on wide ones. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase xl:sr-only">{label}</p>
      <div className="mt-0.5 text-sm text-slate-700 xl:mt-0">{children}</div>
    </div>
  );
}

function StepList({ steps, emptyText }: { steps: StepLocation[]; emptyText: ReactNode }) {
  if (steps.length === 0) return <>{emptyText}</>;
  return (
    <ul className="space-y-1">
      {steps.map((s) => (
        <li key={s.step.id}>
          <Link to={processPaths.detail(s.process.id)} className="hover:text-brand-700 hover:underline" title={s.process.name}>
            {s.number}. {s.step.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MatrixRow({ row }: { row: TraceabilityRow }) {
  const { requirement: r, gaps } = row;
  const noProcess = gaps.process;
  return (
    <li className={`space-y-3 px-5 py-4 xl:space-y-0 ${COLUMNS}`}>
      <Cell label="ID">
        <Link to={requirementPaths.detail(r.id)} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
          {r.identifier}
        </Link>
      </Cell>
      <Cell label="Requirement">
        <Link to={requirementPaths.detail(r.id)} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
          {r.title}
        </Link>
      </Cell>
      <Cell label="Stakeholder">
        {row.stakeholder ? (
          <>
            <Link to={`/stakeholders/${row.stakeholder.id}`} className="hover:text-brand-700 hover:underline">
              {row.stakeholder.name}
            </Link>
            <span className="block text-xs text-slate-500">{row.stakeholder.role}</span>
          </>
        ) : (
          <GapMarker>No stakeholder source</GapMarker>
        )}
      </Cell>
      <Cell label="Objectives">
        {row.objectives.length > 0 ? (
          <ul className="space-y-1">
            {row.objectives.map((o) => (
              <li key={o.id}>{o.text}</li>
            ))}
          </ul>
        ) : (
          <GapMarker>No linked objective</GapMarker>
        )}
      </Cell>
      <Cell label="AS-IS steps">
        <StepList steps={row.asIsSteps} emptyText={noProcess ? <GapMarker>No process step</GapMarker> : <span className="text-slate-500">—</span>} />
      </Cell>
      <Cell label="TO-BE steps">
        <StepList steps={row.toBeSteps} emptyText={noProcess ? <GapMarker>No process step</GapMarker> : <span className="text-slate-500">—</span>} />
      </Cell>
      <Cell label="User stories">
        {row.stories.length > 0 ? (
          <>
            <ul className="space-y-0.5">
              {row.stories.map((s) => (
                <li key={s.id}>
                  <Link to={`/user-stories/${s.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline" title={s.title}>
                    {s.identifier}
                  </Link>
                </li>
              ))}
            </ul>
            <span className="text-xs text-slate-500">{row.stories.length} linked</span>
          </>
        ) : (
          <GapMarker>No user story</GapMarker>
        )}
      </Cell>
      <Cell label="Priority / status">
        <div className="flex flex-wrap gap-1.5 xl:flex-col xl:items-start">
          <PriorityBadge priority={r.priority} />
          <StatusBadge status={r.status} />
        </div>
      </Cell>
    </li>
  );
}

export function TraceabilityMatrixPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  useDocumentTitle('Traceability matrix');

  const type = params.get('type');
  const priority = params.get('priority');
  const status = params.get('status');
  const gap = (GAP_OPTIONS.find((g) => g.value === params.get('gap'))?.value ?? 'all') as GapFilter;
  const filter = {
    ...EMPTY_FILTER,
    type: isRequirementType(type) ? (type as RequirementType) : 'all',
    priority: isRequirementPriority(priority) ? (priority as RequirementPriority) : 'all',
    status: isRequirementStatus(status) ? (status as RequirementStatus) : 'all',
  } as const;

  const allRows = buildTraceabilityMatrix(workspace, workspace.requirements);
  const summary = summariseTraceability(allRows);
  // Filters only narrow the full matrix, so reuse its rows rather than resolving links twice.
  const visibleIds = new Set(filterRequirements(workspace.requirements, filter).map((r) => r.id));
  const rows = filterByGap(
    allRows.filter((row) => visibleIds.has(row.requirement.id)),
    gap,
  );
  const isFiltered = filter.type !== 'all' || filter.priority !== 'all' || filter.status !== 'all' || gap !== 'all';

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const header = (
    <PageHeader
      eyebrow="Requirements Management"
      title="Traceability matrix"
      description="How each requirement traces to its source stakeholder, the project objectives it supports, the AS-IS and TO-BE process steps it affects, and the user stories that deliver it. Missing links are shown as gaps; none are filled in automatically."
      back={{ to: requirementPaths.list, label: 'Requirements register' }}
    />
  );

  if (allRows.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={ListChecks}
          title="No requirements to trace"
          description="Add requirements and link them to stakeholders, objectives and process steps to build the matrix."
          action={
            <ButtonLink to={requirementPaths.create()} variant="primary" icon={Plus}>
              New requirement
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        <Panel>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                ['Fully traced', summary.fullyTraced, 'all'],
                ['Without stakeholder', summary.withoutStakeholder, 'no-stakeholder'],
                ['Without objective', summary.withoutObjective, 'no-objective'],
                ['Without process step', summary.withoutProcess, 'no-process'],
                ['Without user story', allRows.filter((r) => r.storyGap).length, 'no-story'],
              ] as [string, number, GapFilter][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">
                  {value} <span className="text-sm font-normal text-slate-500">of {summary.total}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Filter by type"
              hideLabel
              value={filter.type}
              options={[{ value: 'all', label: 'All types' }, ...REQUIREMENT_TYPES.map((t) => ({ value: t, label: REQUIREMENT_TYPE_DETAILS[t].label }))]}
              onChange={(v) => setParam('type', v)}
            />
            <SelectField
              label="Filter by priority"
              hideLabel
              value={filter.priority}
              options={[{ value: 'all', label: 'All priorities' }, ...REQUIREMENT_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]}
              onChange={(v) => setParam('priority', v)}
            />
            <SelectField
              label="Filter by status"
              hideLabel
              value={filter.status}
              options={[{ value: 'all', label: 'All statuses' }, ...REQUIREMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
              onChange={(v) => setParam('status', v)}
            />
            <SelectField label="Filter by traceability gap" hideLabel value={gap} options={GAP_OPTIONS} onChange={(v) => setParam('gap', v)} />
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setParams({}, { replace: true })}>
              Clear filters
            </Button>
          )}
        </Panel>

        <Panel title="Matrix" description={pluralise(rows.length, 'requirement')} flush>
          <p className="sr-only" role="status">
            {isFiltered ? `${pluralise(rows.length, 'requirement')} shown.` : ''}
          </p>
          <div
            className={`hidden border-b border-slate-200 bg-slate-50/60 px-5 py-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase ${COLUMNS}`}
            aria-hidden="true"
          >
            <span>ID</span>
            <span>Requirement</span>
            <span>Stakeholder</span>
            <span>Objectives</span>
            <span>AS-IS steps</span>
            <span>TO-BE steps</span>
            <span>User stories</span>
            <span>Priority / status</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No requirements match these filters.</p>
          ) : (
            <ol className="divide-y divide-slate-100" aria-label="Traceability matrix">
              {rows.map((row) => (
                <MatrixRow key={row.requirement.id} row={row} />
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
