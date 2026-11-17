import { Link } from 'react-router';
import { ArrowLeftRight, GitBranch, Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import type { BusinessProcess, ProcessType, Workspace } from '../../domain/types';
import { PROCESS_TYPE_LABELS, findProcess, itemsForProcess } from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pluralise } from '../../lib/format';
import { processPaths } from './processPaths';

function ProcessRow({ process, workspace }: { process: BusinessProcess; workspace: Workspace }) {
  const findings =
    process.type === 'as-is'
      ? pluralise(itemsForProcess(workspace.bottlenecks, process).length, 'bottleneck')
      : pluralise(itemsForProcess(workspace.improvements, process).length, 'improvement');
  const baseline = process.baselineProcessId ? findProcess(workspace, process.baselineProcessId) : undefined;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to={processPaths.detail(process.id)}
            className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
          >
            {process.name}
          </Link>
          {process.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{process.description}</p>}
          {process.type === 'to-be' && (
            <p className="mt-1 text-xs text-slate-500">
              {baseline ? (
                <>
                  Compared with AS-IS:{' '}
                  <Link to={processPaths.detail(baseline.id)} className="font-medium text-slate-700 hover:underline">
                    {baseline.name}
                  </Link>
                </>
              ) : (
                'No AS-IS baseline set'
              )}
            </p>
          )}
        </div>
        <p className="shrink-0 text-sm text-slate-500 tabular-nums sm:text-right">
          {pluralise(process.steps.length, 'step')} · {findings}
        </p>
      </div>
    </li>
  );
}

function ProcessSection({ type, processes, workspace }: { type: ProcessType; processes: BusinessProcess[]; workspace: Workspace }) {
  const label = PROCESS_TYPE_LABELS[type];
  return (
    <Panel
      title={`${label} processes`}
      description={type === 'as-is' ? 'How the work is done today.' : 'How the work will be done with the new system.'}
      actions={
        <ButtonLink to={processPaths.create(type)} size="sm" icon={Plus}>
          New {label} process
        </ButtonLink>
      }
      flush
    >
      {processes.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">No {label} processes documented yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {processes.map((p) => (
            <ProcessRow key={p.id} process={p} workspace={workspace} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ProcessesPage() {
  const { workspace } = useWorkspace();
  useDocumentTitle('Process Analysis');

  const asIs = workspace.processes.filter((p) => p.type === 'as-is');
  const toBe = workspace.processes.filter((p) => p.type === 'to-be');
  const comparable = toBe.filter((p) => p.baselineProcessId && findProcess(workspace, p.baselineProcessId));

  const header = (
    <PageHeader
      eyebrow="Process Analysis"
      title="Processes"
      description="Document how work flows today (AS-IS) and how it should flow with the new system (TO-BE), then compare them to see what changes."
      actions={
        comparable.length > 0 && (
          <ButtonLink to={processPaths.compare(comparable[0]?.id)} variant="primary" icon={ArrowLeftRight}>
            Compare AS-IS and TO-BE
          </ButtonLink>
        )
      }
    />
  );

  if (workspace.processes.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={GitBranch}
          title="No processes documented yet"
          description={
            <>
              <p>
                Start with the AS-IS process: the steps, who performs them, and their inputs and outputs. Then document the
                TO-BE process and link its steps to the AS-IS steps they replace.
              </p>
              <p className="mt-3">
                To see a worked example with AS-IS and TO-BE processes, use{' '}
                <Link to="/workspace" className="font-medium text-brand-700 underline underline-offset-2">
                  Restore demo data
                </Link>{' '}
                (this replaces the current workspace).
              </p>
            </>
          }
          action={
            <ButtonLink to={processPaths.create('as-is')} variant="primary" icon={Plus}>
              Document AS-IS process
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
        <ProcessSection type="as-is" processes={asIs} workspace={workspace} />
        <ProcessSection type="to-be" processes={toBe} workspace={workspace} />
      </div>
    </>
  );
}
