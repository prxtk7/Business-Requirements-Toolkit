import { Link, useSearchParams } from 'react-router';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import type { Bottleneck, Improvement, Workspace } from '../../domain/types';
import { describeResponsibility, findProcess } from '../../domain/processes';
import {
  COMPARISON_CATEGORIES,
  COMPARISON_LABELS,
  compareProcesses,
  type ComparedStep,
  type ComparisonRow,
} from '../../domain/processComparison';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../lib/cx';
import { ChangeBadge, LevelBadge } from './processUi';
import { processPaths } from './processPaths';

export function ProcessComparisonPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  useDocumentTitle('Process comparison');

  const candidates = workspace.processes.filter(
    (p) => p.type === 'to-be' && p.baselineProcessId && findProcess(workspace, p.baselineProcessId)?.type === 'as-is',
  );
  const requested = params.get('toBe');
  const toBe = candidates.find((p) => p.id === requested) ?? candidates[0];
  const asIs = toBe?.baselineProcessId ? findProcess(workspace, toBe.baselineProcessId) : undefined;

  const header = (
    <PageHeader
      eyebrow="Process Analysis"
      title="AS-IS and TO-BE comparison"
      description="Step-by-step view of what stays the same, what changes and what is new, with the bottlenecks and improvements recorded against each step."
      back={{ to: processPaths.list, label: 'All processes' }}
    />
  );

  if (!toBe || !asIs) {
    return (
      <>
        {header}
        <EmptyState
          icon={ArrowLeftRight}
          title="Nothing to compare yet"
          description="Create a TO-BE process and set an AS-IS process as its baseline. Then record on each TO-BE step how it changes from the AS-IS steps."
          action={
            <ButtonLink to={processPaths.create('to-be')} variant="primary" icon={Plus}>
              New TO-BE process
            </ButtonLink>
          }
        />
      </>
    );
  }

  const comparison = compareProcesses(asIs, toBe, workspace.bottlenecks, workspace.improvements);

  return (
    <>
      {header}
      <div className="space-y-6">
        <Panel>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            {candidates.length > 1 ? (
              <div className="md:w-96">
                <SelectField
                  id="compare-to-be"
                  label="TO-BE process"
                  value={toBe.id}
                  options={candidates.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(v) => setParams({ toBe: v }, { replace: true })}
                  required
                />
              </div>
            ) : null}
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">AS-IS:</span>{' '}
              <Link to={processPaths.detail(asIs.id)} className="hover:underline">
                {asIs.name}
              </Link>{' '}
              ({asIs.steps.length} steps)
              <span aria-hidden="true" className="mx-2 text-slate-400">→</span>
              <span className="font-medium text-slate-900">TO-BE:</span>{' '}
              <Link to={processPaths.detail(toBe.id)} className="hover:underline">
                {toBe.name}
              </Link>{' '}
              ({toBe.steps.length} steps)
            </p>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-5">
            {COMPARISON_CATEGORIES.map((category) => (
              <div key={category} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
                <dt className="text-xs font-medium text-slate-500">{COMPARISON_LABELS[category]}</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{comparison.counts[category]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Change types come from each TO-BE step’s documented change; “Removed” means no TO-BE step links to the AS-IS step.
            Nothing is inferred automatically.
          </p>
        </Panel>

        {comparison.unlinkedChangedSteps.length > 0 && (
          <Alert tone="warning" title="Some TO-BE steps need linking">
            {comparison.unlinkedChangedSteps.map((s) => `Step ${s.number}: ${s.step.name}`).join('; ')} — marked as changed but not
            linked to any step in this baseline.{' '}
            <Link to={processPaths.detail(toBe.id)} className="font-medium underline underline-offset-2">
              Review the TO-BE steps
            </Link>
            .
          </Alert>
        )}

        <Panel title="Step comparison" flush>
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase md:grid">
            <span>AS-IS</span>
            <span>Change</span>
            <span>TO-BE</span>
          </div>
          <ol className="divide-y divide-slate-100" aria-label="Step comparison">
            {comparison.rows.map((row, index) => (
              <ComparisonRowItem key={index} row={row} workspace={workspace} />
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}

function StepSummary({ compared, workspace }: { compared: ComparedStep; workspace: Workspace }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900">
        {compared.number}. {compared.step.name}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{describeResponsibility(compared.step.responsible, workspace.stakeholders)}</p>
    </div>
  );
}

function FindingList({ items, kind }: { items: (Bottleneck | Improvement)[]; kind: 'bottleneck' | 'improvement' }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <span className="font-medium">{kind === 'bottleneck' ? 'Bottleneck:' : 'Improvement:'}</span>
          <span>{item.title}</span>
          {'severity' in item ? <LevelBadge level={item.severity} kind="severity" /> : <LevelBadge level={item.priority} kind="priority" />}
        </li>
      ))}
    </ul>
  );
}

function ComparisonRowItem({ row, workspace }: { row: ComparisonRow; workspace: Workspace }) {
  return (
    <li
      className={cx(
        'grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] md:gap-4',
        row.category === 'removed' && 'bg-amber-50/40',
      )}
    >
      <div>
        <p className="mb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase md:hidden">AS-IS</p>
        {row.asIs.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No AS-IS equivalent</p>
        ) : (
          <div className="space-y-2">
            {row.asIs.map((s) => (
              <StepSummary key={s.step.id} compared={s} workspace={workspace} />
            ))}
          </div>
        )}
        <FindingList items={row.bottlenecks} kind="bottleneck" />
      </div>
      <div className="md:pt-0.5">
        <ChangeBadge change={row.category} />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase md:hidden">TO-BE</p>
        {row.toBe ? (
          <StepSummary compared={row.toBe} workspace={workspace} />
        ) : (
          <p className="text-sm text-slate-500 italic">Not part of the TO-BE process</p>
        )}
        <FindingList items={row.improvements} kind="improvement" />
      </div>
    </li>
  );
}
