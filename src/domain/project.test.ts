import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  getProjectCompleteness,
  isProjectEmpty,
  normaliseProject,
  toProjectInput,
  validateProject,
  type ProjectOverviewInput,
} from './project';

function validInput(overrides: Partial<ProjectOverviewInput> = {}): ProjectOverviewInput {
  return {
    ...toProjectInput(createEmptyProject()),
    name: 'Dispatch improvement',
    problemStatement: 'Dispatch is slow.',
    objectives: [{ id: 'obj_1', text: 'Centralise service requests' }],
    ...overrides,
  };
}

describe('validateProject', () => {
  it('accepts the minimum required content', () => {
    expect(validateProject(validInput())).toEqual({});
  });

  it('requires a name, problem statement and at least one non-blank objective', () => {
    const errors = validateProject(validInput({ name: ' ', problemStatement: '', objectives: [{ id: 'a', text: '  ' }, { id: 'b', text: '' }] }));
    expect(Object.keys(errors).sort()).toEqual(['name', 'objectives', 'problemStatement']);
  });

  it('limits the project name length', () => {
    expect(validateProject(validInput({ name: 'a'.repeat(121) })).name).toMatch(/120 characters/);
    expect(validateProject(validInput({ name: 'a'.repeat(120) })).name).toBeUndefined();
  });
});

describe('normaliseProject', () => {
  it('trims fields, removes empty list items and stamps updatedAt', () => {
    const result = normaliseProject(
      validInput({ name: '  Project  ', inScope: [' A ', '', 'B'], successCriteria: ['   '] }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(result.name).toBe('Project');
    expect(result.inScope).toEqual(['A', 'B']);
    expect(result.successCriteria).toEqual([]);
    expect(result.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('getProjectCompleteness', () => {
  it('reports every section incomplete for an empty project', () => {
    const items = getProjectCompleteness(createEmptyProject());
    expect(items).toHaveLength(6);
    expect(items.every((i) => !i.complete)).toBe(true);
    expect(isProjectEmpty(createEmptyProject())).toBe(true);
  });

  it('marks sections complete only when they have meaningful content', () => {
    const project = {
      ...createEmptyProject(),
      name: 'P',
      objectives: [{ id: 'a', text: '  ' }],
      inScope: ['Scheduling'],
      outOfScope: [],
    };
    const byKey = Object.fromEntries(getProjectCompleteness(project).map((i) => [i.key, i.complete]));
    expect(byKey).toMatchObject({ name: true, objectives: false, scope: true, successCriteria: false });
    expect(isProjectEmpty(project)).toBe(false);
  });

  it('treats an organisation-only project as not empty', () => {
    expect(isProjectEmpty({ ...createEmptyProject(), organisation: 'Org' })).toBe(false);
  });
});

describe('objective records', () => {
  const requirement = (identifier: string, objectiveIds: string[]) =>
    ({ identifier, objectiveIds }) as unknown as import('./types').Requirement;

  it('keeps objective ids through normalisation and drops blank objectives', () => {
    const result = normaliseProject(
      validInput({ objectives: [{ id: 'obj_1', text: '  Reduce delays ' }, { id: 'obj_2', text: ' ' }] }),
      '2026-01-01T00:00:00.000Z',
    );
    expect(result.objectives).toEqual([{ id: 'obj_1', text: 'Reduce delays' }]);
  });

  it('blocks removing or blanking an objective that requirements trace to', () => {
    const previous = { ...createEmptyProject(), objectives: [{ id: 'obj_1', text: 'Centralise service requests' }, { id: 'obj_2', text: 'Faster dispatch' }] };
    const linked = [requirement('FR-001', ['obj_2']), requirement('FR-004', ['obj_2'])];

    const removed = validateProject(validInput(), linked, previous);
    expect(removed.objectives).toBe('“Faster dispatch” is linked to FR-001, FR-004. Unlink it from those requirements before removing it.');

    const blanked = validateProject(validInput({ objectives: [...previous.objectives.slice(0, 1), { id: 'obj_2', text: ' ' }] }), linked, previous);
    expect(blanked.objectives).toMatch(/Unlink it/);

    // Editing the text keeps the id, so the link is preserved and allowed.
    const edited = validateProject(validInput({ objectives: [{ id: 'obj_2', text: 'Faster, better dispatch' }] }), linked, previous);
    expect(edited.objectives).toBeUndefined();
  });
});
