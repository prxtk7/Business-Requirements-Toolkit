import type {
  Bottleneck,
  BusinessProcess,
  Improvement,
  ProjectOverview,
  Requirement,
  RequirementSequence,
  Risk,
  Stakeholder,
  UserStory,
  Workspace,
} from '../domain/types';
import { deleteProcessCascade, deleteStepCascade, findStakeholderReferences } from '../domain/processes';
import { deleteRequirementCascade } from '../domain/requirements';

/**
 * Pure state transitions for the workspace. IDs and timestamps are produced
 * by the domain layer before an action is dispatched, which keeps this
 * reducer deterministic and easy to test.
 */
export type WorkspaceAction =
  | { type: 'project/saved'; project: ProjectOverview }
  | { type: 'stakeholder/added'; stakeholder: Stakeholder }
  | { type: 'stakeholder/updated'; stakeholder: Stakeholder }
  | { type: 'stakeholder/deleted'; id: string }
  | { type: 'process/added'; process: BusinessProcess }
  /** Replaces a process, including its ordered steps. */
  | { type: 'process/updated'; process: BusinessProcess }
  | { type: 'process/deleted'; id: string }
  | { type: 'step/deleted'; processId: string; stepId: string; now: string }
  | { type: 'bottleneck/saved'; bottleneck: Bottleneck }
  | { type: 'bottleneck/deleted'; id: string }
  | { type: 'improvement/saved'; improvement: Improvement }
  | { type: 'improvement/deleted'; id: string }
  /** Adds a requirement and stores the identifier sequence advanced for it. */
  | { type: 'requirement/added'; requirement: Requirement; sequence: RequirementSequence }
  | { type: 'requirement/updated'; requirement: Requirement }
  /** Deletes a requirement and removes it from other requirements' dependencies. */
  | { type: 'requirement/deleted'; id: string; now: string }
  /** Adds a user story and stores the advanced US sequence. */
  | { type: 'story/added'; story: UserStory; sequence: number }
  /** Replaces a story, including its ordered acceptance criteria. */
  | { type: 'story/updated'; story: UserStory }
  | { type: 'story/deleted'; id: string }
  /** Adds a risk and stores the advanced RSK sequence. */
  | { type: 'risk/added'; risk: Risk; sequence: number }
  | { type: 'risk/updated'; risk: Risk }
  /** Deleting a risk never touches the records it links to. */
  | { type: 'risk/deleted'; id: string }
  | { type: 'workspace/replaced'; workspace: Workspace };

/** Insert or replace a record by id. */
function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
}

function remove<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((i) => i.id !== id);
}

export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'project/saved':
      return { ...state, project: action.project };

    case 'stakeholder/added':
      if (state.stakeholders.some((s) => s.id === action.stakeholder.id)) return state;
      return { ...state, stakeholders: [...state.stakeholders, action.stakeholder] };

    case 'stakeholder/updated': {
      const exists = state.stakeholders.some((s) => s.id === action.stakeholder.id);
      if (!exists) return state;
      return {
        ...state,
        stakeholders: state.stakeholders.map((s) => (s.id === action.stakeholder.id ? action.stakeholder : s)),
      };
    }

    case 'stakeholder/deleted': {
      // Defensive: never orphan process steps or requirements (the provider rejects this case first).
      if (findStakeholderReferences(state, action.id).length > 0) return state;
      if (state.requirements.some((r) => r.sourceStakeholderId === action.id)) return state;
      if (state.userStories.some((s) => s.persona.stakeholderId === action.id)) return state;
      if (state.risks.some((r) => r.owner.stakeholderId === action.id)) return state;
      const remaining = state.stakeholders.filter((s) => s.id !== action.id);
      if (remaining.length === state.stakeholders.length) return state;
      return { ...state, stakeholders: remaining };
    }

    case 'process/added':
      if (state.processes.some((p) => p.id === action.process.id)) return state;
      return { ...state, processes: [...state.processes, action.process] };

    case 'process/updated':
      if (!state.processes.some((p) => p.id === action.process.id)) return state;
      return { ...state, processes: upsert(state.processes, action.process) };

    case 'process/deleted':
      return deleteProcessCascade(state, action.id);

    case 'step/deleted':
      return deleteStepCascade(state, action.processId, action.stepId, action.now);

    case 'bottleneck/saved':
      return { ...state, bottlenecks: upsert(state.bottlenecks, action.bottleneck) };

    case 'bottleneck/deleted':
      return { ...state, bottlenecks: remove(state.bottlenecks, action.id) };

    case 'improvement/saved':
      return { ...state, improvements: upsert(state.improvements, action.improvement) };

    case 'improvement/deleted':
      return { ...state, improvements: remove(state.improvements, action.id) };

    case 'requirement/added':
      if (state.requirements.some((r) => r.id === action.requirement.id || r.identifier === action.requirement.identifier)) {
        return state;
      }
      return {
        ...state,
        requirements: [...state.requirements, action.requirement],
        requirementSequence: action.sequence,
      };

    case 'requirement/updated':
      if (!state.requirements.some((r) => r.id === action.requirement.id)) return state;
      return { ...state, requirements: upsert(state.requirements, action.requirement) };

    case 'requirement/deleted':
      // Defensive: never leave user stories pointing at a deleted requirement (the provider rejects this first).
      if (state.userStories.some((s) => s.requirementIds.includes(action.id))) return state;
      return deleteRequirementCascade(state, action.id, action.now);

    case 'story/added':
      if (state.userStories.some((s) => s.id === action.story.id || s.identifier === action.story.identifier)) return state;
      return { ...state, userStories: [...state.userStories, action.story], storySequence: action.sequence };

    case 'story/updated':
      if (!state.userStories.some((s) => s.id === action.story.id)) return state;
      return { ...state, userStories: upsert(state.userStories, action.story) };

    case 'story/deleted':
      // Deleting a story never touches the requirements it links to.
      return { ...state, userStories: remove(state.userStories, action.id) };

    case 'risk/added':
      if (state.risks.some((r) => r.id === action.risk.id || r.identifier === action.risk.identifier)) return state;
      return { ...state, risks: [...state.risks, action.risk], riskSequence: action.sequence };

    case 'risk/updated':
      if (!state.risks.some((r) => r.id === action.risk.id)) return state;
      return { ...state, risks: upsert(state.risks, action.risk) };

    case 'risk/deleted':
      return { ...state, risks: remove(state.risks, action.id) };

    case 'workspace/replaced':
      return action.workspace;
  }
}
