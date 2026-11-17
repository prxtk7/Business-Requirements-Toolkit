import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/toastContext';
import { useWorkspace } from '../../state/workspaceContext';

/**
 * Persistent warning shown when another browser tab changed or removed the
 * stored workspace. Saving stays paused until the user reloads.
 */
export function ConflictNotice() {
  const { conflict, reloadLatest, hasUnsavedChanges } = useWorkspace();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  if (!conflict) return null;

  const reload = () => {
    setConfirming(false);
    reloadLatest();
    toast.success('Latest workspace loaded.');
  };

  return (
    <>
      <Alert
        tone="error"
        title={conflict === 'removed' ? 'Workspace removed in another tab' : 'Workspace changed in another tab'}
      >
        <p>
          {conflict === 'removed'
            ? 'The saved workspace was removed in another browser tab. Reloading will start from the demonstration data.'
            : 'A newer version of this workspace was saved in another browser tab.'}{' '}
          To avoid overwriting it, saving is paused in this tab until you reload.
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          className="mt-3"
          onClick={() => (hasUnsavedChanges() ? setConfirming(true) : reload())}
        >
          Reload latest workspace
        </Button>
      </Alert>

      <ConfirmDialog
        open={confirming}
        title="Discard unsaved changes and reload?"
        confirmLabel="Discard and reload"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={reload}
        onCancel={() => setConfirming(false)}
      >
        You have unsaved changes on this page. Reloading replaces them with the latest workspace. If you keep
        editing, copy anything you need first — this tab cannot save until it is reloaded.
      </ConfirmDialog>
    </>
  );
}
