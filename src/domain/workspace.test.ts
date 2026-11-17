import { describe, expect, it } from 'vitest';
import { createBlankWorkspace, describeWorkspaceContents, isWorkspace } from './workspace';
import { createDemoWorkspace, DEMO_ORGANISATION } from '../data/demoWorkspace';
import { getProjectCompleteness, validateProject, toProjectInput } from './project';
import { validateStakeholder, toStakeholderInput } from './stakeholders';

const NOW = '2026-01-01T00:00:00.000Z';

describe('isWorkspace', () => {
  it('accepts blank and demo workspaces', () => {
    expect(isWorkspace(createBlankWorkspace(NOW))).toBe(true);
    expect(isWorkspace(createDemoWorkspace(NOW))).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['missing meta', { project: createBlankWorkspace(NOW).project, stakeholders: [] }],
    ['an unknown origin', { ...createBlankWorkspace(NOW), meta: { origin: 'cloud', createdAt: NOW } }],
    ['a project with wrong types', { ...createBlankWorkspace(NOW), project: { name: 42 } }],
    ['stakeholders not an array', { ...createBlankWorkspace(NOW), stakeholders: {} }],
  ])('rejects %s', (_label, value) => {
    expect(isWorkspace(value)).toBe(false);
  });

  it('rejects a stakeholder with an invalid level', () => {
    const ws = createDemoWorkspace(NOW);
    const broken = { ...ws, stakeholders: [{ ...ws.stakeholders[0], interest: 'very high' }] };
    expect(isWorkspace(broken)).toBe(false);
  });

  it('rejects malformed process records', () => {
    const ws = createDemoWorkspace(NOW);
    const [asIs] = ws.processes;
    expect(isWorkspace({ ...ws, processes: [{ ...asIs, type: 'future' }] })).toBe(false);
    expect(isWorkspace({ ...ws, processes: [{ ...asIs, steps: [{ ...asIs!.steps[0], responsible: { type: 'team' } }] }] })).toBe(false);
    expect(isWorkspace({ ...ws, bottlenecks: [{ ...ws.bottlenecks[0], severity: 'extreme' }] })).toBe(false);
    expect(isWorkspace({ ...ws, improvements: 'none' })).toBe(false);
    const { processes: _omit, ...withoutProcesses } = ws;
    expect(isWorkspace(withoutProcesses)).toBe(false);
  });

  it('rejects duplicate step ids across processes', () => {
    const ws = createDemoWorkspace(NOW);
    const [asIs, toBe] = ws.processes;
    const clash = { ...toBe!, steps: [...toBe!.steps, asIs!.steps[0]!] };
    expect(isWorkspace({ ...ws, processes: [asIs, clash] })).toBe(false);
  });

  it('accepts steps that reference a missing stakeholder (shown as missing in the UI)', () => {
    const ws = createDemoWorkspace(NOW);
    expect(isWorkspace({ ...ws, stakeholders: [] })).toBe(true);
  });

  it('rejects malformed requirement data', () => {
    const ws = createDemoWorkspace(NOW);
    const [first, second] = ws.requirements;
    expect(isWorkspace({ ...ws, requirements: [{ ...first, status: 'done' }] })).toBe(false);
    expect(isWorkspace({ ...ws, requirements: [{ ...first, type: 'business' }] })).toBe(false);
    expect(isWorkspace({ ...ws, requirements: [first, { ...second, identifier: first!.identifier }] })).toBe(false);
    expect(isWorkspace({ ...ws, requirementSequence: { functional: -1, nonFunctional: 0 } })).toBe(false);
    expect(isWorkspace({ ...ws, project: { ...ws.project, objectives: ['plain text'] } })).toBe(false);
    const { requirements: _omit, ...withoutRequirements } = ws;
    expect(isWorkspace(withoutRequirements)).toBe(false);
  });

  it('rejects malformed user story data', () => {
    const ws = createDemoWorkspace(NOW);
    const [first, second] = ws.userStories;
    const criterion = first!.criteria[0]!;
    expect(isWorkspace({ ...ws, userStories: [{ ...first, status: 'done' }] })).toBe(false);
    expect(isWorkspace({ ...ws, userStories: [{ ...first, persona: 'Dispatcher' }] })).toBe(false);
    expect(isWorkspace({ ...ws, userStories: [first, { ...second, identifier: first!.identifier }] })).toBe(false);
    expect(isWorkspace({ ...ws, userStories: [{ ...first, criteria: [criterion, { ...criterion, id: 'other' }] }] })).toBe(false);
    expect(isWorkspace({ ...ws, userStories: [{ ...first, criterionSequence: 0 }] })).toBe(false);
    expect(isWorkspace({ ...ws, storySequence: -1 })).toBe(false);
    const { userStories: _omit, ...withoutStories } = ws;
    expect(isWorkspace(withoutStories)).toBe(false);
  });

  it('rejects malformed risk data', () => {
    const ws = createDemoWorkspace(NOW);
    const [first, second] = ws.risks;
    expect(isWorkspace({ ...ws, risks: [{ ...first, probability: 0 }] })).toBe(false);
    expect(isWorkspace({ ...ws, risks: [{ ...first, impact: 3.5 }] })).toBe(false);
    expect(isWorkspace({ ...ws, risks: [{ ...first, category: 'weather' }] })).toBe(false);
    expect(isWorkspace({ ...ws, risks: [{ ...first, owner: 'Sofia' }] })).toBe(false);
    expect(isWorkspace({ ...ws, risks: [{ ...first, links: { stakeholderIds: [] } }] })).toBe(false);
    expect(isWorkspace({ ...ws, risks: [first, { ...second, identifier: first!.identifier }] })).toBe(false);
    expect(isWorkspace({ ...ws, riskSequence: -1 })).toBe(false);
    const { risks: _omit, ...withoutRisks } = ws;
    expect(isWorkspace(withoutRisks)).toBe(false);
  });

  it('rejects duplicate stakeholder ids', () => {
    const ws = createDemoWorkspace(NOW);
    const first = ws.stakeholders[0]!;
    expect(isWorkspace({ ...ws, stakeholders: [first, { ...first, name: 'Copy' }] })).toBe(false);
  });
});

describe('demonstration dataset', () => {
  const demo = createDemoWorkspace(NOW);

  it('represents the fictional Northstar HVAC Services field service scenario', () => {
    expect(DEMO_ORGANISATION).toBe('Northstar HVAC Services (fictional)');
    expect(demo.project.name).toBe('Field Service Management System');
    expect(demo.project.background).toMatch(/HVAC/);
  });

  it('is clearly labelled as fictional', () => {
    expect(DEMO_ORGANISATION).toMatch(/fictional/i);
    expect(demo.project.organisation).toMatch(/fictional/i);
    expect(demo.project.background).toMatch(/fictional/i);
    expect(demo.meta.origin).toBe('demo');
  });

  it('labels numeric success targets as illustrative', () => {
    for (const criterion of demo.project.successCriteria.filter((c) => /\d+%/.test(c))) {
      expect(criterion).toMatch(/illustrative/i);
    }
  });

  it('passes the same validation rules as user-entered data', () => {
    expect(validateProject(toProjectInput(demo.project))).toEqual({});
    for (const s of demo.stakeholders) {
      expect(validateStakeholder(toStakeholderInput(s), demo.stakeholders, s.id)).toEqual({});
    }
  });

  it('documents every overview section', () => {
    expect(getProjectCompleteness(demo.project).every((i) => i.complete)).toBe(true);
  });

  it('returns independent copies so edits do not leak between workspaces', () => {
    const a = createDemoWorkspace(NOW);
    const b = createDemoWorkspace(NOW);
    a.stakeholders[0]!.expectations.push('mutated');
    expect(b.stakeholders[0]!.expectations).not.toContain('mutated');
  });
});

describe('describeWorkspaceContents', () => {
  it('counts every record type, including nested steps, criteria and links', () => {
    const ws = createDemoWorkspace(NOW);
    const counts = Object.fromEntries(describeWorkspaceContents(ws).map((i) => [i.key, i.count]));
    expect(counts).toEqual({
      project: 1,
      objectives: ws.project.objectives.length,
      stakeholders: ws.stakeholders.length,
      processes: ws.processes.length,
      steps: ws.processes.reduce((n, p) => n + p.steps.length, 0),
      bottlenecks: ws.bottlenecks.length,
      improvements: ws.improvements.length,
      requirements: ws.requirements.length,
      dependencies: ws.requirements.reduce((n, r) => n + r.dependencyIds.length, 0),
      stories: ws.userStories.length,
      criteria: ws.userStories.reduce((n, s) => n + s.criteria.length, 0),
      risks: ws.risks.length,
      riskLinks: ws.risks.reduce((n, r) => n + Object.values(r.links).flat().length, 0),
    });
  });

  it('reports zero for every category of a blank workspace', () => {
    expect(describeWorkspaceContents(createBlankWorkspace(NOW)).every((i) => i.count === 0)).toBe(true);
  });
});
