import { describe, expect, it } from 'vitest';
import type { BusinessProcess, Workspace } from './types';
import {
  addStep,
  applyProcessUpdate,
  createEmptyBottleneckInput,
  createEmptyImprovementInput,
  createEmptyProcessInput,
  createEmptyStepInput,
  createProcess,
  deleteProcessCascade,
  deleteStepCascade,
  describeResponsibility,
  findProcessDependencies,
  findStakeholderReferences,
  findStep,
  findStepDependencies,
  moveStep,
  normaliseStepInput,
  updateStep,
  validateBottleneck,
  validateImprovement,
  validateProcess,
  validateStep,
  type StepInput,
} from './processes';
import { createBlankWorkspace } from './workspace';
import { createStakeholder } from './stakeholders';
import { createDemoWorkspace } from '../data/demoWorkspace';

const NOW = '2026-04-01T09:00:00.000Z';
const LATER = '2026-04-02T09:00:00.000Z';

function stepInput(overrides: Partial<StepInput> = {}): StepInput {
  return { ...createEmptyStepInput('as-is'), name: 'Log request', responsible: { type: 'role', role: 'Clerk' }, ...overrides };
}

/** Blank workspace with one stakeholder, an AS-IS process with two steps and a linked TO-BE process. */
function fixture(): Workspace {
  const ws = createBlankWorkspace(NOW);
  ws.stakeholders.push(
    createStakeholder(
      { name: 'Dana', role: 'Dispatcher', description: '', interest: 'high', influence: 'medium', expectations: [] },
      NOW,
      'stk_dana',
    ),
  );
  let asIs = createProcess({ ...createEmptyProcessInput('as-is'), name: 'Dispatch', objective: 'Get jobs out' }, NOW, 'prc_as');
  asIs = addStep(asIs, stepInput({ name: 'Record request' }), NOW, 'stp_a1').process;
  asIs = addStep(asIs, stepInput({ name: 'Assign', responsible: { type: 'stakeholder', stakeholderId: 'stk_dana' } }), NOW, 'stp_a2').process;
  let toBe = createProcess(
    { ...createEmptyProcessInput('to-be'), name: 'Dispatch', objective: 'Faster', baselineProcessId: 'prc_as' },
    NOW,
    'prc_tb',
  );
  toBe = addStep(
    toBe,
    { ...createEmptyStepInput('to-be'), name: 'Register', responsible: { type: 'role', role: 'CSR' }, change: 'modified', sourceStepIds: ['stp_a1'] },
    NOW,
    'stp_t1',
  ).process;
  ws.processes.push(asIs, toBe);
  ws.bottlenecks.push({
    id: 'btl_1',
    stepId: 'stp_a1',
    title: 'Slow',
    description: 'Slow',
    impact: '',
    severity: 'high',
    suggestedImprovement: '',
    createdAt: NOW,
    updatedAt: NOW,
  });
  ws.improvements.push({
    id: 'imp_1',
    stepId: 'stp_t1',
    title: 'Form',
    description: 'Form',
    relatedProblem: '',
    expectedBenefit: '',
    priority: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  });
  return ws;
}

const proc = (ws: Workspace, id: string) => ws.processes.find((p) => p.id === id) as BusinessProcess;

describe('process validation', () => {
  it('requires a name and objective', () => {
    const errors = validateProcess(createEmptyProcessInput('as-is'), createBlankWorkspace(NOW));
    expect(Object.keys(errors).sort()).toEqual(['name', 'objective']);
  });

  it('rejects duplicate names within the same type but allows AS-IS and TO-BE to share a name', () => {
    const ws = fixture();
    const input = { ...createEmptyProcessInput('as-is'), name: ' dispatch ', objective: 'x' };
    expect(validateProcess(input, ws).name).toMatch(/already exists/);
    expect(validateProcess(input, ws, 'prc_as').name).toBeUndefined();
    expect(fixture().processes.map((p) => p.name)).toEqual(['Dispatch', 'Dispatch']);
  });

  it('requires a TO-BE baseline to be an existing AS-IS process', () => {
    const ws = fixture();
    const input = { ...createEmptyProcessInput('to-be'), name: 'New', objective: 'x', baselineProcessId: 'prc_tb' };
    expect(validateProcess(input, ws).baselineProcessId).toMatch(/AS-IS/);
    expect(validateProcess({ ...input, baselineProcessId: 'missing' }, ws).baselineProcessId).toBeDefined();
  });

  it('blocks changing the baseline while steps are linked to it', () => {
    const ws = fixture();
    const errors = validateProcess(
      { ...createEmptyProcessInput('to-be'), name: 'Dispatch', objective: 'Faster', baselineProcessId: null },
      ws,
      'prc_tb',
    );
    expect(errors.baselineProcessId).toMatch(/Unlink them/);
  });

  it('keeps the type fixed on update and clears the baseline for AS-IS processes', () => {
    const ws = fixture();
    const updated = applyProcessUpdate(
      proc(ws, 'prc_as'),
      { ...createEmptyProcessInput('to-be'), name: ' Renamed ', objective: 'y', baselineProcessId: 'prc_x' },
      LATER,
    );
    expect(updated).toMatchObject({ type: 'as-is', name: 'Renamed', baselineProcessId: null, updatedAt: LATER });
    expect(updated.steps).toHaveLength(2);
  });
});

describe('step validation', () => {
  it('requires an activity name and a responsible stakeholder or role', () => {
    const ws = fixture();
    const errors = validateStep(createEmptyStepInput('as-is'), proc(ws, 'prc_as'), ws);
    expect(Object.keys(errors).sort()).toEqual(['name', 'responsible']);
  });

  it('rejects a reference to a stakeholder that does not exist', () => {
    const ws = fixture();
    const errors = validateStep(stepInput({ responsible: { type: 'stakeholder', stakeholderId: 'stk_gone' } }), proc(ws, 'prc_as'), ws);
    expect(errors.responsible).toBeDefined();
    expect(validateStep(stepInput({ responsible: { type: 'stakeholder', stakeholderId: 'stk_dana' } }), proc(ws, 'prc_as'), ws)).toEqual({});
  });

  it('requires changed TO-BE steps to link to steps of the baseline', () => {
    const ws = fixture();
    const toBe = proc(ws, 'prc_tb');
    const base = { ...createEmptyStepInput('to-be'), name: 'X', responsible: { type: 'role' as const, role: 'CSR' } };
    expect(validateStep({ ...base, change: 'modified', sourceStepIds: [] }, toBe, ws).sourceStepIds).toBeDefined();
    expect(validateStep({ ...base, change: 'automated', sourceStepIds: ['stp_t1'] }, toBe, ws).sourceStepIds).toMatch(/baseline/);
    expect(validateStep({ ...base, change: 'automated', sourceStepIds: ['stp_a2'] }, toBe, ws)).toEqual({});
    expect(validateStep({ ...base, change: 'new' }, toBe, ws)).toEqual({});
  });

  it('only allows "new" steps when a TO-BE process has no baseline', () => {
    const ws = fixture();
    const noBaseline = { ...proc(ws, 'prc_tb'), baselineProcessId: null };
    const base = { ...createEmptyStepInput('to-be'), name: 'X', responsible: { type: 'role' as const, role: 'CSR' } };
    expect(validateStep({ ...base, change: 'unchanged', sourceStepIds: ['stp_a1'] }, noBaseline, ws).change).toMatch(/new/);
  });

  it('normalises fields that do not apply to the process type', () => {
    const asIs = normaliseStepInput(stepInput({ change: 'modified', sourceStepIds: ['x'], name: ' A ' }), 'as-is');
    expect(asIs).toMatchObject({ name: 'A', change: null, sourceStepIds: [] });
    const newStep = normaliseStepInput(stepInput({ change: 'new', sourceStepIds: ['x'] }), 'to-be');
    expect(newStep.sourceStepIds).toEqual([]);
    const linked = normaliseStepInput(stepInput({ change: 'modified', sourceStepIds: ['x', 'x', 'y'] }), 'to-be');
    expect(linked.sourceStepIds).toEqual(['x', 'y']);
  });
});

describe('step operations', () => {
  it('adds steps to the end, edits them and reorders them', () => {
    const ws = fixture();
    let p = proc(ws, 'prc_as');
    p = addStep(p, stepInput({ name: 'Visit' }), LATER, 'stp_a3').process;
    expect(p.steps.map((s) => s.id)).toEqual(['stp_a1', 'stp_a2', 'stp_a3']);

    p = updateStep(p, 'stp_a2', stepInput({ name: 'Assign technician' }), LATER);
    expect(p.steps[1]).toMatchObject({ id: 'stp_a2', name: 'Assign technician' });

    p = moveStep(p, 'stp_a3', -1, LATER);
    expect(p.steps.map((s) => s.id)).toEqual(['stp_a1', 'stp_a3', 'stp_a2']);
    expect(moveStep(p, 'stp_a1', -1, LATER)).toBe(p);
    expect(moveStep(p, 'stp_a2', 1, LATER)).toBe(p);
    expect(findStep({ ...ws, processes: [p] }, 'stp_a2')?.number).toBe(3);
  });

  it('deletes a step with its own bottlenecks but leaves other records', () => {
    const ws = fixture();
    const next = deleteStepCascade(ws, 'prc_as', 'stp_a1', LATER);
    expect(proc(next, 'prc_as').steps.map((s) => s.id)).toEqual(['stp_a2']);
    expect(next.bottlenecks).toEqual([]);
    expect(next.improvements).toHaveLength(1);
  });

  it('deletes a process with its steps and their findings', () => {
    const ws = fixture();
    const next = deleteProcessCascade(ws, 'prc_tb');
    expect(next.processes.map((p) => p.id)).toEqual(['prc_as']);
    expect(next.improvements).toEqual([]);
    expect(next.bottlenecks).toHaveLength(1);
  });
});

describe('dependencies', () => {
  it('finds the steps a stakeholder is responsible for', () => {
    const ws = fixture();
    const refs = findStakeholderReferences(ws, 'stk_dana');
    expect(refs.map((r) => [r.process.id, r.step.id, r.number])).toEqual([['prc_as', 'stp_a2', 2]]);
    expect(findStakeholderReferences(ws, 'stk_other')).toEqual([]);
  });

  it('reports TO-BE links (blocking) and owned findings for a step', () => {
    const ws = fixture();
    const deps = findStepDependencies(ws, 'stp_a1');
    expect(deps.linkedSteps.map((l) => l.step.id)).toEqual(['stp_t1']);
    expect(deps.bottlenecks.map((b) => b.id)).toEqual(['btl_1']);
    expect(findStepDependencies(ws, 'stp_a2').linkedSteps).toEqual([]);
  });

  it('reports TO-BE processes that use a process as their baseline', () => {
    const ws = fixture();
    const deps = findProcessDependencies(ws, 'prc_as');
    expect(deps.dependentProcesses.map((p) => p.id)).toEqual(['prc_tb']);
    expect(deps.stepCount).toBe(2);
    expect(findProcessDependencies(ws, 'prc_tb').dependentProcesses).toEqual([]);
  });

  it('describes responsibilities, including missing stakeholders', () => {
    const ws = fixture();
    expect(describeResponsibility({ type: 'stakeholder', stakeholderId: 'stk_dana' }, ws.stakeholders)).toBe('Dana (Dispatcher)');
    expect(describeResponsibility({ type: 'role', role: 'Customer' }, ws.stakeholders)).toBe('Customer');
    expect(describeResponsibility({ type: 'stakeholder', stakeholderId: 'nope' }, ws.stakeholders)).toMatch(/missing/);
  });
});

describe('bottlenecks and improvements', () => {
  it('requires title, description and an AS-IS step for bottlenecks', () => {
    const ws = fixture();
    expect(Object.keys(validateBottleneck(createEmptyBottleneckInput(), ws)).sort()).toEqual(['description', 'stepId', 'title']);
    const onToBe = { ...createEmptyBottleneckInput('stp_t1'), title: 'T', description: 'D' };
    expect(validateBottleneck(onToBe, ws).stepId).toMatch(/AS-IS/);
    expect(validateBottleneck({ ...onToBe, stepId: 'stp_a2' }, ws)).toEqual({});
  });

  it('requires title, description and a TO-BE step for improvements', () => {
    const ws = fixture();
    expect(Object.keys(validateImprovement(createEmptyImprovementInput(), ws)).sort()).toEqual(['description', 'stepId', 'title']);
    const onAsIs = { ...createEmptyImprovementInput('stp_a1'), title: 'T', description: 'D' };
    expect(validateImprovement(onAsIs, ws).stepId).toMatch(/TO-BE/);
    expect(validateImprovement({ ...onAsIs, stepId: 'stp_t1' }, ws)).toEqual({});
  });
});

describe('demonstration processes', () => {
  const demo = createDemoWorkspace(NOW);

  it('contains a linked AS-IS and TO-BE process for Northstar HVAC Services', () => {
    const asIs = demo.processes.find((p) => p.type === 'as-is')!;
    const toBe = demo.processes.find((p) => p.type === 'to-be')!;
    expect(toBe.baselineProcessId).toBe(asIs.id);
    expect(asIs.description).toMatch(/Fictional/);
    expect(toBe.description).toMatch(/Fictional/);
    expect(asIs.steps.length).toBeGreaterThan(5);
    expect(toBe.steps.length).toBeGreaterThan(5);
  });

  it('passes the same validation rules as user-entered data', () => {
    for (const p of demo.processes) {
      expect(validateProcess(p, demo, p.id)).toEqual({});
      for (const s of p.steps) expect(validateStep(s, p, demo)).toEqual({});
    }
    for (const b of demo.bottlenecks) expect(validateBottleneck(b, demo)).toEqual({});
    for (const i of demo.improvements) expect(validateImprovement(i, demo)).toEqual({});
  });

  it('only marks steps as automated where the step describes automatic system behaviour', () => {
    for (const s of demo.processes.flatMap((p) => p.steps).filter((s) => s.change === 'automated')) {
      expect(s.description).toMatch(/automatically/);
    }
  });
});
