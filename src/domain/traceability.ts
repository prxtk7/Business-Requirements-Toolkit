import type { Objective, Requirement, Stakeholder, UserStory, Workspace } from './types';
import type { StepLocation } from './processes';
import { compareIdentifiers } from './requirements';
import { groupStoriesByRequirement } from './userStories';

/**
 * Requirements traceability matrix. Each row resolves a requirement's links
 * to stakeholders, objectives and process steps. Missing links are reported
 * as gaps; references to records that no longer exist are reported as broken.
 * Nothing is inferred or filled in.
 */
export interface TraceabilityRow {
  requirement: Requirement;
  stakeholder: Stakeholder | null;
  objectives: Objective[];
  asIsSteps: StepLocation[];
  toBeSteps: StepLocation[];
  dependencies: Requirement[];
  /** User stories that implement the requirement (Phase 4). */
  stories: UserStory[];
  gaps: { stakeholder: boolean; objective: boolean; process: boolean };
  /** No user story covers the requirement yet. Reported separately from the upstream gaps above. */
  storyGap: boolean;
  /** Count of stored references that no longer resolve (should be zero). */
  brokenReferences: number;
}

export interface TraceabilitySummary {
  total: number;
  withoutStakeholder: number;
  withoutObjective: number;
  withoutProcess: number;
  fullyTraced: number;
}

/**
 * Id lookups for resolving links. Built once per matrix so each row costs
 * only its own links, rather than a scan of every collection per link.
 */
interface TraceabilityIndex {
  stakeholders: Map<string, Stakeholder>;
  objectives: Map<string, Objective>;
  steps: Map<string, StepLocation>;
  requirements: Map<string, Requirement>;
  storiesByRequirement: Map<string, UserStory[]>;
}

/** First record wins for a duplicated id, matching a linear `find`. */
function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(item.id)) map.set(item.id, item);
  return map;
}

function buildIndex(workspace: Workspace): TraceabilityIndex {
  const steps = new Map<string, StepLocation>();
  for (const process of workspace.processes) {
    process.steps.forEach((step, index) => {
      if (!steps.has(step.id)) steps.set(step.id, { process, step, number: index + 1 });
    });
  }
  return {
    stakeholders: indexById(workspace.stakeholders),
    objectives: indexById(workspace.project.objectives),
    steps,
    requirements: indexById(workspace.requirements),
    storiesByRequirement: groupStoriesByRequirement(workspace),
  };
}

function resolve<T>(ids: readonly string[], lookup: Map<string, T>): T[] {
  return ids.map((id) => lookup.get(id)).filter((item): item is T => item !== undefined);
}

export function buildTraceabilityRow(workspace: Workspace, requirement: Requirement): TraceabilityRow {
  return buildRow(buildIndex(workspace), requirement);
}

function buildRow(index: TraceabilityIndex, requirement: Requirement): TraceabilityRow {
  const stakeholder = requirement.sourceStakeholderId ? (index.stakeholders.get(requirement.sourceStakeholderId) ?? null) : null;
  const objectives = resolve(requirement.objectiveIds, index.objectives);
  const steps = resolve(requirement.stepIds, index.steps);
  const dependencies = resolve(requirement.dependencyIds, index.requirements);
  const stories = index.storiesByRequirement.get(requirement.id) ?? [];

  const broken =
    (requirement.sourceStakeholderId && !stakeholder ? 1 : 0) +
    (requirement.objectiveIds.length - objectives.length) +
    (requirement.stepIds.length - steps.length) +
    (requirement.dependencyIds.length - dependencies.length);

  return {
    requirement,
    stakeholder,
    objectives,
    asIsSteps: steps.filter((s) => s.process.type === 'as-is'),
    toBeSteps: steps.filter((s) => s.process.type === 'to-be'),
    dependencies,
    stories,
    storyGap: stories.length === 0,
    gaps: { stakeholder: stakeholder === null, objective: objectives.length === 0, process: steps.length === 0 },
    brokenReferences: broken,
  };
}

export function buildTraceabilityMatrix(workspace: Workspace, requirements: readonly Requirement[]): TraceabilityRow[] {
  const index = buildIndex(workspace);
  return [...requirements]
    .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
    .map((r) => buildRow(index, r));
}

export function summariseTraceability(rows: readonly TraceabilityRow[]): TraceabilitySummary {
  return {
    total: rows.length,
    withoutStakeholder: rows.filter((r) => r.gaps.stakeholder).length,
    withoutObjective: rows.filter((r) => r.gaps.objective).length,
    withoutProcess: rows.filter((r) => r.gaps.process).length,
    fullyTraced: rows.filter((r) => !r.gaps.stakeholder && !r.gaps.objective && !r.gaps.process).length,
  };
}

export type GapFilter = 'all' | 'any-gap' | 'no-stakeholder' | 'no-objective' | 'no-process' | 'no-story';

export function filterByGap(rows: readonly TraceabilityRow[], gap: GapFilter): TraceabilityRow[] {
  switch (gap) {
    case 'any-gap':
      return rows.filter((r) => r.gaps.stakeholder || r.gaps.objective || r.gaps.process);
    case 'no-stakeholder':
      return rows.filter((r) => r.gaps.stakeholder);
    case 'no-objective':
      return rows.filter((r) => r.gaps.objective);
    case 'no-process':
      return rows.filter((r) => r.gaps.process);
    case 'no-story':
      return rows.filter((r) => r.storyGap);
    default:
      return [...rows];
  }
}
