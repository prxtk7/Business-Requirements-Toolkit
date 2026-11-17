import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { FilePlus2, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Panel } from '../../components/ui/Panel';
import { useToast } from '../../components/ui/toastContext';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/format';
import { createDemoWorkspace } from '../../data/demoWorkspace';
import { describeWorkspaceContents, type WorkspaceContentItem } from '../../domain/workspace';

type PendingAction = 'demo' | 'blank' | null;

const COUNTING_TIMESTAMP = '1970-01-01T00:00:00.000Z';

/** One-sentence summary of the main record types, e.g. "10 stakeholders, 27 requirements and 14 risks". */
function summarise(items: WorkspaceContentItem[], keys: string[]): string {
  const parts = keys
    .map((k) => items.find((i) => i.key === k))
    .filter((i): i is WorkspaceContentItem => !!i && i.count > 0)
    .map((i) => `${i.count} ${i.label.toLowerCase()}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'no records');
}

/** Compact list of record counts. Categories with no records are left out. */
function ContentCounts({ items, label }: { items: WorkspaceContentItem[]; label: string }) {
  const present = items.filter((i) => i.count > 0);
  if (present.length === 0) return <p className="text-sm text-slate-600">No records.</p>;
  return (
    <ul aria-label={label} className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
      {present.map((i) => (
        <li key={i.key} className="flex justify-between gap-3">
          <span className="text-slate-600">{i.label}</span>
          <span className="font-medium text-slate-900 tabular-nums">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceDataPage() {
  const { workspace, actions, loadStatus } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction>(null);
  useDocumentTitle('Workspace data');
  const current = describeWorkspaceContents(workspace);
  const isEmpty = current.every((i) => i.count === 0);
  // Counts of the fictional dataset that "Restore demo data" loads; computed, never hard-coded.
  // The timestamp only fills the records' created/updated dates, which the counts ignore.
  const demo = useMemo(() => describeWorkspaceContents(createDemoWorkspace(COUNTING_TIMESTAMP)), []);

  const confirm = () => {
    const result = pending === 'demo' ? actions.resetToDemo() : actions.startBlank();
    setPending(null);
    if (!result.ok && result.blocked) {
      toast.error(result.error);
      return;
    }
    if (result.ok) {
      toast.success(pending === 'demo' ? 'Demonstration data restored.' : 'Blank workspace created.');
    } else {
      toast.error(result.error);
    }
    navigate('/');
  };

  const storageLabel = loadStatus === 'unavailable' ? 'In memory only (browser storage unavailable)' : 'This browser (local storage)';

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Workspace data"
        description="Your workspace is stored only in this browser. Nothing is sent to a server."
      />

      <div className="space-y-6">
        <Panel title="Current workspace">
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Started from</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {workspace.meta.origin === 'demo' ? 'Fictional demonstration data' : 'Blank workspace'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatDateTime(workspace.meta.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Storage</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{storageLabel}</dd>
            </div>
          </dl>
          <h3 className="mt-5 text-sm font-medium text-slate-900">Records in this workspace</h3>
          <ContentCounts items={current} label="Records in this workspace" />
        </Panel>

        <Panel title="Reset workspace" description="Both options delete every record in the current workspace, in every module. This cannot be undone.">
          <div className="divide-y divide-slate-100">
            <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Restore demonstration data</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Reload the fictional Northstar HVAC Services field service scenario.
                </p>
              </div>
              <Button icon={RotateCcw} onClick={() => setPending('demo')}>
                Restore demo data
              </Button>
            </div>
            <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-900">Start a blank workspace</h3>
                <p className="mt-0.5 text-sm text-slate-500">Clear all modules and begin your own project analysis.</p>
              </div>
              <Button icon={FilePlus2} onClick={() => setPending('blank')}>
                Start blank workspace
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending === 'demo' ? 'Delete this workspace and restore the demo?' : 'Delete this workspace and start blank?'}
        confirmLabel={pending === 'demo' ? 'Delete all and restore demo' : 'Delete all and start blank'}
        tone="danger"
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <p>
          The entire current workspace will be replaced.{' '}
          {isEmpty ? 'It contains no records.' : 'These records will be permanently deleted:'}
        </p>
        {!isEmpty && <ContentCounts items={current} label="Records that will be deleted" />}
        {pending === 'demo' ? (
          <>
            <p className="mt-3">
              They are replaced with the fictional demonstration data:{' '}
              {summarise(demo, ['objectives', 'stakeholders', 'processes', 'requirements', 'stories', 'criteria', 'risks'])}.
            </p>
          </>
        ) : (
          <p className="mt-3">Nothing replaces them: every module starts empty.</p>
        )}
        <p className="mt-3 font-medium text-slate-900">This cannot be undone. No copy of the current workspace is kept.</p>
      </ConfirmDialog>
    </>
  );
}
