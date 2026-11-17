import { createContext, useContext } from 'react';
import type { Stakeholder, StakeholderInput, Workspace } from '../domain/types';
import type { ProjectOverviewInput } from '../domain/project';
import type { BottleneckInput, ImprovementInput, ProcessInput, StepInput } from '../domain/processes';
import type { RequirementInput } from '../domain/requirements';
import type { StoryInput } from '../domain/userStories';
import type { RiskInput } from '../domain/risks';
import type { VerificationStatus } from '../domain/types';
import type { ExternalChange, LoadResult } from '../storage/workspaceStorage';

/**
 * Outcome of a workspace change. `blocked` means the change was refused and
 * not applied at all (the workspace changed in another tab, or a data
 * integrity rule failed), so callers should keep the user's input on screen
 * rather than navigate away.
 */
export type CommitResult = { ok: true } | { ok: false; error: string; blocked?: boolean };

/** Result of creating or updating a record, with the record's id. */
export interface SaveRecordResult {
  result: CommitResult;
  id: string;
}

export const CONFLICT_SAVE_ERROR =
  'Not saved: this workspace was changed in another tab. Reload the latest workspace before making further changes.';

export interface WorkspaceActions {
  saveProject(input: ProjectOverviewInput): CommitResult;
  addStakeholder(input: StakeholderInput): { result: CommitResult; stakeholder: Stakeholder };
  updateStakeholder(id: string, input: StakeholderInput): CommitResult;
  deleteStakeholder(id: string): CommitResult;
  resetToDemo(): CommitResult;
  startBlank(): CommitResult;

  /** Create (`id` null) or update a process's details. Steps are managed separately. */
  saveProcess(id: string | null, input: ProcessInput): SaveRecordResult;
  deleteProcess(id: string): CommitResult;
  /** Create (`stepId` null, appended to the end) or update a step. */
  saveStep(processId: string, stepId: string | null, input: StepInput): SaveRecordResult;
  moveStep(processId: string, stepId: string, offset: -1 | 1): CommitResult;
  deleteStep(processId: string, stepId: string): CommitResult;
  saveBottleneck(id: string | null, input: BottleneckInput): SaveRecordResult;
  deleteBottleneck(id: string): CommitResult;
  saveImprovement(id: string | null, input: ImprovementInput): SaveRecordResult;
  deleteImprovement(id: string): CommitResult;

  /** Create (`id` null; the next FR/NFR identifier is assigned) or update a requirement. */
  saveRequirement(id: string | null, input: RequirementInput): SaveRecordResult;
  /** Delete a requirement and remove it from other requirements' dependencies. */
  deleteRequirement(id: string): CommitResult;

  /** Create (`id` null; the next US identifier is assigned) or update a user story and its criteria. */
  saveStory(id: string | null, input: StoryInput): SaveRecordResult;
  deleteStory(id: string): CommitResult;
  /** Record the documented verification outcome of one acceptance criterion. */
  setCriterionVerification(storyId: string, criterionId: string, verification: VerificationStatus): CommitResult;

  /** Create (`id` null; the next RSK identifier is assigned) or update a risk. */
  saveRisk(id: string | null, input: RiskInput): SaveRecordResult;
  /** Delete a risk. Its related records are never affected. */
  deleteRisk(id: string): CommitResult;
}

export interface WorkspaceContextValue {
  workspace: Workspace;
  actions: WorkspaceActions;
  /** Outcome of the most recent load, used to show recovery / storage notices. */
  loadStatus: LoadResult['status'];
  backupKey: string | null;
  /** Problems found while loading saved data (status 'repaired'), and whether repairs were applied. */
  loadIssues: { issues: string[]; dataChanged: boolean } | null;
  /** Latest persistence failure, if the most recent save did not succeed. */
  persistenceError: string | null;
  dismissLoadNotice(): void;
  loadNoticeDismissed: boolean;

  /** Set when another tab changed or removed the stored workspace. Saving is paused until reload. */
  conflict: ExternalChange | null;
  /** Discard this tab's copy and load the latest stored workspace. */
  reloadLatest(): void;
  /** Increments on every reload; used to remount pages so forms pick up fresh data. */
  revision: number;
  /** Forms report whether they hold unsaved edits, so a reload can warn first. */
  trackUnsavedChanges(id: string, dirty: boolean): void;
  hasUnsavedChanges(): boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside <WorkspaceProvider>.');
  return value;
}
