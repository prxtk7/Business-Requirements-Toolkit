import { describe, expect, it } from 'vitest';
import { buildTraceabilityMatrix, buildTraceabilityRow, filterByGap, summariseTraceability } from './traceability';
import { validateRequirement, toRequirementInput } from './requirements';
import { findStep } from './processes';
import { groupStoriesByRequirement, storiesForRequirement } from './userStories';
import { createDemoWorkspace } from '../data/demoWorkspace';

const NOW = '2026-05-01T09:00:00.000Z';

describe('traceability matrix', () => {
  const ws = createDemoWorkspace(NOW);
  const byIdentifier = (id: string) => ws.requirements.find((r) => r.identifier === id)!;

  it('resolves multiple relationships and splits steps into AS-IS and TO-BE', () => {
    const row = buildTraceabilityRow(ws, byIdentifier('FR-004'));
    expect(row.stakeholder?.name).toBe('Aisha Rahman');
    expect(row.objectives.map((o) => o.id)).toEqual(['obj_demo_scheduling']);
    expect(row.asIsSteps.map((s) => s.step.id)).toEqual(['stp_demo_as_assign', 'stp_demo_as_appointment']);
    expect(row.toBeSteps.map((s) => [s.step.id, s.number])).toEqual([['stp_demo_to_schedule', 5]]);
    expect(row.dependencies.map((d) => d.identifier)).toEqual(['FR-001', 'FR-003']);
    expect(row.gaps).toEqual({ stakeholder: false, objective: false, process: false });
    expect(row.brokenReferences).toBe(0);
  });

  it('reports missing relationships as gaps instead of hiding them', () => {
    expect(buildTraceabilityRow(ws, byIdentifier('NFR-002')).gaps).toEqual({ stakeholder: false, objective: true, process: true });
    expect(buildTraceabilityRow(ws, byIdentifier('NFR-008')).gaps).toEqual({ stakeholder: true, objective: false, process: false });
  });

  it('counts references that no longer resolve', () => {
    const broken = { ...byIdentifier('FR-001'), sourceStakeholderId: 'stk_gone', objectiveIds: ['obj_gone'], stepIds: ['stp_gone'] };
    const row = buildTraceabilityRow(ws, broken);
    expect(row.brokenReferences).toBe(3);
    expect(row.gaps).toEqual({ stakeholder: true, objective: true, process: true });
  });

  it('orders rows by identifier and summarises gaps', () => {
    const rows = buildTraceabilityMatrix(ws, [...ws.requirements].reverse());
    expect(rows[0]!.requirement.identifier).toBe('FR-001');
    expect(summariseTraceability(rows)).toEqual({
      total: 27,
      withoutStakeholder: 1,
      withoutObjective: 2,
      withoutProcess: 3,
      fullyTraced: 23,
    });
  });

  it('filters rows by gap type', () => {
    const rows = buildTraceabilityMatrix(ws, ws.requirements);
    const ids = (gap: Parameters<typeof filterByGap>[1]) => filterByGap(rows, gap).map((r) => r.requirement.identifier);
    expect(ids('no-stakeholder')).toEqual(['NFR-008']);
    expect(ids('no-objective')).toEqual(['NFR-002', 'NFR-004']);
    expect(ids('no-process')).toEqual(['NFR-001', 'NFR-002', 'NFR-004']);
    expect(ids('any-gap')).toEqual(['NFR-001', 'NFR-002', 'NFR-004', 'NFR-008']);
    expect(ids('all')).toHaveLength(27);
  });
});

describe('demonstration requirements', () => {
  const ws = createDemoWorkspace(NOW);

  it('contains 18 functional and 9 non-functional requirements with matching sequences', () => {
    expect(ws.requirements.filter((r) => r.type === 'functional')).toHaveLength(18);
    expect(ws.requirements.filter((r) => r.type === 'non-functional')).toHaveLength(9);
    expect(ws.requirementSequence).toEqual({ functional: 18, nonFunctional: 9 });
    expect(new Set(ws.requirements.map((r) => r.identifier)).size).toBe(27);
  });

  it('passes the same validation as user-entered requirements', () => {
    for (const r of ws.requirements) expect(validateRequirement(toRequirementInput(r), ws, r.id)).toEqual({});
  });

  it('only references records that exist', () => {
    for (const r of ws.requirements) expect(buildTraceabilityRow(ws, r).brokenReferences).toBe(0);
  });

  it('links Centralised Service Request Registration as described in the scenario', () => {
    const fr1 = ws.requirements.find((r) => r.identifier === 'FR-001')!;
    expect(fr1.sourceStakeholderId).toBe('stk_demo_customer_service');
    expect(fr1.objectiveIds).toEqual(['obj_demo_requests']);
    expect(fr1.stepIds.map((id) => findStep(ws, id)?.step.name)).toEqual([
      'Record service request manually',
      'Register service request in the FSM system',
    ]);
  });

  it('labels every numeric target as an illustrative proposal needing validation', () => {
    // Cross-references such as FR-003 or RSK-001 are identifiers, not numeric targets.
    const texts = ws.requirements.flatMap((r) => [r.description, r.rationale, ...r.acceptanceCriteria]);
    const withoutIdentifiers = (t: string) => t.replace(/\b(FR|NFR|US|RSK)-\d{3}\b/g, '');
    for (const text of texts.filter((t) => /\d/.test(withoutIdentifiers(t)) && !/WCAG 2\.2/.test(t))) {
      expect(text).toMatch(/Illustrative proposed target, requires stakeholder validation/);
    }
  });

  it('is never auto-approved: statuses vary and include drafts', () => {
    const statuses = new Set(ws.requirements.map((r) => r.status));
    expect(statuses.has('draft')).toBe(true);
    expect(statuses.size).toBeGreaterThan(3);
  });
});

describe('indexed lookups (performance refactor)', () => {
  const ws = createDemoWorkspace(NOW);

  it('builds the same rows in the matrix as one requirement at a time', () => {
    const matrix = buildTraceabilityMatrix(ws, ws.requirements);
    for (const row of matrix) expect(row).toEqual(buildTraceabilityRow(ws, row.requirement));
  });

  it('matches the per-requirement story lookup, in identifier order', () => {
    const groups = groupStoriesByRequirement(ws);
    for (const requirement of ws.requirements) {
      expect(groups.get(requirement.id) ?? []).toEqual(storiesForRequirement(ws, requirement.id));
    }
    // Every requirement with stories is in the index, and nothing else.
    expect([...groups.keys()].sort()).toEqual(
      ws.requirements.filter((r) => storiesForRequirement(ws, r.id).length > 0).map((r) => r.id).sort(),
    );
  });

  it('lists a story once even if it repeats a requirement link, and resolves steps with their position', () => {
    const [first, second] = ws.userStories;
    const target = first!.requirementIds[0]!;
    const repeated = { ...ws, userStories: [{ ...second!, requirementIds: [target, target] }, first!] };
    const stories = groupStoriesByRequirement(repeated).get(target)!;
    expect(stories.map((s) => s.identifier)).toEqual([first!.identifier, second!.identifier].sort());

    for (const row of buildTraceabilityMatrix(ws, ws.requirements)) {
      for (const location of [...row.asIsSteps, ...row.toBeSteps]) expect(location).toEqual(findStep(ws, location.step.id));
    }
  });
});
