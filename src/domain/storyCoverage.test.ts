import { describe, expect, it } from 'vitest';
import { buildCoverage, countCriteria, filterCoverage, summariseCoverage } from './storyCoverage';
import { buildTraceabilityMatrix, filterByGap } from './traceability';
import { createDemoWorkspace } from '../data/demoWorkspace';

const NOW = '2026-06-01T09:00:00.000Z';

describe('story coverage', () => {
  const ws = createDemoWorkspace(NOW);

  it('summarises stories, covered requirements and criteria verification separately', () => {
    expect(summariseCoverage(ws)).toEqual({
      totalStories: 18,
      totalRequirements: 27,
      requirementsCovered: 18,
      requirementsWithoutStories: 9,
      criteria: { total: 36, passed: 2, 'not-tested': 32, failed: 1, blocked: 1 },
    });
  });

  it('lists requirements without user stories as gaps', () => {
    const uncovered = filterCoverage(buildCoverage(ws), 'uncovered').map((r) => r.requirement.identifier);
    expect(uncovered).toEqual(['FR-012', 'FR-014', 'FR-018', 'NFR-001', 'NFR-003', 'NFR-004', 'NFR-007', 'NFR-008', 'NFR-009']);
    expect(filterCoverage(buildCoverage(ws), 'covered')).toHaveLength(18);
  });

  it('counts criteria per requirement across all linked stories', () => {
    const fr006 = buildCoverage(ws).find((r) => r.requirement.identifier === 'FR-006')!;
    expect(fr006.stories.map((s) => s.identifier)).toEqual(['US-006', 'US-014']);
    expect(fr006.criteria).toEqual({ total: 5, passed: 0, 'not-tested': 3, failed: 1, blocked: 1 });
  });

  it('counts a criterion once overall even when its story covers several requirements', () => {
    const perRequirement = buildCoverage(ws).reduce((sum, r) => sum + r.criteria.total, 0);
    expect(perRequirement).toBeGreaterThan(countCriteria(ws.userStories).total);
  });

  it('a requirement can be covered while its criteria are untested (coverage is not verification)', () => {
    const fr003 = buildCoverage(ws).find((r) => r.requirement.identifier === 'FR-003')!;
    expect(fr003.covered).toBe(true);
    expect(fr003.criteria.passed).toBe(0);
  });

  it('reports an empty workspace without errors', () => {
    const empty = { requirements: [], userStories: [] };
    expect(summariseCoverage(empty)).toMatchObject({ totalStories: 0, requirementsCovered: 0, requirementsWithoutStories: 0 });
  });
});

describe('traceability matrix with user stories', () => {
  const ws = createDemoWorkspace(NOW);
  const rows = buildTraceabilityMatrix(ws, ws.requirements);

  it('shows linked story identifiers and flags requirements without stories', () => {
    const fr008 = rows.find((r) => r.requirement.identifier === 'FR-008')!;
    expect(fr008.stories.map((s) => s.identifier)).toEqual(['US-008', 'US-009']);
    expect(fr008.storyGap).toBe(false);
    expect(filterByGap(rows, 'no-story').map((r) => r.requirement.identifier)).toEqual(['FR-012', 'FR-014', 'FR-018', 'NFR-001', 'NFR-003', 'NFR-004', 'NFR-007', 'NFR-008', 'NFR-009']);
  });

  it('keeps the existing upstream gap definitions unchanged', () => {
    expect(filterByGap(rows, 'any-gap').map((r) => r.requirement.identifier)).toEqual(['NFR-001', 'NFR-002', 'NFR-004', 'NFR-008']);
  });
});
