import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { demoWithoutRequirements, readStoredWorkspace, renderApp } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';

describe('Project Overview', () => {
  it('shows the demo project as a structured charter', async () => {
    renderApp({ path: '/overview' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Field Service Management System' }),
    ).toBeInTheDocument();
    for (const section of ['Background', 'Problem statement', 'Objectives', 'Scope', 'Success criteria']) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
    expect(screen.getByRole('progressbar', { name: 'Project overview completeness' })).toHaveAttribute(
      'aria-valuenow',
      '6',
    );
    expect(screen.getByText(/fictional demonstration scenario/i)).toBeInTheDocument();
  });

  it('validates required fields and saves changes', async () => {
    const { user, storage, router } = renderApp({ path: '/overview' });

    await user.click(await screen.findByRole('link', { name: 'Edit overview' }));
    const name = await screen.findByRole('textbox', { name: /^Project name/ });
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Save overview' }));

    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('Enter a project name.');
    expect(summary).toHaveFocus();
    expect(router.state.location.pathname).toBe('/overview/edit');

    // Error summary links move focus to the field.
    await user.click(within(summary).getByRole('link', { name: 'Enter a project name.' }));
    expect(name).toHaveFocus();

    await user.type(name, 'Field Service Platform Rollout');
    await user.click(screen.getByRole('button', { name: 'Add objective' }));
    expect(screen.getByRole('textbox', { name: 'Objective 8' })).toHaveFocus();
    // Pasting goes to the focused element, so the new objective must still have received focus.
    await user.paste('Publish technician availability daily');
    await user.click(screen.getByRole('button', { name: 'Save overview' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Field Service Platform Rollout' })).toBeInTheDocument();
    expect(screen.getByText('Publish technician availability daily')).toBeInTheDocument();
    expect(await screen.findByText('Project overview saved.')).toBeInTheDocument();

    const stored = readStoredWorkspace(storage).project;
    expect(stored.name).toBe('Field Service Platform Rollout');
    expect(stored.objectives).toHaveLength(8);
    expect(stored.updatedAt).not.toBeNull();
  });

  it('reorders and removes list items', async () => {
    // No requirements trace to the objectives here, so any objective may be removed.
    const { user, storage } = renderApp({ path: '/overview/edit', storage: demoWithoutRequirements() });

    const first = await screen.findByRole('textbox', { name: 'Objective 1' });
    const originalFirst = (first as HTMLInputElement).value;
    const originalSecond = (screen.getByRole('textbox', { name: 'Objective 2' }) as HTMLInputElement).value;

    await user.click(screen.getByRole('button', { name: 'Move objective 1 down' }));
    expect(screen.getByRole('textbox', { name: 'Objective 1' })).toHaveValue(originalSecond);
    expect(screen.getByRole('textbox', { name: 'Objective 2' })).toHaveValue(originalFirst);

    await user.click(screen.getByRole('button', { name: 'Remove objective 1' }));
    await user.click(screen.getByRole('button', { name: 'Save overview' }));

    expect((await screen.findAllByText(originalFirst)).length).toBeGreaterThan(0);
    const stored = readStoredWorkspace(storage).project.objectives;
    expect(stored[0]!.text).toBe(originalFirst);
    expect(stored.map((o) => o.text)).not.toContain(originalSecond);
  });

  it('keeps objective ids when reordering, and blocks removing an objective that requirements trace to', async () => {
    const { user, storage } = renderApp({ path: '/overview/edit' });
    const before = readStoredWorkspace(storage).project.objectives;

    await user.click(await screen.findByRole('button', { name: 'Move objective 1 down' }));
    await user.click(screen.getByRole('button', { name: 'Remove objective 1' }));
    await user.click(screen.getByRole('button', { name: 'Save overview' }));

    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent(`“${before[1]!.text}” is linked to FR-003, FR-004, FR-015, FR-018, NFR-003`);
    expect(readStoredWorkspace(storage).project.objectives).toEqual(before);

    // Discard, then a pure reorder saves and keeps each objective's id.
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    await user.click(await screen.findByRole('link', { name: 'Edit overview' }));
    await user.click(await screen.findByRole('button', { name: 'Move objective 1 down' }));
    await user.click(screen.getByRole('button', { name: 'Save overview' }));
    await screen.findByText('Project overview saved.');
    const after = readStoredWorkspace(storage).project.objectives;
    expect(after.map((o) => o.id)).toEqual([before[1]!.id, before[0]!.id, ...before.slice(2).map((o) => o.id)]);
  });

  it('shows an empty state for a blank workspace and allows creating an overview', async () => {
    const { user } = renderApp({ path: '/workspace' });
    await user.click(await screen.findByRole('button', { name: 'Start blank workspace' }));
    await user.click(screen.getByRole('button', { name: 'Delete all and start blank' }));
    await user.click(screen.getByRole('link', { name: 'Project Overview' }));

    expect(await screen.findByRole('heading', { name: 'No project overview yet' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Create project overview' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Create project overview' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save overview' }));
    expect(screen.getByRole('alert')).toHaveTextContent('There are 3 problems with this form');
  });

  it('reports a storage failure instead of claiming success', async () => {
    const storage = new MemoryStorage();
    const { user } = renderApp({ path: '/overview/edit', storage });
    storage.failWrites = 'quota';

    const name = await screen.findByRole('textbox', { name: /^Project name/ });
    await user.type(name, ' v2');
    await user.click(screen.getByRole('button', { name: 'Save overview' }));

    expect(await screen.findByText('Changes not saved')).toBeInTheDocument();
    expect(screen.queryByText('Project overview saved.')).not.toBeInTheDocument();
    expect(screen.getAllByText(/storage is full/i).length).toBeGreaterThan(0);
  });
});
