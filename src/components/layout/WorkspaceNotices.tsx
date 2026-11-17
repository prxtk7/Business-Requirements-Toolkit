import { Link } from 'react-router';
import { Alert } from '../ui/Alert';
import { useWorkspace } from '../../state/workspaceContext';
import { ConflictNotice } from './ConflictNotice';

/** Global banners about data origin and persistence health. */
export function WorkspaceNotices() {
  const { workspace, loadStatus, backupKey, loadIssues, persistenceError, loadNoticeDismissed, dismissLoadNotice } = useWorkspace();

  return (
    <div className="mb-6 space-y-3 empty:hidden">
      <ConflictNotice />

      {persistenceError && (
        <Alert tone="error" title="Changes not saved">
          {persistenceError}
        </Alert>
      )}

      {!loadNoticeDismissed && loadStatus === 'unavailable' && (
        <Alert tone="warning" title="Browser storage unavailable" onDismiss={dismissLoadNotice}>
          Your browser is blocking local storage, so changes will only last until this tab is closed.
        </Alert>
      )}

      {!loadNoticeDismissed && loadStatus === 'recovered' && (
        <Alert tone="warning" title="Saved workspace could not be read" onDismiss={dismissLoadNotice}>
          The demonstration workspace has been loaded instead.
          {backupKey ? (
            <>
              {' '}
              The unreadable data was kept in browser storage under <code className="font-mono text-xs">{backupKey}</code>.
            </>
          ) : (
            ' The unreadable data could not be backed up, so it has been left in browser storage unchanged. Saving any change in this tab will replace it.'
          )}
        </Alert>
      )}

      {!loadNoticeDismissed && loadIssues && <RepairNotice {...loadIssues} backupKey={backupKey} onDismiss={dismissLoadNotice} />}

      {!loadNoticeDismissed && workspace.meta.origin === 'demo' && loadStatus !== 'recovered' && loadStatus !== 'repaired' && (
        <Alert tone="info" onDismiss={dismissLoadNotice}>
          You are viewing a <strong className="font-semibold">fictional demonstration scenario</strong>. The
          company, people and figures are invented. Edit freely, or{' '}
          <Link to="/workspace" className="font-medium underline underline-offset-2">
            start a blank workspace
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}

/** How many problems to list before summarising the rest. */
const VISIBLE_ISSUES = 6;

function RepairNotice({
  issues,
  dataChanged,
  backupKey,
  onDismiss,
}: {
  issues: string[];
  dataChanged: boolean;
  backupKey: string | null;
  onDismiss: () => void;
}) {
  const hidden = issues.length - VISIBLE_ISSUES;
  return (
    <Alert tone="warning" title="Some saved records needed attention" onDismiss={onDismiss}>
      <p>
        {!dataChanged
          ? 'Your workspace was loaded unchanged, but some records refer to records that no longer exist:'
          : backupKey
            ? 'Your workspace was loaded and the problems below were repaired automatically. Records that could not be read were set aside rather than deleted.'
            : 'Your workspace was loaded with the repairs below applied in this tab only.'}
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {issues.slice(0, VISIBLE_ISSUES).map((issue, index) => (
          // Messages can repeat (e.g. two processes with the same name), so position is part of the key.
          <li key={`${index}-${issue}`}>{issue}</li>
        ))}
        {hidden > 0 && <li>…and {hidden} more.</li>}
      </ul>
      {dataChanged && (
        <p className="mt-1.5">
          {backupKey ? (
            <>
              The original saved data is kept in browser storage under <code className="font-mono text-xs">{backupKey}</code>.
            </>
          ) : (
            'The original saved data could not be backed up, so it has been left in browser storage unchanged. Saving any change in this tab will replace it.'
          )}
        </p>
      )}
    </Alert>
  );
}
