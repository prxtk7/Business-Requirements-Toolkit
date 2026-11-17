import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { demoWithDeletableHealthSafetyOfficer, readStoredWorkspace, renderApp } from '../../test/renderApp';

/** The register is the table without a caption; the grid table has a caption. */
function registerTable(): HTMLElement {
  const tables = screen.getAllByRole('table');
  const table = tables.find((t) => !t.querySelector('caption'));
  if (!table) throw new Error('Stakeholder register table not found');
  return table;
}

describe('Stakeholder Analysis', () => {
  it('lists demo stakeholders on the map and in the register', async () => {
    renderApp({ path: '/stakeholders' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Stakeholders' })).toBeInTheDocument();
    const grid = screen.getByRole('table', { name: /mapped by influence/i });
    expect(within(grid).getByRole('link', { name: 'Daniel Hartley' })).toBeInTheDocument();
    expect(within(registerTable()).getAllByRole('row')).toHaveLength(11); // header + 10 demo records
  });

  it('filters the register by search text and strategy', async () => {
    const { user } = renderApp({ path: '/stakeholders' });

    await user.type(await screen.findByRole('searchbox', { name: 'Search stakeholders' }), 'invoicing');
    let rows = within(registerTable()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Grace Whitmore');

    await user.clear(screen.getByRole('searchbox', { name: 'Search stakeholders' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by engagement strategy' }), 'manage-closely');
    rows = within(registerTable()).getAllByRole('row').slice(1);
    // First link in each row is the stakeholder name; sorted by influence, interest, then name.
    expect(rows.map((r) => within(r).getAllByRole('link')[0]?.textContent)).toEqual([
      'Daniel Hartley',
      'Sofia Lindqvist',
    ]);

    await user.type(screen.getByRole('searchbox', { name: 'Search stakeholders' }), 'zzz');
    expect(screen.getByText('No stakeholders match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(registerTable()).getAllByRole('row')).toHaveLength(11);
  });

  it('validates and adds a new stakeholder, persisting it to storage', async () => {
    const { user, storage } = renderApp({ path: '/stakeholders' });

    await user.click(await screen.findByRole('link', { name: 'Add stakeholder' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Add stakeholder' })).toBeInTheDocument();

    // Submitting empty shows an error summary with both required fields.
    await user.click(screen.getByRole('button', { name: 'Add stakeholder' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('There are 2 problems with this form');
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('aria-invalid', 'true');

    // Duplicate names are rejected.
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'aisha rahman');
    await user.type(screen.getByRole('textbox', { name: /^Role/ }), 'Fleet and Vehicle Manager');
    await user.click(screen.getByRole('button', { name: 'Add stakeholder' }));
    expect(screen.getByText('A stakeholder with this name already exists.', { selector: 'p' })).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: /^Name/ }));
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Fleet Manager');

    // Rating updates the suggested strategy live.
    const influence = screen.getByRole('group', { name: /^Influence/ });
    const interest = screen.getByRole('group', { name: /^Interest/ });
    await user.click(within(influence).getByRole('radio', { name: 'High' }));
    await user.click(within(interest).getByRole('radio', { name: 'Low' }));
    expect(screen.getByText('Suggested strategy').parentElement).toHaveTextContent('Keep satisfied');

    await user.click(screen.getByRole('button', { name: 'Add expectation' }));
    await user.type(screen.getByRole('textbox', { name: 'Expectation 1' }), 'Van stock levels visible before dispatch');

    await user.click(screen.getByRole('button', { name: 'Add stakeholder' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Fleet Manager' })).toBeInTheDocument();
    expect(await screen.findByText('Fleet Manager added to the stakeholder register.')).toBeInTheDocument();
    expect(screen.getByText('Van stock levels visible before dispatch')).toBeInTheDocument();

    const stored = readStoredWorkspace(storage).stakeholders.find((s) => s.name === 'Fleet Manager');
    expect(stored).toMatchObject({
      role: 'Fleet and Vehicle Manager',
      influence: 'high',
      interest: 'low',
      expectations: ['Van stock levels visible before dispatch'],
    });
  });

  it('edits an existing stakeholder', async () => {
    const { user, storage } = renderApp({ path: '/stakeholders/stk_demo_finance' });

    await user.click(await screen.findByRole('link', { name: 'Edit stakeholder' }));
    const role = screen.getByRole('textbox', { name: /^Role/ });
    await user.clear(role);
    await user.type(role, 'Finance and Commercial Manager');
    await user.click(within(screen.getByRole('group', { name: /^Interest/ })).getByRole('radio', { name: 'High' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Finance and Commercial Manager')).toBeInTheDocument();
    expect(screen.getAllByText('Manage closely').length).toBeGreaterThan(0);
    expect(readStoredWorkspace(storage).stakeholders.find((s) => s.id === 'stk_demo_finance')?.interest).toBe('high');
  });

  it('asks for confirmation before deleting, and cancelling keeps the record', async () => {
    const { user, storage } = renderApp({ path: '/stakeholders', storage: demoWithDeletableHealthSafetyOfficer() });

    await user.click(await screen.findByRole('button', { name: 'Delete Health and Safety Officer' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete stakeholder?' });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(registerTable()).getByRole('link', { name: 'Health and Safety Officer' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Health and Safety Officer' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));

    expect(within(registerTable()).queryByRole('link', { name: 'Health and Safety Officer' })).not.toBeInTheDocument();
    expect(await screen.findByText('Health and Safety Officer removed from the stakeholder register.')).toBeInTheDocument();
    expect(readStoredWorkspace(storage).stakeholders.some((s) => s.name === 'Health and Safety Officer')).toBe(false);
  });

  it('warns before discarding unsaved form changes', async () => {
    const { user, router } = renderApp({ path: '/stakeholders/new' });

    await user.type(await screen.findByRole('textbox', { name: /^Name/ }), 'Draft');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe('/stakeholders/new');
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Draft');

    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(router.state.location.pathname).toBe('/stakeholders');
  });

  it('shows a not-found state for an unknown stakeholder', async () => {
    renderApp({ path: '/stakeholders/does-not-exist' });
    expect(await screen.findByRole('heading', { name: 'Stakeholder not found' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Stakeholder not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to stakeholders' })).toHaveAttribute('href', '/stakeholders');
  });

  it('shows an empty state for a blank workspace', async () => {
    const { user } = renderApp({ path: '/workspace' });
    await user.click(await screen.findByRole('button', { name: 'Start blank workspace' }));
    await user.click(screen.getByRole('button', { name: 'Delete all and start blank' }));
    await user.click(screen.getByRole('link', { name: 'Stakeholders' }));

    expect(await screen.findByRole('heading', { name: 'No stakeholders yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add first stakeholder' })).toHaveAttribute('href', '/stakeholders/new');
  });
});
