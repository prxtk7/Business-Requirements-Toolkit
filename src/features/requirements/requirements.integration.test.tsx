import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { demoWithoutStories, paste, readStoredWorkspace, renderApp } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';
import { STORAGE_KEY, saveWorkspace } from '../../storage/workspaceStorage';
import { CONFLICT_SAVE_ERROR } from '../../state/workspaceContext';

const AS_IS_GROUP = 'Handle repair and maintenance requests (AS-IS)';
const TO_BE_GROUP = 'Handle repair and maintenance requests (TO-BE)';

function registerRows() {
  return within(screen.getByRole('table', { name: 'Requirements' })).getAllByRole('row').slice(1);
}

const rowIds = () => registerRows().map((r) => within(r).getAllByRole('cell')[0]!.textContent);
const byIdentifier = (storage: MemoryStorage, identifier: string) =>
  readStoredWorkspace(storage).requirements.find((r) => r.identifier === identifier);

describe('Requirements register', () => {
  it('lists requirements with counts and supports search, filters and clearing', async () => {
    const { user } = renderApp({ path: '/requirements' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Requirements register' })).toBeInTheDocument();
    expect(registerRows()).toHaveLength(27);
    const count = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
    expect([count('Total'), count('Functional'), count('Non-functional')]).toEqual(['27', '18', '9']);
    expect(screen.getByRole('button', { name: 'Approved (6)' })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search requirements' }), 'nfr-00');
    expect(registerRows()).toHaveLength(9);
    await user.clear(screen.getByRole('searchbox', { name: 'Search requirements' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by type' }), 'functional');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by priority' }), 'must');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'approved');
    expect(rowIds()).toEqual(['FR-001', 'FR-003', 'FR-004']);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by category' }), 'scheduling');
    expect(rowIds()).toEqual(['FR-003', 'FR-004']);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(registerRows()).toHaveLength(27);

    await user.click(screen.getByRole('button', { name: 'Deferred (1)' }));
    expect(rowIds()).toEqual(['FR-018']);
  });

  it('sorts by priority', async () => {
    const { user } = renderApp({ path: '/requirements' });
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Sort by' }), 'priority');
    const ids = rowIds();
    expect(ids.slice(-3)).toEqual(['FR-011', 'FR-016', 'FR-018']); // the two Could Have requirements, then the Won't Have
  });
});

describe('Requirement creation and editing', () => {
  it('validates, then creates a traced functional requirement as a draft with the next identifier', async () => {
    const { user, storage } = renderApp({ path: '/requirements/new' });

    expect(await screen.findByText('FR-019')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create requirement' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('There are 3 problems with this form');
    expect(summary).toHaveTextContent('Select a functional requirement category.');

    await user.type(screen.getByRole('textbox', { name: /^Title/ }), 'Technician skills register');
    await paste(user, screen.getByRole('textbox', { name: /^Description/ }), 'The system shall record each technician’s certified skills.');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Category/ }), 'scheduling');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Priority/ }), 'must');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Source stakeholder/ }), 'stk_demo_dispatch');
    await user.click(screen.getByRole('checkbox', { name: /Improve technician scheduling/ }));
    await user.click(within(screen.getByRole('group', { name: AS_IS_GROUP })).getByRole('checkbox', { name: '3. Review technician availability' }));
    await user.click(within(screen.getByRole('group', { name: TO_BE_GROUP })).getByRole('checkbox', { name: /^4\. Review technician availability/ }));
    await user.click(screen.getByRole('checkbox', { name: 'FR-003 — Technician availability management' }));
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    // Pasting goes to the focused element, so the new criterion must have received focus.
    await user.paste('Skills are shown when assigning a technician.');
    await user.click(screen.getByRole('button', { name: 'Create requirement' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Technician skills register' })).toBeInTheDocument();
    expect(await screen.findByText('FR-019 created as Draft.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aisha Rahman' })).toHaveAttribute('href', '/stakeholders/stk_demo_dispatch');
    expect(screen.getByRole('link', { name: /Improve technician scheduling/ })).toHaveAttribute('href', '/overview#objective-obj_demo_scheduling');
    expect(screen.getByText(/step 3: Review technician availability$/)).toBeInTheDocument();

    expect(byIdentifier(storage, 'FR-019')).toMatchObject({
      status: 'draft',
      priority: 'must',
      sourceStakeholderId: 'stk_demo_dispatch',
      objectiveIds: ['obj_demo_scheduling'],
      stepIds: ['stp_demo_as_availability', 'stp_demo_to_availability'],
      dependencyIds: ['req_demo_fr003'],
      acceptanceCriteria: ['Skills are shown when assigning a technician.'],
    });
    expect(readStoredWorkspace(storage).requirementSequence.functional).toBe(19);
  });

  it('numbers non-functional requirements in their own sequence and offers NFR categories', async () => {
    const { user, storage } = renderApp({ path: '/requirements/new' });

    await user.click(within(await screen.findByRole('group', { name: 'Type' })).getByRole('radio', { name: 'Non-functional' }));
    expect(screen.getByText('NFR-010')).toBeInTheDocument();
    const category = screen.getByRole('combobox', { name: /^Category/ });
    expect(within(category).queryByRole('option', { name: 'Scheduling and Dispatch' })).not.toBeInTheDocument();
    await user.selectOptions(category, 'scalability');
    await user.type(screen.getByRole('textbox', { name: /^Title/ }), 'Growth in technician numbers');
    await user.type(screen.getByRole('textbox', { name: /^Description/ }), 'The system shall support more technicians without redesign.');
    await user.click(screen.getByRole('button', { name: 'Create requirement' }));

    expect(await screen.findByText('NFR-010 created as Draft.')).toBeInTheDocument();
    expect(byIdentifier(storage, 'NFR-010')?.category).toBe('scalability');
    expect(readStoredWorkspace(storage).requirementSequence).toEqual({ functional: 18, nonFunctional: 10 });
  });

  it('edits a requirement without changing its identifier or type', async () => {
    const { user, storage } = renderApp({ path: '/requirements/req_demo_fr007/edit' });
    const before = byIdentifier(storage, 'FR-007')!;

    expect(await screen.findByText(/fixed after creation/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Type' })).not.toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: /^Title/ });
    await user.clear(title);
    await user.type(title, 'Spare parts reservation against work orders');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Status/ }), 'approved');
    await user.click(screen.getByRole('button', { name: 'Save requirement' }));

    expect(await screen.findByText('FR-007 saved.')).toBeInTheDocument();
    const after = byIdentifier(storage, 'FR-007')!;
    expect(after).toMatchObject({ id: before.id, identifier: 'FR-007', type: 'functional', status: 'approved', createdAt: before.createdAt });
    expect(after.title).toBe('Spare parts reservation against work orders');
  });

  it('prevents circular dependencies', async () => {
    const { user, storage } = renderApp({ path: '/requirements/req_demo_fr001/edit' });

    await user.click(await screen.findByRole('checkbox', { name: 'FR-006 — Digital work order completion' }));
    await user.click(screen.getByRole('button', { name: 'Save requirement' }));

    expect(screen.getByRole('alert')).toHaveTextContent('circular chain: FR-001 → FR-006 → FR-005 → FR-004 → FR-001');
    expect(byIdentifier(storage, 'FR-001')!.dependencyIds).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Edit FR-001' })).toBeInTheDocument();
  });

  it('does not offer the requirement itself as a dependency', async () => {
    renderApp({ path: '/requirements/req_demo_fr004/edit' });
    await screen.findByRole('heading', { level: 1, name: 'Edit FR-004' });
    expect(screen.queryByRole('checkbox', { name: /^FR-004 —/ })).not.toBeInTheDocument();
  });
});

describe('Requirement detail and deletion', () => {
  it('shows traceability gaps rather than hiding them', async () => {
    renderApp({ path: '/requirements/req_demo_nfr002' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Role-based access control' })).toBeInTheDocument();
    expect(screen.getByText('Traceability gap: not linked to any project objective.')).toBeInTheDocument();
    expect(screen.getByText('Traceability gap: not linked to any AS-IS or TO-BE process step.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kenji Watanabe' })).toBeInTheDocument();
  });

  it('blocks deleting a requirement that user stories are linked to', async () => {
    const { user, storage } = renderApp({ path: '/requirements/req_demo_fr001' });
    const before = storage.getItem(STORAGE_KEY);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'FR-001 cannot be deleted yet' });
    expect(within(dialog).getByRole('link', { name: 'US-001 Register service requests' })).toHaveAttribute('href', '/user-stories/us_demo_001/edit');
    expect(within(dialog).queryByRole('button', { name: 'Delete requirement' })).not.toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('lists dependents before deleting and removes the dependency from them; identifiers are not reused', async () => {
    // No user stories link to FR-001 here, so the Phase 3 dependency clean-up is exercised on its own.
    const { user, storage } = renderApp({ path: '/requirements/req_demo_fr001', storage: demoWithoutStories() });

    const requiredBy = await screen.findByRole('heading', { name: 'Required by' });
    expect(requiredBy.nextElementSibling).toHaveTextContent('FR-002');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete FR-001?' });
    expect(dialog).toHaveTextContent('3 requirements depend on it');
    for (const id of ['FR-002', 'FR-004', 'FR-012']) expect(within(dialog).getByRole('link', { name: new RegExp(id) })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Requirements register' })).toBeInTheDocument();
    expect(await screen.findByText('FR-001 deleted.')).toBeInTheDocument();

    const stored = readStoredWorkspace(storage);
    expect(stored.requirements.some((r) => r.identifier === 'FR-001')).toBe(false);
    expect(stored.requirements.some((r) => r.dependencyIds.includes('req_demo_fr001'))).toBe(false);

    await user.click(screen.getByRole('link', { name: 'New requirement' }));
    expect(await screen.findByText('FR-019')).toBeInTheDocument();
  });

  it('cancelling deletion keeps the requirement', async () => {
    const { user, storage } = renderApp({ path: '/requirements' });
    await user.click(await screen.findByRole('button', { name: 'Delete NFR-008' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(byIdentifier(storage, 'NFR-008')).toBeDefined();
    expect(registerRows()).toHaveLength(27);
  });
});

describe('Traceability matrix', () => {
  it('shows relationships and gaps, and filters by gap and classification', async () => {
    const { user } = renderApp({ path: '/traceability' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Traceability matrix' })).toBeInTheDocument();
    const matrix = () => screen.getByRole('list', { name: 'Traceability matrix' });
    expect(within(matrix()).getAllByRole('link', { name: /^(FR|NFR)-\d{3}$/ })).toHaveLength(27);
    expect(within(matrix()).getAllByText('No stakeholder source')).toHaveLength(1);
    expect(within(matrix()).getAllByText('No linked objective')).toHaveLength(2);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by traceability gap' }), 'no-process');
    expect(within(matrix()).getAllByRole('link', { name: /^(FR|NFR)-\d{3}$/ }).map((l) => l.textContent)).toEqual(['NFR-001', 'NFR-002', 'NFR-004']);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by type' }), 'functional');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'draft');
    expect(within(matrix()).getAllByRole('link', { name: /^(FR|NFR)-\d{3}$/ }).map((l) => l.textContent)).toEqual(['FR-009', 'FR-011']);

    await user.click(within(matrix()).getByRole('link', { name: 'FR-009' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Service history management' })).toBeInTheDocument();
  });
});

describe('Requirements integration with the rest of the workspace', () => {
  it('shows the requirements summary on the dashboard', async () => {
    renderApp({ path: '/' });
    const summary = await screen.findByLabelText('Requirements summary');
    const value = (label: string) => within(summary).getByText(label).closest('div')?.querySelector('dd')?.textContent;
    expect(['Total', 'Functional', 'Non-functional', 'Must Have', 'Approved', 'Awaiting review'].map(value)).toEqual(['27', '18', '9', '10', '6', '15']);
  });

  it('keeps new requirements across reloads', async () => {
    const storage = new MemoryStorage();
    const first = renderApp({ path: '/requirements/new', storage });
    await first.user.type(await screen.findByRole('textbox', { name: /^Title/ }), 'Audit trail');
    await first.user.type(screen.getByRole('textbox', { name: /^Description/ }), 'Record who changed each work order.');
    await first.user.selectOptions(screen.getByRole('combobox', { name: /^Category/ }), 'work-orders');
    await first.user.click(screen.getByRole('button', { name: 'Create requirement' }));
    await screen.findByText('FR-019 created as Draft.');
    first.unmount();

    renderApp({ path: '/requirements', storage });
    expect(await screen.findByRole('link', { name: 'Audit trail' })).toBeInTheDocument();
  });

  it('keeps the requirement form open when saving is blocked by another tab', async () => {
    const storage = new MemoryStorage();
    const { user, router } = renderApp({ path: '/requirements/req_demo_fr002/edit', storage });
    const title = await screen.findByRole('textbox', { name: /^Title/ });
    await user.type(title, ' (draft)');

    const other = readStoredWorkspace(storage);
    other.project.name = 'Changed elsewhere';
    saveWorkspace(storage, other, '2026-06-01T00:00:00.000Z');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: storage.getItem(STORAGE_KEY) }));
    });

    await user.click(screen.getByRole('button', { name: 'Save requirement' }));
    expect(await screen.findByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/requirements/req_demo_fr002/edit');
    expect(title).toHaveValue('Automatic service request acknowledgement (draft)');
    expect(byIdentifier(storage, 'FR-002')!.title).toBe('Automatic service request acknowledgement');
  });

  it('shows which requirements trace to a process step', async () => {
    renderApp({ path: '/processes/prc_demo_as_is' });
    const step = (await screen.findByText('Record service request manually', { selector: 'h3' })).closest('li')!;
    expect(within(step).getByRole('link', { name: 'FR-001' })).toHaveAttribute('href', '/requirements/req_demo_fr001');
  });
});
