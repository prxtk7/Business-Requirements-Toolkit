import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { UserStory } from '../../domain/types';
import { useWorkspace } from '../../state/workspaceContext';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { pluralise } from '../../lib/format';
import { risksLinkedTo } from '../../domain/risks';
import { RiskUnlinkNote } from '../risks/riskUi';

interface Props {
  story: UserStory | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteStoryDialog({ story, onClose, onDeleted }: Props) {
  const { workspace, actions } = useWorkspace();
  const risks = story ? risksLinkedTo(workspace, 'storyIds', story.id) : [];
  const report = useCommitFeedback();

  const confirm = () => {
    if (!story) return;
    const proceed = report(actions.deleteStory(story.id), `${story.identifier} deleted.`);
    onClose();
    if (proceed) onDeleted?.();
  };

  return (
    <ConfirmDialog
      open={story !== null}
      title={story ? `Delete ${story.identifier}?` : 'Delete user story?'}
      confirmLabel="Delete user story"
      tone="danger"
      onConfirm={confirm}
      onCancel={onClose}
    >
      <strong className="font-semibold text-slate-800">
        {story?.identifier} {story?.title}
      </strong>{' '}
      and its {pluralise(story?.criteria.length ?? 0, 'acceptance criterion', 'acceptance criteria')} will be permanently
      deleted. Linked requirements are not affected. The identifier will not be reused.
      <RiskUnlinkNote risks={risks} />
    </ConfirmDialog>
  );
}
