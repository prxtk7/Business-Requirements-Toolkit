import type { Bottleneck, BusinessProcess, Improvement, ProcessStep, StepChange } from './types';

/**
 * AS-IS vs TO-BE comparison.
 *
 * Categories come only from what the analyst documented:
 *  - a TO-BE step's own `change` value (unchanged / modified / new / automated)
 *  - "removed": an AS-IS step that no TO-BE step links to.
 * Nothing is inferred from step names or descriptions, so a step is only ever
 * shown as automated when its TO-BE record says so.
 */
export type ComparisonCategory = StepChange | 'removed';

export const COMPARISON_CATEGORIES: readonly ComparisonCategory[] = [
  'unchanged',
  'modified',
  'new',
  'automated',
  'removed',
];

export const COMPARISON_LABELS: Record<ComparisonCategory, string> = {
  unchanged: 'Unchanged',
  modified: 'Modified',
  new: 'New',
  automated: 'Automated',
  removed: 'Removed',
};

export interface ComparedStep {
  step: ProcessStep;
  number: number;
}

export interface ComparisonRow {
  category: ComparisonCategory;
  asIs: ComparedStep[];
  toBe: ComparedStep | null;
  bottlenecks: Bottleneck[];
  improvements: Improvement[];
}

export interface ProcessComparison {
  rows: ComparisonRow[];
  counts: Record<ComparisonCategory, number>;
  /** TO-BE steps that claim a change but link to no step in the baseline (data needs fixing). */
  unlinkedChangedSteps: ComparedStep[];
}

export function compareProcesses(
  asIs: BusinessProcess,
  toBe: BusinessProcess,
  bottlenecks: readonly Bottleneck[],
  improvements: readonly Improvement[],
): ProcessComparison {
  const asIsIndex = new Map(asIs.steps.map((s, i) => [s.id, i]));
  const asIsCompared = (index: number): ComparedStep => ({ step: asIs.steps[index] as ProcessStep, number: index + 1 });
  const bottlenecksFor = (stepIds: string[]) => bottlenecks.filter((b) => stepIds.includes(b.stepId));

  const linked = new Set<string>();
  const unlinkedChangedSteps: ComparedStep[] = [];

  const rows: ComparisonRow[] = toBe.steps.map((step, index) => {
    const toBeStep = { step, number: index + 1 };
    // Only links to steps that exist in this baseline count; stale IDs are ignored.
    const sourceIndexes = step.sourceStepIds
      .map((id) => asIsIndex.get(id))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    sourceIndexes.forEach((i) => linked.add((asIs.steps[i] as ProcessStep).id));

    const category: ComparisonCategory = step.change ?? 'new';
    if (category !== 'new' && sourceIndexes.length === 0) unlinkedChangedSteps.push(toBeStep);

    const sources = sourceIndexes.map(asIsCompared);
    return {
      category,
      asIs: sources,
      toBe: toBeStep,
      bottlenecks: bottlenecksFor(sources.map((s) => s.step.id)),
      improvements: improvements.filter((i) => i.stepId === step.id),
    };
  });

  // Insert removed AS-IS steps after the last row that covers an earlier AS-IS step,
  // so the table still reads in roughly process order.
  asIs.steps.forEach((step, index) => {
    if (linked.has(step.id)) return;
    const removed: ComparisonRow = {
      category: 'removed',
      asIs: [asIsCompared(index)],
      toBe: null,
      bottlenecks: bottlenecksFor([step.id]),
      improvements: [],
    };
    let insertAt = 0;
    rows.forEach((row, rowIndex) => {
      if (row.asIs.some((s) => s.number - 1 < index)) insertAt = rowIndex + 1;
    });
    rows.splice(insertAt, 0, removed);
  });

  const counts = Object.fromEntries(COMPARISON_CATEGORIES.map((c) => [c, 0])) as Record<ComparisonCategory, number>;
  for (const row of rows) counts[row.category] += 1;

  return { rows, counts, unlinkedChangedSteps };
}
