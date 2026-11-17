import { describe, expect, it } from 'vitest';
import type { Requirement, Workspace } from './types';
import {
  EMPTY_FILTER,
  applyRequirementUpdate,
  compareIdentifiers,
  createEmptyRequirementInput,
  createRequirement,
  deleteRequirementCascade,
  findDependencyCycle,
  findDependents,
  filterRequirements,
  formatIdentifier,
  nextIdentifier,
  parseIdentifier,
  requirementsLinkedToObjective,
  requirementsLinkedToStep,
  requirementsSourcedFrom,
  sortRequirements,
  summariseRequirements,
  toRequirementInput,
  validateRequirement,
  type RequirementInput,
} from './requirements';
import { createDemoWorkspace } from '../data/demoWorkspace';
import { workspaceReducer } from '../state/workspaceReducer';

const NOW = '2026-05-01T09:00:00.000Z';
const LATER = '2026-05-02T09:00:00.000Z';

function input(overrides: Partial<RequirementInput> = {}): RequirementInput {
  return {
    ...createEmptyRequirementInput('functional'),
    title: 'Record requests',
    description: 'The system shall record requests.',
    category: 'service-requests',
    ...overrides,
  };
}

/** Demo workspace with a requirement added through the same path the app uses. */
function add(ws: Workspace, values: Partial<RequirementInput>, id?: string): { ws: Workspace; req: Requirement } {
  const { requirement, sequence } = createRequirement(input(values), ws, NOW, id);
  return { ws: workspaceReducer(ws, { type: 'requirement/added', requirement, sequence }), req: requirement };
}

const req = (ws: Workspace, identifier: string) => ws.requirements.find((r) => r.identifier === identifier)!;

describe('requirement identifiers', () => {
  it('formats and parses FR and NFR identifiers', () => {
    expect(formatIdentifier('functional', 7)).toBe('FR-007');
    expect(formatIdentifier('non-functional', 12)).toBe('NFR-012');
    expect(formatIdentifier('functional', 1234)).toBe('FR-1234');
    expect(parseIdentifier('NFR-012')).toEqual({ type: 'non-functional', number: 12 });
    expect(parseIdentifier('REQ-1')).toBeNull();
  });

  it('keeps separate FR and NFR sequences', () => {
    let ws: Workspace = { ...createDemoWorkspace(NOW), requirements: [], requirementSequence: { functional: 0, nonFunctional: 0 } };
    ws = add(ws, { title: 'A' }).ws;
    ws = add(ws, { title: 'B', type: 'non-functional', category: 'security' }).ws;
    ws = add(ws, { title: 'C' }).ws;
    expect(ws.requirements.map((r) => r.identifier)).toEqual(['FR-001', 'NFR-001', 'FR-002']);
    expect(ws.requirementSequence).toEqual({ functional: 2, nonFunctional: 1 });
  });

  it('never reuses an identifier after deletion', () => {
    let ws = createDemoWorkspace(NOW);
    ws = workspaceReducer(ws, { type: 'requirement/deleted', id: req(ws, 'FR-012').id, now: LATER });
    expect(nextIdentifier(ws, 'functional').identifier).toBe('FR-019');
    ws = add(ws, { title: 'New' }).ws;
    expect(ws.requirements.some((r) => r.identifier === 'FR-012')).toBe(false);
    expect(req(ws, 'FR-019').title).toBe('New');
  });

  it('never issues an identifier below one already in use, even if the sequence lags', () => {
    const ws = { ...createDemoWorkspace(NOW), requirementSequence: { functional: 2, nonFunctional: 0 } };
    expect(nextIdentifier(ws, 'functional').identifier).toBe('FR-019');
    expect(nextIdentifier(ws, 'non-functional').identifier).toBe('NFR-010');
  });

  it('keeps the identifier, type and creation date stable when edited', () => {
    const ws = createDemoWorkspace(NOW);
    const original = req(ws, 'FR-004');
    const updated = applyRequirementUpdate(original, { ...toRequirementInput(original), title: 'Renamed', type: 'non-functional' }, LATER);
    expect(updated).toMatchObject({ id: original.id, identifier: 'FR-004', type: 'functional', title: 'Renamed', createdAt: NOW, updatedAt: LATER });
  });

  it('orders identifiers naturally: FR before NFR, then by number', () => {
    expect(['NFR-002', 'FR-010', 'FR-002', 'NFR-001'].sort(compareIdentifiers)).toEqual(['FR-002', 'FR-010', 'NFR-001', 'NFR-002']);
  });
});

describe('requirement validation', () => {
  const ws = createDemoWorkspace(NOW);

  it('starts new requirements as drafts', () => {
    expect(createEmptyRequirementInput().status).toBe('draft');
    expect(createRequirement(input(), ws, NOW).requirement.status).toBe('draft');
  });

  it('requires title, description, category, and valid type, priority and status', () => {
    const errors = validateRequirement(createEmptyRequirementInput(), ws);
    expect(Object.keys(errors).sort()).toEqual(['category', 'description', 'title']);
    const invalid = validateRequirement(
      input({ type: 'other' as never, priority: 'urgent' as never, status: 'done' as never }),
      ws,
    );
    expect(invalid.type).toBeDefined();
    expect(invalid.priority).toBeDefined();
    expect(invalid.status).toBeDefined();
  });

  it('requires the category to belong to the requirement type', () => {
    expect(validateRequirement(input({ category: 'security' }), ws).category).toMatch(/functional requirement category/);
    expect(validateRequirement(input({ type: 'non-functional', category: 'security' }), ws)).toEqual({});
  });

  it('rejects changing the type of an existing requirement', () => {
    const fr = req(ws, 'FR-001');
    expect(validateRequirement({ ...toRequirementInput(fr), type: 'non-functional', category: 'security' }, ws, fr.id).type).toMatch(/FR-001/);
  });

  it('requires referenced stakeholders, objectives and process steps to exist', () => {
    expect(validateRequirement(input({ sourceStakeholderId: 'stk_gone' }), ws).sourceStakeholderId).toBeDefined();
    expect(validateRequirement(input({ objectiveIds: ['obj_gone'] }), ws).objectiveIds).toBeDefined();
    expect(validateRequirement(input({ stepIds: ['stp_gone'] }), ws).stepIds).toBeDefined();
    const valid = input({
      sourceStakeholderId: 'stk_demo_dispatch',
      objectiveIds: ['obj_demo_scheduling'],
      stepIds: ['stp_demo_as_assign', 'stp_demo_to_schedule'],
    });
    expect(validateRequirement(valid, ws)).toEqual({});
  });

  it('rejects duplicate references', () => {
    expect(validateRequirement(input({ objectiveIds: ['obj_demo_requests', 'obj_demo_requests'] }), ws).objectiveIds).toMatch(/once/);
    expect(validateRequirement(input({ stepIds: ['stp_demo_as_record', 'stp_demo_as_record'] }), ws).stepIds).toMatch(/once/);
    const dep = req(ws, 'FR-001').id;
    expect(validateRequirement(input({ dependencyIds: [dep, dep] }), ws).dependencyIds).toMatch(/once/);
  });

  it('rejects self, missing and circular dependencies', () => {
    const fr1 = req(ws, 'FR-001');
    const fr4 = req(ws, 'FR-004');
    const fr6 = req(ws, 'FR-006');
    expect(validateRequirement({ ...toRequirementInput(fr1), dependencyIds: [fr1.id] }, ws, fr1.id).dependencyIds).toMatch(/itself/);
    expect(validateRequirement(input({ dependencyIds: ['req_gone'] }), ws).dependencyIds).toMatch(/no longer exist/);
    // Direct cycle: FR-004 depends on FR-001, so FR-001 cannot depend on FR-004.
    expect(validateRequirement({ ...toRequirementInput(fr1), dependencyIds: [fr4.id] }, ws, fr1.id).dependencyIds).toBe(
      'These dependencies would create a circular chain: FR-001 → FR-004 → FR-001.',
    );
    // Indirect cycle: FR-006 → FR-005 → FR-004 → FR-001.
    expect(validateRequirement({ ...toRequirementInput(fr1), dependencyIds: [fr6.id] }, ws, fr1.id).dependencyIds).toMatch(
      /FR-001 → FR-006 → FR-005 → FR-004 → FR-001/,
    );
    // A dependency that adds no cycle is fine.
    expect(validateRequirement({ ...toRequirementInput(fr6), dependencyIds: [...fr6.dependencyIds, fr1.id] }, ws, fr6.id)).toEqual({});
  });

  it('finds no cycle in the demonstration data', () => {
    for (const r of ws.requirements) expect(findDependencyCycle(ws.requirements, r.id, r.dependencyIds)).toBeNull();
  });
});

describe('requirement CRUD transforms', () => {
  it('creates a requirement with normalised text and acceptance criteria', () => {
    const ws = createDemoWorkspace(NOW);
    const { requirement } = createRequirement(input({ title: '  Spaced  ', acceptanceCriteria: [' One ', '', '  '] }), ws, NOW, 'req_x');
    expect(requirement).toMatchObject({ id: 'req_x', identifier: 'FR-019', title: 'Spaced', acceptanceCriteria: ['One'], createdAt: NOW });
  });

  it('deletes a requirement and removes it from dependents', () => {
    const ws = createDemoWorkspace(NOW);
    const fr1 = req(ws, 'FR-001');
    expect(findDependents(ws.requirements, fr1.id).map((r) => r.identifier)).toEqual(['FR-002', 'FR-004', 'FR-012']);
    const next = deleteRequirementCascade(ws, fr1.id, LATER);
    expect(next.requirements.some((r) => r.id === fr1.id)).toBe(false);
    expect(next.requirements.some((r) => r.dependencyIds.includes(fr1.id))).toBe(false);
    expect(req(next, 'FR-004').dependencyIds).toEqual([req(ws, 'FR-003').id]);
    expect(req(next, 'FR-004').updatedAt).toBe(LATER);
    expect(req(next, 'FR-003').updatedAt).toBe(NOW);
  });

  it('finds requirements by stakeholder, objective and step', () => {
    const ws = createDemoWorkspace(NOW);
    expect(requirementsSourcedFrom(ws, 'stk_demo_warehouse').map((r) => r.identifier)).toEqual(['FR-007', 'FR-016']);
    expect(requirementsLinkedToObjective(ws, 'obj_demo_scheduling').map((r) => r.identifier)).toEqual(['FR-003', 'FR-004', 'FR-015', 'FR-018', 'NFR-003']);
    expect(requirementsLinkedToStep(ws, 'stp_demo_as_record').map((r) => r.identifier)).toEqual(['FR-001']);
    expect(requirementsSourcedFrom(ws, 'stk_demo_health_safety').map((r) => r.identifier)).toEqual(['FR-017', 'NFR-009']);
    expect(requirementsSourcedFrom(ws, 'stk_demo_sponsor')).toEqual([]);
  });
});

describe('register filtering, sorting and summary', () => {
  const ws = createDemoWorkspace(NOW);
  const ids = (list: Requirement[]) => list.map((r) => r.identifier);

  it('searches identifier, title and description', () => {
    expect(ids(filterRequirements(ws.requirements, { ...EMPTY_FILTER, query: 'nfr-002' }))).toEqual(['NFR-002']);
    expect(ids(filterRequirements(ws.requirements, { ...EMPTY_FILTER, query: 'SPARE PARTS' }))).toEqual(['FR-007', 'FR-016']);
    expect(ids(filterRequirements(ws.requirements, { ...EMPTY_FILTER, query: 'gloves' }))).toEqual(['NFR-005']);
  });

  it('filters by type, category, priority and status together', () => {
    expect(filterRequirements(ws.requirements, { ...EMPTY_FILTER, type: 'non-functional' })).toHaveLength(9);
    expect(ids(filterRequirements(ws.requirements, { ...EMPTY_FILTER, category: 'scheduling' }))).toEqual(['FR-003', 'FR-004', 'FR-015', 'FR-018']);
    expect(ids(filterRequirements(ws.requirements, { ...EMPTY_FILTER, priority: 'wont' }))).toEqual(['FR-018']);
    expect(
      ids(filterRequirements(ws.requirements, { ...EMPTY_FILTER, type: 'functional', priority: 'must', status: 'approved' })),
    ).toEqual(['FR-001', 'FR-003', 'FR-004']);
  });

  it('sorts by identifier, priority, status and last update', () => {
    const shuffled = [...ws.requirements].reverse();
    expect(ids(sortRequirements(shuffled, 'identifier')).slice(0, 3)).toEqual(['FR-001', 'FR-002', 'FR-003']);
    expect(sortRequirements(shuffled, 'priority')[0]!.priority).toBe('must');
    expect(sortRequirements(shuffled, 'status')[0]!.status).toBe('draft');
    const touched = ws.requirements.map((r) => (r.identifier === 'NFR-008' ? { ...r, updatedAt: LATER } : r));
    expect(sortRequirements(touched, 'updated')[0]!.identifier).toBe('NFR-008');
  });

  it('summarises totals for the dashboard', () => {
    expect(summariseRequirements(ws.requirements)).toMatchObject({
      total: 27,
      functional: 18,
      nonFunctional: 9,
      must: 10,
      approved: 6,
      awaitingReview: 15,
    });
    expect(summariseRequirements([]).total).toBe(0);
  });
});
