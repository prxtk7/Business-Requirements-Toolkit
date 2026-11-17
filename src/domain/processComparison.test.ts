import { describe, expect, it } from 'vitest';
import type { Bottleneck, BusinessProcess, Improvement, ProcessStep, StepChange } from './types';
import { compareProcesses } from './processComparison';
import { createDemoWorkspace } from '../data/demoWorkspace';

const NOW = '2026-04-01T09:00:00.000Z';

function step(id: string, change: StepChange | null = null, sourceStepIds: string[] = [], description = ''): ProcessStep {
  return {
    id,
    name: id,
    description,
    responsible: { type: 'role', role: 'Role' },
    input: '',
    output: '',
    decision: '',
    notes: '',
    change,
    sourceStepIds,
  };
}

function process(id: string, type: 'as-is' | 'to-be', steps: ProcessStep[]): BusinessProcess {
  return {
    id,
    type,
    name: id,
    description: '',
    objective: '',
    trigger: '',
    startCondition: '',
    endCondition: '',
    baselineProcessId: type === 'to-be' ? 'asis' : null,
    steps,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const bottleneck = (id: string, stepId: string): Bottleneck => ({
  id,
  stepId,
  title: id,
  description: '',
  impact: '',
  severity: 'high',
  suggestedImprovement: '',
  createdAt: NOW,
  updatedAt: NOW,
});

const improvement = (id: string, stepId: string): Improvement => ({
  id,
  stepId,
  title: id,
  description: '',
  relatedProblem: '',
  expectedBenefit: '',
  priority: 'high',
  createdAt: NOW,
  updatedAt: NOW,
});

const asIs = process('asis', 'as-is', [step('a1'), step('a2'), step('a3'), step('a4'), step('a5')]);

describe('compareProcesses', () => {
  const toBe = process('tobe', 'to-be', [
    step('t1', 'unchanged', ['a1']),
    step('t2', 'new'),
    step('t3', 'modified', ['a2', 'a3']),
    step('t4', 'automated', ['a5']),
  ]);

  it('uses the documented change of each TO-BE step and marks unlinked AS-IS steps as removed', () => {
    const result = compareProcesses(asIs, toBe, [], []);
    expect(result.rows.map((r) => [r.category, r.asIs.map((s) => s.step.id), r.toBe?.step.id ?? null])).toEqual([
      ['unchanged', ['a1'], 't1'],
      ['new', [], 't2'],
      ['modified', ['a2', 'a3'], 't3'],
      ['removed', ['a4'], null],
      ['automated', ['a5'], 't4'],
    ]);
    expect(result.counts).toEqual({ unchanged: 1, modified: 1, new: 1, automated: 1, removed: 1 });
  });

  it('never infers automation from step text', () => {
    const text = process('tobe', 'to-be', [step('t1', 'modified', ['a1'], 'The system automatically sends the work order.')]);
    const result = compareProcesses(asIs, text, [], []);
    expect(result.rows[0]?.category).toBe('modified');
    expect(result.counts.automated).toBe(0);
  });

  it('attaches AS-IS bottlenecks and TO-BE improvements to their rows', () => {
    const result = compareProcesses(
      asIs,
      toBe,
      [bottleneck('b2', 'a2'), bottleneck('b4', 'a4'), bottleneck('other', 'zz')],
      [improvement('i3', 't3'), improvement('other', 'zz')],
    );
    const modified = result.rows.find((r) => r.category === 'modified')!;
    expect(modified.bottlenecks.map((b) => b.id)).toEqual(['b2']);
    expect(modified.improvements.map((i) => i.id)).toEqual(['i3']);
    expect(result.rows.find((r) => r.category === 'removed')!.bottlenecks.map((b) => b.id)).toEqual(['b4']);
  });

  it('places removed steps at the start when no earlier AS-IS step is covered', () => {
    const result = compareProcesses(asIs, process('tobe', 'to-be', [step('t1', 'modified', ['a3'])]), [], []);
    expect(result.rows.map((r) => r.asIs[0]?.step.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(result.rows.map((r) => r.category)).toEqual(['removed', 'removed', 'modified', 'removed', 'removed']);
  });

  it('flags changed TO-BE steps whose links do not match the baseline', () => {
    const result = compareProcesses(asIs, process('tobe', 'to-be', [step('t1', 'modified', ['missing'])]), [], []);
    expect(result.unlinkedChangedSteps.map((s) => s.step.id)).toEqual(['t1']);
    expect(result.counts.removed).toBe(5);
  });

  it('shows an AS-IS step mapped to two TO-BE steps in both rows', () => {
    const split = process('tobe', 'to-be', [step('t1', 'modified', ['a1']), step('t2', 'automated', ['a1'])]);
    const result = compareProcesses(process('asis', 'as-is', [step('a1')]), split, [], []);
    expect(result.rows.map((r) => r.asIs.map((s) => s.step.id))).toEqual([['a1'], ['a1']]);
    expect(result.counts.removed).toBe(0);
  });

  it('produces the documented comparison for the demonstration scenario', () => {
    const demo = createDemoWorkspace(NOW);
    const [demoAsIs, demoToBe] = demo.processes as [BusinessProcess, BusinessProcess];
    const result = compareProcesses(demoAsIs, demoToBe, demo.bottlenecks, demo.improvements);
    expect(result.counts).toEqual({ unchanged: 1, modified: 8, new: 2, automated: 3, removed: 0 });
    // Status enquiries are still answered in the TO-BE process, from the system rather than by asking dispatch.
    const enquiries = result.rows.find((r) => r.asIs.some((a) => a.step.id === 'stp_demo_as_status_calls'))!;
    expect(enquiries.category).toBe('modified');
    expect(enquiries.toBe?.step.name).toBe('Answer status enquiries from the FSM system');
    expect(result.unlinkedChangedSteps).toEqual([]);
  });
});
