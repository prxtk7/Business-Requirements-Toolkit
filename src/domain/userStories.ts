import type {
  AcceptanceCriterion,
  RequirementPriority,
  StoryPersona,
  StoryStatus,
  UserStory,
  ValidationErrors,
  VerificationStatus,
  Workspace,
} from './types';
import {
  DEFAULT_STORY_STATUS,
  DEFAULT_VERIFICATION_STATUS,
  STORY_PREFIX,
  STORY_STATUSES,
  VAGUE_TERMS,
  isStoryStatus,
  isVerificationStatus,
} from './storyConfig';
import { REQUIREMENT_PRIORITIES, isRequirementPriority } from './requirementConfig';
import { createId } from './ids';
import { formatNumbered, nextNumber, parseNumbered } from './identifiers';
import { isBlank } from './text';

export const STORY_TITLE_MAX_LENGTH = 150;
export const PERSONA_MAX_LENGTH = 80;

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export function nextStoryIdentifier(workspace: Pick<Workspace, 'userStories' | 'storySequence'>) {
  const number = nextNumber(workspace.storySequence, workspace.userStories.map((s) => s.identifier), STORY_PREFIX);
  return { identifier: formatNumbered(STORY_PREFIX, number), sequence: number };
}

export function compareStoryIdentifiers(a: string, b: string): number {
  const na = parseNumbered(a, STORY_PREFIX);
  const nb = parseNumbered(b, STORY_PREFIX);
  return na !== null && nb !== null ? na - nb : a.localeCompare(b);
}

export function criterionLabel(criterion: Pick<AcceptanceCriterion, 'number'>): string {
  return `AC-${criterion.number}`;
}

// ---------------------------------------------------------------------------
// Statement
// ---------------------------------------------------------------------------

/** "a" or "an" for the persona label (simple vowel rule, with common exceptions). */
export function indefiniteArticle(word: string): 'a' | 'an' {
  const w = word.trim().toLowerCase();
  if (/^(uni|use|eu|one|u[bcfhjkqrst][aeiou])/.test(w)) return 'a';
  if (/^(hour|honest|honour|heir)/.test(w)) return 'an';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}

/** Remove a leading "I want (to)" / "so that" if the user typed it, and any trailing full stop. */
function stripLead(text: string, lead: RegExp): string {
  return text.trim().replace(lead, '').replace(/[.\s]+$/, '').trim();
}

export function normaliseNeed(need: string): string {
  return stripLead(need, /^i\s+want\s+/i);
}

export function normaliseBenefit(benefit: string): string {
  return stripLead(benefit, /^so\s+that\s+/i);
}

/** The full "As a …, I want …, so that …" statement, built from the stored parts. */
export function formatStoryStatement(story: Pick<UserStory, 'persona' | 'need' | 'benefit'>): string {
  const label = story.persona.label.trim() || '[user role]';
  const need = normaliseNeed(story.need) || '[capability]';
  const benefit = normaliseBenefit(story.benefit) || '[benefit]';
  return `As ${indefiniteArticle(label)} ${label}, I want ${need}, so that ${benefit}.`;
}

// ---------------------------------------------------------------------------
// Acceptance criteria
// ---------------------------------------------------------------------------

/** A criterion while editing: new criteria have no number until the story is saved. */
export type CriterionInput = Omit<AcceptanceCriterion, 'number'> & { number: number | null };

export function createEmptyCriterion(): CriterionInput {
  return {
    id: createId('ac'),
    number: null,
    title: '',
    given: '',
    when: '',
    then: '',
    notes: '',
    verification: DEFAULT_VERIFICATION_STATUS,
  };
}

export type CriterionErrors = Partial<Record<'title' | 'given' | 'when' | 'then' | 'verification', string>>;

/** Strip a leading Gherkin keyword the user may have typed ("Given ...", "WHEN, ..."). */
export function stripGherkinKeyword(text: string, keyword: 'given' | 'when' | 'then'): string {
  return text.trim().replace(new RegExp(`^${keyword}\\b[\\s,:]*`, 'i'), '').trim();
}

export function validateCriterion(c: CriterionInput): CriterionErrors {
  const errors: CriterionErrors = {};
  if (isBlank(c.title)) errors.title = 'Enter a short title.';
  if (stripGherkinKeyword(c.given, 'given') === '') errors.given = 'Describe the starting context (Given).';
  if (stripGherkinKeyword(c.when, 'when') === '') errors.when = 'Describe the action or event (When).';
  if (stripGherkinKeyword(c.then, 'then') === '') errors.then = 'Describe the expected, observable outcome (Then).';
  if (!isVerificationStatus(c.verification)) errors.verification = 'Select a verification status.';
  return errors;
}

/** Vague words found in a criterion's Then clause — a non-blocking writing hint. */
export function findVagueTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return VAGUE_TERMS.filter((term) => new RegExp(`(^|[^a-z-])${term.replace(/[-\s]/g, '[-\\s]')}($|[^a-z-])`).test(lower));
}

export function moveItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}

// ---------------------------------------------------------------------------
// Stories: input and validation
// ---------------------------------------------------------------------------

export interface StoryInput {
  title: string;
  persona: StoryPersona;
  need: string;
  benefit: string;
  description: string;
  requirementIds: string[];
  priority: RequirementPriority;
  status: StoryStatus;
  criteria: CriterionInput[];
}

export function createEmptyStoryInput(): StoryInput {
  return {
    title: '',
    persona: { stakeholderId: null, label: '' },
    need: '',
    benefit: '',
    description: '',
    requirementIds: [],
    priority: 'should',
    status: DEFAULT_STORY_STATUS,
    criteria: [],
  };
}

export function toStoryInput(story: UserStory): StoryInput {
  return {
    title: story.title,
    persona: { ...story.persona },
    need: story.need,
    benefit: story.benefit,
    description: story.description,
    requirementIds: [...story.requirementIds],
    priority: story.priority,
    status: story.status,
    criteria: story.criteria.map((c) => ({ ...c })),
  };
}

export type StoryErrors = ValidationErrors<StoryInput>;

export interface StoryValidation {
  errors: StoryErrors;
  /** Per-criterion errors keyed by criterion id. */
  criteria: Record<string, CriterionErrors>;
}

export function validateStory(input: StoryInput, workspace: Workspace): StoryValidation {
  const errors: StoryErrors = {};
  const title = input.title.trim();
  if (title.length === 0) errors.title = 'Enter a story title.';
  else if (title.length > STORY_TITLE_MAX_LENGTH) errors.title = `Title must be ${STORY_TITLE_MAX_LENGTH} characters or fewer.`;

  const label = input.persona.label.trim();
  if (label.length === 0) errors.persona = 'Enter the user role used in the story statement.';
  else if (label.length > PERSONA_MAX_LENGTH) errors.persona = `The user role must be ${PERSONA_MAX_LENGTH} characters or fewer.`;
  else if (input.persona.stakeholderId !== null && !workspace.stakeholders.some((s) => s.id === input.persona.stakeholderId)) {
    errors.persona = 'The selected stakeholder no longer exists. Choose another or use a custom persona.';
  }

  if (normaliseNeed(input.need) === '') errors.need = 'Describe what the user wants to do (I want …).';
  if (normaliseBenefit(input.benefit) === '') errors.benefit = 'Describe the benefit (so that …).';

  const requirementIds = new Set(workspace.requirements.map((r) => r.id));
  if (input.requirementIds.length === 0) errors.requirementIds = 'Link at least one requirement.';
  else if (new Set(input.requirementIds).size !== input.requirementIds.length) {
    errors.requirementIds = 'Each requirement can only be linked once.';
  } else if (!input.requirementIds.every((id) => requirementIds.has(id))) {
    errors.requirementIds = 'One or more linked requirements no longer exist.';
  }

  if (!isRequirementPriority(input.priority)) errors.priority = 'Select a MoSCoW priority.';
  if (!isStoryStatus(input.status)) errors.status = 'Select a status.';

  const criteria: Record<string, CriterionErrors> = {};
  input.criteria.forEach((c, index) => {
    const e = validateCriterion(c);
    if (Object.keys(e).length > 0) {
      criteria[c.id] = e;
      errors.criteria ??= `Acceptance criterion ${index + 1} is incomplete: every criterion needs a title, Given, When and Then.`;
    }
  });
  if (new Set(input.criteria.map((c) => c.id)).size !== input.criteria.length) {
    errors.criteria = 'Acceptance criteria must have unique ids.';
  }

  return { errors, criteria };
}

export function isStoryValid(validation: StoryValidation): boolean {
  return Object.keys(validation.errors).length === 0;
}

// ---------------------------------------------------------------------------
// Stories: create, update, delete
// ---------------------------------------------------------------------------

/** Normalise criteria and give new ones the next per-story numbers. */
function finaliseCriteria(criteria: readonly CriterionInput[], lastNumber: number) {
  let sequence = lastNumber;
  const result: AcceptanceCriterion[] = criteria.map((c) => {
    const number = c.number ?? ++sequence;
    return {
      id: c.id,
      number,
      title: c.title.trim(),
      given: stripGherkinKeyword(c.given, 'given'),
      when: stripGherkinKeyword(c.when, 'when'),
      then: stripGherkinKeyword(c.then, 'then'),
      notes: c.notes.trim(),
      verification: c.verification,
    };
  });
  return { criteria: result, sequence: Math.max(sequence, ...result.map((c) => c.number), 0) };
}

function normaliseStory(input: StoryInput) {
  return {
    title: input.title.trim(),
    persona: { stakeholderId: input.persona.stakeholderId, label: input.persona.label.trim() },
    need: normaliseNeed(input.need),
    benefit: normaliseBenefit(input.benefit),
    description: input.description.trim(),
    requirementIds: [...input.requirementIds],
    priority: input.priority,
    status: input.status,
  };
}

export function createUserStory(
  input: StoryInput,
  workspace: Pick<Workspace, 'userStories' | 'storySequence'>,
  now: string,
  id = createId('us'),
): { story: UserStory; sequence: number } {
  const { identifier, sequence } = nextStoryIdentifier(workspace);
  const { criteria, sequence: criterionSequence } = finaliseCriteria(input.criteria, 0);
  return {
    story: { id, identifier, ...normaliseStory(input), criteria, criterionSequence, createdAt: now, updatedAt: now },
    sequence,
  };
}

/** Apply edits. Identifier, creation date and existing criterion numbers never change. */
export function applyStoryUpdate(existing: UserStory, input: StoryInput, now: string): UserStory {
  const { criteria, sequence } = finaliseCriteria(input.criteria, existing.criterionSequence);
  return {
    ...existing,
    ...normaliseStory(input),
    criteria,
    criterionSequence: Math.max(existing.criterionSequence, sequence),
    updatedAt: now,
  };
}

export function setCriterionVerification(
  story: UserStory,
  criterionId: string,
  verification: VerificationStatus,
  now: string,
): UserStory {
  if (!story.criteria.some((c) => c.id === criterionId)) return story;
  return {
    ...story,
    criteria: story.criteria.map((c) => (c.id === criterionId ? { ...c, verification } : c)),
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

export function storiesForRequirement(workspace: Pick<Workspace, 'userStories'>, requirementId: string): UserStory[] {
  return workspace.userStories
    .filter((s) => s.requirementIds.includes(requirementId))
    .sort((a, b) => compareStoryIdentifiers(a.identifier, b.identifier));
}

/**
 * Stories grouped by the requirements they link to, each group in identifier
 * order (as `storiesForRequirement` returns them). Built in one pass so
 * per-requirement views do not rescan every story for every requirement.
 */
export function groupStoriesByRequirement(workspace: Pick<Workspace, 'userStories'>): Map<string, UserStory[]> {
  const sorted = [...workspace.userStories].sort((a, b) => compareStoryIdentifiers(a.identifier, b.identifier));
  const groups = new Map<string, UserStory[]>();
  for (const story of sorted) {
    for (const requirementId of new Set(story.requirementIds)) {
      const group = groups.get(requirementId);
      if (group) group.push(story);
      else groups.set(requirementId, [story]);
    }
  }
  return groups;
}

export function storiesForStakeholder(workspace: Pick<Workspace, 'userStories'>, stakeholderId: string): UserStory[] {
  return workspace.userStories.filter((s) => s.persona.stakeholderId === stakeholderId);
}

// ---------------------------------------------------------------------------
// Register: filter, sort, summary
// ---------------------------------------------------------------------------

export interface StoryFilter {
  query: string;
  requirementId: string | 'all';
  priority: RequirementPriority | 'all';
  status: StoryStatus | 'all';
}

export const EMPTY_STORY_FILTER: StoryFilter = { query: '', requirementId: 'all', priority: 'all', status: 'all' };

export function filterStories(stories: readonly UserStory[], filter: StoryFilter): UserStory[] {
  const query = filter.query.trim().toLowerCase();
  return stories.filter(
    (s) =>
      (filter.requirementId === 'all' || s.requirementIds.includes(filter.requirementId)) &&
      (filter.priority === 'all' || s.priority === filter.priority) &&
      (filter.status === 'all' || s.status === filter.status) &&
      (query === '' || [s.identifier, s.title, s.persona.label].some((f) => f.toLowerCase().includes(query))),
  );
}

export type StorySort = 'identifier' | 'priority' | 'status' | 'updated';

export const STORY_SORT_LABELS: Record<StorySort, string> = {
  identifier: 'Identifier',
  priority: 'Priority (Must first)',
  status: 'Status (workflow order)',
  updated: 'Recently updated',
};

export function sortStories(stories: readonly UserStory[], sort: StorySort): UserStory[] {
  const byId = (a: UserStory, b: UserStory) => compareStoryIdentifiers(a.identifier, b.identifier);
  return [...stories].sort((a, b) => {
    switch (sort) {
      case 'priority':
        return REQUIREMENT_PRIORITIES.indexOf(a.priority) - REQUIREMENT_PRIORITIES.indexOf(b.priority) || byId(a, b);
      case 'status':
        return STORY_STATUSES.indexOf(a.status) - STORY_STATUSES.indexOf(b.status) || byId(a, b);
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt) || byId(a, b);
      default:
        return byId(a, b);
    }
  });
}

export function countStoriesByStatus(stories: readonly UserStory[]): Record<StoryStatus, number> {
  const counts = Object.fromEntries(STORY_STATUSES.map((s) => [s, 0])) as Record<StoryStatus, number>;
  for (const s of stories) counts[s.status] += 1;
  return counts;
}
