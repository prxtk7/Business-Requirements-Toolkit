import { describe, expect, it } from 'vitest';
import { workspaceReducer } from './workspaceReducer';
import { createBlankWorkspace } from '../domain/workspace';
import { createStakeholder } from '../domain/stakeholders';
import { createDemoWorkspace } from '../data/demoWorkspace';
import type { StakeholderInput } from '../domain/types';

const NOW = '2026-01-01T00:00:00.000Z';
const input: StakeholderInput = {
  name: 'Sam',
  role: 'Dispatcher',
  description: '',
  interest: 'high',
  influence: 'low',
  expectations: [],
};

describe('workspaceReducer', () => {
  it('adds a stakeholder without mutating the previous state', () => {
    const state = createBlankWorkspace(NOW);
    const stakeholder = createStakeholder(input, NOW, 'a');
    const next = workspaceReducer(state, { type: 'stakeholder/added', stakeholder });

    expect(next.stakeholders).toEqual([stakeholder]);
    expect(state.stakeholders).toEqual([]);
  });

  it('ignores an add with a duplicate id', () => {
    const stakeholder = createStakeholder(input, NOW, 'a');
    const state = workspaceReducer(createBlankWorkspace(NOW), { type: 'stakeholder/added', stakeholder });
    expect(workspaceReducer(state, { type: 'stakeholder/added', stakeholder })).toBe(state);
  });

  it('updates only the matching stakeholder', () => {
    let state = createBlankWorkspace(NOW);
    state = workspaceReducer(state, { type: 'stakeholder/added', stakeholder: createStakeholder(input, NOW, 'a') });
    state = workspaceReducer(state, {
      type: 'stakeholder/added',
      stakeholder: createStakeholder({ ...input, name: 'Kim' }, NOW, 'b'),
    });

    const changed = { ...state.stakeholders[0]!, name: 'Samira' };
    const next = workspaceReducer(state, { type: 'stakeholder/updated', stakeholder: changed });

    expect(next.stakeholders.map((s) => s.name)).toEqual(['Samira', 'Kim']);
  });

  it('returns the same state when updating or deleting an unknown id', () => {
    const state = createDemoWorkspace(NOW);
    const ghost = createStakeholder(input, NOW, 'ghost');
    expect(workspaceReducer(state, { type: 'stakeholder/updated', stakeholder: ghost })).toBe(state);
    expect(workspaceReducer(state, { type: 'stakeholder/deleted', id: 'ghost' })).toBe(state);
  });

  it('deletes a stakeholder by id', () => {
    const demo = createDemoWorkspace(NOW);
    const target = demo.stakeholders.find((s) => s.id === 'stk_demo_health_safety')!;
    // Every demo stakeholder is referenced somewhere; detach the two requirements sourced from this one first.
    const state = {
      ...demo,
      requirements: demo.requirements.map((r) => (r.sourceStakeholderId === target.id ? { ...r, sourceStakeholderId: null } : r)),
    };
    const next = workspaceReducer(state, { type: 'stakeholder/deleted', id: target.id });
    expect(next.stakeholders).toHaveLength(state.stakeholders.length - 1);
    expect(next.stakeholders.find((s) => s.id === target.id)).toBeUndefined();
  });

  it('saves the project and replaces the whole workspace', () => {
    const state = createBlankWorkspace(NOW);
    const project = { ...state.project, name: 'New' };
    expect(workspaceReducer(state, { type: 'project/saved', project }).project.name).toBe('New');

    const demo = createDemoWorkspace(NOW);
    expect(workspaceReducer(state, { type: 'workspace/replaced', workspace: demo })).toBe(demo);
  });

  it('refuses to delete a stakeholder referenced by a process step', () => {
    const state = createDemoWorkspace(NOW);
    expect(workspaceReducer(state, { type: 'stakeholder/deleted', id: 'stk_demo_dispatch' })).toBe(state);
  });

  it('deletes a process together with its bottlenecks', () => {
    const state = createDemoWorkspace(NOW);
    const toBeRemoved = workspaceReducer(state, { type: 'process/deleted', id: 'prc_demo_to_be' });
    expect(toBeRemoved.processes.map((p) => p.id)).toEqual(['prc_demo_as_is']);
    expect(toBeRemoved.improvements).toEqual([]);
    expect(toBeRemoved.bottlenecks).toHaveLength(state.bottlenecks.length);
  });

  it('deletes a step together with the findings recorded against it', () => {
    const state = createDemoWorkspace(NOW);
    const next = workspaceReducer(state, {
      type: 'step/deleted',
      processId: 'prc_demo_as_is',
      stepId: 'stp_demo_as_parts',
      now: NOW,
    });
    expect(next.processes[0]!.steps.some((s) => s.id === 'stp_demo_as_parts')).toBe(false);
    expect(next.bottlenecks.some((b) => b.stepId === 'stp_demo_as_parts')).toBe(false);
    expect(next.bottlenecks).toHaveLength(state.bottlenecks.length - 1);
  });

  it('upserts and deletes bottlenecks and improvements', () => {
    const state = createDemoWorkspace(NOW);
    const changed = { ...state.bottlenecks[0]!, title: 'Renamed' };
    const updated = workspaceReducer(state, { type: 'bottleneck/saved', bottleneck: changed });
    expect(updated.bottlenecks[0]!.title).toBe('Renamed');
    expect(updated.bottlenecks).toHaveLength(state.bottlenecks.length);

    const added = workspaceReducer(state, { type: 'improvement/saved', improvement: { ...state.improvements[0]!, id: 'imp_new' } });
    expect(added.improvements).toHaveLength(state.improvements.length + 1);
    const removed = workspaceReducer(added, { type: 'improvement/deleted', id: 'imp_new' });
    expect(removed.improvements).toHaveLength(state.improvements.length);
  });
});

describe('workspaceReducer: requirements', () => {
  it('adds a requirement and advances the identifier sequence', () => {
    const state = createDemoWorkspace(NOW);
    const requirement = { ...state.requirements[0]!, id: 'req_new', identifier: 'FR-019' };
    const next = workspaceReducer(state, {
      type: 'requirement/added',
      requirement,
      sequence: { functional: 19, nonFunctional: 9 },
    });
    expect(next.requirements).toHaveLength(28);
    expect(next.requirementSequence.functional).toBe(19);
  });

  it('refuses an add that would duplicate an identifier', () => {
    const state = createDemoWorkspace(NOW);
    const dup = { ...state.requirements[0]!, id: 'req_new' };
    expect(workspaceReducer(state, { type: 'requirement/added', requirement: dup, sequence: state.requirementSequence })).toBe(state);
  });

  it('updates a requirement and ignores unknown ids', () => {
    const state = createDemoWorkspace(NOW);
    const changed = { ...state.requirements[0]!, title: 'Changed' };
    expect(workspaceReducer(state, { type: 'requirement/updated', requirement: changed }).requirements[0]!.title).toBe('Changed');
    const ghost = { ...changed, id: 'req_ghost' };
    expect(workspaceReducer(state, { type: 'requirement/updated', requirement: ghost })).toBe(state);
  });

  it('refuses to delete a stakeholder who is the source of a requirement', () => {
    const state = createDemoWorkspace(NOW);
    // Kenji Watanabe (IT Manager) is not responsible for any step but is the source of NFRs.
    expect(workspaceReducer(state, { type: 'stakeholder/deleted', id: 'stk_demo_it' })).toBe(state);
  });
});

describe('workspaceReducer: user stories', () => {
  it('adds a story and advances the story counter; refuses duplicate identifiers', () => {
    const state = createDemoWorkspace(NOW);
    const story = { ...state.userStories[0]!, id: 'us_new', identifier: 'US-019' };
    const next = workspaceReducer(state, { type: 'story/added', story, sequence: 19 });
    expect(next.userStories).toHaveLength(19);
    expect(next.storySequence).toBe(19);
    const dup = { ...state.userStories[0]!, id: 'us_dup' };
    expect(workspaceReducer(state, { type: 'story/added', story: dup, sequence: 15 })).toBe(state);
  });

  it('updates a story and ignores unknown ids', () => {
    const state = createDemoWorkspace(NOW);
    const changed = { ...state.userStories[1]!, title: 'Changed' };
    expect(workspaceReducer(state, { type: 'story/updated', story: changed }).userStories[1]!.title).toBe('Changed');
    expect(workspaceReducer(state, { type: 'story/updated', story: { ...changed, id: 'us_ghost' } })).toBe(state);
  });

  it('refuses to delete a requirement linked by a story', () => {
    const state = createDemoWorkspace(NOW);
    expect(workspaceReducer(state, { type: 'requirement/deleted', id: 'req_demo_fr004', now: NOW })).toBe(state);
    // FR-012 has no stories, so the Phase 3 deletion still works.
    expect(workspaceReducer(state, { type: 'requirement/deleted', id: 'req_demo_fr012', now: NOW }).requirements).toHaveLength(26);
  });
});

describe('workspaceReducer: risks', () => {
  it('adds a risk and advances the risk counter; refuses duplicate identifiers', () => {
    const state = createDemoWorkspace(NOW);
    const risk = { ...state.risks[0]!, id: 'rsk_new', identifier: 'RSK-015' };
    const next = workspaceReducer(state, { type: 'risk/added', risk, sequence: 15 });
    expect(next.risks).toHaveLength(15);
    expect(next.riskSequence).toBe(15);
    expect(workspaceReducer(state, { type: 'risk/added', risk: { ...state.risks[0]!, id: 'rsk_dup' }, sequence: 15 })).toBe(state);
  });

  it('updates and deletes risks; ignores unknown ids', () => {
    const state = createDemoWorkspace(NOW);
    const changed = { ...state.risks[2]!, probability: 1 };
    expect(workspaceReducer(state, { type: 'risk/updated', risk: changed }).risks[2]!.probability).toBe(1);
    expect(workspaceReducer(state, { type: 'risk/updated', risk: { ...changed, id: 'rsk_ghost' } })).toBe(state);
    expect(workspaceReducer(state, { type: 'risk/deleted', id: state.risks[0]!.id }).risks).toHaveLength(13);
  });
});
