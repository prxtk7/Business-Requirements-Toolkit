import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { LEVEL_LABELS } from '../../domain/types';
import { STRATEGY_DETAILS, getEngagementStrategy } from '../../domain/stakeholders';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/format';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { PROCESS_TYPE_LABELS, findStakeholderReferences } from '../../domain/processes';
import { processPaths } from '../processes/processPaths';
import { StrategyBadge } from './StrategyBadge';
import { DeleteStakeholderDialog } from './DeleteStakeholderDialog';

export function StakeholderDetailPage() {
  const { stakeholderId } = useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const stakeholder = workspace.stakeholders.find((s) => s.id === stakeholderId);
  useDocumentTitle(stakeholder?.name ?? 'Stakeholder not found');

  if (!stakeholder) {
    return (
      <NotFoundPage
        title="Stakeholder not found"
        message="This stakeholder may have been deleted, or the link is incorrect."
        backTo={{ to: '/stakeholders', label: 'Back to stakeholders' }}
      />
    );
  }

  const strategy = getEngagementStrategy(stakeholder.influence, stakeholder.interest);
  const responsibilities = findStakeholderReferences(workspace, stakeholder.id);

  return (
    <>
      <PageHeader
        eyebrow="Stakeholder Analysis"
        title={stakeholder.name}
        description={stakeholder.role}
        back={{ to: '/stakeholders', label: 'All stakeholders' }}
        actions={
          <>
            <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <ButtonLink to={`/stakeholders/${stakeholder.id}/edit`} variant="primary" icon={Pencil}>
              Edit stakeholder
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Panel title="Description">
            {stakeholder.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{stakeholder.description}</p>
            ) : (
              <p className="text-sm text-slate-500 italic">No description recorded.</p>
            )}
          </Panel>

          <Panel title="Expectations" description="What this stakeholder needs from the project.">
            {stakeholder.expectations.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5">
                {stakeholder.expectations.map((e, i) => (
                  <li key={i} className="pl-1 text-sm leading-relaxed text-slate-700 marker:text-slate-400">
                    {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">No expectations recorded.</p>
            )}
          </Panel>

          <Panel title="Process responsibilities" description="Process steps this stakeholder is responsible for.">
            {responsibilities.length > 0 ? (
              <ul className="space-y-2">
                {responsibilities.map((ref) => (
                  <li key={ref.step.id} className="text-sm">
                    <Link to={processPaths.detail(ref.process.id)} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                      {ref.process.name}
                    </Link>{' '}
                    <span className="text-slate-500">
                      ({PROCESS_TYPE_LABELS[ref.process.type]}) — step {ref.number}: {ref.step.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 italic">Not assigned to any process step.</p>
            )}
          </Panel>
        </div>

        <Panel title="Assessment">
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Interest</dt>
              <dd className="font-medium text-slate-900">{LEVEL_LABELS[stakeholder.interest]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Influence</dt>
              <dd className="font-medium text-slate-900">{LEVEL_LABELS[stakeholder.influence]}</dd>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <dt className="text-slate-500">Engagement strategy</dt>
              <dd className="mt-1.5">
                <StrategyBadge strategy={strategy} />
                <p className="mt-2 leading-relaxed text-slate-600">{STRATEGY_DETAILS[strategy].guidance}</p>
              </dd>
            </div>
            <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
              <dt className="sr-only">Record history</dt>
              <dd>Added {formatDateTime(stakeholder.createdAt)}</dd>
              {stakeholder.updatedAt !== stakeholder.createdAt && (
                <dd className="mt-0.5">Updated {formatDateTime(stakeholder.updatedAt)}</dd>
              )}
            </div>
          </dl>
        </Panel>
      </div>

      <DeleteStakeholderDialog
        stakeholder={confirmDelete ? stakeholder : null}
        onClose={() => setConfirmDelete(false)}
        onDeleted={() => navigate('/stakeholders', { replace: true })}
      />
    </>
  );
}
