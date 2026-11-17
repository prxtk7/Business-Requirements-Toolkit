import { Link } from 'react-router';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/toastContext';
import type { Stakeholder } from '../../domain/types';
import { PROCESS_TYPE_LABELS, findStakeholderReferences } from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { processPaths } from '../processes/processPaths';
import { requirementsSourcedFrom } from '../../domain/requirements';
import { requirementPaths } from '../requirements/requirementPaths';
import { storiesForStakeholder } from '../../domain/userStories';
import { risksLinkedTo, risksOwnedBy } from '../../domain/risks';
import { RiskUnlinkNote } from '../risks/riskUi';
import { riskPaths } from '../risks/riskPaths';

interface Props {
  stakeholder: Stakeholder | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Confirms stakeholder deletion. A stakeholder that is responsible for
 * process steps cannot be deleted: the dialog lists those steps so the user
 * can reassign or remove each responsibility first.
 */
export function DeleteStakeholderDialog({ stakeholder, onClose, onDeleted }: Props) {
  const { workspace, actions } = useWorkspace();
  const toast = useToast();
  const references = stakeholder ? findStakeholderReferences(workspace, stakeholder.id) : [];
  const requirements = stakeholder ? requirementsSourcedFrom(workspace, stakeholder.id) : [];
  const stories = stakeholder ? storiesForStakeholder(workspace, stakeholder.id) : [];
  const ownedRisks = stakeholder ? risksOwnedBy(workspace, stakeholder.id) : [];
  const relatedRisks = stakeholder ? risksLinkedTo(workspace, 'stakeholderIds', stakeholder.id) : [];

  if (stakeholder && (references.length > 0 || requirements.length > 0 || stories.length > 0 || ownedRisks.length > 0)) {
    const parts = [
      references.length > 0 && (references.length === 1 ? 'responsible for a process step' : `responsible for ${references.length} process steps`),
      requirements.length > 0 && `the source of ${requirements.length === 1 ? 'a requirement' : `${requirements.length} requirements`}`,
      stories.length > 0 && `the user role of ${stories.length === 1 ? 'a user story' : `${stories.length} user stories`}`,
      ownedRisks.length > 0 && `the owner of ${ownedRisks.length === 1 ? 'a risk' : `${ownedRisks.length} risks`}`,
    ].filter(Boolean);
    return (
      <ConfirmDialog open title="This stakeholder cannot be deleted yet" tone="warning" cancelLabel="Close" onCancel={onClose}>
        <p>
          <strong className="font-semibold text-slate-800">{stakeholder.name}</strong> is {parts.join(' and ')}. Reassign
          each item below to another stakeholder (or remove the link), then delete the stakeholder.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {ownedRisks.map((r) => (
            <li key={r.id}>
              <Link to={riskPaths.edit(r.id)} className="font-medium text-brand-700 underline underline-offset-2">
                {r.identifier} {r.title} (risk owner)
              </Link>
            </li>
          ))}
          {stories.map((s) => (
            <li key={s.id}>
              <Link to={`/user-stories/${s.id}/edit`} className="font-medium text-brand-700 underline underline-offset-2">
                {s.identifier} {s.title} (user story role)
              </Link>
            </li>
          ))}
          {requirements.map((r) => (
            <li key={r.id}>
              <Link to={requirementPaths.edit(r.id)} className="font-medium text-brand-700 underline underline-offset-2">
                {r.identifier} {r.title} (requirement source)
              </Link>
            </li>
          ))}
          {references.map((ref) => (
            <li key={ref.step.id}>
              <Link
                to={processPaths.editStep(ref.process.id, ref.step.id)}
                className="font-medium text-brand-700 underline underline-offset-2"
              >
                {ref.process.name} ({PROCESS_TYPE_LABELS[ref.process.type]}) — step {ref.number}: {ref.step.name}
              </Link>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    );
  }

  const handleConfirm = () => {
    if (!stakeholder) return;
    const result = actions.deleteStakeholder(stakeholder.id);
    if (result.ok) toast.success(`${stakeholder.name} removed from the stakeholder register.`);
    else toast.error(result.error);
    onClose();
    // A blocked delete (cross-tab conflict or integrity rule) changed nothing, so stay where we are.
    if (result.ok || !result.blocked) onDeleted?.();
  };

  return (
    <ConfirmDialog
      open={stakeholder !== null}
      title="Delete stakeholder?"
      confirmLabel="Delete stakeholder"
      tone="danger"
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <strong className="font-semibold text-slate-800">{stakeholder?.name}</strong> and their expectations will be
      permanently removed from this workspace.
      <RiskUnlinkNote risks={relatedRisks} />
    </ConfirmDialog>
  );
}
