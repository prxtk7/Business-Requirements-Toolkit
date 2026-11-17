import type {
  Requirement,
  RequirementPriority,
  RequirementSequence,
  RequirementStatus,
  RequirementType,
  ValidationErrors,
  Workspace,
} from './types';
import {
  AWAITING_REVIEW_STATUSES,
  DEFAULT_REQUIREMENT_STATUS,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPE_DETAILS,
  isCategoryForType,
  isRequirementPriority,
  isRequirementStatus,
  isRequirementType,
} from './requirementConfig';
import { createId } from './ids';
import { formatNumbered, nextNumber } from './identifiers';
import { isBlank, normaliseList } from './text';
import { findStep } from './processes';

export const TITLE_MAX_LENGTH = 150;

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

const SEQUENCE_KEY: Record<RequirementType, keyof RequirementSequence> = {
  functional: 'functional',
  'non-functional': 'nonFunctional',
};

export function createEmptySequence(): RequirementSequence {
  return { functional: 0, nonFunctional: 0 };
}

export function formatIdentifier(type: RequirementType, number: number): string {
  return formatNumbered(REQUIREMENT_TYPE_DETAILS[type].prefix, number);
}

/** Parse "FR-007" into its type and number; null if the format is not recognised. */
export function parseIdentifier(identifier: string): { type: RequirementType; number: number } | null {
  const match = /^(FR|NFR)-(\d+)$/.exec(identifier);
  if (!match) return null;
  return { type: match[1] === 'FR' ? 'functional' : 'non-functional', number: Number(match[2]) };
}

/**
 * Next identifier for a type. Uses the stored sequence (last number issued)
 * and, defensively, the highest number present, so an identifier is never
 * reissued even after deletions or if the counter were behind.
 */
export function nextIdentifier(workspace: Pick<Workspace, 'requirements' | 'requirementSequence'>, type: RequirementType) {
  const number = nextNumber(
    workspace.requirementSequence[SEQUENCE_KEY[type]],
    workspace.requirements.map((r) => r.identifier),
    REQUIREMENT_TYPE_DETAILS[type].prefix,
  );
  return {
    identifier: formatIdentifier(type, number),
    sequence: { ...workspace.requirementSequence, [SEQUENCE_KEY[type]]: number } as RequirementSequence,
  };
}

/** Natural ordering: FR before NFR, then by number. */
export function compareIdentifiers(a: string, b: string): number {
  const pa = parseIdentifier(a);
  const pb = parseIdentifier(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.type !== pb.type) return pa.type === 'functional' ? -1 : 1;
  return pa.number - pb.number;
}

// ---------------------------------------------------------------------------
// Input and validation
// ---------------------------------------------------------------------------

export type RequirementInput = Omit<Requirement, 'id' | 'identifier' | 'createdAt' | 'updatedAt'>;

export function createEmptyRequirementInput(type: RequirementType = 'functional'): RequirementInput {
  return {
    type,
    category: '',
    title: '',
    description: '',
    rationale: '',
    priority: 'should',
    status: DEFAULT_REQUIREMENT_STATUS,
    sourceStakeholderId: null,
    objectiveIds: [],
    stepIds: [],
    dependencyIds: [],
    acceptanceCriteria: [],
  };
}

export function toRequirementInput(r: Requirement): RequirementInput {
  return {
    type: r.type,
    category: r.category,
    title: r.title,
    description: r.description,
    rationale: r.rationale,
    priority: r.priority,
    status: r.status,
    sourceStakeholderId: r.sourceStakeholderId,
    objectiveIds: [...r.objectiveIds],
    stepIds: [...r.stepIds],
    dependencyIds: [...r.dependencyIds],
    acceptanceCriteria: [...r.acceptanceCriteria],
  };
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * If giving requirement `id` the dependencies `dependencyIds` would create a
 * cycle, return the cycle as identifiers (e.g. ["FR-001", "FR-004", "FR-001"]).
 */
export function findDependencyCycle(
  requirements: readonly Requirement[],
  id: string,
  dependencyIds: readonly string[],
): string[] | null {
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const depsOf = (reqId: string) => (reqId === id ? dependencyIds : (byId.get(reqId)?.dependencyIds ?? []));
  const label = (reqId: string) => byId.get(reqId)?.identifier ?? 'this requirement';

  const visit = (current: string, path: string[], seen: Set<string>): string[] | null => {
    for (const next of depsOf(current)) {
      if (next === id) return [...path, next];
      if (seen.has(next)) continue;
      seen.add(next);
      const found = visit(next, [...path, next], seen);
      if (found) return found;
    }
    return null;
  };

  const cycle = visit(id, [id], new Set());
  return cycle ? cycle.map(label) : null;
}

export function validateRequirement(
  input: RequirementInput,
  workspace: Workspace,
  editingId?: string,
): ValidationErrors<RequirementInput> {
  const errors: ValidationErrors<RequirementInput> = {};
  const title = input.title.trim();
  const existing = editingId ? workspace.requirements.find((r) => r.id === editingId) : undefined;

  if (title.length === 0) errors.title = 'Enter a requirement title.';
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`;

  if (isBlank(input.description)) errors.description = 'Describe what the requirement is.';

  if (!isRequirementType(input.type)) errors.type = 'Select functional or non-functional.';
  else if (existing && existing.type !== input.type) {
    errors.type = `The type cannot change after creation because it determines the identifier (${existing.identifier}).`;
  }

  if (isRequirementType(input.type) && !isCategoryForType(input.type, input.category)) {
    errors.category = `Select a ${REQUIREMENT_TYPE_DETAILS[input.type].label.toLowerCase()} requirement category.`;
  }

  if (!isRequirementPriority(input.priority)) errors.priority = 'Select a MoSCoW priority.';
  if (!isRequirementStatus(input.status)) errors.status = 'Select a status.';

  if (input.sourceStakeholderId !== null && !workspace.stakeholders.some((s) => s.id === input.sourceStakeholderId)) {
    errors.sourceStakeholderId = 'The selected stakeholder no longer exists.';
  }

  const objectiveIds = new Set(workspace.project.objectives.map((o) => o.id));
  if (hasDuplicates(input.objectiveIds)) errors.objectiveIds = 'Each objective can only be linked once.';
  else if (!input.objectiveIds.every((id) => objectiveIds.has(id))) {
    errors.objectiveIds = 'One or more linked objectives no longer exist.';
  }

  if (hasDuplicates(input.stepIds)) errors.stepIds = 'Each process step can only be linked once.';
  else if (!input.stepIds.every((id) => findStep(workspace, id))) {
    errors.stepIds = 'One or more linked process steps no longer exist.';
  }

  const requirementIds = new Set(workspace.requirements.map((r) => r.id));
  if (editingId && input.dependencyIds.includes(editingId)) {
    errors.dependencyIds = 'A requirement cannot depend on itself.';
  } else if (hasDuplicates(input.dependencyIds)) {
    errors.dependencyIds = 'Each dependency can only be listed once.';
  } else if (!input.dependencyIds.every((id) => requirementIds.has(id))) {
    errors.dependencyIds = 'One or more dependencies no longer exist.';
  } else if (editingId) {
    const cycle = findDependencyCycle(workspace.requirements, editingId, input.dependencyIds);
    if (cycle) errors.dependencyIds = `These dependencies would create a circular chain: ${cycle.join(' → ')}.`;
  }

  return errors;
}

function normaliseInput(input: RequirementInput): RequirementInput {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    rationale: input.rationale.trim(),
    objectiveIds: [...input.objectiveIds],
    stepIds: [...input.stepIds],
    dependencyIds: [...input.dependencyIds],
    acceptanceCriteria: normaliseList(input.acceptanceCriteria),
  };
}

/** Create a requirement with the next identifier; returns the updated sequence to persist with it. */
export function createRequirement(
  input: RequirementInput,
  workspace: Pick<Workspace, 'requirements' | 'requirementSequence'>,
  now: string,
  id = createId('req'),
): { requirement: Requirement; sequence: RequirementSequence } {
  const { identifier, sequence } = nextIdentifier(workspace, input.type);
  return { requirement: { id, identifier, ...normaliseInput(input), createdAt: now, updatedAt: now }, sequence };
}

/** Apply edits. Identifier, type and creation date never change. */
export function applyRequirementUpdate(existing: Requirement, input: RequirementInput, now: string): Requirement {
  return {
    ...existing,
    ...normaliseInput({ ...input, type: existing.type }),
    id: existing.id,
    identifier: existing.identifier,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

/** Requirements that depend on `id`. */
export function findDependents(requirements: readonly Requirement[], id: string): Requirement[] {
  return requirements.filter((r) => r.dependencyIds.includes(id));
}

/**
 * Delete a requirement and remove it from other requirements' dependency
 * lists (their `updatedAt` changes, since their dependencies changed).
 */
export function deleteRequirementCascade(workspace: Workspace, id: string, now: string): Workspace {
  return {
    ...workspace,
    requirements: workspace.requirements
      .filter((r) => r.id !== id)
      .map((r) =>
        r.dependencyIds.includes(id)
          ? { ...r, dependencyIds: r.dependencyIds.filter((d) => d !== id), updatedAt: now }
          : r,
      ),
  };
}

// ---------------------------------------------------------------------------
// References from requirements to other records (used to block deletes)
// ---------------------------------------------------------------------------

export function requirementsSourcedFrom(workspace: Workspace, stakeholderId: string): Requirement[] {
  return workspace.requirements.filter((r) => r.sourceStakeholderId === stakeholderId);
}

export function requirementsLinkedToStep(workspace: Workspace, stepId: string): Requirement[] {
  return workspace.requirements.filter((r) => r.stepIds.includes(stepId));
}

export function requirementsLinkedToObjective(workspace: Pick<Workspace, 'requirements'>, objectiveId: string): Requirement[] {
  return workspace.requirements.filter((r) => r.objectiveIds.includes(objectiveId));
}

// ---------------------------------------------------------------------------
// Register: filtering, sorting and summaries
// ---------------------------------------------------------------------------

export interface RequirementFilter {
  query: string;
  type: RequirementType | 'all';
  category: string | 'all';
  priority: RequirementPriority | 'all';
  status: RequirementStatus | 'all';
}

export const EMPTY_FILTER: RequirementFilter = { query: '', type: 'all', category: 'all', priority: 'all', status: 'all' };

export function filterRequirements(requirements: readonly Requirement[], filter: RequirementFilter): Requirement[] {
  const query = filter.query.trim().toLowerCase();
  return requirements.filter(
    (r) =>
      (filter.type === 'all' || r.type === filter.type) &&
      (filter.category === 'all' || r.category === filter.category) &&
      (filter.priority === 'all' || r.priority === filter.priority) &&
      (filter.status === 'all' || r.status === filter.status) &&
      (query === '' || [r.identifier, r.title, r.description].some((f) => f.toLowerCase().includes(query))),
  );
}

export type RequirementSort = 'identifier' | 'priority' | 'status' | 'updated';

export const SORT_LABELS: Record<RequirementSort, string> = {
  identifier: 'Identifier',
  priority: 'Priority (Must first)',
  status: 'Status (workflow order)',
  updated: 'Recently updated',
};

export function sortRequirements(requirements: readonly Requirement[], sort: RequirementSort): Requirement[] {
  const byId = (a: Requirement, b: Requirement) => compareIdentifiers(a.identifier, b.identifier);
  const rank = <T extends string>(order: readonly T[]) => (v: T) => order.indexOf(v);
  const priorityRank = rank(REQUIREMENT_PRIORITIES);
  const statusRank = rank(REQUIREMENT_STATUSES);
  return [...requirements].sort((a, b) => {
    switch (sort) {
      case 'priority':
        return priorityRank(a.priority) - priorityRank(b.priority) || byId(a, b);
      case 'status':
        return statusRank(a.status) - statusRank(b.status) || byId(a, b);
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt) || byId(a, b);
      default:
        return byId(a, b);
    }
  });
}

export interface RequirementSummary {
  total: number;
  functional: number;
  nonFunctional: number;
  must: number;
  approved: number;
  awaitingReview: number;
  byStatus: Record<RequirementStatus, number>;
}

export function summariseRequirements(requirements: readonly Requirement[]): RequirementSummary {
  const byStatus = Object.fromEntries(REQUIREMENT_STATUSES.map((s) => [s, 0])) as Record<RequirementStatus, number>;
  for (const r of requirements) byStatus[r.status] += 1;
  return {
    total: requirements.length,
    functional: requirements.filter((r) => r.type === 'functional').length,
    nonFunctional: requirements.filter((r) => r.type === 'non-functional').length,
    must: requirements.filter((r) => r.priority === 'must').length,
    approved: byStatus.approved,
    awaitingReview: requirements.filter((r) => AWAITING_REVIEW_STATUSES.includes(r.status)).length,
    byStatus,
  };
}
