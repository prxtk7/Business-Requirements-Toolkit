import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { demoWithoutRequirements, paste, readStoredWorkspace, renderApp, seededStorage } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';
import { STORAGE_KEY, saveWorkspace } from '../../storage/workspaceStorage';
import { CONFLICT_SAVE_ERROR } from '../../state/workspaceContext';

const riskRows = () => within(screen.getByRole('table', { name: 'Risks' })).getAllByRole('row').slice(1);
const rowIds = () => riskRows().map((r) => within(r).getAllByRole('cell')[0]!.textContent);
const storedRisk = (storage: MemoryStorage, identifier: string) => readStoredWorkspace(storage).risks.find((r) => r.identifier === identifier);

describe('Risk register', () => {
  it('lists risks with severity and status counts, and supports search, filters, sorting and clearing', async () => {
    const { user } = renderApp({ path: '/risks' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Risk register' })).toBeInTheDocument();
    expect(riskRows()).toHaveLength(14);
    expect(screen.getByRole('button', { name: /^Critical \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Materialised (1)' })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search risks' }), 'grace');
    expect(rowIds()).toEqual(['RSK-006']);
    await user.clear(screen.getByRole('searchbox', { name: 'Search risks' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by owner' }), 'stk:stk_demo_it');
    expect(rowIds()).toEqual(['RSK-003', 'RSK-005', 'RSK-007']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by response strategy' }), 'avoid');
    expect(rowIds()).toEqual(['RSK-005']);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by category' }), 'resource');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'closed');
    expect(rowIds()).toEqual(['RSK-012']);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await user.click(screen.getByRole('button', { name: /^Critical \(2\)/ }));
    expect(rowIds()).toEqual(['RSK-005', 'RSK-008']);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'severity');
    expect(rowIds().slice(0, 3)).toEqual(['RSK-005', 'RSK-008', 'RSK-001']);
  });

  it('shows an empty state when there are no risks', async () => {
    renderApp({ path: '/risks', storage: seededStorage((ws) => ({ ...ws, risks: [] })) });
    expect(await screen.findByRole('heading', { name: 'No risks recorded yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record first risk' })).toHaveAttribute('href', '/risks/new');
  });
});

describe('Risk creation and editing', () => {
  it('validates, calculates the score live, and records a risk as Identified', async () => {
    const { user, storage } = renderApp({ path: '/risks/new' });

    expect(await screen.findByText('RSK-015')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record risk' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('There are 5 problems with this form');
    expect(summary).toHaveTextContent('A mitigate response needs a mitigation plan.');

    await user.type(screen.getByRole('textbox', { name: /^Title/ }), 'Vendor delivers late');
    await paste(user, screen.getByRole('textbox', { name: /^Description/ }), 'The FSM vendor could miss the configuration milestone.');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Category/ }), 'external');

    const score = screen.getByText('Calculated score').parentElement!;
    expect(score).toHaveTextContent('3 × 3 =9Medium');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Probability/ }), '4');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Impact/ }), '5');
    expect(score).toHaveTextContent('4 × 5 =20Critical');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    await paste(user, screen.getByRole('textbox', { name: /^Mitigation plan/ }), 'Weekly milestone reviews with the vendor.');
    await user.type(screen.getByRole('textbox', { name: /^Owner name/ }), 'Vendor account manager');
    await user.click(screen.getByRole('checkbox', { name: 'FR-004 — Technician scheduling and allocation' }));
    await user.click(screen.getByRole('button', { name: 'Record risk' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Vendor delivers late' })).toBeInTheDocument();
    expect(await screen.findByText('RSK-015 recorded as Identified.')).toBeInTheDocument();
    expect(screen.getByText('Custom owner — not a record in the stakeholder register.')).toBeInTheDocument();
    expect(storedRisk(storage, 'RSK-015')).toMatchObject({
      probability: 4,
      impact: 5,
      status: 'identified',
      owner: { stakeholderId: null, customName: 'Vendor account manager' },
      links: { requirementIds: ['req_demo_fr004'], stakeholderIds: [], storyIds: [] },
    });
    expect(storedRisk(storage, 'RSK-015')).not.toHaveProperty('score');
    expect(readStoredWorkspace(storage).riskSequence).toBe(15);
  });

  it('edits a risk without changing its ID, and the severity follows the new ratings', async () => {
    const { user, storage } = renderApp({ path: '/risks/rsk_demo_004/edit' });
    const before = storedRisk(storage, 'RSK-004')!;

    await user.selectOptions(await screen.findByRole('combobox', { name: /^Probability/ }), '5');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Status/ }), 'in-progress');
    await user.click(screen.getByRole('button', { name: 'Save risk' }));

    expect(await screen.findByText('RSK-004 saved.')).toBeInTheDocument();
    // 5 × 3 = 15, so the derived severity moves from Medium to High.
    expect(screen.getByText('5 × 3 =')).toBeInTheDocument();
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(storedRisk(storage, 'RSK-004')).toMatchObject({ id: before.id, identifier: 'RSK-004', probability: 5, status: 'in-progress', createdAt: before.createdAt });
  });

  it('deletes a risk after confirmation, keeps related records and never reuses the ID', async () => {
    const { user, storage } = renderApp({ path: '/risks/rsk_demo_012' });
    const before = readStoredWorkspace(storage);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete RSK-012?' });
    expect(dialog).toHaveTextContent('are not affected');
    await user.click(within(dialog).getByRole('button', { name: 'Delete risk' }));

    expect(await screen.findByText('RSK-012 deleted.')).toBeInTheDocument();
    const after = readStoredWorkspace(storage);
    expect(after.risks.map((r) => r.identifier)).not.toContain('RSK-012');
    expect([after.stakeholders, after.processes, after.requirements, after.userStories]).toEqual([before.stakeholders, before.processes, before.requirements, before.userStories]);

    await user.click(screen.getByRole('link', { name: 'New risk' }));
    expect(await screen.findByText('RSK-015')).toBeInTheDocument();
  });
});

describe('Risk detail', () => {
  it('answers what, why, how serious, who, prevention and contingency, with links to related records', async () => {
    renderApp({ path: '/risks/rsk_demo_001' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Technicians resist adopting the mobile work-order app' })).toBeInTheDocument();
    for (const section of ['Risk overview', 'Risk description', 'Risk assessment', 'Response strategy', 'Mitigation plan', 'Contingency plan', 'Ownership', 'Related project records', 'Risk history']) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }
    expect(screen.getByText('Score = probability × impact')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sofia Lindqvist' })).toHaveAttribute('href', '/stakeholders/stk_demo_operations');
    expect(screen.getByRole('link', { name: 'FR-006' })).toHaveAttribute('href', '/requirements/req_demo_fr006');
    expect(screen.getByRole('link', { name: 'US-006' })).toHaveAttribute('href', '/user-stories/us_demo_006');
    expect(screen.getByText(/step 11: Complete work order on mobile device/)).toBeInTheDocument();
  });
});

describe('Risk matrix', () => {
  it('shows counts from the stored risks and lists the risks of a selected cell', async () => {
    const { user, router } = renderApp({ path: '/risk-matrix' });

    const cell = await screen.findByRole('button', { name: 'Probability 4 Likely, impact 5 Severe: score 20, Critical, 2 risks' });
    expect(screen.getByRole('button', { name: 'Probability 1 Rare, impact 1 Insignificant: score 1, Low, 0 risks' })).toBeInTheDocument();
    await user.click(cell);
    expect(cell).toHaveAttribute('aria-pressed', 'true');
    const list = screen.getByRole('list', { name: 'Risks in the selected cell' });
    expect(within(list).getAllByRole('link', { name: /^RSK-/ }).map((l) => l.textContent)).toEqual(['RSK-005', 'RSK-008']);

    await user.click(within(list).getByRole('link', { name: 'RSK-008' }));
    expect(router.state.location.pathname).toBe('/risks/rsk_demo_008');
  });

  it('can exclude closed and materialised risks', async () => {
    const { user } = renderApp({ path: '/risk-matrix' });
    expect(await screen.findByRole('button', { name: /^Probability 2 Unlikely, impact 2 Minor: .*1 risk$/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Risks to show' }), 'open');
    expect(screen.getByRole('button', { name: /^Probability 2 Unlikely, impact 2 Minor: .*0 risks$/ })).toBeInTheDocument();
    expect(screen.getByText('12 risks shown')).toBeInTheDocument();
  });

  it('includes a severity legend', async () => {
    renderApp({ path: '/risk-matrix' });
    const legend = await screen.findByRole('list', { name: 'Severity legend' });
    expect(legend).toHaveTextContent('Critical score 17–25');
    expect(legend).toHaveTextContent('Low score 1–4');
  });
});

describe('Dashboard', () => {
  it('summarises risks from stored data and links to the register and matrix', async () => {
    renderApp({ path: '/' });
    const summary = await screen.findByLabelText('Risk summary');
    const value = (label: string) => within(summary).getByText(label).closest('div')?.querySelector('dd')?.textContent;
    expect(['Total risks', 'Critical', 'High', 'Medium', 'Low', 'Open', 'Materialised', 'Closed'].map(value)).toEqual(['14', '2', '5', '6', '1', '12', '1', '1']);
    expect(screen.getByRole('link', { name: 'Matrix of risks' })).toHaveAttribute('href', '/risk-matrix');
    expect(screen.getByRole('link', { name: 'Register of risks' })).toHaveAttribute('href', '/risks');
  });
});

describe('Integrity with other modules', () => {
  it('blocks deleting a stakeholder who owns a risk', async () => {
    const storage = seededStorage((ws) => ({
      ...ws,
      risks: ws.risks.map((r) => (r.identifier === 'RSK-006' ? { ...r, owner: { stakeholderId: 'stk_demo_health_safety', customName: '' } } : r)),
    }));
    const { user } = renderApp({ path: '/stakeholders', storage });
    await user.click(await screen.findByRole('button', { name: 'Delete Health and Safety Officer' }));
    const dialog = screen.getByRole('alertdialog', { name: 'This stakeholder cannot be deleted yet' });
    expect(dialog).toHaveTextContent('the owner of a risk');
    expect(within(dialog).getByRole('link', { name: /RSK-006 .* \(risk owner\)/ })).toHaveAttribute('href', '/risks/rsk_demo_006/edit');
    expect(within(dialog).queryByRole('button', { name: 'Delete stakeholder' })).not.toBeInTheDocument();
  });

  it('removes a deleted stakeholder from risks that only link to them, after saying so', async () => {
    const storage = seededStorage((ws) => ({
      ...ws,
      risks: ws.risks.map((r) => (r.identifier === 'RSK-011' ? { ...r, links: { ...r.links, stakeholderIds: ['stk_demo_health_safety'] } } : r)),
      // FR-017 and NFR-009 are sourced from this stakeholder; detach them so only the risk link remains.
      requirements: ws.requirements.map((r) => (r.sourceStakeholderId === 'stk_demo_health_safety' ? { ...r, sourceStakeholderId: null } : r)),
    }));
    const { user } = renderApp({ path: '/stakeholders', storage });
    await user.click(await screen.findByRole('button', { name: 'Delete Health and Safety Officer' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete stakeholder?' });
    expect(dialog).toHaveTextContent('Risk RSK-011 links to it. The link will be removed from that risk; the risk itself is kept.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete stakeholder' }));

    expect(await screen.findByText('Health and Safety Officer removed from the stakeholder register.')).toBeInTheDocument();
    expect(storedRisk(storage, 'RSK-011')!.links.stakeholderIds).toEqual([]);
  });

  it('removes a deleted requirement from linked risks', async () => {
    const { user, storage } = renderApp({ path: '/requirements/req_demo_nfr001' });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete NFR-001?' });
    expect(within(dialog).getByRole('link', { name: 'RSK-007' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));

    await screen.findByText('NFR-001 deleted.');
    expect(storedRisk(storage, 'RSK-007')!.links.requirementIds).toEqual(['req_demo_nfr004']);
  });

  it('removes a deleted user story from linked risks', async () => {
    const { user, storage } = renderApp({ path: '/user-stories/us_demo_013' });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete US-013?' });
    expect(dialog).toHaveTextContent('Risk RSK-011 links to it.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete user story' }));

    await screen.findByText('US-013 deleted.');
    expect(storedRisk(storage, 'RSK-011')!.links.storyIds).toEqual([]);
  });

  it('removes a deleted process step from linked risks', async () => {
    const storage = demoWithoutRequirements();
    const { user } = renderApp({ path: '/processes/prc_demo_to_be', storage });
    await user.click(await screen.findByRole('button', { name: 'Delete step 3: Send request acknowledgement to customer' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete step?' });
    expect(dialog).toHaveTextContent('Risk RSK-010 links to it.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete step' }));

    expect(storedRisk(storage, 'RSK-010')!.links.stepIds).toEqual(['stp_demo_to_confirm']);
  });

  it('states that a removed objective is unlinked from risks, then removes the link on save', async () => {
    const storage = demoWithoutRequirements();
    const { user } = renderApp({ path: '/overview/edit', storage });
    await user.click(await screen.findByRole('button', { name: 'Remove objective 1' }));
    expect(screen.getByText('Removed objective is linked to risks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'RSK-002' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save overview' }));

    await screen.findByText('Project overview saved.');
    expect(storedRisk(storage, 'RSK-002')!.links.objectiveIds).toEqual([]);
    expect(storedRisk(storage, 'RSK-002')).toBeDefined();
  });
});

describe('Persistence and conflicts', () => {
  it('keeps new risks across reloads', async () => {
    const storage = new MemoryStorage();
    const first = renderApp({ path: '/risks/new', storage });
    await first.user.type(await screen.findByRole('textbox', { name: /^Title/ }), 'Licence costs rise');
    await first.user.type(screen.getByRole('textbox', { name: /^Description/ }), 'Per-user licence prices could increase at renewal.');
    await first.user.selectOptions(screen.getByRole('combobox', { name: /^Category/ }), 'financial');
    await first.user.selectOptions(screen.getByRole('combobox', { name: /^Response strategy/ }), 'accept');
    await first.user.selectOptions(screen.getByRole('combobox', { name: /^Owner$/ }), 'stk_demo_finance');
    await first.user.click(screen.getByRole('button', { name: 'Record risk' }));
    await screen.findByText('RSK-015 recorded as Identified.');
    first.unmount();

    renderApp({ path: '/risks', storage });
    expect(await screen.findByRole('link', { name: 'Licence costs rise' })).toBeInTheDocument();
  });

  it('keeps the risk form open when saving is blocked by another tab', async () => {
    const storage = new MemoryStorage();
    const { user, router } = renderApp({ path: '/risks/rsk_demo_002/edit', storage });
    const title = await screen.findByRole('textbox', { name: /^Title/ });
    await user.type(title, ' (revised)');

    const other = readStoredWorkspace(storage);
    other.project.name = 'Changed elsewhere';
    saveWorkspace(storage, other, '2026-08-01T00:00:00.000Z');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: storage.getItem(STORAGE_KEY) }));
    });

    await user.click(screen.getByRole('button', { name: 'Save risk' }));
    expect(await screen.findByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/risks/rsk_demo_002/edit');
    expect(storedRisk(storage, 'RSK-002')!.title).toBe('Customer records are incomplete or inconsistent');
  });
});
