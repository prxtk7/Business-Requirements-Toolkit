import { describe, expect, it } from 'vitest';
import type { Risk, Workspace } from './types';
import {
  EMPTY_RISK_FILTER,
  applyRiskUpdate,
  assessRisk,
  buildRiskMatrix,
  createEmptyRiskInput,
  createRisk,
  filterRisks,
  nextRiskIdentifier,
  ownerKey,
  ownerName,
  pruneRiskLinks,
  risksLinkedTo,
  risksOwnedBy,
  sortRisks,
  summariseRisks,
  toRiskInput,
  validateRisk,
  type RiskInput,
} from './risks';
import { isRating, riskScore, severityForScore } from './riskConfig';
import { createDemoWorkspace } from '../data/demoWorkspace';
import { workspaceReducer } from '../state/workspaceReducer';

const NOW = '2026-07-01T09:00:00.000Z';
const LATER = '2026-07-02T09:00:00.000Z';

function input(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    ...createEmptyRiskInput(),
    title: 'Vendor delay',
    description: 'The vendor may deliver late.',
    category: 'external',
    mitigation: 'Agree milestones.',
    owner: { stakeholderId: 'stk_demo_operations', customName: '' },
    ...overrides,
  };
}

function add(ws: Workspace, values: Partial<RiskInput> = {}): { ws: Workspace; risk: Risk } {
  const { risk, sequence } = createRisk(input(values), ws, NOW);
  return { ws: workspaceReducer(ws, { type: 'risk/added', risk, sequence }), risk };
}

const byId = (ws: Workspace, identifier: string) => ws.risks.find((r) => r.identifier === identifier)!;
const ids = (risks: Risk[]) => risks.map((r) => r.identifier);

describe('5 × 5 scoring', () => {
  it('multiplies probability by impact and maps every score to the agreed band', () => {
    expect(riskScore(4, 3)).toBe(12);
    const bands: Record<string, number[]> = { low: [], medium: [], high: [], critical: [] };
    for (let p = 1; p <= 5; p++) for (let i = 1; i <= 5; i++) bands[severityForScore(p * i)]!.push(p * i);
    expect(Math.max(...bands.low!)).toBe(4);
    expect([Math.min(...bands.medium!), Math.max(...bands.medium!)]).toEqual([5, 9]);
    expect([Math.min(...bands.high!), Math.max(...bands.high!)]).toEqual([10, 16]);
    expect(Math.min(...bands.critical!)).toBe(20);
  });

  it('places band boundaries exactly', () => {
    expect([4, 5, 9, 10, 16, 17, 25].map(severityForScore)).toEqual(['low', 'medium', 'medium', 'high', 'high', 'critical', 'critical']);
    expect(() => severityForScore(0)).toThrow(RangeError);
    expect(() => severityForScore(26)).toThrow(RangeError);
  });

  it('derives score and severity from the stored ratings (never stored themselves)', () => {
    const risk = byId(createDemoWorkspace(NOW), 'RSK-008');
    expect(assessRisk(risk)).toEqual({ score: 20, severity: 'critical' });
    expect(Object.keys(risk)).not.toContain('score');
    expect(Object.keys(risk)).not.toContain('severity');
    expect(assessRisk({ ...risk, impact: 2 })).toEqual({ score: 8, severity: 'medium' });
  });

  it('only accepts whole-number ratings from 1 to 5', () => {
    expect([1, 3, 5].every(isRating)).toBe(true);
    expect([0, 6, 2.5, Number.NaN, '3'].some(isRating)).toBe(false);
  });
});

describe('risk validation', () => {
  const ws = createDemoWorkspace(NOW);

  it('accepts a complete risk, including a custom owner and no related records', () => {
    expect(validateRisk(input(), ws)).toEqual({});
    expect(validateRisk(input({ owner: { stakeholderId: null, customName: 'Vendor account manager' } }), ws)).toEqual({});
  });

  it('requires title, description, category and an owner', () => {
    const errors = validateRisk({ ...createEmptyRiskInput(), mitigation: 'x' }, ws);
    expect(Object.keys(errors).sort()).toEqual(['category', 'description', 'owner', 'title']);
  });

  it('rejects ratings that are not whole numbers from 1 to 5', () => {
    expect(validateRisk(input({ probability: 0 }), ws).probability).toBe('Probability must be a whole number from 1 to 5.');
    expect(validateRisk(input({ impact: 6 }), ws).impact).toBe('Impact must be a whole number from 1 to 5.');
    expect(validateRisk(input({ probability: 2.5 }), ws).probability).toBeDefined();
  });

  it('requires a mitigation plan for a Mitigate response only', () => {
    expect(validateRisk(input({ response: 'mitigate', mitigation: '  ' }), ws).mitigation).toMatch(/mitigation plan/);
    expect(validateRisk(input({ response: 'accept', mitigation: '' }), ws)).toEqual({});
  });

  it('rejects invalid category, response, status and missing owners', () => {
    const errors = validateRisk(input({ category: 'weather', response: 'ignore' as never, status: 'done' as never }), ws);
    expect(Object.keys(errors).sort()).toEqual(['category', 'response', 'status']);
    expect(validateRisk(input({ owner: { stakeholderId: 'stk_gone', customName: '' } }), ws).owner).toMatch(/no longer exists/);
  });

  it('rejects related records that do not exist or are listed twice', () => {
    const links = createEmptyRiskInput().links;
    expect(validateRisk(input({ links: { ...links, requirementIds: ['req_gone'] } }), ws).links).toMatch(/requirements no longer exist/);
    expect(validateRisk(input({ links: { ...links, stepIds: ['stp_demo_as_record', 'stp_demo_as_record'] } }), ws).links).toMatch(/once/);
    expect(validateRisk(input({ links: { ...links, storyIds: ['us_gone'] } }), ws).links).toMatch(/user stories/);
    const valid = { ...links, stakeholderIds: ['stk_demo_it'], objectiveIds: ['obj_demo_reporting'], stepIds: ['stp_demo_to_complete'], requirementIds: ['req_demo_fr006'], storyIds: ['us_demo_006'] };
    expect(validateRisk(input({ links: valid }), ws)).toEqual({});
  });
});

describe('risk identifiers and CRUD transforms', () => {
  it('continues the demo sequence and never reuses an identifier after deletion', () => {
    let ws = createDemoWorkspace(NOW);
    expect(nextRiskIdentifier(ws).identifier).toBe('RSK-015');
    ws = workspaceReducer(ws, { type: 'risk/deleted', id: byId(ws, 'RSK-014').id });
    expect(nextRiskIdentifier(ws).identifier).toBe('RSK-015');
    const created = add(ws);
    expect(created.risk.identifier).toBe('RSK-015');
    expect(created.ws.riskSequence).toBe(15);
    expect(add({ ...ws, risks: [], riskSequence: 0 }).risk.identifier).toBe('RSK-001');
  });

  it('creates risks as Identified with trimmed text; custom owners keep only their name', () => {
    const ws = createDemoWorkspace(NOW);
    const { risk } = add(ws, { title: '  Spaced  ', owner: { stakeholderId: null, customName: '  Vendor PM ' } });
    expect(risk).toMatchObject({ title: 'Spaced', status: 'identified', owner: { stakeholderId: null, customName: 'Vendor PM' } });
    const { risk: stakeholderOwned } = add(ws, { owner: { stakeholderId: 'stk_demo_it', customName: 'ignored' } });
    expect(stakeholderOwned.owner).toEqual({ stakeholderId: 'stk_demo_it', customName: '' });
  });

  it('keeps identifier and creation date when edited; severity follows the new ratings', () => {
    const ws = createDemoWorkspace(NOW);
    const original = byId(ws, 'RSK-004');
    const edited = applyRiskUpdate(original, { ...toRiskInput(original), probability: 5, impact: 4 }, LATER);
    expect(edited).toMatchObject({ id: original.id, identifier: 'RSK-004', createdAt: NOW, updatedAt: LATER });
    expect(assessRisk(edited)).toEqual({ score: 20, severity: 'critical' });
  });

  it('deleting a risk leaves every related record untouched', () => {
    const ws = createDemoWorkspace(NOW);
    const next = workspaceReducer(ws, { type: 'risk/deleted', id: byId(ws, 'RSK-001').id });
    expect(next.risks).toHaveLength(13);
    expect([next.stakeholders, next.requirements, next.userStories, next.processes, next.project]).toEqual([
      ws.stakeholders,
      ws.requirements,
      ws.userStories,
      ws.processes,
      ws.project,
    ]);
  });
});

describe('relationships and integrity', () => {
  it('finds risks by owner and by related record', () => {
    const ws = createDemoWorkspace(NOW);
    expect(ids(risksOwnedBy(ws, 'stk_demo_operations'))).toEqual(['RSK-001', 'RSK-004', 'RSK-008', 'RSK-012', 'RSK-013']);
    expect(ids(risksLinkedTo(ws, 'requirementIds', 'req_demo_nfr001'))).toEqual(['RSK-007']);
    expect(ids(risksLinkedTo(ws, 'stepIds', ['stp_demo_to_acknowledge', 'stp_demo_to_complete']))).toEqual(['RSK-001', 'RSK-010']);
    expect(risksOwnedBy(ws, 'stk_demo_health_safety')).toEqual([]);
  });

  it('removes links to deleted records, marks the risk updated, and leaves owners alone', () => {
    const ws = createDemoWorkspace(NOW);
    const withoutRecords: Workspace = {
      ...ws,
      requirements: ws.requirements.filter((r) => r.id !== 'req_demo_nfr001'),
      userStories: ws.userStories.filter((s) => s.id !== 'us_demo_013'),
      stakeholders: ws.stakeholders.filter((s) => s.id !== 'stk_demo_technicians'),
    };
    const pruned = pruneRiskLinks(withoutRecords, LATER);
    expect(byId(pruned, 'RSK-007').links.requirementIds).toEqual(['req_demo_nfr004']);
    expect(byId(pruned, 'RSK-011').links.storyIds).toEqual([]);
    expect(byId(pruned, 'RSK-008').links.stakeholderIds).toEqual(['stk_demo_dispatch']);
    expect(byId(pruned, 'RSK-007').updatedAt).toBe(LATER);
    expect(byId(pruned, 'RSK-006').updatedAt).toBe(NOW);
    expect(byId(pruned, 'RSK-001').owner).toEqual(byId(ws, 'RSK-001').owner);
  });

  it('returns the same workspace when nothing needs pruning', () => {
    const ws = createDemoWorkspace(NOW);
    expect(pruneRiskLinks(ws, LATER)).toBe(ws);
  });

  it('refuses to delete a stakeholder who owns a risk', () => {
    const ws = createDemoWorkspace(NOW);
    const owned: Workspace = { ...ws, risks: ws.risks.map((r) => (r.identifier === 'RSK-006' ? { ...r, owner: { stakeholderId: 'stk_demo_health_safety', customName: '' } } : r)) };
    expect(workspaceReducer(owned, { type: 'stakeholder/deleted', id: 'stk_demo_health_safety' })).toBe(owned);
  });
});

describe('register filtering, sorting and summary', () => {
  const ws = createDemoWorkspace(NOW);

  it('searches ID, title, description and owner name', () => {
    expect(ids(filterRisks(ws.risks, { ...EMPTY_RISK_FILTER, query: 'rsk-01' }, ws))).toEqual(['RSK-010', 'RSK-011', 'RSK-012', 'RSK-013', 'RSK-014']);
    expect(ids(filterRisks(ws.risks, { ...EMPTY_RISK_FILTER, query: 'SPAM' }, ws))).toEqual(['RSK-010']);
    expect(ids(filterRisks(ws.risks, { ...EMPTY_RISK_FILTER, query: 'invoicing' }, ws))).toEqual(['RSK-003']);
    expect(ids(filterRisks(ws.risks, { ...EMPTY_RISK_FILTER, query: 'grace' }, ws))).toEqual(['RSK-006']);
  });

  it('filters by category, severity, status, response and owner', () => {
    const f = (patch: Partial<typeof EMPTY_RISK_FILTER>) => ids(filterRisks(ws.risks, { ...EMPTY_RISK_FILTER, ...patch }, ws));
    expect(f({ category: 'data-security' })).toEqual(['RSK-002', 'RSK-005']);
    expect(f({ severity: 'critical' })).toEqual(['RSK-005', 'RSK-008']);
    expect(f({ status: 'monitoring' })).toEqual(['RSK-006', 'RSK-011']);
    expect(f({ response: 'avoid' })).toEqual(['RSK-005', 'RSK-009']);
    expect(f({ owner: 'stk:stk_demo_it' })).toEqual(['RSK-003', 'RSK-005', 'RSK-007']);
    expect(f({ owner: ownerKey({ stakeholderId: null, customName: 'Data Protection Lead (external adviser)' }) })).toEqual(['RSK-011']);
    expect(f({ severity: 'high', status: 'response-planned' })).toEqual(['RSK-001', 'RSK-007']);
  });

  it('sorts by ID, severity, probability, impact and last update', () => {
    const shuffled = [...ws.risks].reverse();
    expect(ids(sortRisks(shuffled, 'identifier')).slice(0, 2)).toEqual(['RSK-001', 'RSK-002']);
    expect(ids(sortRisks(shuffled, 'severity')).slice(0, 3)).toEqual(['RSK-005', 'RSK-008', 'RSK-001']);
    expect(sortRisks(shuffled, 'probability')[0]!.probability).toBe(4);
    expect(ids(sortRisks(shuffled, 'impact')).slice(0, 4)).toEqual(['RSK-005', 'RSK-007', 'RSK-008', 'RSK-009']);
    const touched = ws.risks.map((r) => (r.identifier === 'RSK-012' ? { ...r, updatedAt: LATER } : r));
    expect(sortRisks(touched, 'updated')[0]!.identifier).toBe('RSK-012');
  });

  it('summarises severity and status from the stored risks', () => {
    expect(summariseRisks(ws.risks)).toMatchObject({
      total: 14,
      bySeverity: { critical: 2, high: 5, medium: 6, low: 1 },
      open: 12,
      materialised: 1,
      closed: 1,
    });
    expect(summariseRisks([])).toMatchObject({ total: 0, open: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } });
  });

  it('names stakeholder and custom owners', () => {
    expect(ownerName(byId(ws, 'RSK-006').owner, ws)).toBe('Grace Whitmore');
    expect(ownerName(byId(ws, 'RSK-011').owner, ws)).toBe('Data Protection Lead (external adviser)');
  });
});

describe('risk matrix', () => {
  const ws = createDemoWorkspace(NOW);

  it('builds 25 cells with probability 5 on the top row and impact 1 in the first column', () => {
    const matrix = buildRiskMatrix(ws.risks);
    expect(matrix).toHaveLength(5);
    expect(matrix.every((row) => row.length === 5)).toBe(true);
    expect(matrix[0]![0]).toMatchObject({ probability: 5, impact: 1, score: 5, severity: 'medium' });
    expect(matrix[4]![4]).toMatchObject({ probability: 1, impact: 5, score: 5 });
    expect(matrix[0]![4]).toMatchObject({ probability: 5, impact: 5, score: 25, severity: 'critical' });
  });

  it('places each stored risk in exactly one cell', () => {
    const cells = buildRiskMatrix(ws.risks).flat();
    expect(cells.reduce((n, c) => n + c.risks.length, 0)).toBe(14);
    const cell = (p: number, i: number) => ids(cells.find((c) => c.probability === p && c.impact === i)!.risks);
    expect(cell(4, 5)).toEqual(['RSK-005', 'RSK-008']);
    expect(cell(2, 4)).toEqual(['RSK-006', 'RSK-011', 'RSK-013']);
    expect(cell(1, 1)).toEqual([]);
  });

  it('reflects changes to the data rather than fixed values', () => {
    const { ws: next } = add(ws, { probability: 1, impact: 1 });
    expect(buildRiskMatrix(next.risks).flat().find((c) => c.probability === 1 && c.impact === 1)!.risks).toHaveLength(1);
  });
});

describe('demonstration risks', () => {
  const ws = createDemoWorkspace(NOW);

  it('has 14 valid risks with a contingency plan each and a mitigation plan unless accepted', () => {
    expect(ws.risks).toHaveLength(14);
    expect(ws.riskSequence).toBe(14);
    for (const r of ws.risks) {
      expect(validateRisk(toRiskInput(r), ws)).toEqual({});
      expect(r.contingency.length).toBeGreaterThan(0);
    }
    // Every risk that is not simply accepted has a mitigation plan.
    for (const r of ws.risks.filter((risk) => risk.response !== 'accept')) expect(r.mitigation.length).toBeGreaterThan(0);
  });

  it('covers a realistic mix of categories, strategies, statuses and severities', () => {
    expect(new Set(ws.risks.map((r) => r.category)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(ws.risks.map((r) => r.response))).toEqual(new Set(['avoid', 'mitigate', 'transfer', 'accept']));
    expect(new Set(ws.risks.map((r) => r.status)).size).toBe(7);
    expect(new Set(ws.risks.map((r) => assessRisk(r).severity)).size).toBe(4);
  });

  it('only links to records that exist', () => {
    expect(pruneRiskLinks(ws, LATER)).toBe(ws);
  });
});
