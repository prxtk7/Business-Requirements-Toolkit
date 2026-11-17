import type { Workspace } from '../domain/types';
import { isWorkspace } from '../domain/workspace';
import { createDemoWorkspace } from '../data/demoWorkspace';
import { repairRelationships, salvageWorkspace, type IntegrityResult } from '../domain/integrity';

/**
 * Persistence for the workspace aggregate.
 *
 * Data is stored as a versioned envelope so future schema changes can be
 * migrated rather than silently discarded. All functions take a `Storage`
 * instance so they can be tested without touching the real browser storage.
 */

export const STORAGE_KEY = 'ba-toolkit:workspace';
export const BACKUP_KEY_PREFIX = 'ba-toolkit:workspace-backup:';
/**
 * Schema history:
 *  1 - project overview and stakeholders (Phase 1)
 *  2 - adds process analysis: processes, bottlenecks, improvements (Phase 2)
 *  3 - objectives become { id, text } records; adds requirements and the
 *      requirement identifier sequence (Phase 3)
 *  4 - adds user stories (with nested acceptance criteria) and the
 *      user story identifier sequence (Phase 4)
 *  5 - adds the risk register and the risk identifier sequence (Phase 5)
 */
export const SCHEMA_VERSION = 5;

interface StoredEnvelope {
  schemaVersion: number;
  savedAt: string;
  workspace: unknown;
}

export type LoadResult =
  /** Existing saved workspace restored. */
  | { status: 'loaded'; workspace: Workspace }
  /** Nothing saved yet: demonstration data created. */
  | { status: 'seeded'; workspace: Workspace }
  /**
   * Saved data was unreadable; demo data was loaded instead. With a `backupKey`
   * the original was copied there and replaced in storage; without one the
   * backup failed and the original was left untouched under `STORAGE_KEY`.
   */
  | { status: 'recovered'; workspace: Workspace; backupKey: string | null; reason: string }
  /**
   * The user's workspace was loaded, but some records or links needed
   * attention (see `issues`). When `dataChanged` is true, repairs were applied:
   * with a `backupKey` the original was copied there and the repaired
   * workspace saved; without one the backup failed, so the original was left
   * untouched and the repairs exist only in memory until the user saves.
   * When false, the problems are only reported and nothing was written.
   */
  | { status: 'repaired'; workspace: Workspace; issues: string[]; dataChanged: boolean; backupKey: string | null }
  /** Browser storage is unavailable; the workspace lives in memory only. */
  | { status: 'unavailable'; workspace: Workspace };

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Access `localStorage` defensively: it can throw in private modes or sandboxed iframes. */
export function getBrowserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = '__ba-toolkit-probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredEnvelope).schemaVersion === 'number' &&
    'workspace' in value
  );
}

/**
 * v1 -> v2: add the empty process-analysis collections. Existing project and
 * stakeholder data is carried over untouched; no demonstration processes are
 * injected into a user's workspace.
 */
function migrateV1toV2(workspace: unknown): unknown {
  if (typeof workspace !== 'object' || workspace === null || Array.isArray(workspace)) return workspace;
  const record = workspace as Record<string, unknown>;
  return {
    ...record,
    processes: record.processes ?? [],
    bottlenecks: record.bottlenecks ?? [],
    improvements: record.improvements ?? [],
  };
}

/**
 * v2 -> v3: give each objective a stable id so requirements can trace to it,
 * and add the empty requirements collection and identifier sequence.
 *
 * Idempotent: objectives that are already records are kept as they are, and
 * migrated ids are derived from position (`obj_m1`, `obj_m2`, ...) so running
 * the migration twice yields the same result. Nothing references objectives
 * before v3, so positional ids are safe at this point.
 */
export function migrateV2toV3(workspace: unknown): unknown {
  if (typeof workspace !== 'object' || workspace === null || Array.isArray(workspace)) return workspace;
  const record = workspace as Record<string, unknown>;
  const project = record.project;
  let migratedProject = project;
  if (typeof project === 'object' && project !== null && Array.isArray((project as Record<string, unknown>).objectives)) {
    const objectives = (project as { objectives: unknown[] }).objectives.map((o, index) =>
      typeof o === 'string' ? { id: `obj_m${index + 1}`, text: o } : o,
    );
    migratedProject = { ...project, objectives };
  }
  return {
    ...record,
    project: migratedProject,
    requirements: record.requirements ?? [],
    requirementSequence: record.requirementSequence ?? { functional: 0, nonFunctional: 0 },
  };
}

/**
 * v3 -> v4: add the empty user story collection and its identifier sequence.
 * Idempotent: existing values are kept, so running it twice changes nothing
 * and a stored counter is never reset.
 */
export function migrateV3toV4(workspace: unknown): unknown {
  if (typeof workspace !== 'object' || workspace === null || Array.isArray(workspace)) return workspace;
  const record = workspace as Record<string, unknown>;
  return {
    ...record,
    userStories: record.userStories ?? [],
    storySequence: record.storySequence ?? 0,
  };
}

/**
 * v4 -> v5: add the empty risk register and its identifier sequence.
 * Idempotent: existing values are kept and a stored counter is never reset.
 */
export function migrateV4toV5(workspace: unknown): unknown {
  if (typeof workspace !== 'object' || workspace === null || Array.isArray(workspace)) return workspace;
  const record = workspace as Record<string, unknown>;
  return {
    ...record,
    risks: record.risks ?? [],
    riskSequence: record.riskSequence ?? 0,
  };
}

/**
 * Upgrade a stored envelope step by step to the current schema version.
 * Unknown (e.g. future) versions throw, which triggers the backup-and-recover
 * path in `loadWorkspace` rather than discarding data silently.
 */
export function migrate(envelope: { schemaVersion: number; workspace: unknown }): unknown {
  let { schemaVersion: version, workspace } = envelope;
  if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version ${version}.`);
  }
  if (version === 1) {
    workspace = migrateV1toV2(workspace);
    version = 2;
  }
  if (version === 2) {
    workspace = migrateV2toV3(workspace);
    version = 3;
  }
  if (version === 3) {
    workspace = migrateV3toV4(workspace);
    version = 4;
  }
  if (version === 4) {
    workspace = migrateV4toV5(workspace);
    version = 5;
  }
  return workspace;
}

function backupRaw(storage: Storage, raw: string, now: string): string | null {
  const key = `${BACKUP_KEY_PREFIX}${now}`;
  try {
    storage.setItem(key, raw);
    return key;
  } catch {
    return null;
  }
}

export function loadWorkspace(storage: Storage | null, now: string): LoadResult {
  if (!storage) return { status: 'unavailable', workspace: createDemoWorkspace(now) };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable', workspace: createDemoWorkspace(now) };
  }

  if (raw === null) {
    const workspace = createDemoWorkspace(now);
    saveWorkspace(storage, workspace, now);
    return { status: 'seeded', workspace };
  }

  let reason: string;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) throw new Error('Saved data is not in the expected format.');
    const candidate = migrate(parsed);
    if (isWorkspace(candidate)) {
      const checked = repairRelationships(candidate, now);
      if (checked.issues.length === 0) return { status: 'loaded', workspace: candidate };
      return keepRepaired(storage, raw, now, checked);
    }
    // Some records are malformed: keep every readable record rather than the demo data.
    const salvaged = salvageWorkspace(candidate, now);
    if (salvaged) {
      const checked = repairRelationships(salvaged.workspace, now);
      return keepRepaired(storage, raw, now, { workspace: checked.workspace, issues: [...salvaged.issues, ...checked.issues], changed: true });
    }
    reason = 'Saved data failed validation.';
  } catch (error) {
    reason = error instanceof Error ? error.message : 'Saved data could not be read.';
  }

  const backupKey = backupRaw(storage, raw, now);
  const workspace = createDemoWorkspace(now);
  // Replace the unreadable data only once a copy of it is safe. If the backup
  // could not be written (typically because storage is full), leave the
  // original in place: it is only overwritten if the user saves a change.
  if (backupKey) saveWorkspace(storage, workspace, now);
  return { status: 'recovered', workspace, backupKey, reason };
}

/**
 * Finish loading a workspace that needed attention. Repaired data replaces the
 * stored original only after the original has been backed up; if the backup
 * fails, storage is left unchanged.
 */
function keepRepaired(storage: Storage, raw: string, now: string, result: IntegrityResult): LoadResult {
  const base = { status: 'repaired' as const, workspace: result.workspace, issues: result.issues, dataChanged: result.changed };
  if (!result.changed) return { ...base, backupKey: null };
  const backupKey = backupRaw(storage, raw, now);
  if (backupKey) saveWorkspace(storage, result.workspace, now);
  return { ...base, backupKey };
}

export function saveWorkspace(storage: Storage | null, workspace: Workspace, now: string): SaveResult {
  if (!storage) return { ok: false, error: 'Browser storage is unavailable. Changes will be lost when you close this tab.' };
  const envelope: StoredEnvelope = { schemaVersion: SCHEMA_VERSION, savedAt: now, workspace };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    return {
      ok: false,
      error: quota
        ? 'Browser storage is full. Your latest changes could not be saved.'
        : 'Your latest changes could not be saved to browser storage.',
    };
  }
}

// ---------------------------------------------------------------------------
// Cross-tab change detection.
// The app does not synchronise tabs. It only detects that another tab has
// changed the stored workspace so this tab can stop saving stale data.
// ---------------------------------------------------------------------------

export type ExternalChange = 'modified' | 'removed';

/**
 * Classify a `storage` event raised by another tab. Returns null for events
 * that do not affect the workspace. A null key means storage was cleared.
 */
export function classifyExternalChange(key: string | null, newValue: string | null): ExternalChange | null {
  if (key === null) return 'removed';
  if (key !== STORAGE_KEY) return null;
  return newValue === null ? 'removed' : 'modified';
}

/**
 * Read the raw stored workspace string, used to check that nothing else has
 * written since this tab last loaded or saved. Returns `undefined` when the
 * value cannot be read, so callers can skip the check rather than guess.
 */
export function readStoredRaw(storage: Storage): string | null | undefined {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
}
