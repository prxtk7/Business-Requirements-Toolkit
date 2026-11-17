import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { paste, readStoredWorkspace, renderApp } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';
import { STORAGE_KEY, saveWorkspace } from '../../storage/workspaceStorage';
import { CONFLICT_SAVE_ERROR } from '../../state/workspaceContext';

/** Form controls are looked up by id where several share a label (e.g. "Title" on the story and on each criterion). */
const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const criterionGroup = (n: number) => screen.getByRole('group', { name: new RegExp(`^Acceptance criterion ${n}\\b`) });
const storyRows = () => within(screen.getByRole('table', { name: 'User stories' })).getAllByRole('row').slice(1);
const rowIds = () => storyRows().map((r) => within(r).getAllByRole('cell')[0]!.textContent);
const stored = (storage: MemoryStorage, identifier: string) => readStoredWorkspace(storage).userStories.find((s) => s.identifier === identifier);

describe('User stories register', () => {
  it('lists stories with status counts and supports search, filters and clearing', async () => {
    const { user } = renderApp({ path: '/user-stories' });

    expect(await screen.findByRole('heading', { level: 1, name: 'User stories' })).toBeInTheDocument();
    expect(storyRows()).toHaveLength(18);
    expect(screen.getByRole('button', { name: 'Ready for Development (2)' })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search user stories' }), 'warehouse');
    expect(rowIds()).toEqual(['US-007', 'US-018']);
    await user.clear(screen.getByRole('searchbox', { name: 'Search user stories' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by linked requirement' }), 'req_demo_fr008');
    expect(rowIds()).toEqual(['US-008', 'US-009']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by priority' }), 'should');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'approved');
    expect(rowIds()).toEqual(['US-008']);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(storyRows()).toHaveLength(18);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'priority');
    expect(rowIds().slice(-3)).toEqual(['US-009', 'US-012', 'US-018']);
  });
});

describe('User story creation and editing', () => {
  it('validates, builds the statement, and saves a story with Gherkin criteria as a draft', async () => {
    const { user, storage } = renderApp({ path: '/user-stories/new' });

    expect(await screen.findByText('US-019')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create user story' }));
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('There are 5 problems with this form');
    expect(summary).toHaveTextContent('Link at least one requirement.');

    await user.type(field('story-title'), 'Check parts before travelling');
    await user.selectOptions(screen.getByRole('combobox', { name: /^User role/ }), 'stk_demo_technicians');
    const persona = screen.getByRole('textbox', { name: /^Role wording in the statement/ });
    expect(persona).toHaveValue('Field service technicians (user group)');
    await user.clear(persona);
    await user.type(persona, 'Field Service Technician');
    await paste(user, screen.getByRole('textbox', { name: /^I want/ }), 'to see which parts are reserved for my next job');
    await paste(user, screen.getByRole('textbox', { name: /^So that/ }), 'I do not travel without them');
    expect(screen.getByText('As a Field Service Technician, I want to see which parts are reserved for my next job, so that I do not travel without them.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'FR-007 — Spare parts reservation' }));

    // An incomplete criterion blocks saving.
    await user.click(screen.getByRole('button', { name: 'Add acceptance criterion' }));
    await paste(user, within(criterionGroup(1)).getByRole('textbox', { name: /^Title/ }), 'Reserved parts listed');
    await paste(user, within(criterionGroup(1)).getByRole('textbox', { name: /^Given/ }), 'parts are reserved against my next work order');
    await paste(user, within(criterionGroup(1)).getByRole('textbox', { name: /^When/ }), 'I open the work order');
    await user.click(screen.getByRole('button', { name: 'Create user story' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Acceptance criterion 1 is incomplete');
    expect(within(criterionGroup(1)).getByText('Describe the expected, observable outcome (Then).')).toBeInTheDocument();

    await paste(user, within(criterionGroup(1)).getByRole('textbox', { name: /^Then/ }), 'Then the reserved parts and quantities are listed');

    await user.click(screen.getByRole('button', { name: 'Add acceptance criterion' }));
    const second = criterionGroup(2);
    await paste(user, within(second).getByRole('textbox', { name: /^Title/ }), 'Missing reservation flagged');
    await paste(user, within(second).getByRole('textbox', { name: /^Given/ }), 'no parts are reserved');
    await paste(user, within(second).getByRole('textbox', { name: /^When/ }), 'I open the work order');
    await paste(user, within(second).getByRole('textbox', { name: /^Then/ }), 'a "no parts reserved" warning is shown');
    await user.click(screen.getByRole('button', { name: 'Move acceptance criterion 2 up' }));
    expect(within(criterionGroup(1)).getByRole('textbox', { name: /^Title/ })).toHaveValue('Missing reservation flagged');

    await user.click(screen.getByRole('button', { name: 'Create user story' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Check parts before travelling' })).toBeInTheDocument();
    expect(await screen.findByText('US-019 created as Draft.')).toBeInTheDocument();
    const criteria = within(screen.getByRole('list', { name: 'Acceptance criteria' })).getAllByRole('listitem');
    // New criteria are numbered on first save in their displayed order; numbers are stable after that.
    expect(criteria[0]).toHaveTextContent('US-019 AC-1');
    // Typed 'Then' keyword was stripped, so it is not duplicated in the readable view.
    expect(criteria[1]).toHaveTextContent('Thenthe reserved parts and quantities are listed');
    expect(criteria[1]).not.toHaveTextContent('Then Then');

    expect(stored(storage, 'US-019')).toMatchObject({
      status: 'draft',
      persona: { stakeholderId: 'stk_demo_technicians', label: 'Field Service Technician' },
      requirementIds: ['req_demo_fr007'],
      criterionSequence: 2,
    });
    expect(stored(storage, 'US-019')!.criteria.map((c) => [c.number, c.then, c.verification])).toEqual([
      [1, 'a "no parts reserved" warning is shown', 'not-tested'],
      [2, 'the reserved parts and quantities are listed', 'not-tested'],
    ]);
  });

  it('supports a clearly labelled custom persona', async () => {
    const { user, storage } = renderApp({ path: '/user-stories/new?requirement=req_demo_fr002' });

    expect(await screen.findByRole('checkbox', { name: 'FR-002 — Automatic service request acknowledgement' })).toBeChecked();
    await user.type(field('story-title'), 'Acknowledge site manager');
    await user.type(screen.getByRole('textbox', { name: /^Custom persona/ }), 'site manager');
    expect(screen.getByText('Not a stakeholder record — used only in this story.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /^I want/ }), 'a copy of the acknowledgement');
    await user.type(screen.getByRole('textbox', { name: /^So that/ }), 'I can arrange site access');
    await user.click(screen.getByRole('button', { name: 'Create user story' }));

    expect(await screen.findByText('Custom persona — not a record in the stakeholder register.')).toBeInTheDocument();
    expect(stored(storage, 'US-019')!.persona).toEqual({ stakeholderId: null, label: 'site manager' });
    expect(readStoredWorkspace(storage).stakeholders).toHaveLength(10);
  });

  it('edits a story and its criteria without changing identifiers', async () => {
    const { user, storage } = renderApp({ path: '/user-stories/us_demo_006/edit' });
    const before = stored(storage, 'US-006')!;

    await user.click(await screen.findByRole('button', { name: 'Remove acceptance criterion 1' }));
    await user.selectOptions(field('story-priority') as HTMLSelectElement, 'should');
    await user.click(screen.getByRole('button', { name: 'Save user story' }));

    expect(await screen.findByText('US-006 saved.')).toBeInTheDocument();
    const after = stored(storage, 'US-006')!;
    expect(after).toMatchObject({ id: before.id, identifier: 'US-006', priority: 'should', createdAt: before.createdAt, criterionSequence: 3 });
    expect(after.criteria.map((c) => c.number)).toEqual([2, 3]);
    // The requirement's own priority is untouched.
    expect(readStoredWorkspace(storage).requirements.find((r) => r.id === 'req_demo_fr006')!.priority).toBe('must');
  });
});

describe('User story detail', () => {
  it('records verification status without changing the story status', async () => {
    const { user, storage } = renderApp({ path: '/user-stories/us_demo_003' });

    expect(await screen.findByText('As a Service Coordinator, I want to see each technician’s availability and skills on one scheduling board, so that I can choose a suitable technician without phoning around.')).toBeInTheDocument();
    expect(screen.getAllByText(/does not run tests against any system/).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Verification status of US-003 AC-2' }), 'passed');
    expect(await screen.findByText('US-003 AC-2 marked Passed.')).toBeInTheDocument();
    const story = stored(storage, 'US-003')!;
    expect(story.criteria.map((c) => c.verification)).toEqual(['not-tested', 'passed']);
    expect(story.status).toBe('ready');
  });

  it('deletes a story after confirmation, keeps its requirements and never reuses the identifier', async () => {
    const { user, storage } = renderApp({ path: '/user-stories/us_demo_014' });

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete US-014?' });
    expect(dialog).toHaveTextContent('Linked requirements are not affected');
    await user.click(within(dialog).getByRole('button', { name: 'Delete user story' }));

    expect(await screen.findByText('US-014 deleted.')).toBeInTheDocument();
    const ws = readStoredWorkspace(storage);
    expect(ws.userStories.some((s) => s.identifier === 'US-014')).toBe(false);
    expect(ws.requirements).toHaveLength(27);

    await user.click(screen.getByRole('link', { name: 'New user story' }));
    expect(await screen.findByText('US-019')).toBeInTheDocument();
  });
});

describe('Requirement integration', () => {
  it('shows linked stories on the requirement and creates a pre-linked story from there', async () => {
    const { user } = renderApp({ path: '/requirements/req_demo_fr008' });

    expect(await screen.findByRole('link', { name: 'US-008' })).toHaveAttribute('href', '/user-stories/us_demo_008');
    expect(screen.getByRole('link', { name: 'US-009' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'New linked story' }));
    expect(await screen.findByRole('checkbox', { name: 'FR-008 — Customer appointment notifications' })).toBeChecked();
  });

  it('shows a coverage gap for a requirement without stories', async () => {
    renderApp({ path: '/requirements/req_demo_fr012' });
    expect(await screen.findByText('Coverage gap: no user story is linked to this requirement yet.')).toBeInTheDocument();
  });

  it('adds user stories to the traceability matrix with a coverage-gap filter', async () => {
    const { user } = renderApp({ path: '/traceability' });
    const matrix = await screen.findByRole('list', { name: 'Traceability matrix' });
    expect(within(matrix).getAllByText('No user story')).toHaveLength(9);
    expect(within(matrix).getByRole('link', { name: 'US-009' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by traceability gap' }), 'no-story');
    const ids = within(screen.getByRole('list', { name: 'Traceability matrix' }))
      .getAllByRole('link', { name: /^(FR|NFR)-\d{3}$/ })
      .map((l) => l.textContent);
    expect(ids).toEqual(['FR-012', 'FR-014', 'FR-018', 'NFR-001', 'NFR-003', 'NFR-004', 'NFR-007', 'NFR-008', 'NFR-009']);
  });
});

describe('Coverage and dashboard', () => {
  it('shows coverage and criteria verification separately, and filters uncovered requirements', async () => {
    const { user } = renderApp({ path: '/coverage' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Requirement coverage' })).toBeInTheDocument();
    const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
    expect([stat('User stories'), stat('Requirements covered'), stat('Requirements without stories')]).toEqual(['18', '18of 27', '9of 27']);
    expect([stat('Total criteria'), stat('Passed'), stat('Not tested'), stat('Failed'), stat('Blocked')]).toEqual(['36', '2', '32', '1', '1']);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'uncovered');
    const rows = within(screen.getByRole('table', { name: 'Requirement coverage' })).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('link')[0]!.textContent)).toEqual(['FR-012', 'FR-014', 'FR-018', 'NFR-001', 'NFR-003', 'NFR-004', 'NFR-007', 'NFR-008', 'NFR-009']);
    expect(rows[0]).toHaveTextContent('No user stories');
  });

  it('summarises stories and criteria on the dashboard', async () => {
    renderApp({ path: '/' });
    const summary = await screen.findByLabelText('User story summary');
    const value = (label: string) => within(summary).getByText(label).closest('div')?.querySelector('dd')?.textContent;
    expect(['User stories', 'Requirements covered', 'Without stories', 'Acceptance criteria', 'Criteria passed', 'Criteria not tested'].map(value)).toEqual([
      '18',
      '18',
      '9',
      '36',
      '2',
      '32',
    ]);
  });
});

describe('Persistence and conflicts', () => {
  it('keeps new stories across reloads', async () => {
    const storage = new MemoryStorage();
    const first = renderApp({ path: '/user-stories/new?requirement=req_demo_fr010', storage });
    await screen.findByText('US-019');
    await first.user.type(field('story-title'), 'Weekly summary email');
    await first.user.type(screen.getByRole('textbox', { name: /^Custom persona/ }), 'regional director');
    await first.user.type(screen.getByRole('textbox', { name: /^I want/ }), 'a weekly summary by email');
    await first.user.type(screen.getByRole('textbox', { name: /^So that/ }), 'I see trends without logging in');
    await first.user.click(screen.getByRole('button', { name: 'Create user story' }));
    await screen.findByText('US-019 created as Draft.');
    first.unmount();

    renderApp({ path: '/user-stories', storage });
    expect(await screen.findByRole('link', { name: 'Weekly summary email' })).toBeInTheDocument();
  });

  it('keeps the story form open when saving is blocked by another tab', async () => {
    const storage = new MemoryStorage();
    const { user, router } = renderApp({ path: '/user-stories/us_demo_002/edit', storage });
    const title = (await screen.findAllByRole('textbox', { name: /^Title/ }))[0]!;
    await user.type(title, ' (revised)');

    const other = readStoredWorkspace(storage);
    other.project.name = 'Changed elsewhere';
    saveWorkspace(storage, other, '2026-07-01T00:00:00.000Z');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: storage.getItem(STORAGE_KEY) }));
    });

    await user.click(screen.getByRole('button', { name: 'Save user story' }));
    expect(await screen.findByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/user-stories/us_demo_002/edit');
    expect(title).toHaveValue('Receive request acknowledgement (revised)');
    expect(stored(storage, 'US-002')!.title).toBe('Receive request acknowledgement');
  });
});
