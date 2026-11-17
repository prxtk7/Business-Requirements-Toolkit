import { describe, expect, it } from 'vitest';
import type { Level, Stakeholder, StakeholderInput } from './types';
import {
  applyStakeholderUpdate,
  countByStrategy,
  createStakeholder,
  filterStakeholders,
  getEngagementStrategy,
  groupByGridCell,
  sortByPriority,
  validateStakeholder,
} from './stakeholders';

const NOW = '2026-01-15T10:00:00.000Z';

function input(overrides: Partial<StakeholderInput> = {}): StakeholderInput {
  return {
    name: 'Alex Morgan',
    role: 'Programme Manager',
    description: '',
    interest: 'medium',
    influence: 'medium',
    expectations: [],
    ...overrides,
  };
}

function stakeholder(id: string, name: string, influence: Level, interest: Level, extra: Partial<Stakeholder> = {}): Stakeholder {
  return createStakeholder(input({ name, influence, interest, ...extra }), NOW, id);
}

describe('getEngagementStrategy', () => {
  it.each<[Level, Level, string]>([
    ['high', 'high', 'manage-closely'],
    ['high', 'medium', 'keep-satisfied'],
    ['high', 'low', 'keep-satisfied'],
    ['medium', 'high', 'keep-informed'],
    ['medium', 'medium', 'keep-informed'],
    ['medium', 'low', 'monitor'],
    ['low', 'high', 'keep-informed'],
    ['low', 'medium', 'monitor'],
    ['low', 'low', 'monitor'],
  ])('influence %s + interest %s → %s', (influence, interest, expected) => {
    expect(getEngagementStrategy(influence, interest)).toBe(expected);
  });
});

describe('validateStakeholder', () => {
  it('accepts a complete stakeholder', () => {
    expect(validateStakeholder(input())).toEqual({});
  });

  it('requires name and role, ignoring whitespace', () => {
    const errors = validateStakeholder(input({ name: '   ', role: '' }));
    expect(errors.name).toBe('Enter the stakeholder name.');
    expect(errors.role).toBe('Enter the stakeholder role.');
  });

  it('rejects overly long names', () => {
    expect(validateStakeholder(input({ name: 'x'.repeat(121) })).name).toMatch(/120 characters or fewer/);
  });

  it('rejects duplicate names case-insensitively', () => {
    const existing = [stakeholder('a', 'Alex Morgan', 'low', 'low')];
    expect(validateStakeholder(input({ name: '  alex MORGAN ' }), existing).name).toBe(
      'A stakeholder with this name already exists.',
    );
  });

  it('allows a stakeholder to keep its own name when editing', () => {
    const existing = [stakeholder('a', 'Alex Morgan', 'low', 'low')];
    expect(validateStakeholder(input(), existing, 'a')).toEqual({});
  });

  it('rejects invalid level values from untyped sources', () => {
    const errors = validateStakeholder(input({ interest: 'extreme' as Level }));
    expect(errors.interest).toBeDefined();
  });
});

describe('createStakeholder / applyStakeholderUpdate', () => {
  it('trims text and drops blank expectations', () => {
    const s = createStakeholder(
      input({ name: '  Jo  ', role: ' Lead ', expectations: [' Faster dispatch ', '', '   '] }),
      NOW,
      'id-1',
    );
    expect(s).toMatchObject({ id: 'id-1', name: 'Jo', role: 'Lead', expectations: ['Faster dispatch'] });
    expect(s.createdAt).toBe(NOW);
    expect(s.updatedAt).toBe(NOW);
  });

  it('generates a prefixed id by default', () => {
    expect(createStakeholder(input(), NOW).id).toMatch(/^stk_/);
  });

  it('keeps id and createdAt but refreshes updatedAt on update', () => {
    const original = stakeholder('id-1', 'Jo', 'low', 'low');
    const later = '2026-02-01T00:00:00.000Z';
    const updated = applyStakeholderUpdate(original, input({ name: 'Jo Smith', influence: 'high' }), later);
    expect(updated).toMatchObject({ id: 'id-1', name: 'Jo Smith', influence: 'high', createdAt: NOW, updatedAt: later });
  });
});

describe('filtering, sorting and grouping', () => {
  const list = [
    stakeholder('1', 'Technicians', 'low', 'high', { role: 'User group' }),
    stakeholder('2', 'Sponsor', 'high', 'high', { description: 'Owns the budget' }),
    stakeholder('3', 'IT Manager', 'high', 'medium'),
    stakeholder('4', 'Subcontractors', 'low', 'low'),
  ];

  it('searches name, role and description case-insensitively', () => {
    expect(filterStakeholders(list, { query: 'BUDGET', strategy: 'all' }).map((s) => s.id)).toEqual(['2']);
    expect(filterStakeholders(list, { query: 'user group', strategy: 'all' }).map((s) => s.id)).toEqual(['1']);
    expect(filterStakeholders(list, { query: '  ', strategy: 'all' })).toHaveLength(4);
  });

  it('filters by derived engagement strategy', () => {
    expect(filterStakeholders(list, { query: '', strategy: 'keep-satisfied' }).map((s) => s.id)).toEqual(['3']);
    expect(filterStakeholders(list, { query: 'sponsor', strategy: 'monitor' })).toEqual([]);
  });

  it('sorts by influence, then interest, then name', () => {
    expect(sortByPriority(list).map((s) => s.name)).toEqual(['Sponsor', 'IT Manager', 'Technicians', 'Subcontractors']);
  });

  it('counts stakeholders per strategy', () => {
    expect(countByStrategy(list)).toEqual({
      'manage-closely': 1,
      'keep-satisfied': 1,
      'keep-informed': 1,
      monitor: 1,
    });
  });

  it('groups stakeholders into grid cells', () => {
    const cells = groupByGridCell(list);
    expect(cells.get('high:high')?.map((s) => s.id)).toEqual(['2']);
    expect(cells.get('low:high')?.map((s) => s.id)).toEqual(['1']);
    expect(cells.has('medium:medium')).toBe(false);
  });
});
