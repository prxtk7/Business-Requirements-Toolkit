import type { Blocker } from 'react-router';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Discard unsaved changes?"
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      tone="danger"
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    >
      You have changes on this page that have not been saved. If you leave now, they will be lost.
    </ConfirmDialog>
  );
}
