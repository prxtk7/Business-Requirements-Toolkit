import type { BusinessProcess, Requirement, Risk, RiskLinks, UserStory, Workspace } from './types';
import { createEmptyProject } from './project';
import { findDependencyCycle } from './requirements';
import { parseNumbered } from './identifiers';
import {
  isBottleneck,
  isBusinessProcess,
  isCount,
  isImprovement,
  isProjectOverview,
  isRecord,
  isRequirement,
  isRisk,
  isSequence,
  isStakeholder,
  isUserStory,
  isWorkspace,
} from './workspace';

/**
 * Integrity checks for workspaces read back from storage.
 *
 * The app enforces relationships whenever it saves, so problems here mean the
 * stored data was edited or damaged outside the app. Two levels:
 *
 * - `repairRelationships`: the workspace is structurally valid but some
 *   references point at records that do not exist. A reference to nothing is
 *   removed (or, for a story's user role, turned into a custom persona with
 *   the same wording). References that cannot be repaired without guessing
 *   are kept and reported.
 * - `salvageWorkspace`: some records are malformed. Those records are set
 *   aside (the caller keeps the original data as a backup) and every
 *   readable record is kept, instead of replacing the whole workspace.
 *
 * Every change and every unresolved problem is described in `issues`, so
 * nothing is altered silently.
 */
export interface IntegrityResult {
  workspace: Workspace;
  /** Human-readable description of each repair or unresolved problem. */
  issues: string[];
  /** True when `workspace` differs from the input (some repair was applied). */
  changed: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Verb agreement for counts: "1 link was", "2 links were". */
const were = (n: number) => (n === 1 ? 'was' : 'were');

const RISK_LINK_KINDS: readonly (keyof RiskLinks)[] = ['stakeholderIds', 'objectiveIds', 'stepIds', 'requirementIds', 'storyIds'];

/** Ids from `ids` that exist in `valid`, without duplicates or `self`. */
function keepValid(ids: readonly string[], valid: ReadonlySet<string>, self?: string): string[] {
  return [...new Set(ids)].filter((id) => valid.has(id) && id !== self);
}

export function repairRelationships(workspace: Workspace, now: string): IntegrityResult {
  const issues: string[] = [];
  const stakeholderIds = new Set(workspace.stakeholders.map((s) => s.id));
  const objectiveIds = new Set(workspace.project.objectives.map((o) => o.id));
  const processesById = new Map(workspace.processes.map((p) => [p.id, p]));

  // Processes: TO-BE baseline and step links to AS-IS steps.
  const processes = workspace.processes.map((process): BusinessProcess => {
    const notes: string[] = [];
    const baseline = process.baselineProcessId ? processesById.get(process.baselineProcessId) : undefined;
    const baselineValid = process.type === 'to-be' && baseline?.type === 'as-is';
    let baselineProcessId = process.baselineProcessId;
    if (baselineProcessId !== null && !baselineValid) {
      baselineProcessId = null;
      notes.push('its AS-IS baseline no longer exists, so the baseline was cleared');
    }
    const baselineSteps = new Set(baselineValid && baseline ? baseline.steps.map((s) => s.id) : []);
    let removedLinks = 0;
    const steps = process.steps.map((step) => {
      const kept = keepValid(step.sourceStepIds, baselineSteps);
      if (kept.length === step.sourceStepIds.length) return step;
      removedLinks += step.sourceStepIds.length - kept.length;
      return { ...step, sourceStepIds: kept };
    });
    if (removedLinks > 0) notes.push(`${plural(removedLinks, 'step link')} to AS-IS steps outside its baseline ${were(removedLinks)} removed`);

    const missingResponsible = process.steps.filter(
      (s) => s.responsible.type === 'stakeholder' && !stakeholderIds.has(s.responsible.stakeholderId),
    ).length;
    if (missingResponsible > 0) {
      issues.push(
        `Process "${process.name}": ${plural(missingResponsible, 'step')} ${missingResponsible === 1 ? 'names' : 'name'} a responsible stakeholder that no longer exists. Kept as is; choose who is responsible when you next edit ${missingResponsible === 1 ? 'that step' : 'those steps'}.`,
      );
    }
    if (notes.length === 0) return process;
    issues.push(`Process "${process.name}": ${notes.join('; ')}.`);
    return { ...process, baselineProcessId, steps, updatedAt: now };
  });

  const stepIds = new Set(processes.flatMap((p) => p.steps.map((s) => s.id)));
  const requirementIds = new Set(workspace.requirements.map((r) => r.id));

  // Requirements: source stakeholder, objectives, process steps, dependencies.
  const requirements = workspace.requirements.map((requirement): Requirement => {
    const notes: string[] = [];
    let sourceStakeholderId = requirement.sourceStakeholderId;
    if (sourceStakeholderId !== null && !stakeholderIds.has(sourceStakeholderId)) {
      sourceStakeholderId = null;
      notes.push('its source stakeholder no longer exists, so the source was cleared');
    }
    const objectives = keepValid(requirement.objectiveIds, objectiveIds);
    const steps = keepValid(requirement.stepIds, stepIds);
    const dependencies = keepValid(requirement.dependencyIds, requirementIds, requirement.id);
    const removed =
      requirement.objectiveIds.length - objectives.length +
      (requirement.stepIds.length - steps.length) +
      (requirement.dependencyIds.length - dependencies.length);
    if (removed > 0) notes.push(`${plural(removed, 'link')} to missing or invalid records ${were(removed)} removed`);
    if (notes.length === 0) return requirement;
    issues.push(`${requirement.identifier}: ${notes.join('; ')}.`);
    return { ...requirement, sourceStakeholderId, objectiveIds: objectives, stepIds: steps, dependencyIds: dependencies, updatedAt: now };
  });

  // Circular dependencies cannot be broken without choosing which link is wrong: report them.
  const reportedCycles = new Set<string>();
  for (const requirement of requirements) {
    const cycle = findDependencyCycle(requirements, requirement.id, requirement.dependencyIds);
    if (!cycle) continue;
    const key = [...new Set(cycle)].sort().join(',');
    if (reportedCycles.has(key)) continue;
    reportedCycles.add(key);
    issues.push(`Requirements form a circular dependency chain (${cycle.join(' → ')}). Kept as is; edit one of them to break the chain.`);
  }

  // User stories: linked requirements and the stakeholder used as user role.
  const userStories = workspace.userStories.map((story): UserStory => {
    const notes: string[] = [];
    const linked = keepValid(story.requirementIds, requirementIds);
    if (linked.length !== story.requirementIds.length) {
      const removed = story.requirementIds.length - linked.length;
      notes.push(
        `${plural(removed, 'link')} to requirements that no longer exist ${were(removed)} removed` +
          (linked.length === 0 ? ' (link a requirement before the story can be saved again)' : ''),
      );
    }
    let persona = story.persona;
    if (persona.stakeholderId !== null && !stakeholderIds.has(persona.stakeholderId)) {
      persona = { stakeholderId: null, label: persona.label };
      notes.push(`its user role stakeholder no longer exists, so "${persona.label}" is kept as a custom persona`);
    }
    if (notes.length === 0) return story;
    issues.push(`${story.identifier}: ${notes.join('; ')}.`);
    return { ...story, requirementIds: linked, persona, updatedAt: now };
  });

  // Findings attached to steps that no longer exist cannot be placed anywhere: report them.
  const orphanBottlenecks = workspace.bottlenecks.filter((b) => !stepIds.has(b.stepId)).length;
  const orphanImprovements = workspace.improvements.filter((i) => !stepIds.has(i.stepId)).length;
  if (orphanBottlenecks + orphanImprovements > 0) {
    const parts = [orphanBottlenecks && plural(orphanBottlenecks, 'bottleneck'), orphanImprovements && plural(orphanImprovements, 'improvement')].filter(Boolean);
    const one = orphanBottlenecks + orphanImprovements === 1;
    issues.push(
      `${parts.join(' and ')} ${one ? 'refers' : 'refer'} to process steps that no longer exist. ${one ? 'It is' : 'They are'} kept in saved data but ${one ? 'is' : 'are'} not shown on any process.`,
    );
  }

  // Risks: related-record links (the same cleanup the app applies on every save) and owners.
  const storyIds = new Set(userStories.map((s) => s.id));
  const existing: Record<keyof RiskLinks, ReadonlySet<string>> = {
    stakeholderIds,
    objectiveIds,
    stepIds,
    requirementIds,
    storyIds,
  };
  const risks = workspace.risks.map((risk): Risk => {
    if (risk.owner.stakeholderId !== null && !stakeholderIds.has(risk.owner.stakeholderId)) {
      issues.push(`${risk.identifier}: its owner is a stakeholder that no longer exists. Kept as is; assign an owner when you next edit the risk.`);
    }
    let removed = 0;
    const links = { ...risk.links };
    for (const kind of RISK_LINK_KINDS) {
      const kept = keepValid(risk.links[kind], existing[kind]);
      removed += risk.links[kind].length - kept.length;
      links[kind] = kept;
    }
    if (removed === 0) return risk;
    issues.push(`${risk.identifier}: ${plural(removed, 'link')} to records that no longer exist ${were(removed)} removed.`);
    return { ...risk, links, updatedAt: now };
  });

  const changed =
    processes.some((p, i) => p !== workspace.processes[i]) ||
    requirements.some((r, i) => r !== workspace.requirements[i]) ||
    userStories.some((s, i) => s !== workspace.userStories[i]) ||
    risks.some((r, i) => r !== workspace.risks[i]);

  return {
    workspace: changed ? { ...workspace, processes, requirements, userStories, risks } : workspace,
    issues,
    changed,
  };
}

// ---------------------------------------------------------------------------
// Structural salvage
// ---------------------------------------------------------------------------

const COLLECTIONS = ['stakeholders', 'processes', 'bottlenecks', 'improvements', 'requirements', 'userStories', 'risks'] as const;

/** Singular and plural wording for each collection, used in messages. */
const NOUNS: Record<(typeof COLLECTIONS)[number], [string, string]> = {
  stakeholders: ['stakeholder', 'stakeholders'],
  processes: ['process', 'processes'],
  bottlenecks: ['bottleneck', 'bottlenecks'],
  improvements: ['improvement', 'improvements'],
  requirements: ['requirement', 'requirements'],
  userStories: ['user story', 'user stories'],
  risks: ['risk', 'risks'],
};

/** How a set-aside record is named in messages: its identifier, name or title when readable. */
function describe(value: unknown): string {
  if (!isRecord(value)) return 'an unreadable entry';
  for (const key of ['identifier', 'name', 'title'] as const) {
    const v = value[key];
    if (typeof v === 'string' && v.trim()) return key === 'identifier' ? v : `"${v.trim()}"`;
  }
  return 'an unnamed entry';
}

/** Highest number used by `prefix` identifiers, including records that were set aside. */
function highestIdentifier(items: readonly unknown[], prefix: string): number {
  return items.reduce<number>((max, item) => {
    const identifier = isRecord(item) && typeof item.identifier === 'string' ? item.identifier : '';
    return Math.max(max, parseNumbered(identifier, prefix) ?? 0);
  }, 0);
}

/**
 * Keep every readable record of a workspace that failed validation. Returns
 * null when the data is not recognisably a workspace (e.g. a collection is not
 * a list), in which case the caller falls back to its full recovery path.
 */
export function salvageWorkspace(value: unknown, now: string): IntegrityResult | null {
  if (!isRecord(value)) return null;
  if (!COLLECTIONS.every((key) => Array.isArray(value[key]))) return null;
  const issues: string[] = [];

  const meta = value.meta;
  const metaValid = isRecord(meta) && (meta.origin === 'demo' || meta.origin === 'blank') && typeof meta.createdAt === 'string';
  if (!metaValid) issues.push('The workspace details could not be read and were reset.');

  const project = isProjectOverview(value.project) ? value.project : createEmptyProject();
  if (project !== value.project) {
    issues.push('The project overview could not be read and was reset to empty. Links from other records to its objectives were removed.');
  }

  const kept: Record<string, unknown[]> = {};
  const raw = (key: (typeof COLLECTIONS)[number]) => value[key] as unknown[];
  const guards: Record<(typeof COLLECTIONS)[number], (v: unknown) => boolean> = {
    stakeholders: isStakeholder,
    processes: isBusinessProcess,
    bottlenecks: isBottleneck,
    improvements: isImprovement,
    requirements: isRequirement,
    userStories: isUserStory,
    risks: isRisk,
  };
  const seenStepIds = new Set<string>();

  for (const key of COLLECTIONS) {
    const ids = new Set<string>();
    const identifiers = new Set<string>();
    const setAside: string[] = [];
    const records: unknown[] = [];
    for (const item of raw(key)) {
      if (!guards[key](item)) {
        setAside.push(describe(item));
        continue;
      }
      // Duplicates (same id, identifier or step id as an earlier record) would break lookups: keep the first.
      const record = item as { id: string; identifier?: string; steps?: { id: string }[] };
      const duplicate =
        ids.has(record.id) ||
        (record.identifier !== undefined && identifiers.has(record.identifier)) ||
        (record.steps ?? []).some((step) => seenStepIds.has(step.id));
      if (duplicate) {
        setAside.push(`${describe(item)} (duplicate)`);
        continue;
      }
      ids.add(record.id);
      if (record.identifier !== undefined) identifiers.add(record.identifier);
      for (const step of record.steps ?? []) seenStepIds.add(step.id);
      records.push(item);
    }
    kept[key] = records;
    if (setAside.length > 0) {
      const [one, many] = NOUNS[key];
      const n = setAside.length;
      issues.push(`${n} ${n === 1 ? one : many} could not be read and ${n === 1 ? 'was' : 'were'} set aside: ${setAside.join(', ')}.`);
    }
  }

  // Counters: keep valid ones; otherwise continue after the highest identifier ever seen, set-aside records included.
  let requirementSequence = value.requirementSequence;
  if (!isSequence(requirementSequence)) {
    requirementSequence = { functional: highestIdentifier(raw('requirements'), 'FR'), nonFunctional: highestIdentifier(raw('requirements'), 'NFR') };
    issues.push('The requirement numbering counters could not be read; numbering continues after the highest FR and NFR identifiers found.');
  }
  let storySequence = value.storySequence;
  if (!isCount(storySequence)) {
    storySequence = highestIdentifier(raw('userStories'), 'US');
    issues.push('The user story numbering counter could not be read; numbering continues after the highest US identifier found.');
  }
  let riskSequence = value.riskSequence;
  if (!isCount(riskSequence)) {
    riskSequence = highestIdentifier(raw('risks'), 'RSK');
    issues.push('The risk numbering counter could not be read; numbering continues after the highest RSK identifier found.');
  }

  const workspace = {
    meta: metaValid ? meta : { origin: 'blank', createdAt: now },
    project,
    ...kept,
    requirementSequence,
    storySequence,
    riskSequence,
  };
  if (!isWorkspace(workspace)) return null;
  return { workspace, issues, changed: true };
}
