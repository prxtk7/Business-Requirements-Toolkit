import { describe, expect, it } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { demoWithoutRequirements, paste, readStoredWorkspace, renderApp, seededStorage } from '../../test/renderApp';
import { MemoryStorage } from '../../test/MemoryStorage';
import { STORAGE_KEY, saveWorkspace } from '../../storage/workspaceStorage';
import { CONFLICT_SAVE_ERROR } from '../../state/workspaceContext';

const AS_IS = '/processes/prc_demo_as_is';
const TO_BE = '/processes/prc_demo_to_be';

/** Demo data without the TO-BE step that answers status enquiries, so AS-IS step 7 has no TO-BE counterpart. */
function withoutToBeEnquiryStep() {
  const id = 'stp_demo_to_status';
  return seededStorage((ws) => ({
    ...ws,
    processes: ws.processes.map((p) => ({ ...p, steps: p.steps.filter((st) => st.id !== id) })),
    improvements: ws.improvements.filter((i) => i.stepId !== id),
    requirements: ws.requirements.map((r) => ({ ...r, stepIds: r.stepIds.filter((x) => x !== id) })),
  }));
}

function stepHeadings() {
  const list = screen.getByRole('list', { name: /steps$/ });
  return within(list)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
}

describe('Process Analysis', () => {
  it('lists the demonstration AS-IS and TO-BE processes', async () => {
    const { user } = renderApp({ path: '/processes' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Processes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AS-IS processes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TO-BE processes' })).toBeInTheDocument();
    expect(screen.getByText('12 steps · 8 bottlenecks')).toBeInTheDocument();
    expect(screen.getByText('14 steps · 9 improvements')).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: 'Handle repair and maintenance requests' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Handle repair and maintenance requests' })).toBeInTheDocument();
    expect(stepHeadings()[1]).toBe('Step 2: Record service request manually');
  });

  it('validates and creates a process, then adds, edits, reorders and deletes steps', async () => {
    const { user, storage } = renderApp({ path: '/processes/new?type=as-is' });

    await user.click(await screen.findByRole('button', { name: 'Create process' }));
    expect(screen.getByRole('alert')).toHaveTextContent('There are 2 problems with this form');

    await user.type(screen.getByRole('textbox', { name: /^Process name/ }), 'Planned maintenance visits');
    await paste(user, screen.getByRole('textbox', { name: /^Objective/ }), 'Service contract equipment on schedule');
    await paste(user, screen.getByRole('textbox', { name: /^Trigger/ }), 'Maintenance due date reached');
    await user.click(screen.getByRole('button', { name: 'Create process' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Planned maintenance visits' })).toBeInTheDocument();
    expect(screen.getByText('No steps yet')).toBeInTheDocument();
    const processId = readStoredWorkspace(storage).processes.find((p) => p.name === 'Planned maintenance visits')!.id;

    // Step 1: responsible stakeholder from the register.
    await user.click(screen.getByRole('link', { name: 'Add step' }));
    await user.click(await screen.findByRole('button', { name: 'Add step' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the activity name.');
    await user.type(screen.getByRole('textbox', { name: /^Activity name/ }), 'Check contracts due');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Responsible/ }), 'stk_demo_dispatch');
    await user.type(screen.getByRole('textbox', { name: /^Input/ }), 'Contract spreadsheet');
    await paste(user, screen.getByRole('textbox', { name: /^Decision/ }), 'Is maintenance due this month?');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    expect(await screen.findByText('Step added as step 1.')).toBeInTheDocument();

    // Step 2: free-text role.
    await user.click(screen.getByRole('link', { name: 'Add step' }));
    await user.type(screen.getByRole('textbox', { name: /^Activity name/ }), 'Book visit');
    expect(screen.getByRole('combobox', { name: /^Responsible/ })).toHaveValue('__role__');
    await user.type(screen.getByRole('textbox', { name: /^Role/ }), 'Office administrator');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await screen.findByText('Step added as step 2.');
    expect(stepHeadings()).toEqual(['Step 1: Check contracts due', 'Step 2: Book visit']);
    expect(screen.getByText(/Aisha Rahman \(Service Coordinator/)).toBeInTheDocument();
    expect(screen.getByText('Is maintenance due this month?')).toBeInTheDocument();

    // Edit.
    await user.click(screen.getByRole('link', { name: 'Edit step 2: Book visit' }));
    const name = screen.getByRole('textbox', { name: /^Activity name/ });
    await user.clear(name);
    await user.type(name, 'Book maintenance visit');
    await user.click(screen.getByRole('button', { name: 'Save step' }));
    await screen.findByText('Step saved.');

    // Reorder.
    await user.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(stepHeadings()).toEqual(['Step 1: Book maintenance visit', 'Step 2: Check contracts due']);
    expect(readStoredWorkspace(storage).processes.find((p) => p.id === processId)!.steps.map((s) => s.name)).toEqual([
      'Book maintenance visit',
      'Check contracts due',
    ]);

    // Delete with confirmation.
    await user.click(screen.getByRole('button', { name: 'Delete step 1: Book maintenance visit' }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Delete step?' })).getByRole('button', { name: 'Delete step' }));
    expect(stepHeadings()).toEqual(['Step 1: Check contracts due']);
    expect(readStoredWorkspace(storage).processes.find((p) => p.id === processId)!.steps).toHaveLength(1);
  });

  it('blocks deleting an AS-IS step that TO-BE steps link to', async () => {
    const storage = new MemoryStorage();
    const { user } = renderApp({ path: AS_IS, storage });
    const before = storage.getItem(STORAGE_KEY);

    await user.click(await screen.findByRole('button', { name: 'Delete step 4: Assign technician manually' }));
    const dialog = screen.getByRole('alertdialog', { name: 'This step cannot be deleted yet' });
    expect(within(dialog).getByRole('link', { name: /step 5: Assign technician and schedule visit/ })).toHaveAttribute(
      'href',
      '/processes/prc_demo_to_be/steps/stp_demo_to_schedule/edit',
    );
    expect(within(dialog).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('deletes an unlinked step together with its bottleneck after confirmation', async () => {
    // Without the TO-BE enquiry step, AS-IS step 7 is referenced only by FR-012.
    const { user, storage } = renderApp({ path: AS_IS, storage: withoutToBeEnquiryStep() });

    // FR-012 traces to step 7, so deletion is blocked until that link is removed.
    await user.click(await screen.findByRole('button', { name: 'Delete step 7: Answer customer calls chasing updates' }));
    const blocked = screen.getByRole('alertdialog', { name: 'This step cannot be deleted yet' });
    await user.click(within(blocked).getByRole('link', { name: /FR-012 Service request status tracking/ }));
    await user.click(await screen.findByRole('checkbox', { name: '7. Answer customer calls chasing updates' }));
    await user.click(screen.getByRole('button', { name: 'Save requirement' }));
    await screen.findByText('FR-012 saved.');

    await user.click(screen.getByRole('link', { name: 'Process Analysis' }));
    await user.click((await screen.findAllByRole('link', { name: 'Handle repair and maintenance requests' }))[0]!);
    await user.click(await screen.findByRole('button', { name: 'Delete step 7: Answer customer calls chasing updates' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete step?' });
    expect(dialog).toHaveTextContent('together with the 1 bottleneck recorded against it');
    await user.click(within(dialog).getByRole('button', { name: 'Delete step' }));

    const stored = readStoredWorkspace(storage);
    expect(stored.processes[0]!.steps).toHaveLength(11);
    expect(stored.bottlenecks.some((b) => b.stepId === 'stp_demo_as_status_calls')).toBe(false);
  });

  it('adds, edits and deletes bottlenecks on AS-IS steps', async () => {
    const { user, storage } = renderApp({ path: AS_IS });

    await user.click(await screen.findByRole('link', { name: 'Add bottleneck' }));
    await user.type(await screen.findByRole('textbox', { name: /^Title/ }), 'Whiteboard out of date');
    await user.type(screen.getByRole('textbox', { name: /^Description/ }), 'Changes during the day are not written up.');
    await user.click(screen.getByRole('button', { name: 'Add bottleneck' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select the AS-IS step where this bottleneck occurs.');

    await user.selectOptions(screen.getByRole('combobox', { name: /^Process step/ }), 'stp_demo_as_availability');
    await user.click(within(screen.getByRole('group', { name: 'Severity' })).getByRole('radio', { name: 'High' }));
    await user.click(screen.getByRole('button', { name: 'Add bottleneck' }));
    expect(await screen.findByText('Bottleneck added.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Whiteboard out of date' })).toBeInTheDocument();

    const created = readStoredWorkspace(storage).bottlenecks.find((b) => b.title === 'Whiteboard out of date')!;
    expect(created).toMatchObject({ stepId: 'stp_demo_as_availability', severity: 'high' });

    await user.click(screen.getByRole('link', { name: 'Edit Whiteboard out of date' }));
    await user.type(screen.getByRole('textbox', { name: /^Impact/ }), 'Double bookings');
    await user.click(screen.getByRole('button', { name: 'Save bottleneck' }));
    await screen.findByText('Bottleneck saved.');
    expect(readStoredWorkspace(storage).bottlenecks.find((b) => b.id === created.id)!.impact).toBe('Double bookings');

    await user.click(screen.getByRole('button', { name: 'Delete Whiteboard out of date' }));
    await user.click(screen.getByRole('button', { name: 'Delete bottleneck' }));
    expect(screen.queryByRole('heading', { name: 'Whiteboard out of date' })).not.toBeInTheDocument();
    expect(readStoredWorkspace(storage).bottlenecks.some((b) => b.id === created.id)).toBe(false);
  });

  it('adds an improvement on a TO-BE step', async () => {
    const { user, storage } = renderApp({ path: TO_BE });

    await user.click(await screen.findByRole('link', { name: 'Add improvement' }));
    await user.type(await screen.findByRole('textbox', { name: /^Title/ }), 'Technician skills matrix');
    await user.type(screen.getByRole('textbox', { name: /^Description/ }), 'Skills recorded per technician.');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Process step/ }), 'stp_demo_to_schedule');
    await user.type(screen.getByRole('textbox', { name: /^Related business problem/ }), 'No single view of technician availability');
    await user.click(screen.getByRole('button', { name: 'Add improvement' }));

    expect(await screen.findByText('Improvement added.')).toBeInTheDocument();
    expect(readStoredWorkspace(storage).improvements.find((i) => i.title === 'Technician skills matrix')).toMatchObject({
      stepId: 'stp_demo_to_schedule',
      priority: 'medium',
    });
  });

  it('requires changed TO-BE steps to be linked to AS-IS steps', async () => {
    const { user, storage } = renderApp({ path: `${TO_BE}/steps/new` });

    await user.type(await screen.findByRole('textbox', { name: /^Activity name/ }), 'Check warranty status');
    await user.selectOptions(screen.getByRole('combobox', { name: /^Responsible/ }), 'stk_demo_customer_service');
    await user.click(within(screen.getByRole('group', { name: /^Change type/ })).getByRole('radio', { name: 'Modified' }));
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select the AS-IS step(s) this step corresponds to');

    await user.click(screen.getByRole('checkbox', { name: '2. Record service request manually' }));
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await screen.findByText('Step added as step 15.');

    const step = readStoredWorkspace(storage).processes[1]!.steps[14]!;
    expect(step).toMatchObject({ name: 'Check warranty status', change: 'modified', sourceStepIds: ['stp_demo_as_record'] });
  });

  it('shows an AS-IS step with no TO-BE counterpart as removed, with its bottleneck', async () => {
    renderApp({ path: '/processes/compare', storage: withoutToBeEnquiryStep() });
    expect(await screen.findByRole('heading', { level: 1, name: 'AS-IS and TO-BE comparison' })).toBeInTheDocument();
    expect(screen.getByText('Removed', { selector: 'dt' }).nextElementSibling?.textContent).toBe('1');
    const rows = within(screen.getByRole('list', { name: 'Step comparison' })).getAllByRole('listitem');
    const removed = rows.find((r) => within(r).queryByText('Not part of the TO-BE process'))!;
    expect(removed).toHaveTextContent('7. Answer customer calls chasing updates');
    expect(removed).toHaveTextContent('Customers chase status updates by phone');
  });

  it('compares AS-IS and TO-BE using the documented change types', async () => {
    renderApp({ path: '/processes/compare' });

    expect(await screen.findByRole('heading', { level: 1, name: 'AS-IS and TO-BE comparison' })).toBeInTheDocument();
    const count = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
    expect([count('Unchanged'), count('Modified'), count('New'), count('Automated'), count('Removed')]).toEqual(['1', '8', '2', '3', '0']);

    const rows = within(screen.getByRole('list', { name: 'Step comparison' })).getAllByRole('listitem');
    // Status enquiries are still answered in the TO-BE process, from the system rather than via dispatch.
    const enquiries = rows.find((r) => within(r).queryByText('7. Answer customer calls chasing updates'))!;
    expect(enquiries).toHaveTextContent('8. Answer status enquiries from the FSM system');
    expect(enquiries).toHaveTextContent('Customers chase status updates by phone');
    expect(enquiries).toHaveTextContent('Request status available to customer service');
    expect(within(screen.getByRole('list', { name: 'Step comparison' })).queryByText('Not part of the TO-BE process')).not.toBeInTheDocument();

    const automated = rows.filter((r) => within(r).queryByText('Automated', { selector: 'span' }));
    expect(automated).toHaveLength(3);
    expect(automated[0]).toHaveTextContent('Send appointment confirmation and reminder');
  });

  it('blocks deleting a process whose steps requirements trace to', async () => {
    const { user, storage } = renderApp({ path: TO_BE });
    const before = storage.getItem(STORAGE_KEY);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'This process cannot be deleted yet' });
    expect(within(dialog).getByRole('link', { name: /FR-001 Centralised service request registration/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Delete process' })).not.toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('blocks deleting an AS-IS process used as a baseline and cascades a TO-BE delete', async () => {
    // Without requirement links, so the Phase 2 baseline and cascade rules are exercised on their own.
    const { user, storage } = renderApp({ path: AS_IS, storage: demoWithoutRequirements() });

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog', { name: 'This process cannot be deleted yet' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('link', { name: 'All processes' }));
    await user.click(screen.getAllByRole('link', { name: 'Handle repair and maintenance requests' })[1]!);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete process?' });
    expect(dialog).toHaveTextContent('14 steps and 9 improvements');
    await user.click(within(dialog).getByRole('button', { name: 'Delete process' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Processes' })).toBeInTheDocument();
    const stored = readStoredWorkspace(storage);
    expect(stored.processes.map((p) => p.id)).toEqual(['prc_demo_as_is']);
    expect(stored.improvements).toEqual([]);
    expect(stored.bottlenecks).toHaveLength(8);
  });

  it('warns before leaving a step form with unsaved changes', async () => {
    const { user, router } = renderApp({ path: `${AS_IS}/steps/new` });
    await user.type(await screen.findByRole('textbox', { name: /^Activity name/ }), 'Draft');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe(`${AS_IS}/steps/new`);
  });

  it('keeps the step form open when saving is blocked by a cross-tab conflict', async () => {
    const storage = new MemoryStorage();
    const { user, router } = renderApp({ path: `${AS_IS}/steps/new`, storage });

    await user.type(await screen.findByRole('textbox', { name: /^Activity name/ }), 'Log call');
    await user.type(screen.getByRole('textbox', { name: /^Role/ }), 'Receptionist');

    const other = readStoredWorkspace(storage);
    other.project.name = 'Changed elsewhere';
    saveWorkspace(storage, other, '2026-05-01T00:00:00.000Z');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: storage.getItem(STORAGE_KEY) }));
    });

    await user.click(screen.getByRole('button', { name: 'Add step' }));
    expect(await screen.findByText(CONFLICT_SAVE_ERROR)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`${AS_IS}/steps/new`);
    expect(screen.getByRole('textbox', { name: /^Activity name/ })).toHaveValue('Log call');
    expect(readStoredWorkspace(storage).processes[0]!.steps).toHaveLength(12);
  });
});

describe('Stakeholder references from process steps', () => {
  it('blocks deleting a referenced stakeholder until the step is reassigned', async () => {
    // Viktor is also the source of FR-016 and the user role of US-018; detach those two so the test walks
    // one reference of each kind (step, requirement, story) rather than the whole chain.
    const storage = seededStorage((ws) => ({
      ...ws,
      requirements: ws.requirements.map((r) => (r.identifier === 'FR-016' ? { ...r, sourceStakeholderId: 'stk_demo_operations' } : r)),
      userStories: ws.userStories.map((s) => (s.identifier === 'US-018' ? { ...s, persona: { stakeholderId: null, label: 'Warehouse Manager' } } : s)),
    }));
    const { user } = renderApp({ path: '/stakeholders', storage });

    await user.click(await screen.findByRole('button', { name: 'Delete Viktor Novak' }));
    const dialog = screen.getByRole('alertdialog', { name: 'This stakeholder cannot be deleted yet' });
    expect(dialog).toHaveTextContent('is responsible for a process step');
    expect(within(dialog).queryByRole('button', { name: 'Delete stakeholder' })).not.toBeInTheDocument();

    expect(dialog).toHaveTextContent('the source of a requirement');

    // Follow the link to the referencing step and reassign it to a role.
    await user.click(within(dialog).getByRole('link', { name: /step 9: Reserve spare parts/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit step 9' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /^Responsible/ }), '__role__');
    await user.type(screen.getByRole('textbox', { name: /^Role/ }), 'Warehouse team');
    await user.click(screen.getByRole('button', { name: 'Save step' }));
    await screen.findByText('Step saved.');

    // Still blocked: Viktor is the source of FR-007. Reassign it via the dialog link.
    await user.click(screen.getByRole('link', { name: 'Stakeholders' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Viktor Novak' }));
    const stillBlocked = screen.getByRole('alertdialog', { name: 'This stakeholder cannot be deleted yet' });
    expect(within(stillBlocked).queryByRole('link', { name: /step 9/ })).not.toBeInTheDocument();
    await user.click(within(stillBlocked).getByRole('link', { name: /FR-007 Spare parts reservation/ }));
    await user.selectOptions(await screen.findByRole('combobox', { name: /^Source stakeholder/ }), 'stk_demo_operations');
    await user.click(screen.getByRole('button', { name: 'Save requirement' }));
    await screen.findByText('FR-007 saved.');

    // Still blocked: Viktor is the user role of US-007. Switch that story to a custom persona.
    await user.click(screen.getByRole('link', { name: 'Stakeholders' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Viktor Novak' }));
    const storyBlock = screen.getByRole('alertdialog', { name: 'This stakeholder cannot be deleted yet' });
    await user.click(within(storyBlock).getByRole('link', { name: /US-007 Reserve spare parts/ }));
    await user.selectOptions(await screen.findByRole('combobox', { name: /^User role/ }), '__custom__');
    await user.type(screen.getByRole('textbox', { name: /^Custom persona/ }), 'Warehouse Manager');
    await user.click(screen.getByRole('button', { name: 'Save user story' }));
    await screen.findByText('US-007 saved.');

    await user.click(screen.getByRole('link', { name: 'Stakeholders' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Viktor Novak' }));
    await user.click(screen.getByRole('button', { name: 'Delete stakeholder' }));

    expect(await screen.findByText('Viktor Novak removed from the stakeholder register.')).toBeInTheDocument();
    expect(readStoredWorkspace(storage).stakeholders.some((s) => s.name === 'Viktor Novak')).toBe(false);
  });

  it('shows the process steps a stakeholder is responsible for', async () => {
    renderApp({ path: '/stakeholders/stk_demo_warehouse' });
    expect(await screen.findByRole('heading', { name: 'Process responsibilities' })).toBeInTheDocument();
    expect(screen.getByText(/step 9: Reserve spare parts against the work order/)).toBeInTheDocument();
  });
});
