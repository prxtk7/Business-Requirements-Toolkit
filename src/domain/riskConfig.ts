import type { RiskResponse, RiskSeverity, RiskStatus } from './types';

/**
 * Risk classification and the 5 × 5 scoring model. Components read every
 * option list and label from here.
 */

export const RISK_PREFIX = 'RSK';

export interface RiskOption {
  id: string;
  label: string;
}

export const RISK_CATEGORIES: readonly RiskOption[] = [
  { id: 'technical', label: 'Technical' },
  { id: 'operational', label: 'Operational' },
  { id: 'financial', label: 'Financial' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'resource', label: 'Resource' },
  { id: 'organisational', label: 'Organisational' },
  { id: 'data-security', label: 'Data & Security' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'external', label: 'External' },
  { id: 'other', label: 'Other' },
];

export function riskCategoryLabel(id: string): string {
  return RISK_CATEGORIES.find((c) => c.id === id)?.label ?? 'Unknown category';
}

export function isRiskCategory(value: unknown): value is string {
  return typeof value === 'string' && RISK_CATEGORIES.some((c) => c.id === value);
}

export const RISK_RESPONSES: readonly RiskResponse[] = ['avoid', 'mitigate', 'transfer', 'accept'];

export const RESPONSE_DETAILS: Record<RiskResponse, { label: string; description: string }> = {
  avoid: { label: 'Avoid', description: 'Change the plan so the risk cannot occur.' },
  mitigate: { label: 'Mitigate', description: 'Act to reduce the probability or the impact.' },
  transfer: { label: 'Transfer', description: 'Shift the impact to a third party, e.g. through a contract.' },
  accept: { label: 'Accept', description: 'Take no action beyond monitoring; rely on the contingency plan.' },
};

export const RISK_STATUSES: readonly RiskStatus[] = [
  'identified',
  'under-assessment',
  'response-planned',
  'in-progress',
  'monitoring',
  'materialised',
  'closed',
];

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  identified: 'Identified',
  'under-assessment': 'Under Assessment',
  'response-planned': 'Response Planned',
  'in-progress': 'In Progress',
  monitoring: 'Monitoring',
  closed: 'Closed',
  materialised: 'Materialised',
};

/** Statuses counted as "open": still being managed and not yet occurred. */
export const OPEN_RISK_STATUSES: readonly RiskStatus[] = [
  'identified',
  'under-assessment',
  'response-planned',
  'in-progress',
  'monitoring',
];

export const DEFAULT_RISK_STATUS: RiskStatus = 'identified';

// ---- 5 × 5 scoring model ----------------------------------------------------

export const RATINGS = [1, 2, 3, 4, 5] as const;

export const PROBABILITY_LABELS: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
};

export const IMPACT_LABELS: Record<number, string> = {
  1: 'Insignificant',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Severe',
};

export const SEVERITIES: readonly RiskSeverity[] = ['critical', 'high', 'medium', 'low'];

/** Score bands (inclusive). Score = probability × impact. */
export const SEVERITY_BANDS: readonly { severity: RiskSeverity; label: string; min: number; max: number }[] = [
  { severity: 'low', label: 'Low', min: 1, max: 4 },
  { severity: 'medium', label: 'Medium', min: 5, max: 9 },
  { severity: 'high', label: 'High', min: 10, max: 16 },
  { severity: 'critical', label: 'Critical', min: 17, max: 25 },
];

export const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function riskScore(probability: number, impact: number): number {
  return probability * impact;
}

export function severityForScore(score: number): RiskSeverity {
  const band = SEVERITY_BANDS.find((b) => score >= b.min && score <= b.max);
  if (!band) throw new RangeError(`Risk score ${score} is outside 1–25.`);
  return band.severity;
}

export function isRiskResponse(value: unknown): value is RiskResponse {
  return typeof value === 'string' && (RISK_RESPONSES as readonly string[]).includes(value);
}

export function isRiskStatus(value: unknown): value is RiskStatus {
  return typeof value === 'string' && (RISK_STATUSES as readonly string[]).includes(value);
}
