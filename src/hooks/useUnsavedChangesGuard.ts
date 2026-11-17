import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router';
import { useWorkspace } from '../state/workspaceContext';

/**
 * Warn before leaving a form with unsaved changes, both for in-app
 * navigation (via the router blocker) and for closing / reloading the tab.
 * Also reports the dirty state to the workspace, so reloading after a
 * cross-tab conflict can warn before discarding the form.
 *
 * Call `allowNavigation()` immediately before navigating away after a
 * successful save, so that the redirect is not blocked.
 */
export function useUnsavedChangesGuard(isDirty: boolean): { blocker: Blocker; allowNavigation: () => void } {
  const { trackUnsavedChanges } = useWorkspace();
  const formId = useId();
  const dirtyRef = useRef(isDirty);
  const bypassRef = useRef(false);
  // Navigation can only start after a render is committed, so updating here is always in time.
  useLayoutEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !bypassRef.current && dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    trackUnsavedChanges(formId, isDirty);
    return () => trackUnsavedChanges(formId, false);
  }, [formId, isDirty, trackUnsavedChanges]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const allowNavigation = useCallback(() => {
    bypassRef.current = true;
  }, []);

  return { blocker, allowNavigation };
}
