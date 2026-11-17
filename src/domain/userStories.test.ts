import { describe, expect, it } from 'vitest';
import type { UserStory, Workspace } from './types';
import {
  EMPTY_STORY_FILTER,
  applyStoryUpdate,
  countStoriesByStatus,
  createEmptyCriterion,
  createEmptyStoryInput,
  createUserStory,
  filterStories,
  findVagueTerms,
  formatStoryStatement,
  indefiniteArticle,
  isStoryValid,
  moveItem,
  nextStoryIdentifier,
  setCriterionVerification,
  sortStories,
  storiesForRequirement,
  storiesForStakeholder,
  stripGherkinKeyword,
  toStoryInput,
  validateCriterion,
  validateStory,
  type CriterionInput,
  type StoryInput,
} from './userStories';
import { formatNumbered, nextNumber, parseNumbered } from './identifiers';
import { createDemoWorkspace } from '../data/demoWorkspace';
import { workspaceReducer } from '../state/workspaceReducer';

const NOW = '2026-06-01T09:00:00.000Z';
const LATER = '2026-06-02T09:00:00.000Z';

function criterion(overrides: Partial<CriterionInput> = {}): CriterionInput {
  return { ...createEmptyCriterion(), title: 'Saved', given: 'a form', when: 'it is submitted', then: 'a reference is shown', ...overrides };
}

function input(overrides: Partial<StoryInput> = {}): StoryInput {
  return {
    ...createEmptyStoryInput(),
    title: 'Book a visit',
    persona: { stakeholderId: 'stk_demo_dispatch', label: 'Service Coordinator' },
    need: 'to book visits',
    benefit: 'customers get a time',
    requirementIds: ['req_demo_fr004'],
    ...overrides,
  };
}

function add(ws: Workspace, values: Partial<StoryInput> = {}): { ws: Workspace; story: UserStory } {
  const { story, sequence } = createUserStory(input(values), ws, NOW);
  return { ws: workspaceReducer(ws, { type: 'story/added', story, sequence }), story };
}

const byIdentifier = (ws: Workspace, id: string) => ws.userStories.find((s) => s.identifier === id)!;

describe('numbered identifiers', () => {
  it('formats, parses and advances past both the counter and the highest in use', () => {
    expect(formatNumbered('US', 7)).toBe('US-007');
    expect(parseNumbered('US-012', 'US')).toBe(12);
    expect(parseNumbered('FR-012', 'US')).toBeNull();
    expect(nextNumber(3, ['US-001', 'US-009'], 'US')).toBe(10);
    expect(nextNumber(12, ['US-001'], 'US')).toBe(13);
  });
});

describe('user story identifiers', () => {
  it('continues the demo sequence and never reuses an identifier after deletion', () => {
    let ws = createDemoWorkspace(NOW);
    expect(nextStoryIdentifier(ws).identifier).toBe('US-019');
    ws = workspaceReducer(ws, { type: 'story/deleted', id: byIdentifier(ws, 'US-014').id });
    expect(nextStoryIdentifier(ws).identifier).toBe('US-019');
    const created = add(ws);
    expect(created.story.identifier).toBe('US-019');
    expect(created.ws.storySequence).toBe(19);
  });

  it('starts at US-001 in an empty workspace', () => {
    const ws: Workspace = { ...createDemoWorkspace(NOW), userStories: [], storySequence: 0 };
    expect(add(ws).story.identifier).toBe('US-001');
  });

  it('keeps identifier, creation date and existing criterion numbers when edited', () => {
    const ws = createDemoWorkspace(NOW);
    const original = byIdentifier(ws, 'US-006');
    const edited = applyStoryUpdate(original, { ...toStoryInput(original), title: 'Renamed' }, LATER);
    expect(edited).toMatchObject({ id: original.id, identifier: 'US-006', createdAt: NOW, updatedAt: LATER, title: 'Renamed' });
    expect(edited.criteria.map((c) => c.number)).toEqual([1, 2, 3]);
  });
});

describe('story statement', () => {
  it('is built from role, need and benefit', () => {
    expect(formatStoryStatement({ persona: { stakeholderId: null, label: 'Service Coordinator' }, need: 'to see availability', benefit: 'conflicts are reduced' })).toBe(
      'As a Service Coordinator, I want to see availability, so that conflicts are reduced.',
    );
  });

  it('uses "an" where needed and tolerates typed lead-in words', () => {
    expect(indefiniteArticle('Operations Manager')).toBe('an');
    expect(indefiniteArticle('IT Manager')).toBe('an');
    expect(indefiniteArticle('user')).toBe('a');
    expect(formatStoryStatement({ persona: { stakeholderId: null, label: 'Operations Manager' }, need: 'I want a dashboard.', benefit: 'So that I can plan.' })).toBe(
      'As an Operations Manager, I want a dashboard, so that I can plan.',
    );
  });
});

describe('story validation', () => {
  const ws = createDemoWorkspace(NOW);

  it('requires title, user role, need, benefit and at least one requirement', () => {
    const { errors } = validateStory(createEmptyStoryInput(), ws);
    expect(Object.keys(errors).sort()).toEqual(['benefit', 'need', 'persona', 'requirementIds', 'title']);
    expect(errors.requirementIds).toBe('Link at least one requirement.');
  });

  it('accepts a valid story with a stakeholder role or a custom persona', () => {
    expect(isStoryValid(validateStory(input(), ws))).toBe(true);
    expect(isStoryValid(validateStory(input({ persona: { stakeholderId: null, label: 'Site visitor' } }), ws))).toBe(true);
  });

  it('rejects missing stakeholders, missing or duplicate requirements, and invalid priority/status', () => {
    expect(validateStory(input({ persona: { stakeholderId: 'stk_gone', label: 'X' } }), ws).errors.persona).toMatch(/no longer exists/);
    expect(validateStory(input({ requirementIds: ['req_gone'] }), ws).errors.requirementIds).toMatch(/no longer exist/);
    expect(validateStory(input({ requirementIds: ['req_demo_fr004', 'req_demo_fr004'] }), ws).errors.requirementIds).toMatch(/once/);
    const bad = validateStory(input({ priority: 'urgent' as never, status: 'done' as never }), ws).errors;
    expect(bad.priority).toBeDefined();
    expect(bad.status).toBeDefined();
  });

  it('rejects incomplete Given/When/Then criteria and reports which one', () => {
    const incomplete = criterion({ then: '  ' });
    const result = validateStory(input({ criteria: [criterion(), incomplete] }), ws);
    expect(result.errors.criteria).toMatch(/criterion 2 is incomplete/);
    expect(result.criteria[incomplete.id]).toEqual({ then: 'Describe the expected, observable outcome (Then).' });
  });

  it('treats a field containing only the Gherkin keyword as empty', () => {
    expect(validateCriterion(criterion({ given: 'Given ', when: 'WHEN,' })).given).toBeDefined();
    expect(validateCriterion(criterion({ given: 'Given ', when: 'WHEN,' })).when).toBeDefined();
    expect(stripGherkinKeyword('Then: the reference is shown', 'then')).toBe('the reference is shown');
    expect(stripGherkinKeyword('Thereafter it closes', 'then')).toBe('Thereafter it closes');
  });
});

describe('acceptance criteria', () => {
  it('default to Not Tested and are never marked passed automatically', () => {
    expect(createEmptyCriterion().verification).toBe('not-tested');
    const ws = createDemoWorkspace(NOW);
    const { story } = add(ws, { criteria: [criterion(), criterion({ title: 'Second' })] });
    expect(story.criteria.map((c) => c.verification)).toEqual(['not-tested', 'not-tested']);
  });

  it('get stable numbers that are not reused after deletion and survive reordering', () => {
    const ws = createDemoWorkspace(NOW);
    const { story } = add(ws, { criteria: [criterion({ title: 'A' }), criterion({ title: 'B' }), criterion({ title: 'C' })] });
    expect(story.criteria.map((c) => [c.title, c.number])).toEqual([['A', 1], ['B', 2], ['C', 3]]);

    // Remove C, move B up, add D: B keeps 2, A keeps 1, D gets 4 (3 is not reused).
    const edited = toStoryInput(story);
    const withoutC = edited.criteria.slice(0, 2);
    const reordered = moveItem(withoutC, 1, -1);
    const updated = applyStoryUpdate(story, { ...edited, criteria: [...reordered, criterion({ title: 'D' })] }, LATER);
    expect(updated.criteria.map((c) => [c.title, c.number])).toEqual([['B', 2], ['A', 1], ['D', 4]]);
    expect(updated.criterionSequence).toBe(4);
  });

  it('strip typed keywords and trim text when saved', () => {
    const ws = createDemoWorkspace(NOW);
    const { story } = add(ws, { criteria: [criterion({ given: ' Given a form ', when: 'When saved', then: 'THEN a reference is shown' })] });
    expect(story.criteria[0]).toMatchObject({ given: 'a form', when: 'saved', then: 'a reference is shown' });
  });

  it('records a verification status without changing anything else', () => {
    const story = byIdentifier(createDemoWorkspace(NOW), 'US-003');
    const target = story.criteria[1]!;
    const updated = setCriterionVerification(story, target.id, 'failed', LATER);
    expect(updated.criteria.map((c) => c.verification)).toEqual(['not-tested', 'failed']);
    expect(updated.status).toBe(story.status);
    expect(updated.updatedAt).toBe(LATER);
    expect(setCriterionVerification(story, 'missing', 'passed', LATER)).toBe(story);
  });

  it('flags vague wording as a hint only', () => {
    expect(findVagueTerms('The system should work properly and be user-friendly')).toEqual(['properly', 'user-friendly']);
    expect(findVagueTerms('the appointment appears in the technician schedule')).toEqual([]);
    expect(findVagueTerms('Display a breakfast menu')).toEqual([]);
    expect(findVagueTerms('It is user friendly')).toEqual(['user-friendly']);
  });
});

describe('relationships', () => {
  const ws = createDemoWorkspace(NOW);
  const ids = (stories: UserStory[]) => stories.map((s) => s.identifier);

  it('supports several stories per requirement and several requirements per story', () => {
    expect(ids(storiesForRequirement(ws, 'req_demo_fr008'))).toEqual(['US-008', 'US-009']);
    expect(ids(storiesForRequirement(ws, 'req_demo_fr006'))).toEqual(['US-006', 'US-014']);
    expect(byIdentifier(ws, 'US-004').requirementIds).toEqual(['req_demo_fr004', 'req_demo_fr003']);
    expect(storiesForRequirement(ws, 'req_demo_fr012')).toEqual([]);
  });

  it('finds stories by persona stakeholder', () => {
    expect(ids(storiesForStakeholder(ws, 'stk_demo_warehouse'))).toEqual(['US-007', 'US-018']);
    expect(storiesForStakeholder(ws, 'stk_demo_health_safety')).toEqual([]);
  });

  it('keeps story priority independent of the linked requirement', () => {
    const story = byIdentifier(ws, 'US-009');
    const requirement = ws.requirements.find((r) => r.id === story.requirementIds[0])!;
    expect([story.priority, requirement.priority]).toEqual(['could', 'should']);
  });

  it('refuses to delete a requirement or stakeholder that stories reference, but deleting a story leaves requirements', () => {
    expect(workspaceReducer(ws, { type: 'requirement/deleted', id: 'req_demo_fr001', now: LATER })).toBe(ws);
    expect(workspaceReducer(ws, { type: 'stakeholder/deleted', id: 'stk_demo_warehouse' })).toBe(ws);
    const afterStoryDelete = workspaceReducer(ws, { type: 'story/deleted', id: 'us_demo_001' });
    expect(afterStoryDelete.requirements).toEqual(ws.requirements);
    expect(afterStoryDelete.userStories).toHaveLength(17);
  });
});

describe('register filtering, sorting and counts', () => {
  const ws = createDemoWorkspace(NOW);
  const ids = (stories: UserStory[]) => stories.map((s) => s.identifier);

  it('searches identifier, title and user role', () => {
    expect(ids(filterStories(ws.userStories, { ...EMPTY_STORY_FILTER, query: 'us-01' }))).toEqual(['US-010', 'US-011', 'US-012', 'US-013', 'US-014', 'US-015', 'US-016', 'US-017', 'US-018']);
    expect(ids(filterStories(ws.userStories, { ...EMPTY_STORY_FILTER, query: 'SPARE' }))).toEqual(['US-007']);
    expect(ids(filterStories(ws.userStories, { ...EMPTY_STORY_FILTER, query: 'it manager' }))).toEqual(['US-013']);
  });

  it('filters by requirement, priority and status', () => {
    expect(ids(filterStories(ws.userStories, { ...EMPTY_STORY_FILTER, requirementId: 'req_demo_fr003' }))).toEqual(['US-003', 'US-004']);
    expect(ids(filterStories(ws.userStories, { ...EMPTY_STORY_FILTER, priority: 'could' }))).toEqual(['US-009', 'US-012', 'US-018']);
    expect(ids(filterStories(ws.userStories, { ...EMPTY_STORY_FILTER, status: 'ready' }))).toEqual(['US-003', 'US-004']);
  });

  it('sorts and counts by status', () => {
    expect(sortStories([...ws.userStories].reverse(), 'identifier')[0]!.identifier).toBe('US-001');
    expect(sortStories(ws.userStories, 'priority')[0]!.priority).toBe('must');
    expect(sortStories(ws.userStories, 'status')[0]!.status).toBe('draft');
    expect(countStoriesByStatus(ws.userStories)).toEqual({
      draft: 3,
      proposed: 5,
      'under-review': 5,
      approved: 2,
      ready: 2,
      implemented: 1,
      deferred: 0,
    });
  });
});

describe('demonstration stories', () => {
  const ws = createDemoWorkspace(NOW);

  it('has 18 valid stories with 1–3 well-formed criteria each', () => {
    expect(ws.userStories).toHaveLength(18);
    expect(ws.storySequence).toBe(18);
    for (const story of ws.userStories) {
      expect(isStoryValid(validateStory(toStoryInput(story), ws))).toBe(true);
      expect(story.criteria.length).toBeGreaterThanOrEqual(1);
      expect(story.criteria.length).toBeLessThanOrEqual(3);
      for (const c of story.criteria) expect(findVagueTerms(c.then)).toEqual([]);
    }
  });

  it('marks only a few criteria with a verification outcome, each with an explanatory note', () => {
    const verified = ws.userStories.flatMap((s) => s.criteria).filter((c) => c.verification !== 'not-tested');
    expect(verified.map((c) => c.verification).sort()).toEqual(['blocked', 'failed', 'passed', 'passed']);
    for (const c of verified) expect(c.notes).toMatch(/Fictional pilot review record/);
  });
});
