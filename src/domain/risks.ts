import type { Risk, RiskLinks, RiskOwner, RiskResponse, RiskSeverity, RiskStatus, ValidationErrors, Workspace } from './types';
import {
  DEFAULT_RISK_STATUS,
  OPEN_RISK_STATUSES,
  RISK_PREFIX,
  RISK_STATUSES,
  isRating,
  isRiskCategory,
  isRiskResponse,
  isRiskStatus,
  riskScore,
  severityForScore,
} from './riskConfig';
import { createId } from './ids';
import { formatNumbered, nextNumber, parseNumbered } from './identifiers';
import { findStep } from './processes';
import { isBlank } from './text';

export const RISK_TITLE_MAX_LENGTH = 150;
export const OWNER_NAME_MAX_LENGTH = 80;

// ---------------------------------------------------------------------------
// Identifiers and assessment
// ---------------------------------------------------------------------------

export function nextRiskIdentifier(workspace: Pick<Workspace, 'risks' | 'riskSequence'>) {
  const number = nextNumber(workspace.riskSequence, workspace.risks.map((r) => r.identifier), RISK_PREFIX);
  return { identifier: formatNumbered(RISK_PREFIX, number), sequence: number };
}

export function compareRiskIdentifiers(a: string, b: string): number {
  const na = parseNumbered(a, RISK_PREFIX);
  const nb = parseNumbered(b, RISK_PREFIX);
  return na !== null && nb !== null ? na - nb : a.localeCompare(b);
}

export interface RiskAssessment {
  score: number;
  severity: RiskSeverity;
}

/** Score and severity are always derived from probability and impact. */
export function assessRisk(risk: Pick<Risk, 'probability' | 'impact'>): RiskAssessment {
  const score = riskScore(risk.probability, risk.impact);
  return { score, severity: severityForScore(score) };
}

export function isOpenRisk(risk: Pick<Risk, 'status'>): boolean {
  return OPEN_RISK_STATUSES.includes(risk.status);
}

export function ownerName(owner: RiskOwner, workspace: Pick<Workspace, 'stakeholders'>): string {
  if (owner.stakeholderId === null) return owner.customName;
  return workspace.stakeholders.find((s) => s.id === owner.stakeholderId)?.name ?? 'Missing stakeholder';
}

// ---------------------------------------------------------------------------
// Input and validation
// ---------------------------------------------------------------------------

export type RiskInput = Omit<Risk, 'id' | 'identifier' | 'createdAt' | 'updatedAt'>;

export function createEmptyLinks(): RiskLinks {
  return { stakeholderIds: [], objectiveIds: [], stepIds: [], requirementIds: [], storyIds: [] };
}

export function createEmptyRiskInput(): RiskInput {
  return {
    title: '',
    description: '',
    category: '',
    probability: 3,
    impact: 3,
    response: 'mitigate',
    mitigation: '',
    contingency: '',
    owner: { stakeholderId: null, customName: '' },
    status: DEFAULT_RISK_STATUS,
    links: createEmptyLinks(),
  };
}

export function toRiskInput(risk: Risk): RiskInput {
  return {
    title: risk.title,
    description: risk.description,
    category: risk.category,
    probability: risk.probability,
    impact: risk.impact,
    response: risk.response,
    mitigation: risk.mitigation,
    contingency: risk.contingency,
    owner: { ...risk.owner },
    status: risk.status,
    links: cloneLinks(risk.links),
  };
}

function cloneLinks(links: RiskLinks): RiskLinks {
  return {
    stakeholderIds: [...links.stakeholderIds],
    objectiveIds: [...links.objectiveIds],
    stepIds: [...links.stepIds],
    requirementIds: [...links.requirementIds],
    storyIds: [...links.storyIds],
  };
}

const hasDuplicates = (ids: readonly string[]) => new Set(ids).size !== ids.length;

/** Check every link points at an existing record and is listed once. Returns the first problem. */
function validateLinks(links: RiskLinks, workspace: Workspace): string | undefined {
  const checks: [string, string[], (id: string) => boolean][] = [
    ['stakeholders', links.stakeholderIds, (id) => workspace.stakeholders.some((s) => s.id === id)],
    ['objectives', links.objectiveIds, (id) => workspace.project.objectives.some((o) => o.id === id)],
    ['process steps', links.stepIds, (id) => findStep(workspace, id) !== undefined],
    ['requirements', links.requirementIds, (id) => workspace.requirements.some((r) => r.id === id)],
    ['user stories', links.storyIds, (id) => workspace.userStories.some((s) => s.id === id)],
  ];
  for (const [label, ids, exists] of checks) {
    if (hasDuplicates(ids)) return `Each of the related ${label} can only be linked once.`;
    if (!ids.every(exists)) return `One or more related ${label} no longer exist.`;
  }
  return undefined;
}

export function validateRisk(input: RiskInput, workspace: Workspace): ValidationErrors<RiskInput> {
  const errors: ValidationErrors<RiskInput> = {};
  const title = input.title.trim();

  if (title.length === 0) errors.title = 'Enter a short risk title.';
  else if (title.length > RISK_TITLE_MAX_LENGTH) errors.title = `Title must be ${RISK_TITLE_MAX_LENGTH} characters or fewer.`;
  if (isBlank(input.description)) errors.description = 'Describe what could happen and why.';
  if (!isRiskCategory(input.category)) errors.category = 'Select a risk category.';
  if (!isRating(input.probability)) errors.probability = 'Probability must be a whole number from 1 to 5.';
  if (!isRating(input.impact)) errors.impact = 'Impact must be a whole number from 1 to 5.';
  if (!isRiskResponse(input.response)) errors.response = 'Select a response strategy.';
  else if (input.response === 'mitigate' && isBlank(input.mitigation)) {
    errors.mitigation = 'A mitigate response needs a mitigation plan.';
  }
  if (!isRiskStatus(input.status)) errors.status = 'Select a status.';

  if (input.owner.stakeholderId !== null) {
    if (!workspace.stakeholders.some((s) => s.id === input.owner.stakeholderId)) {
      errors.owner = 'The selected owner no longer exists. Choose another owner.';
    }
  } else if (isBlank(input.owner.customName)) {
    errors.owner = 'Choose a stakeholder or enter the name of the person responsible.';
  } else if (input.owner.customName.trim().length > OWNER_NAME_MAX_LENGTH) {
    errors.owner = `The owner name must be ${OWNER_NAME_MAX_LENGTH} characters or fewer.`;
  }

  const linkError = validateLinks(input.links, workspace);
  if (linkError) errors.links = linkError;

  return errors;
}

function normaliseInput(input: RiskInput): RiskInput {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    mitigation: input.mitigation.trim(),
    contingency: input.contingency.trim(),
    owner:
      input.owner.stakeholderId === null
        ? { stakeholderId: null, customName: input.owner.customName.trim() }
        : { stakeholderId: input.owner.stakeholderId, customName: '' },
    links: cloneLinks(input.links),
  };
}

export function createRisk(
  input: RiskInput,
  workspace: Pick<Workspace, 'risks' | 'riskSequence'>,
  now: string,
  id = createId('rsk'),
): { risk: Risk; sequence: number } {
  const { identifier, sequence } = nextRiskIdentifier(workspace);
  return { risk: { id, identifier, ...normaliseInput(input), createdAt: now, updatedAt: now }, sequence };
}

/** Apply edits. Identifier and creation date never change. */
export function applyRiskUpdate(existing: Risk, input: RiskInput, now: string): Risk {
  return { ...existing, ...normaliseInput(input), id: existing.id, identifier: existing.identifier, createdAt: existing.createdAt, updatedAt: now };
}

// ---------------------------------------------------------------------------
// References to other records
// ---------------------------------------------------------------------------

export type RiskLinkKind = keyof RiskLinks;

/** Risks that list `id` among their related records of the given kind. */
export function risksLinkedTo(workspace: Pick<Workspace, 'risks'>, kind: RiskLinkKind, ids: string | readonly string[]): Risk[] {
  const wanted = new Set(typeof ids === 'string' ? [ids] : ids);
  return workspace.risks.filter((r) => r.links[kind].some((id) => wanted.has(id))).sort((a, b) => compareRiskIdentifiers(a.identifier, b.identifier));
}

/** Risks owned by a stakeholder. Ownership blocks deleting the stakeholder. */
export function risksOwnedBy(workspace: Pick<Workspace, 'risks'>, stakeholderId: string): Risk[] {
  return workspace.risks.filter((r) => r.owner.stakeholderId === stakeholderId).sort((a, b) => compareRiskIdentifiers(a.identifier, b.identifier));
}

/**
 * Remove related-record links that no longer resolve (the record was
 * deleted). Applied on every save so a risk can never keep a dangling link.
 * Ownership is not touched: deleting an owner is blocked instead. Returns the
 * same workspace object when nothing changes.
 */
export function pruneRiskLinks(workspace: Workspace, now: string): Workspace {
  if (workspace.risks.length === 0) return workspace;
  const exists = {
    stakeholderIds: new Set(workspace.stakeholders.map((s) => s.id)),
    objectiveIds: new Set(workspace.project.objectives.map((o) => o.id)),
    stepIds: new Set(workspace.processes.flatMap((p) => p.steps.map((s) => s.id))),
    requirementIds: new Set(workspace.requirements.map((r) => r.id)),
    storyIds: new Set(workspace.userStories.map((s) => s.id)),
  };
  let changed = false;
  const risks = workspace.risks.map((risk) => {
    const links = { ...risk.links };
    let riskChanged = false;
    for (const kind of Object.keys(exists) as RiskLinkKind[]) {
      const kept = risk.links[kind].filter((id) => exists[kind].has(id));
      if (kept.length !== risk.links[kind].length) {
        links[kind] = kept;
        riskChanged = true;
      }
    }
    if (!riskChanged) return risk;
    changed = true;
    return { ...risk, links, updatedAt: now };
  });
  return changed ? { ...workspace, risks } : workspace;
}

// ---------------------------------------------------------------------------
// Register: filter, sort, counts
// ---------------------------------------------------------------------------

/** Owner filter values: `stk:<stakeholderId>` or `custom:<name>`. */
export function ownerKey(owner: RiskOwner): string {
  return owner.stakeholderId !== null ? `stk:${owner.stakeholderId}` : `custom:${owner.customName}`;
}

export interface RiskFilter {
  query: string;
  category: string | 'all';
  severity: RiskSeverity | 'all';
  status: RiskStatus | 'all';
  response: RiskResponse | 'all';
  owner: string | 'all';
}

export const EMPTY_RISK_FILTER: RiskFilter = { query: '', category: 'all', severity: 'all', status: 'all', response: 'all', owner: 'all' };

export function filterRisks(risks: readonly Risk[], filter: RiskFilter, workspace: Pick<Workspace, 'stakeholders'>): Risk[] {
  const query = filter.query.trim().toLowerCase();
  return risks.filter(
    (r) =>
      (filter.category === 'all' || r.category === filter.category) &&
      (filter.severity === 'all' || assessRisk(r).severity === filter.severity) &&
      (filter.status === 'all' || r.status === filter.status) &&
      (filter.response === 'all' || r.response === filter.response) &&
      (filter.owner === 'all' || ownerKey(r.owner) === filter.owner) &&
      (query === '' || [r.identifier, r.title, r.description, ownerName(r.owner, workspace)].some((f) => f.toLowerCase().includes(query))),
  );
}

export type RiskSort = 'identifier' | 'severity' | 'probability' | 'impact' | 'updated';

export const RISK_SORT_LABELS: Record<RiskSort, string> = {
  identifier: 'Risk ID',
  severity: 'Severity (highest score first)',
  probability: 'Probability (highest first)',
  impact: 'Impact (highest first)',
  updated: 'Recently updated',
};

export function sortRisks(risks: readonly Risk[], sort: RiskSort): Risk[] {
  const byId = (a: Risk, b: Risk) => compareRiskIdentifiers(a.identifier, b.identifier);
  return [...risks].sort((a, b) => {
    switch (sort) {
      case 'severity':
        return assessRisk(b).score - assessRisk(a).score || b.impact - a.impact || byId(a, b);
      case 'probability':
        return b.probability - a.probability || byId(a, b);
      case 'impact':
        return b.impact - a.impact || byId(a, b);
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt) || byId(a, b);
      default:
        return byId(a, b);
    }
  });
}

export interface RiskSummary {
  total: number;
  bySeverity: Record<RiskSeverity, number>;
  byStatus: Record<RiskStatus, number>;
  open: number;
  materialised: number;
  closed: number;
}

export function summariseRisks(risks: readonly Risk[]): RiskSummary {
  const bySeverity: Record<RiskSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byStatus = Object.fromEntries(RISK_STATUSES.map((s) => [s, 0])) as Record<RiskStatus, number>;
  for (const r of risks) {
    bySeverity[assessRisk(r).severity] += 1;
    byStatus[r.status] += 1;
  }
  return {
    total: risks.length,
    bySeverity,
    byStatus,
    open: risks.filter(isOpenRisk).length,
    materialised: byStatus.materialised,
    closed: byStatus.closed,
  };
}

// ---------------------------------------------------------------------------
// 5 × 5 matrix
// ---------------------------------------------------------------------------

export interface MatrixCell {
  probability: number;
  impact: number;
  score: number;
  severity: RiskSeverity;
  risks: Risk[];
}

/** Cells ordered with probability 5 first (top row) and impact 1 first (left column). */
export function buildRiskMatrix(risks: readonly Risk[]): MatrixCell[][] {
  return [5, 4, 3, 2, 1].map((probability) =>
    [1, 2, 3, 4, 5].map((impact) => {
      const score = riskScore(probability, impact);
      return {
        probability,
        impact,
        score,
        severity: severityForScore(score),
        risks: risks
          .filter((r) => r.probability === probability && r.impact === impact)
          .sort((a, b) => compareRiskIdentifiers(a.identifier, b.identifier)),
      };
    }),
  );
}
