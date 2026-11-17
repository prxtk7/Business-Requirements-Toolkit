import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { FIXED_NOW, demoWithDeletableHealthSafetyOfficer, readStoredWorkspace, renderApp } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';
import { BACKUP_KEY_PREFIX, SCHEMA_VERSION, STORAGE_KEY } from '../../storage/workspaceStorage';
import { createDemoWorkspace } from '../../data/demoWorkspace';

describe('Workspace', () => {
  it('summarises the project and links stakeholder strategies to filtered views', async () => {
    const { user, router } = renderApp();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Field Service Management System' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Keep satisfied/ }));
    expect(router.state.location.pathname).toBe('/stakeholders');
    expect(router.state.location.search).toBe('?strategy=keep-satisfied');
    expect(await screen.findByRole('combobox', { name: 'Filter by engagement strategy' })).toHaveValue('keep-satisfied');
  });

  it('marks the active navigation item', async () => {
    renderApp({ path: '/stakeholders' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Stakeholders' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Summary' })).not.toHaveAttribute('aria-current');
  });

  it('keeps data across reloads', async () => {
    const storage = demoWithDeletableHealthSafetyOfficer();
    const first = renderApp({ path: '/stakeholders', storage });
    await first.user.click(await screen.findByRole('button', { name: 'Delete Health and Safety Officer' }));
    await first.user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));
    first.unmount();

    renderApp({ path: '/stakeholders', storage });
    expect(await screen.findByRole('heading', { name: 'Stakeholders' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Health and Safety Officer' })).not.toBeInTheDocument();
  });

  it('can restore demonstration data after starting blank', async () => {
    const { user, storage } = renderApp({ path: '/workspace' });

    await user.click(await screen.findByRole('button', { name: 'Start blank workspace' }));
    await user.click(screen.getByRole('button', { name: 'Delete all and start blank' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Untitled project' })).toBeInTheDocument();
    expect(readStoredWorkspace(storage).stakeholders).toEqual([]);

    await user.click(screen.getByRole('link', { name: 'Workspace data' }));
    await user.click(screen.getByRole('button', { name: 'Restore demo data' }));
    await user.click(screen.getByRole('button', { name: 'Delete all and restore demo' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Field Service Management System' }),
    ).toBeInTheDocument();
    expect(readStoredWorkspace(storage).stakeholders.length).toBeGreaterThan(0);
  });

  it('lists every kind of record the reset deletes, with counts taken from the stored workspace', async () => {
    const storage = demoWithDeletableHealthSafetyOfficer();
    const { user } = renderApp({ path: '/stakeholders', storage });
    // Change the data first so the counts cannot come from the demo dataset.
    await user.click(await screen.findByRole('button', { name: 'Delete Health and Safety Officer' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));
    await screen.findByText('Health and Safety Officer removed from the stakeholder register.');
    const ws = readStoredWorkspace(storage);

    await user.click(screen.getByRole('link', { name: 'Workspace data' }));
    await user.click(await screen.findByRole('button', { name: 'Restore demo data' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this workspace and restore the demo?' });
    expect(dialog).toHaveTextContent('The entire current workspace will be replaced.');
    expect(dialog).toHaveTextContent('This cannot be undone.');

    const count = (listName: string, label: string) =>
      within(within(dialog).getByRole('list', { name: listName })).getByText(label).nextElementSibling?.textContent;
    const deleted = 'Records that will be deleted';
    expect(count(deleted, 'Stakeholders')).toBe(String(ws.stakeholders.length));
    expect(count(deleted, 'Stakeholders')).toBe('9');
    expect(count(deleted, 'Objectives')).toBe(String(ws.project.objectives.length));
    expect(count(deleted, 'Processes')).toBe(String(ws.processes.length));
    expect(count(deleted, 'Process steps')).toBe(String(ws.processes.reduce((n, p) => n + p.steps.length, 0)));
    expect(count(deleted, 'Requirements')).toBe(String(ws.requirements.length));
    expect(count(deleted, 'Requirement dependencies')).toBe(String(ws.requirements.reduce((n, r) => n + r.dependencyIds.length, 0)));
    expect(count(deleted, 'User stories')).toBe(String(ws.userStories.length));
    expect(count(deleted, 'Acceptance criteria')).toBe(String(ws.userStories.reduce((n, s) => n + s.criteria.length, 0)));
    expect(count(deleted, 'Risks')).toBe(String(ws.risks.length));
    // The demonstration data that replaces it is described separately, from the demo dataset's own counts.
    const demo = createDemoWorkspace(FIXED_NOW);
    expect(dialog).toHaveTextContent(
      `They are replaced with the fictional demonstration data: ${demo.project.objectives.length} objectives, ${demo.stakeholders.length} stakeholders, ${demo.processes.length} processes, ${demo.requirements.length} requirements, ${demo.userStories.length} user stories, ${demo.userStories.reduce((n, s) => n + s.criteria.length, 0)} acceptance criteria and ${demo.risks.length} risks.`,
    );

    // Cancel is focused first and keeps everything.
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(readStoredWorkspace(storage)).toEqual(ws);
  });

  it('states that starting blank leaves every module empty, and only deletes on explicit confirmation', async () => {
    const { user, storage } = renderApp({ path: '/workspace' });
    const before = readStoredWorkspace(storage);
    const summary = await screen.findByRole('list', { name: 'Records in this workspace' });
    expect(within(summary).getByText('Requirements').nextElementSibling).toHaveTextContent(String(before.requirements.length));

    await user.click(screen.getByRole('button', { name: 'Start blank workspace' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this workspace and start blank?' });
    expect(dialog).toHaveTextContent('Nothing replaces them: every module starts empty.');
    expect(dialog).not.toHaveTextContent('demonstration data');

    // Escape cancels without deleting.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(readStoredWorkspace(storage)).toEqual(before);

    await user.click(screen.getByRole('button', { name: 'Start blank workspace' }));
    await user.click(screen.getByRole('button', { name: 'Delete all and start blank' }));
    expect(await screen.findByText('Blank workspace created.')).toBeInTheDocument();
    const after = readStoredWorkspace(storage);
    expect([after.stakeholders, after.processes, after.requirements, after.userStories, after.risks, after.project.objectives]).toEqual([[], [], [], [], [], []]);

    await user.click(screen.getByRole('link', { name: 'Workspace data' }));
    await user.click(await screen.findByRole('button', { name: 'Restore demo data' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('It contains no records.');
  });

  it('tells the user when saved data could not be read', async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{corrupt');
    renderApp({ storage });

    expect(await screen.findByText('Saved workspace could not be read')).toBeInTheDocument();
  });

  it('keeps unreadable data that could not be backed up until the user saves a change', async () => {
    class NoBackupStorage extends MemoryStorage {
      override setItem(key: string, value: string): void {
        if (key.startsWith(BACKUP_KEY_PREFIX)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        super.setItem(key, value);
      }
    }
    const storage = new NoBackupStorage();
    storage.setItem(STORAGE_KEY, '{corrupt');
    const { user } = renderApp({ path: '/user-stories/us_demo_014', storage });

    const notice = (await screen.findByText('Saved workspace could not be read')).closest('[role="status"]')!;
    expect(notice).toHaveTextContent('left in browser storage unchanged. Saving any change in this tab will replace it.');
    expect(storage.getItem(STORAGE_KEY)).toBe('{corrupt');

    // Saving is a deliberate action, as the notice says: it replaces the unreadable data.
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Delete US-014?' })).getByRole('button', { name: 'Delete user story' }));
    expect(await screen.findByText('US-014 deleted.')).toBeInTheDocument();
    expect(readStoredWorkspace(storage).userStories.map((s) => s.identifier)).not.toContain('US-014');
  });

  it('moves focus into the mobile navigation and back when it is dismissed', async () => {
    const { user } = renderApp();
    const menuButton = await screen.findByRole('button', { name: 'Open navigation' });

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
    // Both sidebars are now rendered; their ids must still be unique.
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of screen.getAllByRole('list', { name: 'Planned modules' })) expect(list).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();

    await user.click(menuButton);
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(menuButton).toHaveFocus();
  });

  describe('mobile navigation keyboard behaviour', () => {
    async function openMenu() {
      const rendered = renderApp();
      const menuButton = await screen.findByRole('button', { name: 'Open navigation' });
      await rendered.user.click(menuButton);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      return { ...rendered, menuButton, dialog };
    }

    it('is a modal dialog that keeps Tab and Shift+Tab inside it', async () => {
      const { user, dialog } = await openMenu();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const close = within(dialog).getByRole('button', { name: 'Close navigation' });
      const last = within(dialog).getByRole('link', { name: 'Workspace data' });
      expect(close).toHaveFocus();

      // Shift+Tab from the first control wraps to the last, Tab from the last wraps to the first.
      await user.tab({ shift: true });
      expect(last).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();

      // A full cycle forwards and backwards never reaches the page behind the drawer.
      const stops = within(dialog).getAllByRole('link').length + 1;
      for (let i = 0; i < stops + 2; i++) {
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
      }
      for (let i = 0; i < stops + 2; i++) {
        await user.tab({ shift: true });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
      }
    });

    it('closes from the backdrop and returns focus to the menu button', async () => {
      const { user, dialog, menuButton } = await openMenu();
      const backdrop = dialog.previousElementSibling as HTMLElement;
      await user.click(backdrop);
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
      expect(menuButton).toHaveFocus();
    });

    it('closes after following a link and moves focus to the page content', async () => {
      const { user, dialog, menuButton, router } = await openMenu();
      await user.click(within(dialog).getByRole('link', { name: 'Stakeholders' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Stakeholders' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/stakeholders');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('main')).toHaveFocus();
    });

    it('can be opened, used and closed with the keyboard alone', async () => {
      const { user, router } = renderApp();
      const menuButton = await screen.findByRole('button', { name: 'Open navigation' });
      menuButton.focus();

      await user.keyboard('{Enter}');
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(within(dialog).getByRole('button', { name: 'Close navigation' })).toHaveFocus();

      await user.tab(); // Summary
      await user.tab(); // Project Overview
      expect(within(dialog).getByRole('link', { name: 'Project Overview' })).toHaveFocus();
      await user.keyboard('{Enter}');

      await waitFor(() => expect(router.state.location.pathname).toBe('/overview'));
      expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveFocus();
    });
  });

  it('shows a not-found page for unknown routes', async () => {
    renderApp({ path: '/nowhere' });
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    // A not-found page is a whole page, so its title is the level-one heading.
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Loading saved data with integrity problems', () => {
  it("keeps the user's workspace, repairs broken links and explains what changed", async () => {
    const ws = createDemoWorkspace(FIXED_NOW);
    const [first, ...rest] = ws.userStories;
    const saved = {
      ...ws,
      project: { ...ws.project, name: 'My own project' },
      userStories: [{ ...first!, requirementIds: [...first!.requirementIds, 'req_gone'] }, ...rest],
    };
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: FIXED_NOW, workspace: saved }));

    renderApp({ storage });

    expect(await screen.findByRole('heading', { level: 1, name: 'My own project' })).toBeInTheDocument();
    const notice = screen.getByText('Some saved records needed attention').closest('[role="status"]') as HTMLElement;
    expect(notice).toHaveTextContent(`${first!.identifier}: 1 link to requirements that no longer exist was removed.`);
    expect(notice).toHaveTextContent(`The original saved data is kept in browser storage under ${BACKUP_KEY_PREFIX}${FIXED_NOW}.`);
    expect(readStoredWorkspace(storage).project.name).toBe('My own project');
    expect(readStoredWorkspace(storage).userStories[0]!.requirementIds).toEqual(first!.requirementIds);
  });

  it('lists only the first few problems and summarises the rest', async () => {
    const ws = createDemoWorkspace(FIXED_NOW);
    const saved = { ...ws, risks: ws.risks.map((r) => ({ ...r, links: { ...r.links, stepIds: [...r.links.stepIds, 'stp_gone'] } })) };
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: FIXED_NOW, workspace: saved }));

    renderApp({ storage });

    const notice = (await screen.findByText('Some saved records needed attention')).closest('[role="status"]') as HTMLElement;
    expect(within(notice).getAllByRole('listitem')).toHaveLength(7);
    expect(notice).toHaveTextContent(`…and ${ws.risks.length - 6} more.`);
  });
});
