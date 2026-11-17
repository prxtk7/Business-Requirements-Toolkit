import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowLeftRight, ArrowUp, GitBranch, Pencil, Plus, Split, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Panel } from '../../components/ui/Panel';
import type { Bottleneck, BusinessProcess, Improvement, ProcessStep, Workspace } from '../../domain/types';
import {
  PROCESS_TYPE_LABELS,
  describeResponsibility,
  findProcess,
  findProcessDependencies,
  findStepDependencies,
  itemsForProcess,
  sortByStepAndLevel,
} from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { pluralise } from '../../lib/format';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { ChangeBadge, LevelBadge, ProcessTypeBadge } from './processUi';
import { processPaths } from './processPaths';
import { compareIdentifiers, requirementsLinkedToStep } from '../../domain/requirements';
import type { Requirement } from '../../domain/types';
import { risksLinkedTo } from '../../domain/risks';
import { RiskUnlinkNote } from '../risks/riskUi';

type PendingDelete =
  | { kind: 'process' }
  | { kind: 'step'; step: ProcessStep; number: number }
  | { kind: 'bottleneck'; item: Bottleneck }
  | { kind: 'improvement'; item: Improvement }
  | null;

export function ProcessDetailPage() {
  const { processId = '' } = useParams();
  const { workspace } = useWorkspace();
  const process = findProcess(workspace, processId);
  useDocumentTitle(process?.name ?? 'Process not found');

  if (!process) {
    return (
      <NotFoundPage
        title="Process not found"
        message="This process may have been deleted, or the link is incorrect."
        backTo={{ to: processPaths.list, label: 'Back to processes' }}
      />
    );
  }
  return <ProcessDetail process={process} workspace={workspace} />;
}

function Definition({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-slate-700">{children || <span className="text-slate-500 italic">Not documented</span>}</dd>
    </div>
  );
}

function ProcessDetail({ process, workspace }: { process: BusinessProcess; workspace: Workspace }) {
  const { actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const [pending, setPending] = useState<PendingDelete>(null);

  const isAsIs = process.type === 'as-is';
  const baseline = process.baselineProcessId ? findProcess(workspace, process.baselineProcessId) : undefined;
  const bottlenecks = sortByStepAndLevel(itemsForProcess(workspace.bottlenecks, process), process, (b) => b.severity);
  const improvements = sortByStepAndLevel(itemsForProcess(workspace.improvements, process), process, (i) => i.priority);
  const stepNumber = new Map(process.steps.map((s, i) => [s.id, i + 1]));
  const baselineNumber = new Map(baseline?.steps.map((s, i) => [s.id, { number: i + 1, name: s.name }]) ?? []);

  const move = (stepId: string, offset: -1 | 1) => {
    const result = actions.moveStep(process.id, stepId, offset);
    if (!result.ok) report(result, '');
  };

  const closeDialog = () => setPending(null);

  return (
    <>
      <PageHeader
        eyebrow={`Process Analysis · ${PROCESS_TYPE_LABELS[process.type]}`}
        title={process.name}
        description={process.description || undefined}
        back={{ to: processPaths.list, label: 'All processes' }}
        actions={
          <>
            <Button variant="secondary" icon={Trash2} onClick={() => setPending({ kind: 'process' })}>
              Delete
            </Button>
            <ButtonLink to={processPaths.edit(process.id)} variant="secondary" icon={Pencil}>
              Edit details
            </ButtonLink>
            {baseline && (
              <ButtonLink to={processPaths.compare(process.id)} variant="primary" icon={ArrowLeftRight}>
                Compare with AS-IS
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <Panel title="Process definition" actions={<ProcessTypeBadge type={process.type} />}>
          <dl className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Definition label="Objective">{process.objective}</Definition>
            </div>
            <Definition label="Trigger">{process.trigger}</Definition>
            {!isAsIs && (
              <Definition label="AS-IS baseline">
                {baseline ? (
                  <Link to={processPaths.detail(baseline.id)} className="font-medium text-brand-700 hover:underline">
                    {baseline.name}
                  </Link>
                ) : (
                  'None — set a baseline to compare with an AS-IS process'
                )}
              </Definition>
            )}
            <Definition label="Start condition">{process.startCondition}</Definition>
            <Definition label="End condition">{process.endCondition}</Definition>
          </dl>
        </Panel>

        <Panel
          title="Process steps"
          description={pluralise(process.steps.length, 'step')}
          actions={
            <ButtonLink to={processPaths.newStep(process.id)} size="sm" variant="primary" icon={Plus}>
              Add step
            </ButtonLink>
          }
          flush
        >
          {process.steps.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <GitBranch aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No steps yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Add the activities in the order they happen, with who performs them and what goes in and out.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-slate-100" aria-label={`${process.name} steps`}>
              {process.steps.map((step, index) => {
                const number = index + 1;
                const findingCount = isAsIs
                  ? workspace.bottlenecks.filter((b) => b.stepId === step.id).length
                  : workspace.improvements.filter((i) => i.stepId === step.id).length;
                return (
                  <li key={step.id} className="px-5 py-4">
                    <div className="flex gap-4">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 tabular-nums"
                        aria-hidden="true"
                      >
                        {number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-slate-900">
                            <span className="sr-only">Step {number}: </span>
                            {step.name}
                          </h3>
                          {step.change && <ChangeBadge change={step.change} />}
                          {findingCount > 0 && (
                            <span className="text-xs text-slate-500">
                              {pluralise(findingCount, isAsIs ? 'bottleneck' : 'improvement')}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">
                          <span className="text-slate-500">Responsible:</span>{' '}
                          {describeResponsibility(step.responsible, workspace.stakeholders)}
                        </p>
                        {step.description && <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{step.description}</p>}
                        {(step.input || step.output) && (
                          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="inline text-slate-500">Input: </dt>
                              <dd className="inline text-slate-700">{step.input || '—'}</dd>
                            </div>
                            <div>
                              <dt className="inline text-slate-500">Output: </dt>
                              <dd className="inline text-slate-700">{step.output || '—'}</dd>
                            </div>
                          </dl>
                        )}
                        {step.decision && (
                          <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-700">
                            <Split aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              <span className="sr-only">Decision: </span>
                              {step.decision}
                            </span>
                          </p>
                        )}
                        {step.notes && <p className="mt-1.5 text-sm text-slate-500 italic">{step.notes}</p>}
                        {step.sourceStepIds.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            From AS-IS:{' '}
                            {step.sourceStepIds
                              .map((id) => baselineNumber.get(id))
                              .map((s, i) => (s ? `${s.number}. ${s.name}` : `missing step (${step.sourceStepIds[i]})`))
                              .join('; ')}
                          </p>
                        )}
                        <TracedBy requirements={requirementsLinkedToStep(workspace, step.id)} />
                      </div>
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                        <div className="flex">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={ArrowUp}
                            aria-label={`Move step ${number} up`}
                            disabled={index === 0}
                            onClick={() => move(step.id, -1)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={ArrowDown}
                            aria-label={`Move step ${number} down`}
                            disabled={index === process.steps.length - 1}
                            onClick={() => move(step.id, 1)}
                          />
                        </div>
                        <div className="flex">
                          <ButtonLink
                            to={processPaths.editStep(process.id, step.id)}
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Pencil}
                            aria-label={`Edit step ${number}: ${step.name}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Trash2}
                            aria-label={`Delete step ${number}: ${step.name}`}
                            onClick={() => setPending({ kind: 'step', step, number })}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        {isAsIs ? (
          <FindingsPanel
            title="Bottlenecks"
            description="Problems and inefficiencies in the current process."
            addLabel="Add bottleneck"
            addTo={processPaths.newBottleneck(process.id)}
            disabledReason={process.steps.length === 0 ? 'Add steps before recording bottlenecks.' : undefined}
            emptyText="No bottlenecks recorded."
          >
            {bottlenecks.map((b) => (
              <FindingItem
                key={b.id}
                title={b.title}
                badge={<LevelBadge level={b.severity} kind="severity" />}
                stepText={stepNumber.has(b.stepId) ? `Step ${stepNumber.get(b.stepId)}` : 'Unknown step'}
                editTo={processPaths.editBottleneck(process.id, b.id)}
                onDelete={() => setPending({ kind: 'bottleneck', item: b })}
                details={[
                  ['Description', b.description],
                  ['Impact', b.impact],
                  ['Suggested improvement', b.suggestedImprovement],
                ]}
              />
            ))}
          </FindingsPanel>
        ) : (
          <FindingsPanel
            title="Improvement opportunities"
            description="Improvements the TO-BE process delivers."
            addLabel="Add improvement"
            addTo={processPaths.newImprovement(process.id)}
            disabledReason={process.steps.length === 0 ? 'Add steps before recording improvements.' : undefined}
            emptyText="No improvements recorded."
          >
            {improvements.map((i) => (
              <FindingItem
                key={i.id}
                title={i.title}
                badge={<LevelBadge level={i.priority} kind="priority" />}
                stepText={stepNumber.has(i.stepId) ? `Step ${stepNumber.get(i.stepId)}` : 'Unknown step'}
                editTo={processPaths.editImprovement(process.id, i.id)}
                onDelete={() => setPending({ kind: 'improvement', item: i })}
                details={[
                  ['Description', i.description],
                  ['Related business problem', i.relatedProblem],
                  ['Expected benefit', i.expectedBenefit],
                ]}
              />
            ))}
          </FindingsPanel>
        )}
      </div>

      <DeleteDialogs
        pending={pending}
        process={process}
        workspace={workspace}
        onClose={closeDialog}
        onConfirm={() => {
          if (!pending) return;
          let ok = true;
          if (pending.kind === 'process') {
            ok = report(actions.deleteProcess(process.id), `${process.name} (${PROCESS_TYPE_LABELS[process.type]}) deleted.`);
            closeDialog();
            if (ok) navigate(processPaths.list, { replace: true });
            return;
          }
          if (pending.kind === 'step') report(actions.deleteStep(process.id, pending.step.id), `Step "${pending.step.name}" deleted.`);
          if (pending.kind === 'bottleneck') report(actions.deleteBottleneck(pending.item.id), `Bottleneck "${pending.item.title}" deleted.`);
          if (pending.kind === 'improvement') report(actions.deleteImprovement(pending.item.id), `Improvement "${pending.item.title}" deleted.`);
          closeDialog();
        }}
      />
    </>
  );
}

function RequirementLinks({ requirements }: { requirements: Requirement[] }) {
  return (
    <>
      {[...requirements]
        .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
        .map((r, i) => (
          <span key={r.id}>
            {i > 0 && ', '}
            <Link to={`/requirements/${r.id}`} className="font-medium text-brand-700 hover:underline" title={r.title}>
              {r.identifier}
            </Link>
          </span>
        ))}
    </>
  );
}

function TracedBy({ requirements }: { requirements: Requirement[] }) {
  if (requirements.length === 0) return null;
  return (
    <p className="mt-2 text-xs text-slate-500">
      Traced by requirements: <RequirementLinks requirements={requirements} />
    </p>
  );
}

function RequirementBlockList({ requirements }: { requirements: Requirement[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5">
      {[...requirements]
        .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
        .map((r) => (
          <li key={r.id}>
            <Link to={`/requirements/${r.id}/edit`} className="font-medium text-brand-700 underline underline-offset-2">
              {r.identifier} {r.title}
            </Link>
          </li>
        ))}
    </ul>
  );
}

function FindingsPanel({
  title,
  description,
  addLabel,
  addTo,
  disabledReason,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  addLabel: string;
  addTo: string;
  disabledReason: string | undefined;
  emptyText: string;
  children: ReactNode[];
}) {
  return (
    <Panel
      title={title}
      description={description}
      actions={
        disabledReason ? undefined : (
          <ButtonLink to={addTo} size="sm" icon={Plus}>
            {addLabel}
          </ButtonLink>
        )
      }
      flush
    >
      {children.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">{disabledReason ?? emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-100">{children}</ul>
      )}
    </Panel>
  );
}

function FindingItem({
  title,
  badge,
  stepText,
  editTo,
  onDelete,
  details,
}: {
  title: string;
  badge: ReactNode;
  stepText: string;
  editTo: string;
  onDelete: () => void;
  details: [string, string][];
}) {
  return (
    <li className="px-5 py-4">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-slate-900">{title}</h3>
            {badge}
            <span className="text-xs text-slate-500">{stepText}</span>
          </div>
          <dl className="mt-2 space-y-1 text-sm">
            {details
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="inline text-slate-500">{label}: </dt>
                  <dd className="inline text-slate-700">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
        <div className="flex shrink-0 items-start">
          <ButtonLink to={editTo} variant="ghost" size="sm" iconOnly icon={Pencil} aria-label={`Edit ${title}`} />
          <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`Delete ${title}`} onClick={onDelete} />
        </div>
      </div>
    </li>
  );
}

function StepLinkList({ items }: { items: { processId: string; processName: string; stepId: string; label: string }[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5">
      {items.map((i) => (
        <li key={i.stepId}>
          <Link to={processPaths.editStep(i.processId, i.stepId)} className="font-medium text-brand-700 underline underline-offset-2">
            {i.processName} — {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DeleteDialogs({
  pending,
  process,
  workspace,
  onClose,
  onConfirm,
}: {
  pending: PendingDelete;
  process: BusinessProcess;
  workspace: Workspace;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!pending) return null;

  if (pending.kind === 'process') {
    const deps = findProcessDependencies(workspace, process.id);
    if (deps.dependentProcesses.length > 0) {
      return (
        <ConfirmDialog open title="This process cannot be deleted yet" tone="warning" cancelLabel="Close" onCancel={onClose}>
          <p>
            It is the AS-IS baseline for the TO-BE process(es) below. Change their baseline (and unlink their steps) before
            deleting it.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {deps.dependentProcesses.map((p) => (
              <li key={p.id}>
                <Link to={processPaths.edit(p.id)} className="font-medium text-brand-700 underline underline-offset-2">
                  {p.name} (TO-BE)
                </Link>
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      );
    }
    if (deps.linkedRequirements.length > 0) {
      return (
        <ConfirmDialog open title="This process cannot be deleted yet" tone="warning" cancelLabel="Close" onCancel={onClose}>
          <p>Requirements trace to steps in this process. Remove those step links from each requirement before deleting it:</p>
          <RequirementBlockList requirements={deps.linkedRequirements} />
        </ConfirmDialog>
      );
    }
    const findings = process.type === 'as-is' ? pluralise(deps.bottlenecks.length, 'bottleneck') : pluralise(deps.improvements.length, 'improvement');
    return (
      <ConfirmDialog open title="Delete process?" confirmLabel="Delete process" tone="danger" onConfirm={onConfirm} onCancel={onClose}>
        <strong className="font-semibold text-slate-800">{process.name}</strong> will be permanently deleted with its{' '}
        {pluralise(deps.stepCount, 'step')} and {findings}.
        <RiskUnlinkNote risks={risksLinkedTo(workspace, 'stepIds', process.steps.map((s) => s.id))} />
      </ConfirmDialog>
    );
  }

  if (pending.kind === 'step') {
    const deps = findStepDependencies(workspace, pending.step.id);
    if (deps.linkedSteps.length > 0) {
      return (
        <ConfirmDialog open title="This step cannot be deleted yet" tone="warning" cancelLabel="Close" onCancel={onClose}>
          <p>
            TO-BE steps are linked to step {pending.number} ({pending.step.name}). Remove the link from each of these steps
            first, so the comparison stays accurate:
          </p>
          <StepLinkList
            items={deps.linkedSteps.map((l) => ({
              processId: l.process.id,
              processName: l.process.name,
              stepId: l.step.id,
              label: `step ${l.number}: ${l.step.name}`,
            }))}
          />
        </ConfirmDialog>
      );
    }
    if (deps.linkedRequirements.length > 0) {
      return (
        <ConfirmDialog open title="This step cannot be deleted yet" tone="warning" cancelLabel="Close" onCancel={onClose}>
          <p>
            Requirements trace to step {pending.number} ({pending.step.name}). Remove the step from each requirement first, so no
            requirement is left pointing at a deleted step:
          </p>
          <RequirementBlockList requirements={deps.linkedRequirements} />
        </ConfirmDialog>
      );
    }
    const owned = [
      deps.bottlenecks.length > 0 && pluralise(deps.bottlenecks.length, 'bottleneck'),
      deps.improvements.length > 0 && pluralise(deps.improvements.length, 'improvement'),
    ].filter(Boolean);
    return (
      <ConfirmDialog open title="Delete step?" confirmLabel="Delete step" tone="danger" onConfirm={onConfirm} onCancel={onClose}>
        Step {pending.number}, <strong className="font-semibold text-slate-800">{pending.step.name}</strong>, will be deleted
        {owned.length > 0 ? `, together with the ${owned.join(' and ')} recorded against it` : ''}. Later steps move up.
        <RiskUnlinkNote risks={risksLinkedTo(workspace, 'stepIds', pending.step.id)} />
      </ConfirmDialog>
    );
  }

  const label = pending.kind === 'bottleneck' ? 'bottleneck' : 'improvement';
  return (
    <ConfirmDialog open title={`Delete ${label}?`} confirmLabel={`Delete ${label}`} tone="danger" onConfirm={onConfirm} onCancel={onClose}>
      <strong className="font-semibold text-slate-800">{pending.item.title}</strong> will be permanently deleted.
    </ConfirmDialog>
  );
}
