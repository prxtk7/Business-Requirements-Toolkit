import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { demoWithDeletableHealthSafetyOfficer, readStoredWorkspace, renderApp } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';
import { STORAGE_KEY, saveWorkspace } from '../../storage/workspaceStorage';
import { CONFLICT_SAVE_ERROR } from '../../state/workspaceContext';
import type { Workspace } from '../../domain/types';

const OTHER_TAB_TIME = '2026-03-02T10:00:00.000Z';
const NEWER_NAME = 'Field Service Management System (Revised Scope)';

/** Simulate another tab saving a changed workspace into shared storage. */
function saveFromOtherTab(storage: MemoryStorage, mutate: (workspace: Workspace) => void): string {
  const workspace = readStoredWorkspace(storage);
  mutate(workspace);
  saveWorkspace(storage, workspace, OTHER_TAB_TIME);
  return storage.getItem(STORAGE_KEY)!;
}

/** Browsers deliver this event to every other tab sharing the storage area. */
function fireStorageEvent(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
  });
}

function renameProjectInOtherTab(storage: MemoryStorage): string {
  const raw = saveFromOtherTab(storage, (ws) => {
    ws.project.name = NEWER_NAME;
  });
  fireStorageEvent(STORAGE_KEY, raw);
  return raw;
}

describe('Cross-tab conflict protection', () => {
  it('shows a persistent warning when another tab saves a newer workspace', async () => {
    const storage = new MemoryStorage();
    renderApp({ path: '/overview', storage });
    await screen.findByRole('heading', { level: 1, name: 'Field Service Management System' });

    renameProjectInOtherTab(storage);

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('Workspace changed in another tab');
    expect(warning).toHaveTextContent('saving is paused in this tab');
    expect(within(warning).queryByRole('button', { name: 'Dismiss message' })).not.toBeInTheDocument();
    expect(within(warning).getByRole('button', { name: 'Reload latest workspace' })).toBeInTheDocument();
    // Nothing is replaced silently: this tab keeps showing its own copy until the user reloads.
    expect(screen.getByRole('heading', { level: 1, name: 'Field Service Management System' })).toBeInTheDocument();
  });

  it('ignores storage events for unrelated keys', async () => {
    renderApp({ path: '/overview' });
    await screen.findByRole('heading', { level: 1, name: 'Field Service Management System' });

    fireStorageEvent('some-other-app', 'value');

    expect(screen.queryByText('Workspace changed in another tab')).not.toBeInTheDocument();
  });

  it('blocks further saves so newer data is not overwritten', async () => {
    const storage = demoWithDeletableHealthSafetyOfficer();
    const { user } = renderApp({ path: '/stakeholders', storage });
    await screen.findByRole('heading', { level: 1, name: 'Stakeholders' });

    const newerRaw = renameProjectInOtherTab(storage);

    await user.click(screen.getByRole('button', { name: 'Delete Health and Safety Officer' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));

    expect(await screen.findByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Health and Safety Officer' }).length).toBeGreaterThan(0);
    expect(storage.getItem(STORAGE_KEY)).toBe(newerRaw);
  });

  it('detects a newer write at save time even if the storage event has not arrived', async () => {
    const storage = demoWithDeletableHealthSafetyOfficer();
    const { user } = renderApp({ path: '/stakeholders', storage });
    await screen.findByRole('heading', { level: 1, name: 'Stakeholders' });

    const newerRaw = saveFromOtherTab(storage, (ws) => {
      ws.project.name = NEWER_NAME;
    });

    await user.click(screen.getByRole('button', { name: 'Delete Health and Safety Officer' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));

    expect(await screen.findByText('Workspace changed in another tab')).toBeInTheDocument();
    expect(screen.getByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEY)).toBe(newerRaw);
  });

  it('reloads the latest workspace and then allows saving again', async () => {
    const storage = demoWithDeletableHealthSafetyOfficer();
    const { user } = renderApp({ path: '/overview', storage });
    await screen.findByRole('heading', { level: 1, name: 'Field Service Management System' });

    renameProjectInOtherTab(storage);
    await user.click(await screen.findByRole('button', { name: 'Reload latest workspace' }));

    expect(screen.getByRole('heading', { level: 1, name: NEWER_NAME })).toBeInTheDocument();
    expect(screen.queryByText('Workspace changed in another tab')).not.toBeInTheDocument();
    expect(await screen.findByText('Latest workspace loaded.')).toBeInTheDocument();

    // Saving works again and builds on the newer data.
    await user.click(screen.getByRole('link', { name: 'Stakeholders' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Health and Safety Officer' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));
    expect(await screen.findByText('Health and Safety Officer removed from the stakeholder register.')).toBeInTheDocument();

    const stored = readStoredWorkspace(storage);
    expect(stored.project.name).toBe(NEWER_NAME);
    expect(stored.stakeholders.some((s) => s.name === 'Health and Safety Officer')).toBe(false);
  });

  it('keeps unsaved form changes during a conflict and warns before discarding them', async () => {
    const storage = new MemoryStorage();
    const { user, router } = renderApp({ path: '/overview/edit', storage });

    const name = await screen.findByRole('textbox', { name: /^Project name/ });
    await user.type(name, ' — draft');
    const newerRaw = renameProjectInOtherTab(storage);

    // Saving is refused, but the user stays on the form with their input intact.
    await user.click(screen.getByRole('button', { name: 'Save overview' }));
    expect(await screen.findByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/overview/edit');
    expect(name).toHaveValue('Field Service Management System — draft');
    expect(storage.getItem(STORAGE_KEY)).toBe(newerRaw);

    // Reloading asks first because the form is dirty.
    await user.click(screen.getByRole('button', { name: 'Reload latest workspace' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Discard unsaved changes and reload?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(name).toHaveValue('Field Service Management System — draft');

    await user.click(screen.getByRole('button', { name: 'Reload latest workspace' }));
    await user.click(screen.getByRole('button', { name: 'Discard and reload' }));

    expect(router.state.location.pathname).toBe('/overview/edit');
    expect(screen.getByRole('textbox', { name: /^Project name/ })).toHaveValue(NEWER_NAME);
    expect(screen.queryByText('Workspace changed in another tab')).not.toBeInTheDocument();
  });

  it('reloads without asking when there are no unsaved changes', async () => {
    const storage = new MemoryStorage();
    const { user } = renderApp({ path: '/overview/edit', storage });
    await screen.findByRole('textbox', { name: /^Project name/ });

    renameProjectInOtherTab(storage);
    await user.click(screen.getByRole('button', { name: 'Reload latest workspace' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Project name/ })).toHaveValue(NEWER_NAME);
  });

  it('handles a workspace removed in another tab', async () => {
    const storage = demoWithDeletableHealthSafetyOfficer();
    const { user } = renderApp({ path: '/stakeholders', storage });
    await screen.findByRole('heading', { level: 1, name: 'Stakeholders' });

    storage.removeItem(STORAGE_KEY);
    fireStorageEvent(STORAGE_KEY, null);

    expect(await screen.findByText('Workspace removed in another tab')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Health and Safety Officer' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reload latest workspace' }));
    expect(screen.queryByText('Workspace removed in another tab')).not.toBeInTheDocument();
    expect(readStoredWorkspace(storage).meta.origin).toBe('demo');
  });
});
