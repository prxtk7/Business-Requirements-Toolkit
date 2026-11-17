import { describe, expect, it } from 'vitest';
import type { Workspace } from './types';
import { repairRelationships, salvageWorkspace } from './integrity';
import { createBlankWorkspace, isWorkspace } from './workspace';
import { createDemoWorkspace } from '../data/demoWorkspace';

const NOW = '2026-06-01T08:00:00.000Z';
const LATER = '2026-06-02T08:00:00.000Z';

const demo = () => createDemoWorkspace(NOW);
const req = (ws: Workspace, identifier: string) => ws.requirements.find((r) => r.identifier === identifier)!;
const story = (ws: Workspace, identifier: string) => ws.userStories.find((s) => s.identifier === identifier)!;
const risk = (ws: Workspace, identifier: string) => ws.risks.find((r) => r.identifier === identifier)!;
/** Replace one record (matched by id) in a collection. */
function withRecord<K extends 'requirements' | 'userStories' | 'risks' | 'processes'>(ws: Workspace, key: K, record: Workspace[K][number]): Workspace {
  return { ...ws, [key]: (ws[key] as { id: string }[]).map((r) => (r.id === record.id ? record : r)) };
}

describe('repairRelationships', () => {
  it('leaves valid workspaces untouched (same object, no issues)', () => {
    for (const ws of [demo(), createBlankWorkspace(NOW)]) {
      const result = repairRelationships(ws, LATER);
      expect(result).toEqual({ workspace: ws, issues: [], changed: false });
      expect(result.workspace).toBe(ws);
    }
  });

  it('removes requirement links to missing stakeholders, objectives, steps and requirements', () => {
    const ws = demo();
    const fr004 = req(ws, 'FR-004');
    const broken = withRecord(ws, 'requirements', {
      ...fr004,
      sourceStakeholderId: 'stk_gone',
      objectiveIds: [...fr004.objectiveIds, 'obj_gone'],
      stepIds: [...fr004.stepIds, 'stp_gone'],
      dependencyIds: [...fr004.dependencyIds, 'req_gone', fr004.id],
    });

    const { workspace, issues, changed } = repairRelationships(broken, LATER);

    expect(changed).toBe(true);
    const repaired = req(workspace, 'FR-004');
    expect(repaired).toEqual({ ...fr004, sourceStakeholderId: null, updatedAt: LATER });
    expect(issues).toEqual([
      'FR-004: its source stakeholder no longer exists, so the source was cleared; 4 links to missing or invalid records were removed.',
    ]);
    // Other records are the same objects: nothing else was touched.
    expect(workspace.requirements.filter((r) => r.id !== fr004.id)).toEqual(ws.requirements.filter((r) => r.id !== fr004.id));
    expect(workspace.stakeholders).toBe(ws.stakeholders);
  });

  it('reports circular requirement dependencies without changing them', () => {
    const ws = demo();
    const fr001 = req(ws, 'FR-001');
    const fr003 = req(ws, 'FR-003');
    const cyclic = withRecord(withRecord(ws, 'requirements', { ...fr001, dependencyIds: [fr003.id] }), 'requirements', { ...fr003, dependencyIds: [fr001.id] });

    const result = repairRelationships(cyclic, LATER);

    expect(result.changed).toBe(false);
    expect(result.workspace).toBe(cyclic);
    expect(result.issues).toEqual([
      'Requirements form a circular dependency chain (FR-001 → FR-003 → FR-001). Kept as is; edit one of them to break the chain.',
    ]);
  });

  it('removes story links to missing requirements and keeps a missing user role as a custom persona', () => {
    const ws = demo();
    const us = ws.userStories[0]!;
    const broken = withRecord(ws, 'userStories', {
      ...us,
      requirementIds: [...us.requirementIds, 'req_gone'],
      persona: { stakeholderId: 'stk_gone', label: 'Night shift dispatcher' },
    });

    const { workspace, issues } = repairRelationships(broken, LATER);

    const repaired = story(workspace, us.identifier);
    expect(repaired.requirementIds).toEqual(us.requirementIds);
    expect(repaired.persona).toEqual({ stakeholderId: null, label: 'Night shift dispatcher' });
    expect(repaired.criteria).toEqual(us.criteria);
    expect(issues).toEqual([
      `${us.identifier}: 1 link to requirements that no longer exist was removed; its user role stakeholder no longer exists, so "Night shift dispatcher" is kept as a custom persona.`,
    ]);
  });

  it('says when a story is left without any linked requirement', () => {
    const ws = demo();
    const us = ws.userStories[0]!;
    const { issues } = repairRelationships(withRecord(ws, 'userStories', { ...us, requirementIds: ['req_gone'] }), LATER);
    expect(issues[0]).toContain('(link a requirement before the story can be saved again)');
  });

  it('clears a missing TO-BE baseline and step links outside the baseline', () => {
    const ws = demo();
    const toBe = ws.processes.find((p) => p.type === 'to-be')!;
    const broken = withRecord(ws, 'processes', { ...toBe, baselineProcessId: 'prc_gone' });

    const { workspace, issues } = repairRelationships(broken, LATER);

    const repaired = workspace.processes.find((p) => p.id === toBe.id)!;
    expect(repaired.baselineProcessId).toBeNull();
    expect(repaired.steps.every((s) => s.sourceStepIds.length === 0)).toBe(true);
    // Step content is otherwise kept.
    expect(repaired.steps.map((s) => [s.id, s.name, s.change])).toEqual(toBe.steps.map((s) => [s.id, s.name, s.change]));
    expect(issues[0]).toMatch(new RegExp(`^Process "${toBe.name}": its AS-IS baseline no longer exists, so the baseline was cleared; \\d+ step links? to AS-IS steps outside its baseline (was|were) removed\\.$`));
  });

  it('prunes risk links to missing records and reports a missing owner without changing it', () => {
    const ws = demo();
    const rsk = risk(ws, 'RSK-002');
    const broken = withRecord(ws, 'risks', {
      ...rsk,
      owner: { stakeholderId: 'stk_gone', customName: '' },
      links: { ...rsk.links, storyIds: [...rsk.links.storyIds, 'us_gone'], stepIds: [...rsk.links.stepIds, 'stp_gone'] },
    });

    const { workspace, issues } = repairRelationships(broken, LATER);

    const repaired = risk(workspace, 'RSK-002');
    expect(repaired.links).toEqual(rsk.links);
    expect(repaired.owner).toEqual({ stakeholderId: 'stk_gone', customName: '' });
    expect(issues).toEqual([
      'RSK-002: its owner is a stakeholder that no longer exists. Kept as is; assign an owner when you next edit the risk.',
      'RSK-002: 2 links to records that no longer exist were removed.',
    ]);
  });

  it('reports, but keeps, steps with a missing responsible stakeholder and findings on missing steps', () => {
    const ws = demo();
    const process = ws.processes[0]!;
    const step = process.steps[0]!;
    const broken: Workspace = {
      ...withRecord(ws, 'processes', { ...process, steps: [{ ...step, responsible: { type: 'stakeholder', stakeholderId: 'stk_gone' } }, ...process.steps.slice(1)] }),
      bottlenecks: [...ws.bottlenecks, { ...ws.bottlenecks[0]!, id: 'btl_orphan', stepId: 'stp_gone' }],
    };

    const result = repairRelationships(broken, LATER);

    expect(result.changed).toBe(false);
    expect(result.workspace).toBe(broken);
    expect(result.issues).toEqual([
      `Process "${process.name}": 1 step names a responsible stakeholder that no longer exists. Kept as is; choose who is responsible when you next edit that step.`,
      '1 bottleneck refers to process steps that no longer exist. It is kept in saved data but is not shown on any process.',
    ]);
  });
});

describe('salvageWorkspace', () => {
  it('sets aside malformed and duplicate records and keeps everything readable', () => {
    const ws = demo();
    const [first, second, ...rest] = ws.risks;
    const value = {
      ...ws,
      risks: [first, { ...second, probability: 9 }, { ...first, identifier: 'RSK-099' }, ...rest],
      stakeholders: [...ws.stakeholders, { name: 'Broken record' }],
    };

    const result = salvageWorkspace(value, LATER)!;

    expect(result.changed).toBe(true);
    expect(isWorkspace(result.workspace)).toBe(true);
    expect(result.workspace.risks.map((r) => r.identifier)).toEqual([first!.identifier, ...rest.map((r) => r.identifier)]);
    expect(result.workspace.stakeholders).toEqual(ws.stakeholders);
    expect(result.workspace.requirements).toEqual(ws.requirements);
    expect(result.issues).toEqual([
      '1 stakeholder could not be read and was set aside: "Broken record".',
      `2 risks could not be read and were set aside: ${second!.identifier}, RSK-099 (duplicate).`,
    ]);
  });

  it('resets an unreadable project overview and counters without losing other records', () => {
    const ws = demo();
    const value = { ...ws, project: { name: 42 }, riskSequence: 'twelve', requirementSequence: null };

    const result = salvageWorkspace(value, LATER)!;

    expect(result.workspace.project.name).toBe('');
    expect(result.workspace.stakeholders).toEqual(ws.stakeholders);
    // Counters continue after the highest identifiers found, so none is reissued.
    expect(result.workspace.riskSequence).toBe(14);
    expect(result.workspace.requirementSequence).toEqual({ functional: 18, nonFunctional: 9 });
    expect(result.issues).toEqual([
      'The project overview could not be read and was reset to empty. Links from other records to its objectives were removed.',
      'The requirement numbering counters could not be read; numbering continues after the highest FR and NFR identifiers found.',
      'The risk numbering counter could not be read; numbering continues after the highest RSK identifier found.',
    ]);
  });

  it('counts set-aside records when rebuilding a counter', () => {
    const ws = demo();
    const last = ws.risks[ws.risks.length - 1]!;
    const result = salvageWorkspace({ ...ws, risks: [...ws.risks.slice(0, -1), { ...last, impact: 0 }], riskSequence: -1 }, LATER)!;
    expect(result.workspace.risks).toHaveLength(ws.risks.length - 1);
    expect(result.workspace.riskSequence).toBe(14);
  });

  it('gives up when the data is not recognisably a workspace', () => {
    const ws = demo();
    expect(salvageWorkspace(null, LATER)).toBeNull();
    expect(salvageWorkspace([], LATER)).toBeNull();
    expect(salvageWorkspace({ meta: {} }, LATER)).toBeNull();
    expect(salvageWorkspace({ ...ws, risks: 'broken' }, LATER)).toBeNull();
  });
});
