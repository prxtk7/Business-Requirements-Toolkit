import type { ReactNode } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import { WorkspaceProvider } from '../state/WorkspaceProvider';
import type { LoadResult } from '../storage/workspaceStorage';

interface AppProvidersProps {
  initial: LoadResult;
  storage: Storage | null;
  now?: () => string;
  children: ReactNode;
}

export function AppProviders({ initial, storage, now, children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <WorkspaceProvider initial={initial} storage={storage} {...(now ? { now } : {})}>
        {children}
      </WorkspaceProvider>
    </ToastProvider>
  );
}
