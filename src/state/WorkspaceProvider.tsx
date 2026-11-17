import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StakeholderInput, Workspace } from '../domain/types';
import { normaliseProject, validateProject, type ProjectOverviewInput } from '../domain/project';
import {
  applyStoryUpdate,
  createUserStory,
  isStoryValid,
  setCriterionVerification,
  storiesForRequirement,
  storiesForStakeholder,
  validateStory,
  type StoryInput,
} from '../domain/userStories';
import type { VerificationStatus } from '../domain/types';
import { applyRiskUpdate, createRisk, pruneRiskLinks, risksOwnedBy, validateRisk, type RiskInput } from '../domain/risks';
import {
  applyRequirementUpdate,
  createRequirement,
  requirementsSourcedFrom,
  validateRequirement,
  type RequirementInput,
} from '../domain/requirements';
import { applyStakeholderUpdate, createStakeholder } from '../domain/stakeholders';
import { createBlankWorkspace } from '../domain/workspace';
import { createDemoWorkspace } from '../data/demoWorkspace';
import {
  addStep,
  applyProcessUpdate,
  createBottleneck,
  createImprovement,
  createProcess,
  findProcess,
  findProcessDependencies,
  findStakeholderReferences,
  findStepDependencies,
  moveStep,
  updateStep,
  validateBottleneck,
  validateImprovement,
  validateProcess,
  validateStep,
  type BottleneckInput,
  type ImprovementInput,
  type ProcessInput,
  type StepInput,
} from '../domain/processes';
import {
  classifyExternalChange,
  loadWorkspace,
  readStoredRaw,
  saveWorkspace,
  type ExternalChange,
  type LoadResult,
} from '../storage/workspaceStorage';
import { workspaceReducer, type WorkspaceAction } from './workspaceReducer';
import {
  CONFLICT_SAVE_ERROR,
  WorkspaceContext,
  type CommitResult,
  type WorkspaceActions,
  type WorkspaceContextValue,
} from './workspaceContext';

interface WorkspaceProviderProps {
  initial: LoadResult;
  storage: Storage | null;
  /** Injectable clock for deterministic tests. */
  now?: () => string;
  children: ReactNode;
}

const systemNow = () => new Date().toISOString();

function firstError(errors: Partial<Record<string, string>>): string | undefined {
  return Object.values(errors).find((e): e is string => typeof e === 'string');
}

const BLOCKED: CommitResult = { ok: false, error: CONFLICT_SAVE_ERROR, blocked: true };

export function WorkspaceProvider({ initial, storage, now = systemNow, children }: WorkspaceProviderProps) {
  const [workspace, setWorkspace] = useState<Workspace>(initial.workspace);
  const [loadResult, setLoadResult] = useState<LoadResult>(initial);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [loadNoticeDismissed, setLoadNoticeDismissed] = useState(false);
  const [conflict, setConflict] = useState<ExternalChange | null>(null);
  const [revision, setRevision] = useState(0);

  // Holds the latest committed state so consecutive commits in one tick chain correctly.
  const stateRef = useRef<Workspace>(initial.workspace);
  // The stored value this tab last loaded or wrote. Anything else in storage was written elsewhere.
  const [initialRaw] = useState(() => (storage ? readStoredRaw(storage) : undefined));
  const lastRawRef = useRef<string | null | undefined>(initialRaw);
  const conflictRef = useRef<ExternalChange | null>(null);
  const unsavedRef = useRef(new Set<string>());

  const flagConflict = useCallback((change: ExternalChange) => {
    conflictRef.current = change;
    setConflict(change);
  }, []);

  // Another tab changed the stored workspace: pause saving and warn.
  useEffect(() => {
    if (!storage) return;
    const onStorage = (event: StorageEvent) => {
      const change = classifyExternalChange(event.key, event.newValue);
      if (!change) return;
      if (change === 'modified' && event.newValue === lastRawRef.current) return;
      flagConflict(change);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storage, flagConflict]);

  /** Apply an action, persist synchronously and report whether saving succeeded. */
  const commit = useCallback(
    (action: WorkspaceAction): CommitResult => {
      if (conflictRef.current) return BLOCKED;

      // Guard against a write from another tab whose storage event has not arrived yet.
      if (storage) {
        const stored = readStoredRaw(storage);
        if (stored !== undefined && lastRawRef.current !== undefined && stored !== lastRawRef.current) {
          flagConflict(stored === null ? 'removed' : 'modified');
          return BLOCKED;
        }
      }

      // Risk links to records deleted by this change are removed in the same save,
      // so a risk can never be persisted with a dangling link.
      const next = pruneRiskLinks(workspaceReducer(stateRef.current, action), now());
      stateRef.current = next;
      setWorkspace(next);
      const result = saveWorkspace(storage, next, now());
      if (result.ok && storage) lastRawRef.current = readStoredRaw(storage);
      setPersistenceError(result.ok ? null : result.error);
      return result;
    },
    [storage, now, flagConflict],
  );

  const reloadLatest = useCallback(() => {
    const result = loadWorkspace(storage, now());
    stateRef.current = result.workspace;
    lastRawRef.current = storage ? readStoredRaw(storage) : undefined;
    conflictRef.current = null;
    unsavedRef.current.clear();
    setWorkspace(result.workspace);
    setLoadResult(result);
    if (result.status === 'recovered' || result.status === 'repaired') setLoadNoticeDismissed(false);
    setConflict(null);
    setPersistenceError(null);
    setRevision((r) => r + 1);
  }, [storage, now]);

  const trackUnsavedChanges = useCallback((id: string, dirty: boolean) => {
    if (dirty) unsavedRef.current.add(id);
    else unsavedRef.current.delete(id);
  }, []);

  const hasUnsavedChanges = useCallback(() => unsavedRef.current.size > 0, []);

  /** Refuse a change without applying it. A pending cross-tab conflict takes precedence. */
  const reject = useCallback(
    (error: string): CommitResult => (conflictRef.current ? BLOCKED : { ok: false, error, blocked: true }),
    [],
  );

  const actions = useMemo<WorkspaceActions>(
    () => ({
      saveProject: (input: ProjectOverviewInput) => {
        const state = stateRef.current;
        const error = firstError(validateProject(input, state.requirements, state.project));
        if (error) return reject(error);
        return commit({ type: 'project/saved', project: normaliseProject(input, now()) });
      },

      addStakeholder: (input: StakeholderInput) => {
        const stakeholder = createStakeholder(input, now());
        return { result: commit({ type: 'stakeholder/added', stakeholder }), stakeholder };
      },

      updateStakeholder: (id: string, input: StakeholderInput) => {
        const current = stateRef.current.stakeholders.find((s) => s.id === id);
        if (!current) return { ok: false, error: 'This stakeholder no longer exists.' };
        return commit({ type: 'stakeholder/updated', stakeholder: applyStakeholderUpdate(current, input, now()) });
      },

      deleteStakeholder: (id: string) => {
        const refs = findStakeholderReferences(stateRef.current, id);
        if (refs.length > 0) {
          return reject(
            `This stakeholder is responsible for ${refs.length} process step(s). Reassign or remove those responsibilities before deleting.`,
          );
        }
        const owned = risksOwnedBy(stateRef.current, id);
        if (owned.length > 0) {
          return reject(
            `This stakeholder owns ${owned.map((r) => r.identifier).join(', ')}. Assign another owner before deleting.`,
          );
        }
        const personaOf = storiesForStakeholder(stateRef.current, id);
        if (personaOf.length > 0) {
          return reject(
            `This stakeholder is the user role of ${personaOf.map((s) => s.identifier).join(', ')}. Change those stories' user role before deleting.`,
          );
        }
        const sourced = requirementsSourcedFrom(stateRef.current, id);
        if (sourced.length > 0) {
          return reject(
            `This stakeholder is the source of ${sourced.map((r) => r.identifier).join(', ')}. Change the source of those requirements before deleting.`,
          );
        }
        return commit({ type: 'stakeholder/deleted', id });
      },

      resetToDemo: () => commit({ type: 'workspace/replaced', workspace: createDemoWorkspace(now()) }),

      startBlank: () => commit({ type: 'workspace/replaced', workspace: createBlankWorkspace(now()) }),

      // ---- Process analysis -------------------------------------------------
      // Every write re-validates against the latest state so data integrity
      // does not depend on the UI having checked first.

      saveProcess: (id: string | null, input: ProcessInput) => {
        const state = stateRef.current;
        const error = firstError(validateProcess(input, state, id ?? undefined));
        if (error) return { result: reject(error), id: id ?? '' };
        if (id === null) {
          const process = createProcess(input, now());
          return { result: commit({ type: 'process/added', process }), id: process.id };
        }
        const current = findProcess(state, id);
        if (!current) return { result: reject('This process no longer exists.'), id };
        return { result: commit({ type: 'process/updated', process: applyProcessUpdate(current, input, now()) }), id };
      },

      deleteProcess: (id: string) => {
        const deps = findProcessDependencies(stateRef.current, id);
        if (deps.dependentProcesses.length > 0) {
          return reject(
            `This AS-IS process is the baseline for ${deps.dependentProcesses.length} TO-BE process(es). Change their baseline before deleting.`,
          );
        }
        if (deps.linkedRequirements.length > 0) {
          return reject(
            `Requirements ${deps.linkedRequirements.map((r) => r.identifier).join(', ')} trace to steps in this process. Remove those links before deleting.`,
          );
        }
        return commit({ type: 'process/deleted', id });
      },

      saveStep: (processId: string, stepId: string | null, input: StepInput) => {
        const state = stateRef.current;
        const process = findProcess(state, processId);
        if (!process) return { result: reject('This process no longer exists.'), id: stepId ?? '' };
        const error = firstError(validateStep(input, process, state));
        if (error) return { result: reject(error), id: stepId ?? '' };
        if (stepId === null) {
          const added = addStep(process, input, now());
          return { result: commit({ type: 'process/updated', process: added.process }), id: added.step.id };
        }
        if (!process.steps.some((s) => s.id === stepId)) return { result: reject('This step no longer exists.'), id: stepId };
        return {
          result: commit({ type: 'process/updated', process: updateStep(process, stepId, input, now()) }),
          id: stepId,
        };
      },

      moveStep: (processId: string, stepId: string, offset: -1 | 1) => {
        const process = findProcess(stateRef.current, processId);
        if (!process) return reject('This process no longer exists.');
        return commit({ type: 'process/updated', process: moveStep(process, stepId, offset, now()) });
      },

      deleteStep: (processId: string, stepId: string) => {
        const deps = findStepDependencies(stateRef.current, stepId);
        if (deps.linkedSteps.length > 0) {
          return reject(
            `${deps.linkedSteps.length} TO-BE step(s) are linked to this step. Remove those links before deleting.`,
          );
        }
        if (deps.linkedRequirements.length > 0) {
          return reject(
            `Requirements ${deps.linkedRequirements.map((r) => r.identifier).join(', ')} trace to this step. Remove those links before deleting.`,
          );
        }
        return commit({ type: 'step/deleted', processId, stepId, now: now() });
      },

      saveBottleneck: (id: string | null, input: BottleneckInput) => {
        const state = stateRef.current;
        const error = firstError(validateBottleneck(input, state));
        if (error) return { result: reject(error), id: id ?? '' };
        const existing = id ? state.bottlenecks.find((b) => b.id === id) : undefined;
        if (id && !existing) return { result: reject('This bottleneck no longer exists.'), id };
        const bottleneck = existing
          ? { ...createBottleneck(input, now(), existing.id), createdAt: existing.createdAt }
          : createBottleneck(input, now());
        return { result: commit({ type: 'bottleneck/saved', bottleneck }), id: bottleneck.id };
      },

      deleteBottleneck: (id: string) => commit({ type: 'bottleneck/deleted', id }),

      saveImprovement: (id: string | null, input: ImprovementInput) => {
        const state = stateRef.current;
        const error = firstError(validateImprovement(input, state));
        if (error) return { result: reject(error), id: id ?? '' };
        const existing = id ? state.improvements.find((i) => i.id === id) : undefined;
        if (id && !existing) return { result: reject('This improvement no longer exists.'), id };
        const improvement = existing
          ? { ...createImprovement(input, now(), existing.id), createdAt: existing.createdAt }
          : createImprovement(input, now());
        return { result: commit({ type: 'improvement/saved', improvement }), id: improvement.id };
      },

      deleteImprovement: (id: string) => commit({ type: 'improvement/deleted', id }),

      // ---- Requirements -------------------------------------------------------

      saveRequirement: (id: string | null, input: RequirementInput) => {
        const state = stateRef.current;
        const error = firstError(validateRequirement(input, state, id ?? undefined));
        if (error) return { result: reject(error), id: id ?? '' };
        if (id === null) {
          // Identifier and sequence come from the latest committed state, so they are never reused.
          const { requirement, sequence } = createRequirement(input, state, now());
          return { result: commit({ type: 'requirement/added', requirement, sequence }), id: requirement.id };
        }
        const existing = state.requirements.find((r) => r.id === id);
        if (!existing) return { result: reject('This requirement no longer exists.'), id };
        return { result: commit({ type: 'requirement/updated', requirement: applyRequirementUpdate(existing, input, now()) }), id };
      },

      deleteRequirement: (id: string) => {
        const stories = storiesForRequirement(stateRef.current, id);
        if (stories.length > 0) {
          return reject(
            `User stories ${stories.map((s) => s.identifier).join(', ')} are linked to this requirement. Unlink them before deleting it.`,
          );
        }
        return commit({ type: 'requirement/deleted', id, now: now() });
      },

      // ---- User stories -------------------------------------------------------

      saveStory: (id: string | null, input: StoryInput) => {
        const state = stateRef.current;
        const validation = validateStory(input, state);
        if (!isStoryValid(validation)) return { result: reject(firstError(validation.errors) ?? 'The story is not valid.'), id: id ?? '' };
        if (id === null) {
          const { story, sequence } = createUserStory(input, state, now());
          return { result: commit({ type: 'story/added', story, sequence }), id: story.id };
        }
        const existing = state.userStories.find((s) => s.id === id);
        if (!existing) return { result: reject('This user story no longer exists.'), id };
        return { result: commit({ type: 'story/updated', story: applyStoryUpdate(existing, input, now()) }), id };
      },

      deleteStory: (id: string) => commit({ type: 'story/deleted', id }),

      setCriterionVerification: (storyId: string, criterionId: string, verification: VerificationStatus) => {
        const story = stateRef.current.userStories.find((s) => s.id === storyId);
        if (!story || !story.criteria.some((c) => c.id === criterionId)) return reject('This acceptance criterion no longer exists.');
        return commit({ type: 'story/updated', story: setCriterionVerification(story, criterionId, verification, now()) });
      },

      // ---- Risks ------------------------------------------------------------

      saveRisk: (id: string | null, input: RiskInput) => {
        const state = stateRef.current;
        const error = firstError(validateRisk(input, state));
        if (error) return { result: reject(error), id: id ?? '' };
        if (id === null) {
          const { risk, sequence } = createRisk(input, state, now());
          return { result: commit({ type: 'risk/added', risk, sequence }), id: risk.id };
        }
        const existing = state.risks.find((r) => r.id === id);
        if (!existing) return { result: reject('This risk no longer exists.'), id };
        return { result: commit({ type: 'risk/updated', risk: applyRiskUpdate(existing, input, now()) }), id };
      },

      deleteRisk: (id: string) => commit({ type: 'risk/deleted', id }),
    }),
    [commit, now, reject],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      actions,
      loadStatus: loadResult.status,
      backupKey: loadResult.status === 'recovered' || loadResult.status === 'repaired' ? loadResult.backupKey : null,
      loadIssues:
        loadResult.status === 'repaired' ? { issues: loadResult.issues, dataChanged: loadResult.dataChanged } : null,
      persistenceError,
      loadNoticeDismissed,
      dismissLoadNotice: () => setLoadNoticeDismissed(true),
      conflict,
      reloadLatest,
      revision,
      trackUnsavedChanges,
      hasUnsavedChanges,
    }),
    [
      workspace,
      actions,
      loadResult,
      persistenceError,
      loadNoticeDismissed,
      conflict,
      reloadLatest,
      revision,
      trackUnsavedChanges,
      hasUnsavedChanges,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
