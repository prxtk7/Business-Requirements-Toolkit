import type { Level, Stakeholder, StakeholderInput, ValidationErrors } from './types';
import { LEVELS } from './types';
import { createId } from './ids';
import { isBlank, normaliseList } from './text';

/**
 * Engagement strategies from an interest / influence (power) grid.
 * Adapted from the widely used Mendelow-style stakeholder matrix to a
 * three-point scale.
 */
export type EngagementStrategy = 'manage-closely' | 'keep-satisfied' | 'keep-informed' | 'monitor';

export const ENGAGEMENT_STRATEGIES: readonly EngagementStrategy[] = [
  'manage-closely',
  'keep-satisfied',
  'keep-informed',
  'monitor',
];

export const STRATEGY_DETAILS: Record<EngagementStrategy, { label: string; guidance: string }> = {
  'manage-closely': {
    label: 'Manage closely',
    guidance: 'Involve in key decisions and engage regularly.',
  },
  'keep-satisfied': {
    label: 'Keep satisfied',
    guidance: 'Consult on matters that affect them; avoid overloading with detail.',
  },
  'keep-informed': {
    label: 'Keep informed',
    guidance: 'Share progress regularly and gather their feedback.',
  },
  monitor: {
    label: 'Monitor',
    guidance: 'Keep a light touch and review periodically.',
  },
};

/**
 * Strategy lookup by influence (rows) and interest (columns).
 *
 *                interest: low      medium           high
 *   influence high:  keep-satisfied keep-satisfied   manage-closely
 *   influence med:   monitor        keep-informed    keep-informed
 *   influence low:   monitor        monitor          keep-informed
 */
const STRATEGY_MATRIX: Record<Level, Record<Level, EngagementStrategy>> = {
  high: { low: 'keep-satisfied', medium: 'keep-satisfied', high: 'manage-closely' },
  medium: { low: 'monitor', medium: 'keep-informed', high: 'keep-informed' },
  low: { low: 'monitor', medium: 'monitor', high: 'keep-informed' },
};

export function getEngagementStrategy(influence: Level, interest: Level): EngagementStrategy {
  return STRATEGY_MATRIX[influence][interest];
}

export const STAKEHOLDER_TEXT_MAX_LENGTH = 120;

export function createEmptyStakeholderInput(): StakeholderInput {
  return {
    name: '',
    role: '',
    description: '',
    interest: 'medium',
    influence: 'medium',
    expectations: [],
  };
}

export function toStakeholderInput(stakeholder: Stakeholder): StakeholderInput {
  return {
    name: stakeholder.name,
    role: stakeholder.role,
    description: stakeholder.description,
    interest: stakeholder.interest,
    influence: stakeholder.influence,
    expectations: [...stakeholder.expectations],
  };
}

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

/**
 * Validate stakeholder input. `existing` is used to prevent duplicate names;
 * pass `ignoreId` when editing so a stakeholder does not clash with itself.
 */
export function validateStakeholder(
  input: StakeholderInput,
  existing: readonly Stakeholder[] = [],
  ignoreId?: string,
): ValidationErrors<StakeholderInput> {
  const errors: ValidationErrors<StakeholderInput> = {};
  const name = input.name.trim();

  if (name.length === 0) {
    errors.name = 'Enter the stakeholder name.';
  } else if (name.length > STAKEHOLDER_TEXT_MAX_LENGTH) {
    errors.name = `Name must be ${STAKEHOLDER_TEXT_MAX_LENGTH} characters or fewer.`;
  } else if (
    existing.some((s) => s.id !== ignoreId && s.name.trim().toLowerCase() === name.toLowerCase())
  ) {
    errors.name = 'A stakeholder with this name already exists.';
  }

  if (isBlank(input.role)) {
    errors.role = 'Enter the stakeholder role.';
  } else if (input.role.trim().length > STAKEHOLDER_TEXT_MAX_LENGTH) {
    errors.role = `Role must be ${STAKEHOLDER_TEXT_MAX_LENGTH} characters or fewer.`;
  }

  if (!isLevel(input.interest)) errors.interest = 'Select an interest level.';
  if (!isLevel(input.influence)) errors.influence = 'Select an influence level.';

  return errors;
}

function normaliseInput(input: StakeholderInput): StakeholderInput {
  return {
    name: input.name.trim(),
    role: input.role.trim(),
    description: input.description.trim(),
    interest: input.interest,
    influence: input.influence,
    expectations: normaliseList(input.expectations),
  };
}

export function createStakeholder(input: StakeholderInput, now: string, id = createId('stk')): Stakeholder {
  return { id, ...normaliseInput(input), createdAt: now, updatedAt: now };
}

export function applyStakeholderUpdate(stakeholder: Stakeholder, input: StakeholderInput, now: string): Stakeholder {
  return { ...stakeholder, ...normaliseInput(input), updatedAt: now };
}

export interface StakeholderFilter {
  query: string;
  strategy: EngagementStrategy | 'all';
}

/** Case-insensitive search over name, role and description, plus strategy filter. */
export function filterStakeholders(stakeholders: readonly Stakeholder[], filter: StakeholderFilter): Stakeholder[] {
  const query = filter.query.trim().toLowerCase();
  return stakeholders.filter((s) => {
    if (filter.strategy !== 'all' && getEngagementStrategy(s.influence, s.interest) !== filter.strategy) {
      return false;
    }
    if (query.length === 0) return true;
    return [s.name, s.role, s.description].some((field) => field.toLowerCase().includes(query));
  });
}

const LEVEL_RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };

/** Sort by influence, then interest (both descending), then name. */
export function sortByPriority(stakeholders: readonly Stakeholder[]): Stakeholder[] {
  return [...stakeholders].sort(
    (a, b) =>
      LEVEL_RANK[b.influence] - LEVEL_RANK[a.influence] ||
      LEVEL_RANK[b.interest] - LEVEL_RANK[a.interest] ||
      a.name.localeCompare(b.name),
  );
}

export function countByStrategy(stakeholders: readonly Stakeholder[]): Record<EngagementStrategy, number> {
  const counts: Record<EngagementStrategy, number> = {
    'manage-closely': 0,
    'keep-satisfied': 0,
    'keep-informed': 0,
    monitor: 0,
  };
  for (const s of stakeholders) counts[getEngagementStrategy(s.influence, s.interest)] += 1;
  return counts;
}

/** Group stakeholders into the 3x3 grid cells, keyed `${influence}:${interest}`. */
export function groupByGridCell(stakeholders: readonly Stakeholder[]): Map<string, Stakeholder[]> {
  const cells = new Map<string, Stakeholder[]>();
  for (const s of sortByPriority(stakeholders)) {
    const key = gridCellKey(s.influence, s.interest);
    const cell = cells.get(key);
    if (cell) cell.push(s);
    else cells.set(key, [s]);
  }
  return cells;
}

export function gridCellKey(influence: Level, interest: Level): string {
  return `${influence}:${interest}`;
}
