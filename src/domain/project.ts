import type { Objective, ProjectOverview, Requirement, ValidationErrors } from './types';
import { createId } from './ids';
import { isBlank, normaliseList } from './text';

export const PROJECT_NAME_MAX_LENGTH = 120;

/** Editable subset of the project overview (excludes audit fields). */
export type ProjectOverviewInput = Omit<ProjectOverview, 'updatedAt'>;

export function createEmptyProject(): ProjectOverview {
  return {
    name: '',
    organisation: '',
    background: '',
    problemStatement: '',
    objectives: [],
    inScope: [],
    outOfScope: [],
    successCriteria: [],
    updatedAt: null,
  };
}

export function toProjectInput(project: ProjectOverview): ProjectOverviewInput {
  const { updatedAt: _updatedAt, ...input } = project;
  return input;
}

export function createObjectiveId(): string {
  return createId('obj');
}

/** Objectives with non-blank text, trimmed. Blank entries are treated as removed. */
export function normaliseObjectives(objectives: readonly Objective[]): Objective[] {
  return objectives.map((o) => ({ id: o.id, text: o.text.trim() })).filter((o) => o.text.length > 0);
}

/**
 * Validate the overview. When `requirements` are given, removing (or blanking)
 * an objective that requirements trace to is rejected: the link must be
 * removed from those requirements first, so no reference is left dangling.
 */
export function validateProject(
  input: ProjectOverviewInput,
  requirements: readonly Requirement[] = [],
  previous?: ProjectOverview,
): ValidationErrors<ProjectOverviewInput> {
  const errors: ValidationErrors<ProjectOverviewInput> = {};

  if (isBlank(input.name)) {
    errors.name = 'Enter a project name.';
  } else if (input.name.trim().length > PROJECT_NAME_MAX_LENGTH) {
    errors.name = `Project name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (isBlank(input.problemStatement)) {
    errors.problemStatement = 'Describe the problem this project addresses.';
  }

  const kept = new Set(normaliseObjectives(input.objectives).map((o) => o.id));
  if (kept.size === 0) {
    errors.objectives = 'Add at least one objective.';
  } else {
    const removedLinked = [...new Set(requirements.flatMap((r) => r.objectiveIds))].filter((id) => !kept.has(id));
    if (removedLinked.length > 0) {
      const id = removedLinked[0] as string;
      const text = previous?.objectives.find((o) => o.id === id)?.text ?? 'An objective';
      const linked = requirements.filter((r) => r.objectiveIds.includes(id)).map((r) => r.identifier);
      errors.objectives = `“${text}” is linked to ${linked.join(', ')}. Unlink it from ${linked.length === 1 ? 'that requirement' : 'those requirements'} before removing it.`;
    }
  }

  return errors;
}

/** Trim text and remove empty list entries before saving. */
export function normaliseProject(input: ProjectOverviewInput, now: string): ProjectOverview {
  return {
    name: input.name.trim(),
    organisation: input.organisation.trim(),
    background: input.background.trim(),
    problemStatement: input.problemStatement.trim(),
    objectives: normaliseObjectives(input.objectives),
    inScope: normaliseList(input.inScope),
    outOfScope: normaliseList(input.outOfScope),
    successCriteria: normaliseList(input.successCriteria),
    updatedAt: now,
  };
}

export interface CompletenessItem {
  key: keyof ProjectOverviewInput | 'scope';
  label: string;
  complete: boolean;
}

/**
 * Checklist of the sections a project overview should contain before it is
 * useful as a project charter. Scope counts as complete when the in-scope
 * list has at least one entry.
 */
export function getProjectCompleteness(project: ProjectOverview): CompletenessItem[] {
  return [
    { key: 'name', label: 'Project name', complete: !isBlank(project.name) },
    { key: 'background', label: 'Background', complete: !isBlank(project.background) },
    { key: 'problemStatement', label: 'Problem statement', complete: !isBlank(project.problemStatement) },
    { key: 'objectives', label: 'Objectives', complete: normaliseObjectives(project.objectives).length > 0 },
    { key: 'scope', label: 'Scope', complete: normaliseList(project.inScope).length > 0 },
    { key: 'successCriteria', label: 'Success criteria', complete: normaliseList(project.successCriteria).length > 0 },
  ];
}

export function isProjectEmpty(project: ProjectOverview): boolean {
  return getProjectCompleteness(project).every((item) => !item.complete) && isBlank(project.organisation);
}
