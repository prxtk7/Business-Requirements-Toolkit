import { useCallback } from 'react';
import { useToast } from '../components/ui/toastContext';
import type { CommitResult } from '../state/workspaceContext';

/**
 * Show the outcome of a workspace change and tell the caller whether to
 * continue (e.g. navigate away). A blocked change was not applied, so the
 * caller should stay put and keep the user's input; a storage failure was
 * applied in memory, so it continues with an error message.
 */
export function useCommitFeedback() {
  const toast = useToast();
  return useCallback(
    (result: CommitResult, successMessage: string): boolean => {
      if (result.ok) {
        toast.success(successMessage);
        return true;
      }
      toast.error(result.error);
      return !result.blocked;
    },
    [toast],
  );
}
