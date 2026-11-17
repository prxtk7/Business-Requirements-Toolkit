import type { Requirement, UserStory, VerificationStatus, Workspace } from './types';
import { VERIFICATION_STATUSES } from './storyConfig';
import { compareIdentifiers } from './requirements';
import { groupStoriesByRequirement } from './userStories';

/**
 * How requirements are translated into user stories.
 *
 * "Covered" means at least one user story links to the requirement. It says
 * nothing about delivery or testing: acceptance-criteria verification is
 * reported separately, and story status (e.g. Implemented) is a third,
 * independent dimension.
 */
export interface CoverageRow {
  requirement: Requirement;
  stories: UserStory[];
  covered: boolean;
  /** Verification counts across the criteria of the linked stories. */
  criteria: Record<VerificationStatus, number> & { total: number };
}

export interface CoverageSummary {
  totalStories: number;
  totalRequirements: number;
  requirementsCovered: number;
  requirementsWithoutStories: number;
  criteria: Record<VerificationStatus, number> & { total: number };
}

function emptyCriteriaCounts(): Record<VerificationStatus, number> & { total: number } {
  return { ...(Object.fromEntries(VERIFICATION_STATUSES.map((s) => [s, 0])) as Record<VerificationStatus, number>), total: 0 };
}

export function countCriteria(stories: readonly UserStory[]) {
  const counts = emptyCriteriaCounts();
  for (const story of stories) {
    for (const c of story.criteria) {
      counts[c.verification] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

export function buildCoverage(workspace: Pick<Workspace, 'requirements' | 'userStories'>): CoverageRow[] {
  const storiesByRequirement = groupStoriesByRequirement(workspace);
  return [...workspace.requirements]
    .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
    .map((requirement) => {
      const stories = storiesByRequirement.get(requirement.id) ?? [];
      return { requirement, stories, covered: stories.length > 0, criteria: countCriteria(stories) };
    });
}

export function summariseCoverage(workspace: Pick<Workspace, 'requirements' | 'userStories'>): CoverageSummary {
  const rows = buildCoverage(workspace);
  const covered = rows.filter((r) => r.covered).length;
  return {
    totalStories: workspace.userStories.length,
    totalRequirements: rows.length,
    requirementsCovered: covered,
    requirementsWithoutStories: rows.length - covered,
    // Every criterion counted once, even if its story links to several requirements.
    criteria: countCriteria(workspace.userStories),
  };
}

export type CoverageFilter = 'all' | 'covered' | 'uncovered';

export function filterCoverage(rows: readonly CoverageRow[], filter: CoverageFilter): CoverageRow[] {
  if (filter === 'covered') return rows.filter((r) => r.covered);
  if (filter === 'uncovered') return rows.filter((r) => !r.covered);
  return [...rows];
}
