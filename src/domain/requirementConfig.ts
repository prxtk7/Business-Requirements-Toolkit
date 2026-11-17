import type { RequirementPriority, RequirementStatus, RequirementType } from './types';

/**
 * Classification configuration for requirements. Components read labels and
 * option lists from here; nothing else hardcodes categories or statuses.
 */

export const REQUIREMENT_TYPES: readonly RequirementType[] = ['functional', 'non-functional'];

export const REQUIREMENT_TYPE_DETAILS: Record<RequirementType, { label: string; short: string; prefix: string }> = {
  functional: { label: 'Functional', short: 'FR', prefix: 'FR' },
  'non-functional': { label: 'Non-functional', short: 'NFR', prefix: 'NFR' },
};

export interface CategoryOption {
  id: string;
  label: string;
}

/** Predefined categories per requirement type. Category ids are stored on requirements. */
export const REQUIREMENT_CATEGORIES: Record<RequirementType, readonly CategoryOption[]> = {
  functional: [
    { id: 'service-requests', label: 'Service Request Management' },
    { id: 'scheduling', label: 'Scheduling and Dispatch' },
    { id: 'work-orders', label: 'Work Order Management' },
    { id: 'inventory', label: 'Inventory and Parts' },
    { id: 'customer-communication', label: 'Customer Communication' },
    { id: 'reporting', label: 'Reporting and Analytics' },
  ],
  'non-functional': [
    { id: 'performance', label: 'Performance' },
    { id: 'availability', label: 'Availability' },
    { id: 'security', label: 'Security' },
    { id: 'usability', label: 'Usability' },
    { id: 'reliability', label: 'Reliability' },
    { id: 'scalability', label: 'Scalability' },
    { id: 'compatibility', label: 'Compatibility' },
    { id: 'maintainability', label: 'Maintainability' },
    { id: 'accessibility', label: 'Accessibility' },
  ],
};

export function categoryLabel(type: RequirementType, categoryId: string): string {
  return REQUIREMENT_CATEGORIES[type].find((c) => c.id === categoryId)?.label ?? 'Unknown category';
}

export function isCategoryForType(type: RequirementType, categoryId: string): boolean {
  return REQUIREMENT_CATEGORIES[type].some((c) => c.id === categoryId);
}

/** MoSCoW, in priority order. */
export const REQUIREMENT_PRIORITIES: readonly RequirementPriority[] = ['must', 'should', 'could', 'wont'];

export const PRIORITY_LABELS: Record<RequirementPriority, string> = {
  must: 'Must Have',
  should: 'Should Have',
  could: 'Could Have',
  wont: "Won't Have (this time)",
};

/** Workflow order used for sorting and filters. */
export const REQUIREMENT_STATUSES: readonly RequirementStatus[] = [
  'draft',
  'proposed',
  'under-review',
  'approved',
  'implemented',
  'deferred',
  'rejected',
];

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  'under-review': 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  implemented: 'Implemented',
  deferred: 'Deferred',
};

/** Statuses counted as "awaiting review" on the dashboard. */
export const AWAITING_REVIEW_STATUSES: readonly RequirementStatus[] = ['proposed', 'under-review'];

/** New requirements start as drafts; they are never approved automatically. */
export const DEFAULT_REQUIREMENT_STATUS: RequirementStatus = 'draft';

export function isRequirementType(value: unknown): value is RequirementType {
  return value === 'functional' || value === 'non-functional';
}

export function isRequirementPriority(value: unknown): value is RequirementPriority {
  return typeof value === 'string' && (REQUIREMENT_PRIORITIES as readonly string[]).includes(value);
}

export function isRequirementStatus(value: unknown): value is RequirementStatus {
  return typeof value === 'string' && (REQUIREMENT_STATUSES as readonly string[]).includes(value);
}
