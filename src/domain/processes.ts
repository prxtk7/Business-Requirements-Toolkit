import type {
  Bottleneck,
  BusinessProcess,
  Improvement,
  Level,
  ProcessStep,
  ProcessType,
  Requirement,
  Responsibility,
  Stakeholder,
  StepChange,
  ValidationErrors,
  Workspace,
} from './types';
import { createId } from './ids';
import { isBlank } from './text';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const PROCESS_TYPES: readonly ProcessType[] = ['as-is', 'to-be'];

export const PROCESS_TYPE_LABELS: Record<ProcessType, string> = {
  'as-is': 'AS-IS',
  'to-be': 'TO-BE',
};

export const STEP_CHANGES: readonly StepChange[] = ['unchanged', 'modified', 'new', 'automated'];

export const STEP_CHANGE_DETAILS: Record<StepChange, { label: string; description: string }> = {
  unchanged: { label: 'Unchanged', description: 'Same activity as in the AS-IS process.' },
  modified: { label: 'Modified', description: 'Same purpose as an AS-IS activity, performed differently.' },
  new: { label: 'New', description: 'Introduced by the TO-BE process; no AS-IS equivalent.' },
  automated: {
    label: 'Automated',
    description: 'An AS-IS manual activity that the TO-BE process performs automatically.',
  },
};

export const NAME_MAX_LENGTH = 120;

export function isProcessType(value: unknown): value is ProcessType {
  return value === 'as-is' || value === 'to-be';
}

export function isStepChange(value: unknown): value is StepChange {
  return typeof value === 'string' && (STEP_CHANGES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface StepLocation {
  process: BusinessProcess;
  step: ProcessStep;
  /** 1-based position within the process. */
  number: number;
}

export function findProcess(workspace: Workspace, processId: string): BusinessProcess | undefined {
  return workspace.processes.find((p) => p.id === processId);
}

/** Locate a step anywhere in the workspace. Step IDs are globally unique. */
export function findStep(workspace: Workspace, stepId: string): StepLocation | undefined {
  for (const process of workspace.processes) {
    const index = process.steps.findIndex((s) => s.id === stepId);
    if (index >= 0) return { process, step: process.steps[index] as ProcessStep, number: index + 1 };
  }
  return undefined;
}

export function stepLabel(location: StepLocation): string {
  return `Step ${location.number}: ${location.step.name}`;
}

export function describeResponsibility(responsible: Responsibility, stakeholders: readonly Stakeholder[]): string {
  if (responsible.type === 'role') return responsible.role;
  const stakeholder = stakeholders.find((s) => s.id === responsible.stakeholderId);
  return stakeholder ? `${stakeholder.name} (${stakeholder.role})` : 'Unknown stakeholder (record missing)';
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

export type ProcessInput = Pick<
  BusinessProcess,
  'type' | 'name' | 'description' | 'objective' | 'trigger' | 'startCondition' | 'endCondition' | 'baselineProcessId'
>;

export function createEmptyProcessInput(type: ProcessType): ProcessInput {
  return {
    type,
    name: '',
    description: '',
    objective: '',
    trigger: '',
    startCondition: '',
    endCondition: '',
    baselineProcessId: null,
  };
}

export function toProcessInput(process: BusinessProcess): ProcessInput {
  return {
    type: process.type,
    name: process.name,
    description: process.description,
    objective: process.objective,
    trigger: process.trigger,
    startCondition: process.startCondition,
    endCondition: process.endCondition,
    baselineProcessId: process.baselineProcessId,
  };
}

/** TO-BE steps of `process` that link to steps of its current baseline. */
function linkedStepCount(process: BusinessProcess): number {
  return process.steps.filter((s) => s.sourceStepIds.length > 0).length;
}

export function validateProcess(
  input: ProcessInput,
  workspace: Workspace,
  editingId?: string,
): ValidationErrors<ProcessInput> {
  const errors: ValidationErrors<ProcessInput> = {};
  const name = input.name.trim();

  if (!isProcessType(input.type)) errors.type = 'Select AS-IS or TO-BE.';

  if (name.length === 0) errors.name = 'Enter a process name.';
  else if (name.length > NAME_MAX_LENGTH) errors.name = `Process name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  else if (
    workspace.processes.some(
      (p) => p.id !== editingId && p.type === input.type && p.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    errors.name = `An ${PROCESS_TYPE_LABELS[input.type]} process with this name already exists.`;
  }

  if (isBlank(input.objective)) errors.objective = 'Describe what the process is meant to achieve.';

  if (input.type === 'to-be' && input.baselineProcessId !== null) {
    const baseline = findProcess(workspace, input.baselineProcessId);
    if (!baseline || baseline.type !== 'as-is') errors.baselineProcessId = 'Select an existing AS-IS process.';
  }

  if (editingId) {
    const existing = findProcess(workspace, editingId);
    if (existing && existing.type !== input.type) errors.type = 'The process type cannot be changed after creation.';
    if (
      existing &&
      existing.type === 'to-be' &&
      existing.baselineProcessId !== input.baselineProcessId &&
      linkedStepCount(existing) > 0
    ) {
      errors.baselineProcessId = `${linkedStepCount(existing)} step(s) are linked to the current AS-IS baseline. Unlink them before changing the baseline.`;
    }
  }

  return errors;
}

function normaliseProcessInput(input: ProcessInput): ProcessInput {
  return {
    type: input.type,
    name: input.name.trim(),
    description: input.description.trim(),
    objective: input.objective.trim(),
    trigger: input.trigger.trim(),
    startCondition: input.startCondition.trim(),
    endCondition: input.endCondition.trim(),
    baselineProcessId: input.type === 'to-be' ? input.baselineProcessId : null,
  };
}

export function createProcess(input: ProcessInput, now: string, id = createId('prc')): BusinessProcess {
  return { id, ...normaliseProcessInput(input), steps: [], createdAt: now, updatedAt: now };
}

export function applyProcessUpdate(process: BusinessProcess, input: ProcessInput, now: string): BusinessProcess {
  // Type is fixed at creation.
  return { ...process, ...normaliseProcessInput({ ...input, type: process.type }), updatedAt: now };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type StepInput = Omit<ProcessStep, 'id'>;

export function createEmptyStepInput(type: ProcessType): StepInput {
  return {
    name: '',
    description: '',
    responsible: { type: 'role', role: '' },
    input: '',
    output: '',
    decision: '',
    notes: '',
    change: type === 'to-be' ? 'new' : null,
    sourceStepIds: [],
  };
}

export function toStepInput(step: ProcessStep): StepInput {
  const { id: _id, ...input } = step;
  return { ...input, sourceStepIds: [...step.sourceStepIds] };
}

export function validateStep(
  input: StepInput,
  process: BusinessProcess,
  workspace: Workspace,
): ValidationErrors<StepInput> {
  const errors: ValidationErrors<StepInput> = {};
  const name = input.name.trim();

  if (name.length === 0) errors.name = 'Enter the activity name.';
  else if (name.length > NAME_MAX_LENGTH) errors.name = `Activity name must be ${NAME_MAX_LENGTH} characters or fewer.`;

  if (input.responsible.type === 'stakeholder') {
    const { stakeholderId } = input.responsible;
    if (!workspace.stakeholders.some((s) => s.id === stakeholderId)) {
      errors.responsible = 'Select a stakeholder from the register, or enter a role.';
    }
  } else if (isBlank(input.responsible.role)) {
    errors.responsible = 'Select a stakeholder, or enter the role responsible for this step.';
  }

  if (process.type === 'to-be') {
    if (!isStepChange(input.change)) {
      errors.change = 'Select how this step changes from the AS-IS process.';
    } else if (input.change !== 'new') {
      const baseline = process.baselineProcessId ? findProcess(workspace, process.baselineProcessId) : undefined;
      if (!baseline) {
        errors.change = 'This process has no AS-IS baseline, so steps can only be marked as new.';
      } else if (input.sourceStepIds.length === 0) {
        errors.sourceStepIds = 'Select the AS-IS step(s) this step corresponds to, or mark it as new.';
      } else if (!input.sourceStepIds.every((id) => baseline.steps.some((s) => s.id === id))) {
        errors.sourceStepIds = 'Linked steps must belong to the AS-IS baseline process.';
      }
    }
  }

  return errors;
}

/** Trim text and drop fields that do not apply to the process type. */
export function normaliseStepInput(input: StepInput, type: ProcessType): StepInput {
  const responsible: Responsibility =
    input.responsible.type === 'role'
      ? { type: 'role', role: input.responsible.role.trim() }
      : { type: 'stakeholder', stakeholderId: input.responsible.stakeholderId };
  const change = type === 'to-be' ? input.change : null;
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    responsible,
    input: input.input.trim(),
    output: input.output.trim(),
    decision: input.decision.trim(),
    notes: input.notes.trim(),
    change,
    sourceStepIds: change && change !== 'new' ? [...new Set(input.sourceStepIds)] : [],
  };
}

export function addStep(
  process: BusinessProcess,
  input: StepInput,
  now: string,
  id = createId('stp'),
): { process: BusinessProcess; step: ProcessStep } {
  const step: ProcessStep = { id, ...normaliseStepInput(input, process.type) };
  return { process: { ...process, steps: [...process.steps, step], updatedAt: now }, step };
}

export function updateStep(process: BusinessProcess, stepId: string, input: StepInput, now: string): BusinessProcess {
  return {
    ...process,
    steps: process.steps.map((s) => (s.id === stepId ? { id: s.id, ...normaliseStepInput(input, process.type) } : s)),
    updatedAt: now,
  };
}

/** Move a step up (-1) or down (+1). Returns the process unchanged at the boundaries. */
export function moveStep(process: BusinessProcess, stepId: string, offset: -1 | 1, now: string): BusinessProcess {
  const index = process.steps.findIndex((s) => s.id === stepId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= process.steps.length) return process;
  const steps = [...process.steps];
  [steps[index], steps[target]] = [steps[target] as ProcessStep, steps[index] as ProcessStep];
  return { ...process, steps, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Dependencies and cascading deletes
//
// Rule: records a process owns (its steps, and the bottlenecks/improvements
// recorded against those steps) are deleted with it after confirmation.
// References from *other* records (stakeholder -> step, AS-IS step -> TO-BE
// step link, AS-IS process -> TO-BE baseline, requirement -> step) block
// deletion until removed.
// ---------------------------------------------------------------------------

export function findStakeholderReferences(workspace: Workspace, stakeholderId: string): StepLocation[] {
  const refs: StepLocation[] = [];
  for (const process of workspace.processes) {
    process.steps.forEach((step, index) => {
      if (step.responsible.type === 'stakeholder' && step.responsible.stakeholderId === stakeholderId) {
        refs.push({ process, step, number: index + 1 });
      }
    });
  }
  return refs;
}

export interface StepDependencies {
  /** TO-BE steps linking to this step (blocking). */
  linkedSteps: StepLocation[];
  /** Requirements tracing to this step (blocking). */
  linkedRequirements: Requirement[];
  /** Owned records deleted with the step. */
  bottlenecks: Bottleneck[];
  improvements: Improvement[];
}

export function findStepDependencies(workspace: Workspace, stepId: string): StepDependencies {
  const linkedSteps: StepLocation[] = [];
  for (const process of workspace.processes) {
    process.steps.forEach((step, index) => {
      if (step.sourceStepIds.includes(stepId)) linkedSteps.push({ process, step, number: index + 1 });
    });
  }
  return {
    linkedSteps,
    linkedRequirements: workspace.requirements.filter((r) => r.stepIds.includes(stepId)),
    bottlenecks: workspace.bottlenecks.filter((b) => b.stepId === stepId),
    improvements: workspace.improvements.filter((i) => i.stepId === stepId),
  };
}

export interface ProcessDependencies {
  /** TO-BE processes using this process as their baseline (blocking). */
  dependentProcesses: BusinessProcess[];
  /** Requirements tracing to any step of this process (blocking). */
  linkedRequirements: Requirement[];
  /** Owned records deleted with the process. */
  stepCount: number;
  bottlenecks: Bottleneck[];
  improvements: Improvement[];
}

export function findProcessDependencies(workspace: Workspace, processId: string): ProcessDependencies {
  const process = findProcess(workspace, processId);
  const stepIds = new Set(process?.steps.map((s) => s.id) ?? []);
  return {
    dependentProcesses: workspace.processes.filter((p) => p.baselineProcessId === processId),
    linkedRequirements: workspace.requirements.filter((r) => r.stepIds.some((id) => stepIds.has(id))),
    stepCount: stepIds.size,
    bottlenecks: workspace.bottlenecks.filter((b) => stepIds.has(b.stepId)),
    improvements: workspace.improvements.filter((i) => stepIds.has(i.stepId)),
  };
}

/** Remove a step and the bottlenecks/improvements recorded against it. */
export function deleteStepCascade(workspace: Workspace, processId: string, stepId: string, now: string): Workspace {
  return {
    ...workspace,
    processes: workspace.processes.map((p) =>
      p.id === processId ? { ...p, steps: p.steps.filter((s) => s.id !== stepId), updatedAt: now } : p,
    ),
    bottlenecks: workspace.bottlenecks.filter((b) => b.stepId !== stepId),
    improvements: workspace.improvements.filter((i) => i.stepId !== stepId),
  };
}

/** Remove a process with its steps and their bottlenecks/improvements. */
export function deleteProcessCascade(workspace: Workspace, processId: string): Workspace {
  const process = findProcess(workspace, processId);
  if (!process) return workspace;
  const stepIds = new Set(process.steps.map((s) => s.id));
  return {
    ...workspace,
    processes: workspace.processes.filter((p) => p.id !== processId),
    bottlenecks: workspace.bottlenecks.filter((b) => !stepIds.has(b.stepId)),
    improvements: workspace.improvements.filter((i) => !stepIds.has(i.stepId)),
  };
}

// ---------------------------------------------------------------------------
// Bottlenecks and improvements
// ---------------------------------------------------------------------------

export type BottleneckInput = Omit<Bottleneck, 'id' | 'createdAt' | 'updatedAt'>;
export type ImprovementInput = Omit<Improvement, 'id' | 'createdAt' | 'updatedAt'>;

const LEVELS: readonly Level[] = ['low', 'medium', 'high'];

export function createEmptyBottleneckInput(stepId = ''): BottleneckInput {
  return { stepId, title: '', description: '', impact: '', severity: 'medium', suggestedImprovement: '' };
}

export function createEmptyImprovementInput(stepId = ''): ImprovementInput {
  return { stepId, title: '', description: '', relatedProblem: '', expectedBenefit: '', priority: 'medium' };
}

export function toBottleneckInput(b: Bottleneck): BottleneckInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = b;
  return input;
}

export function toImprovementInput(i: Improvement): ImprovementInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...input } = i;
  return input;
}

function validateTitleAndDescription(input: { title: string; description: string }) {
  const errors: { title?: string; description?: string } = {};
  const title = input.title.trim();
  if (title.length === 0) errors.title = 'Enter a title.';
  else if (title.length > NAME_MAX_LENGTH) errors.title = `Title must be ${NAME_MAX_LENGTH} characters or fewer.`;
  if (isBlank(input.description)) errors.description = 'Enter a description.';
  return errors;
}

export function validateBottleneck(input: BottleneckInput, workspace: Workspace): ValidationErrors<BottleneckInput> {
  const errors: ValidationErrors<BottleneckInput> = { ...validateTitleAndDescription(input) };
  const location = findStep(workspace, input.stepId);
  if (!location) errors.stepId = 'Select the AS-IS step where this bottleneck occurs.';
  else if (location.process.type !== 'as-is') errors.stepId = 'Bottlenecks can only be recorded against AS-IS steps.';
  if (!LEVELS.includes(input.severity)) errors.severity = 'Select a severity.';
  return errors;
}

export function validateImprovement(input: ImprovementInput, workspace: Workspace): ValidationErrors<ImprovementInput> {
  const errors: ValidationErrors<ImprovementInput> = { ...validateTitleAndDescription(input) };
  const location = findStep(workspace, input.stepId);
  if (!location) errors.stepId = 'Select the TO-BE step that delivers this improvement.';
  else if (location.process.type !== 'to-be') errors.stepId = 'Improvements can only be recorded against TO-BE steps.';
  if (!LEVELS.includes(input.priority)) errors.priority = 'Select a priority.';
  return errors;
}

export function createBottleneck(input: BottleneckInput, now: string, id = createId('btl')): Bottleneck {
  return {
    id,
    stepId: input.stepId,
    title: input.title.trim(),
    description: input.description.trim(),
    impact: input.impact.trim(),
    severity: input.severity,
    suggestedImprovement: input.suggestedImprovement.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createImprovement(input: ImprovementInput, now: string, id = createId('imp')): Improvement {
  return {
    id,
    stepId: input.stepId,
    title: input.title.trim(),
    description: input.description.trim(),
    relatedProblem: input.relatedProblem.trim(),
    expectedBenefit: input.expectedBenefit.trim(),
    priority: input.priority,
    createdAt: now,
    updatedAt: now,
  };
}

const LEVEL_RANK: Record<Level, number> = { high: 0, medium: 1, low: 2 };

/** Order by process step position, then severity/priority (high first). */
export function sortByStepAndLevel<T extends { stepId: string }>(
  items: readonly T[],
  process: BusinessProcess,
  level: (item: T) => Level,
): T[] {
  const position = new Map(process.steps.map((s, i) => [s.id, i]));
  return [...items].sort(
    (a, b) =>
      (position.get(a.stepId) ?? Infinity) - (position.get(b.stepId) ?? Infinity) ||
      LEVEL_RANK[level(a)] - LEVEL_RANK[level(b)],
  );
}

export function itemsForProcess<T extends { stepId: string }>(items: readonly T[], process: BusinessProcess): T[] {
  const ids = new Set(process.steps.map((s) => s.id));
  return items.filter((i) => ids.has(i.stepId));
}
