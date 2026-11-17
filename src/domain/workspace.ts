import type {
  Bottleneck,
  BusinessProcess,
  Improvement,
  Objective,
  ProcessStep,
  ProjectOverview,
  Requirement,
  RequirementSequence,
  Risk,
  Stakeholder,
  UserStory,
  Workspace,
} from './types';
import { createEmptyProject } from './project';
import { isLevel } from './stakeholders';
import { isProcessType, isStepChange } from './processes';
import { isRequirementPriority, isRequirementStatus, isRequirementType } from './requirementConfig';
import { createEmptySequence } from './requirements';
import { isStoryStatus, isVerificationStatus } from './storyConfig';
import { isRating, isRiskCategory, isRiskResponse, isRiskStatus } from './riskConfig';

/** One category of records held in a workspace, with how many there are. */
export interface WorkspaceContentItem {
  key: string;
  label: string;
  count: number;
}

/**
 * Count every kind of record in a workspace, for messages that must state
 * exactly what an operation such as a reset will delete or replace.
 */
export function describeWorkspaceContents(workspace: Workspace): WorkspaceContentItem[] {
  const project = workspace.project;
  const projectDocumented =
    [project.name, project.background, project.problemStatement].some((t) => t.trim().length > 0) ||
    project.inScope.length + project.outOfScope.length + project.successCriteria.length > 0;
  return [
    { key: 'project', label: 'Project overview', count: projectDocumented ? 1 : 0 },
    { key: 'objectives', label: 'Objectives', count: project.objectives.length },
    { key: 'stakeholders', label: 'Stakeholders', count: workspace.stakeholders.length },
    { key: 'processes', label: 'Processes', count: workspace.processes.length },
    { key: 'steps', label: 'Process steps', count: workspace.processes.reduce((n, p) => n + p.steps.length, 0) },
    { key: 'bottlenecks', label: 'Bottlenecks', count: workspace.bottlenecks.length },
    { key: 'improvements', label: 'Improvements', count: workspace.improvements.length },
    { key: 'requirements', label: 'Requirements', count: workspace.requirements.length },
    { key: 'dependencies', label: 'Requirement dependencies', count: workspace.requirements.reduce((n, r) => n + r.dependencyIds.length, 0) },
    { key: 'stories', label: 'User stories', count: workspace.userStories.length },
    { key: 'criteria', label: 'Acceptance criteria', count: workspace.userStories.reduce((n, s) => n + s.criteria.length, 0) },
    { key: 'risks', label: 'Risks', count: workspace.risks.length },
    {
      key: 'riskLinks',
      label: 'Risk links',
      count: workspace.risks.reduce(
        (n, r) => n + Object.values(r.links).reduce((m, ids: readonly string[]) => m + ids.length, 0),
        0,
      ),
    },
  ];
}

export function createBlankWorkspace(now: string): Workspace {
  return {
    meta: { origin: 'blank', createdAt: now },
    project: createEmptyProject(),
    stakeholders: [],
    processes: [],
    bottlenecks: [],
    improvements: [],
    requirements: [],
    requirementSequence: createEmptySequence(),
    userStories: [],
    storySequence: 0,
    risks: [],
    riskSequence: 0,
  };
}

// ---------------------------------------------------------------------------
// Runtime validation of untrusted data (e.g. read back from localStorage).
// Hand-written guards keep the bundle free of a schema-library dependency.
// ---------------------------------------------------------------------------

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((i) => i.id)).size === items.length;
}

function isObjective(value: unknown): value is Objective {
  return isRecord(value) && isString(value.id) && value.id.length > 0 && isString(value.text);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isProjectOverview(value: unknown): value is ProjectOverview {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.organisation) &&
    isString(value.background) &&
    isString(value.problemStatement) &&
    Array.isArray(value.objectives) &&
    value.objectives.every(isObjective) &&
    hasUniqueIds(value.objectives as Objective[]) &&
    isStringArray(value.inScope) &&
    isStringArray(value.outOfScope) &&
    isStringArray(value.successCriteria) &&
    (value.updatedAt === null || isString(value.updatedAt))
  );
}

export function isStakeholder(value: unknown): value is Stakeholder {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.id.length > 0 &&
    isString(value.name) &&
    isString(value.role) &&
    isString(value.description) &&
    isLevel(value.interest) &&
    isLevel(value.influence) &&
    isStringArray(value.expectations) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isProcessStep(value: unknown): value is ProcessStep {
  if (!isRecord(value)) return false;
  const r = value.responsible;
  const validResponsible =
    isRecord(r) &&
    ((r.type === 'stakeholder' && isString(r.stakeholderId)) || (r.type === 'role' && isString(r.role)));
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    isString(value.name) &&
    isString(value.description) &&
    validResponsible &&
    isString(value.input) &&
    isString(value.output) &&
    isString(value.decision) &&
    isString(value.notes) &&
    (value.change === null || isStepChange(value.change)) &&
    isStringArray(value.sourceStepIds)
  );
}

export function isBusinessProcess(value: unknown): value is BusinessProcess {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.id.length > 0 &&
    isProcessType(value.type) &&
    isString(value.name) &&
    isString(value.description) &&
    isString(value.objective) &&
    isString(value.trigger) &&
    isString(value.startCondition) &&
    isString(value.endCondition) &&
    (value.baselineProcessId === null || isString(value.baselineProcessId)) &&
    Array.isArray(value.steps) &&
    value.steps.every(isProcessStep) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function hasAuditFields(value: Record<string, unknown>): boolean {
  return isString(value.id) && value.id.length > 0 && isString(value.stepId) && isString(value.createdAt) && isString(value.updatedAt);
}

export function isBottleneck(value: unknown): value is Bottleneck {
  return (
    isRecord(value) &&
    hasAuditFields(value) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.impact) &&
    isLevel(value.severity) &&
    isString(value.suggestedImprovement)
  );
}

export function isImprovement(value: unknown): value is Improvement {
  return (
    isRecord(value) &&
    hasAuditFields(value) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.relatedProblem) &&
    isString(value.expectedBenefit) &&
    isLevel(value.priority)
  );
}

export function isRequirement(value: unknown): value is Requirement {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.id.length > 0 &&
    isString(value.identifier) &&
    isRequirementType(value.type) &&
    isString(value.category) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.rationale) &&
    isRequirementPriority(value.priority) &&
    isRequirementStatus(value.status) &&
    (value.sourceStakeholderId === null || isString(value.sourceStakeholderId)) &&
    isStringArray(value.objectiveIds) &&
    isStringArray(value.stepIds) &&
    isStringArray(value.dependencyIds) &&
    isStringArray(value.acceptanceCriteria) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

function isCriterion(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.id.length > 0 &&
    isCount(value.number) &&
    value.number > 0 &&
    isString(value.title) &&
    isString(value.given) &&
    isString(value.when) &&
    isString(value.then) &&
    isString(value.notes) &&
    isVerificationStatus(value.verification)
  );
}

export function isUserStory(value: unknown): value is UserStory {
  if (!isRecord(value)) return false;
  const persona = value.persona;
  const criteria = value.criteria;
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    isString(value.identifier) &&
    isString(value.title) &&
    isRecord(persona) &&
    (persona.stakeholderId === null || isString(persona.stakeholderId)) &&
    isString(persona.label) &&
    isString(value.need) &&
    isString(value.benefit) &&
    isString(value.description) &&
    isStringArray(value.requirementIds) &&
    isRequirementPriority(value.priority) &&
    isStoryStatus(value.status) &&
    Array.isArray(criteria) &&
    criteria.every(isCriterion) &&
    hasUniqueIds(criteria as { id: string }[]) &&
    new Set((criteria as { number: number }[]).map((c) => c.number)).size === criteria.length &&
    isCount(value.criterionSequence) &&
    (criteria as { number: number }[]).every((c) => c.number <= (value.criterionSequence as number)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isRisk(value: unknown): value is Risk {
  if (!isRecord(value)) return false;
  const owner = value.owner;
  const links = value.links;
  return (
    isString(value.id) &&
    value.id.length > 0 &&
    isString(value.identifier) &&
    isString(value.title) &&
    isString(value.description) &&
    isRiskCategory(value.category) &&
    isRating(value.probability) &&
    isRating(value.impact) &&
    isRiskResponse(value.response) &&
    isString(value.mitigation) &&
    isString(value.contingency) &&
    isRecord(owner) &&
    (owner.stakeholderId === null || isString(owner.stakeholderId)) &&
    isString(owner.customName) &&
    isRiskStatus(value.status) &&
    isRecord(links) &&
    isStringArray(links.stakeholderIds) &&
    isStringArray(links.objectiveIds) &&
    isStringArray(links.stepIds) &&
    isStringArray(links.requirementIds) &&
    isStringArray(links.storyIds) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isSequence(value: unknown): value is RequirementSequence {
  return isRecord(value) && isCount(value.functional) && isCount(value.nonFunctional);
}

/**
 * Structural validation of a current-schema workspace. Cross-record
 * references (e.g. a step pointing at a deleted stakeholder) are not checked
 * here: the UI renders them as missing rather than discarding the workspace.
 */
export function isWorkspace(value: unknown): value is Workspace {
  if (!isRecord(value)) return false;
  const {
    meta,
    project,
    stakeholders,
    processes,
    bottlenecks,
    improvements,
    requirements,
    requirementSequence,
    userStories,
    storySequence,
    risks,
    riskSequence,
  } = value;
  if (!isRecord(meta) || (meta.origin !== 'demo' && meta.origin !== 'blank') || !isString(meta.createdAt)) {
    return false;
  }
  if (!isProjectOverview(project)) return false;
  if (!Array.isArray(stakeholders) || !stakeholders.every(isStakeholder) || !hasUniqueIds(stakeholders)) return false;
  if (!Array.isArray(processes) || !processes.every(isBusinessProcess) || !hasUniqueIds(processes)) return false;
  if (!hasUniqueIds(processes.flatMap((p) => p.steps))) return false;
  if (!Array.isArray(bottlenecks) || !bottlenecks.every(isBottleneck) || !hasUniqueIds(bottlenecks)) return false;
  if (!Array.isArray(improvements) || !improvements.every(isImprovement) || !hasUniqueIds(improvements)) return false;
  if (!Array.isArray(requirements) || !requirements.every(isRequirement) || !hasUniqueIds(requirements)) return false;
  // Identifiers must be unique too: they are what people cite.
  if (new Set(requirements.map((r) => r.identifier)).size !== requirements.length) return false;
  if (!isSequence(requirementSequence)) return false;
  if (!Array.isArray(userStories) || !userStories.every(isUserStory) || !hasUniqueIds(userStories)) return false;
  if (new Set(userStories.map((s) => s.identifier)).size !== userStories.length) return false;
  if (!isCount(storySequence)) return false;
  if (!Array.isArray(risks) || !risks.every(isRisk) || !hasUniqueIds(risks)) return false;
  if (new Set(risks.map((r) => r.identifier)).size !== risks.length) return false;
  if (!isCount(riskSequence)) return false;
  return true;
}
