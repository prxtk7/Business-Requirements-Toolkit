import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../test/MemoryStorage';
import { createBlankWorkspace } from '../domain/workspace';
import {
  BACKUP_KEY_PREFIX,
  SCHEMA_VERSION,
  STORAGE_KEY,
  classifyExternalChange,
  loadWorkspace,
  migrate,
  migrateV2toV3,
  migrateV3toV4,
  migrateV4toV5,
  readStoredRaw,
  saveWorkspace,
} from './workspaceStorage';

const NOW = '2026-01-01T00:00:00.000Z';

describe('loadWorkspace', () => {
  it('seeds and persists demonstration data on first run', () => {
    const storage = new MemoryStorage();
    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('seeded');
    expect(result.workspace.meta.origin).toBe('demo');
    const stored = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(stored.workspace).toEqual(result.workspace);
  });

  it('restores a previously saved workspace', () => {
    const storage = new MemoryStorage();
    const workspace = createBlankWorkspace(NOW);
    workspace.project.name = 'Saved project';
    saveWorkspace(storage, workspace, NOW);

    const result = loadWorkspace(storage, '2026-02-01T00:00:00.000Z');
    expect(result).toEqual({ status: 'loaded', workspace });
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['a missing envelope', JSON.stringify({ project: {} })],
    ['an invalid workspace shape', JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: { meta: {} } })],
    ['an unsupported future schema', JSON.stringify({ schemaVersion: 99, savedAt: NOW, workspace: {} })],
  ])('recovers from %s by backing it up and loading demo data', (_label, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('recovered');
    if (result.status !== 'recovered') return;
    expect(result.backupKey).toBe(`${BACKUP_KEY_PREFIX}${NOW}`);
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(result.workspace.meta.origin).toBe('demo');
    // The healthy replacement is persisted so the next load succeeds.
    expect(loadWorkspace(storage, NOW).status).toBe('loaded');
  });

  it('leaves unreadable data in place when it cannot be backed up', () => {
    // Backups fail (e.g. storage is full) but the main key could still be written.
    class NoBackupStorage extends MemoryStorage {
      override setItem(key: string, value: string): void {
        if (key.startsWith(BACKUP_KEY_PREFIX)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        super.setItem(key, value);
      }
    }
    const storage = new NoBackupStorage();
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: { meta: {} } });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('recovered');
    if (result.status !== 'recovered') return;
    expect(result.backupKey).toBeNull();
    expect(result.workspace.meta.origin).toBe('demo');
    // The only copy of the user's data is not overwritten on load.
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
  });

  it('falls back to in-memory demo data when storage is unavailable', () => {
    const result = loadWorkspace(null, NOW);
    expect(result.status).toBe('unavailable');
    expect(result.workspace.stakeholders.length).toBeGreaterThan(0);
  });
});

describe('saveWorkspace', () => {
  it('reports a clear error when storage is full', () => {
    const storage = new MemoryStorage();
    storage.failWrites = 'quota';
    const result = saveWorkspace(storage, createBlankWorkspace(NOW), NOW);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/storage is full/i) });
  });

  it('reports a generic error for other write failures', () => {
    const storage = new MemoryStorage();
    storage.failWrites = 'generic';
    const result = saveWorkspace(storage, createBlankWorkspace(NOW), NOW);
    expect(result.ok).toBe(false);
  });

  it('reports that changes are not persisted without storage', () => {
    expect(saveWorkspace(null, createBlankWorkspace(NOW), NOW)).toEqual({
      ok: false,
      error: expect.stringMatching(/unavailable/i),
    });
  });
});

describe('classifyExternalChange', () => {
  it('reports a modified workspace', () => {
    expect(classifyExternalChange(STORAGE_KEY, '{"schemaVersion":1}')).toBe('modified');
  });

  it('reports a removed workspace, including when storage is cleared', () => {
    expect(classifyExternalChange(STORAGE_KEY, null)).toBe('removed');
    expect(classifyExternalChange(null, null)).toBe('removed');
  });

  it('ignores changes to other keys, such as backups', () => {
    expect(classifyExternalChange(`${BACKUP_KEY_PREFIX}${NOW}`, 'x')).toBeNull();
    expect(classifyExternalChange('unrelated', 'x')).toBeNull();
  });
});

describe('readStoredRaw', () => {
  it('returns the stored string, null when absent, and undefined when unreadable', () => {
    const storage = new MemoryStorage();
    expect(readStoredRaw(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, 'raw');
    expect(readStoredRaw(storage)).toBe('raw');

    const broken = new MemoryStorage();
    broken.getItem = () => {
      throw new Error('denied');
    };
    expect(readStoredRaw(broken)).toBeUndefined();
  });
});

describe('schema migration', () => {
  /** A workspace exactly as Phase 1 (schema v1) stored it: no process collections. */
  function v1Workspace() {
    const { processes: _p, bottlenecks: _b, improvements: _i, ...v1 } = createBlankWorkspace(NOW);
    return {
      ...v1,
      project: { ...v1.project, name: 'Saved in v1' },
      stakeholders: [
        {
          id: 'stk_1',
          name: 'Dana',
          role: 'Dispatcher',
          description: '',
          interest: 'high',
          influence: 'medium',
          expectations: ['Fewer calls'],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    };
  }

  it('upgrades a v1 workspace without losing project or stakeholder data', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: NOW, workspace: v1Workspace() });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('loaded');
    expect(result.workspace.project.name).toBe('Saved in v1');
    expect(result.workspace.stakeholders.map((s) => s.name)).toEqual(['Dana']);
    expect(result.workspace.processes).toEqual([]);
    expect(result.workspace.bottlenecks).toEqual([]);
    expect(result.workspace.improvements).toEqual([]);
    expect(result.workspace.requirements).toEqual([]);
    // Demo processes are not injected into a user's workspace.
    expect(result.workspace.meta.origin).toBe('blank');
    // Loading alone does not rewrite storage; the next save writes the current schema.
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    saveWorkspace(storage, result.workspace, NOW);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('backs up an invalid v1 workspace instead of discarding it', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 1, savedAt: NOW, workspace: { ...v1Workspace(), stakeholders: 'broken' } });
    storage.setItem(STORAGE_KEY, raw);
    const result = loadWorkspace(storage, NOW);
    expect(result.status).toBe('recovered');
    expect(storage.getItem(`${BACKUP_KEY_PREFIX}${NOW}`)).toBe(raw);
  });

  it('rejects unknown schema versions', () => {
    for (const version of [0, SCHEMA_VERSION + 1, 1.5]) {
      expect(() => migrate({ schemaVersion: version, workspace: {} })).toThrow(/Unsupported schema version/);
    }
  });

  it('round-trips a workspace with processes, bottlenecks and improvements', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const storage = new MemoryStorage();
    const demo = createDemoWorkspace(NOW);
    saveWorkspace(storage, demo, NOW);
    expect(loadWorkspace(storage, NOW)).toEqual({ status: 'loaded', workspace: demo });
  });
});

describe('schema v3 migration (requirements)', () => {
  /** A Phase 2 (schema v2) workspace: string objectives, processes, no requirements. */
  async function v2Workspace() {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const { requirements: _r, requirementSequence: _s, userStories: _u, storySequence: _us, risks: _k, riskSequence: _ks, ...v2 } = createDemoWorkspace(NOW);
    return { ...v2, project: { ...v2.project, objectives: v2.project.objectives.map((o) => o.text) } };
  }

  it('upgrades v2 data: objectives get stable ids, processes are kept, requirements start empty', async () => {
    const v2 = await v2Workspace();
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 2, savedAt: NOW, workspace: v2 }));

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('loaded');
    expect(result.workspace.project.objectives).toEqual(v2.project.objectives.map((text, i) => ({ id: `obj_m${i + 1}`, text })));
    expect(result.workspace.processes).toEqual(v2.processes);
    expect(result.workspace.bottlenecks).toEqual(v2.bottlenecks);
    expect(result.workspace.improvements).toEqual(v2.improvements);
    expect(result.workspace.stakeholders).toEqual(v2.stakeholders);
    expect(result.workspace.requirements).toEqual([]);
    expect(result.workspace.requirementSequence).toEqual({ functional: 0, nonFunctional: 0 });
  });

  it('is idempotent', async () => {
    const once = migrateV2toV3(await v2Workspace());
    expect(migrateV2toV3(once)).toEqual(once);
    expect(migrateV2toV3(migrateV2toV3(await v2Workspace()))).toEqual(once);
  });

  it('chains v1 -> v2 -> v3', () => {
    const { processes: _p, bottlenecks: _b, improvements: _i, requirements: _r, requirementSequence: _s, ...v1 } = createBlankWorkspace(NOW);
    const migrated = migrate({ schemaVersion: 1, workspace: { ...v1, project: { ...v1.project, objectives: ['One', 'Two'] } } }) as Record<string, unknown>;
    expect((migrated.project as { objectives: unknown }).objectives).toEqual([
      { id: 'obj_m1', text: 'One' },
      { id: 'obj_m2', text: 'Two' },
    ]);
    expect(migrated.processes).toEqual([]);
    expect(migrated.requirements).toEqual([]);
  });

  it('backs up a workspace with an invalid requirement and sets only that requirement aside', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const raw = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      savedAt: NOW,
      workspace: { ...ws, requirements: [{ ...ws.requirements[0], priority: 'urgent' }] },
    });
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const result = loadWorkspace(storage, NOW);
    // Before: the whole workspace was replaced with demo data. Now the user's records are kept.
    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(result.issues).toContain('1 requirement could not be read and was set aside: FR-001.');
    expect(result.workspace.requirements).toEqual([]);
    expect(result.workspace.stakeholders).toEqual(ws.stakeholders);
    expect(result.workspace.userStories.map((s) => s.identifier)).toEqual(ws.userStories.map((s) => s.identifier));
    // The counter is kept, so FR-001 is never reissued.
    expect(result.workspace.requirementSequence).toEqual(ws.requirementSequence);
  });

  it('persists requirements and the identifier sequence across save and load', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    // Remove a requirement nothing links to, as the app's own delete rules require.
    const unlinked = ws.requirements.find(
      (r) =>
        !ws.userStories.some((s) => s.requirementIds.includes(r.id)) &&
        !ws.requirements.some((o) => o.dependencyIds.includes(r.id)) &&
        !ws.risks.some((k) => k.links.requirementIds.includes(r.id)),
    )!;
    const changed = { ...ws, requirements: ws.requirements.filter((r) => r !== unlinked), requirementSequence: { functional: 21, nonFunctional: 9 } };
    const storage = new MemoryStorage();
    saveWorkspace(storage, changed, NOW);
    const loaded = loadWorkspace(storage, NOW);
    expect(loaded.status).toBe('loaded');
    expect(loaded.workspace.requirements).toHaveLength(26);
    expect(loaded.workspace.requirementSequence).toEqual({ functional: 21, nonFunctional: 9 });
  });
});

describe('schema v4 migration (user stories)', () => {
  /** A Phase 3 (schema v3) workspace: requirements and their counters, no stories. */
  async function v3Workspace() {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const { userStories: _u, storySequence: _s, risks: _k, riskSequence: _ks, ...v3 } = createDemoWorkspace(NOW);
    return { ...v3, requirementSequence: { functional: 17, nonFunctional: 9 } };
  }

  it('upgrades v3 data without touching existing records or the requirement counters', async () => {
    const v3 = await v3Workspace();
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 3, savedAt: NOW, workspace: v3 }));

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('loaded');
    expect(result.workspace.requirements).toEqual(v3.requirements);
    expect(result.workspace.requirementSequence).toEqual({ functional: 17, nonFunctional: 9 });
    expect(result.workspace.processes).toEqual(v3.processes);
    expect(result.workspace.project).toEqual(v3.project);
    expect(result.workspace.userStories).toEqual([]);
    expect(result.workspace.storySequence).toBe(0);
  });

  it('is idempotent and never resets an existing story counter', async () => {
    const once = migrateV3toV4(await v3Workspace());
    expect(migrateV3toV4(once)).toEqual(once);
    const withStories = { ...(once as object), storySequence: 22 };
    expect((migrateV3toV4(withStories) as { storySequence: number }).storySequence).toBe(22);
  });

  it('chains v1 -> v4', () => {
    const { processes: _p, bottlenecks: _b, improvements: _i, requirements: _r, requirementSequence: _rs, userStories: _u, storySequence: _s, ...v1 } =
      createBlankWorkspace(NOW);
    const migrated = migrate({ schemaVersion: 1, workspace: { ...v1, project: { ...v1.project, objectives: ['One'] } } }) as Record<string, unknown>;
    expect(migrated.userStories).toEqual([]);
    expect(migrated.storySequence).toBe(0);
    expect(migrated.requirements).toEqual([]);
  });

  it('persists stories, criteria and the story counter across save and load', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    // Remove a story no risk links to, as deleting a story through the app also unlinks it from risks.
    const unlinked = ws.userStories.find((s) => !ws.risks.some((k) => k.links.storyIds.includes(s.id)))!;
    const changed = { ...ws, userStories: ws.userStories.filter((s) => s !== unlinked), storySequence: 30 };
    const storage = new MemoryStorage();
    saveWorkspace(storage, changed, NOW);
    const loaded = loadWorkspace(storage, NOW);
    expect(loaded.status).toBe('loaded');
    expect(loaded.workspace.userStories).toEqual(changed.userStories);
    expect(loaded.workspace.storySequence).toBe(30);
  });

  it('backs up a workspace containing an invalid user story', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const [first] = ws.userStories;
    const raw = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      savedAt: NOW,
      workspace: { ...ws, userStories: [{ ...first, criteria: [{ ...first!.criteria[0], verification: 'maybe' }] }] },
    });
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const result = loadWorkspace(storage, NOW);
    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(result.issues).toContain(`1 user story could not be read and was set aside: ${first!.identifier}.`);
    expect(result.workspace.userStories).toEqual([]);
    expect(result.workspace.requirements).toEqual(ws.requirements);
  });
});

describe('schema v5 migration (risks)', () => {
  /** A Phase 4 (schema v4) workspace: everything up to user stories, no risks. */
  async function v4Workspace() {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const { risks: _k, riskSequence: _ks, ...v4 } = createDemoWorkspace(NOW);
    return { ...v4, storySequence: 31, requirementSequence: { functional: 20, nonFunctional: 9 } };
  }

  it('upgrades v4 data with an empty risk register and preserves every earlier record and counter', async () => {
    const v4 = await v4Workspace();
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 4, savedAt: NOW, workspace: v4 }));

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('loaded');
    expect(result.workspace.risks).toEqual([]);
    expect(result.workspace.riskSequence).toBe(0);
    expect(result.workspace.userStories).toEqual(v4.userStories);
    expect(result.workspace.requirements).toEqual(v4.requirements);
    expect(result.workspace.stakeholders).toEqual(v4.stakeholders);
    expect(result.workspace.processes).toEqual(v4.processes);
    expect(result.workspace.project).toEqual(v4.project);
    expect(result.workspace.storySequence).toBe(31);
    expect(result.workspace.requirementSequence).toEqual({ functional: 20, nonFunctional: 9 });
  });

  it('is idempotent and never resets an existing risk counter', async () => {
    const once = migrateV4toV5(await v4Workspace());
    expect(migrateV4toV5(once)).toEqual(once);
    expect((migrateV4toV5({ ...(once as object), riskSequence: 40 }) as { riskSequence: number }).riskSequence).toBe(40);
  });

  it('chains v1 -> v5', () => {
    const { processes: _p, bottlenecks: _b, improvements: _i, requirements: _r, requirementSequence: _rs, userStories: _u, storySequence: _s, risks: _k, riskSequence: _ks, ...v1 } =
      createBlankWorkspace(NOW);
    const migrated = migrate({ schemaVersion: 1, workspace: { ...v1, project: { ...v1.project, objectives: ['One'] } } }) as Record<string, unknown>;
    expect(migrated.risks).toEqual([]);
    expect(migrated.riskSequence).toBe(0);
    expect(migrated.userStories).toEqual([]);
  });

  it('persists risks and the risk counter across save and load', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const changed = { ...ws, risks: ws.risks.slice(2), riskSequence: 30 };
    const storage = new MemoryStorage();
    saveWorkspace(storage, changed, NOW);
    const loaded = loadWorkspace(storage, NOW);
    expect(loaded.status).toBe('loaded');
    expect(loaded.workspace.risks).toEqual(changed.risks);
    expect(loaded.workspace.riskSequence).toBe(30);
  });

  it('backs up a workspace containing an out-of-range risk rating', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: { ...ws, risks: [{ ...ws.risks[0], impact: 7 }, ...ws.risks.slice(1)] } });
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    const result = loadWorkspace(storage, NOW);
    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(result.issues).toEqual(['1 risk could not be read and was set aside: RSK-001.']);
    expect(result.workspace.risks).toEqual(ws.risks.slice(1));
    // The repaired workspace was saved, so the next load is clean.
    expect(loadWorkspace(storage, NOW).status).toBe('loaded');
  });
});

describe('loading with broken relationships', () => {
  /** Storage where backups cannot be written (e.g. it is nearly full) but the main key can. */
  class NoBackupStorage extends MemoryStorage {
    override setItem(key: string, value: string): void {
      if (key.startsWith(BACKUP_KEY_PREFIX)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      super.setItem(key, value);
    }
  }

  async function brokenWorkspace() {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const [first, ...rest] = ws.userStories;
    // A story linked to a requirement that does not exist, as could happen if storage were edited by hand.
    return { ws, broken: { ...ws, userStories: [{ ...first!, requirementIds: [...first!.requirementIds, 'req_gone'] }, ...rest] } };
  }

  it('loads a valid workspace unchanged without writing anything', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const storage = new MemoryStorage();
    saveWorkspace(storage, createDemoWorkspace(NOW), NOW);
    const before = storage.getItem(STORAGE_KEY);

    const result = loadWorkspace(storage, '2026-02-01T00:00:00.000Z');

    expect(result.status).toBe('loaded');
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
  });

  it('repairs broken links after backing up the original, then loads cleanly', async () => {
    const { ws, broken } = await brokenWorkspace();
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: broken });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(result.dataChanged).toBe(true);
    expect(result.issues).toEqual([`${ws.userStories[0]!.identifier}: 1 link to requirements that no longer exist was removed.`]);
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(result.workspace.userStories[0]!.requirementIds).toEqual(ws.userStories[0]!.requirementIds);
    // Every other record is exactly as saved.
    expect(result.workspace.userStories.slice(1)).toEqual(ws.userStories.slice(1));
    expect(result.workspace.requirements).toEqual(ws.requirements);
    expect(result.workspace.risks).toEqual(ws.risks);
    expect(loadWorkspace(storage, NOW).status).toBe('loaded');
  });

  it('leaves storage untouched when the backup cannot be written', async () => {
    const { broken } = await brokenWorkspace();
    const storage = new NoBackupStorage();
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: broken });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(result.dataChanged).toBe(true);
    expect(result.backupKey).toBeNull();
    // Repairs exist in memory only; the original stays in storage until the user saves.
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
  });

  it('also leaves storage untouched when malformed records are set aside but the backup fails', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const storage = new NoBackupStorage();
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: { ...ws, risks: [{ ...ws.risks[0], impact: 7 }, ...ws.risks.slice(1)] } });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(result.backupKey).toBeNull();
    expect(result.workspace.risks).toHaveLength(ws.risks.length - 1);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('reports problems it cannot repair without writing anything', async () => {
    const { createDemoWorkspace } = await import('../data/demoWorkspace');
    const ws = createDemoWorkspace(NOW);
    const [first, ...rest] = ws.risks;
    const unrepairable = { ...ws, risks: [{ ...first!, owner: { stakeholderId: 'stk_gone', customName: '' } }, ...rest] };
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: NOW, workspace: unrepairable });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(result.dataChanged).toBe(false);
    expect(result.backupKey).toBeNull();
    expect(result.workspace).toEqual(unrepairable);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
  });

  it('repairs a migrated older workspace and saves it in the current schema after backing it up', async () => {
    const { broken } = await brokenWorkspace();
    const { risks: _k, riskSequence: _ks, ...v4 } = broken;
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ schemaVersion: 4, savedAt: NOW, workspace: v4 });
    storage.setItem(STORAGE_KEY, raw);

    const result = loadWorkspace(storage, NOW);

    expect(result.status).toBe('repaired');
    if (result.status !== 'repaired') return;
    expect(storage.getItem(result.backupKey!)).toBe(raw);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.workspace.risks).toEqual([]);
  });
});
