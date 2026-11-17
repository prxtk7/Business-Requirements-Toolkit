import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Risk } from '../../domain/types';
import { useWorkspace } from '../../state/workspaceContext';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';

interface Props {
  risk: Risk | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteRiskDialog({ risk, onClose, onDeleted }: Props) {
  const { actions } = useWorkspace();
  const report = useCommitFeedback();

  const confirm = () => {
    if (!risk) return;
    const proceed = report(actions.deleteRisk(risk.id), `${risk.identifier} deleted.`);
    onClose();
    if (proceed) onDeleted?.();
  };

  return (
    <ConfirmDialog
      open={risk !== null}
      title={risk ? `Delete ${risk.identifier}?` : 'Delete risk?'}
      confirmLabel="Delete risk"
      tone="danger"
      onConfirm={confirm}
      onCancel={onClose}
    >
      <strong className="font-semibold text-slate-800">
        {risk?.identifier} {risk?.title}
      </strong>{' '}
      will be permanently deleted. Linked stakeholders, objectives, process steps, requirements and user stories are not affected. The
      identifier will not be reused.
    </ConfirmDialog>
  );
}
