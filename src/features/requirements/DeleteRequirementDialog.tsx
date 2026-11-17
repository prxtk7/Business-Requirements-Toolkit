import { Link } from 'react-router';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Requirement } from '../../domain/types';
import { findDependents } from '../../domain/requirements';
import { useWorkspace } from '../../state/workspaceContext';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { requirementPaths } from './requirementPaths';
import { storiesForRequirement } from '../../domain/userStories';
import { risksLinkedTo } from '../../domain/risks';
import { RiskUnlinkNote } from '../risks/riskUi';

interface Props {
  requirement: Requirement | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Confirms deletion. If other requirements depend on this one, the dialog
 * names them and explains that the dependency will be removed from each, so
 * no broken reference is left behind.
 */
export function DeleteRequirementDialog({ requirement, onClose, onDeleted }: Props) {
  const { workspace, actions } = useWorkspace();
  const report = useCommitFeedback();
  const dependents = requirement ? findDependents(workspace.requirements, requirement.id) : [];
  const stories = requirement ? storiesForRequirement(workspace, requirement.id) : [];
  const risks = requirement ? risksLinkedTo(workspace, 'requirementIds', requirement.id) : [];

  if (requirement && stories.length > 0) {
    return (
      <ConfirmDialog open title={`${requirement.identifier} cannot be deleted yet`} tone="warning" cancelLabel="Close" onCancel={onClose}>
        <p>
          {stories.length === 1 ? 'A user story is' : `${stories.length} user stories are`} linked to this requirement. Remove the
          requirement from each story (or delete the story) first, so no story is left pointing at a deleted requirement:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {stories.map((s) => (
            <li key={s.id}>
              <Link to={`/user-stories/${s.id}/edit`} className="font-medium text-brand-700 underline underline-offset-2">
                {s.identifier} {s.title}
              </Link>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    );
  }

  const confirm = () => {
    if (!requirement) return;
    const proceed = report(actions.deleteRequirement(requirement.id), `${requirement.identifier} deleted.`);
    onClose();
    if (proceed) onDeleted?.();
  };

  return (
    <ConfirmDialog
      open={requirement !== null}
      title={requirement ? `Delete ${requirement.identifier}?` : 'Delete requirement?'}
      confirmLabel="Delete requirement"
      tone="danger"
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p>
        <strong className="font-semibold text-slate-800">
          {requirement?.identifier} {requirement?.title}
        </strong>{' '}
        will be permanently deleted. Its identifier will not be reused.
      </p>
      {dependents.length > 0 && (
        <>
          <p className="mt-3">
            {dependents.length === 1 ? 'This requirement depends' : `${dependents.length} requirements depend`} on it. The
            dependency will be removed from:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {dependents.map((d) => (
              <li key={d.id}>
                <Link to={requirementPaths.detail(d.id)} className="font-medium text-brand-700 underline underline-offset-2">
                  {d.identifier} {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <RiskUnlinkNote risks={risks} />
    </ConfirmDialog>
  );
}
