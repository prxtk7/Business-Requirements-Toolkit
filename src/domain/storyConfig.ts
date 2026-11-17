import type { StoryStatus, VerificationStatus } from './types';

/** Story workflow, in order. New stories start as Draft and are never approved automatically. */
export const STORY_STATUSES: readonly StoryStatus[] = [
  'draft',
  'proposed',
  'under-review',
  'approved',
  'ready',
  'implemented',
  'deferred',
];

export const STORY_STATUS_LABELS: Record<StoryStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  'under-review': 'Under Review',
  approved: 'Approved',
  ready: 'Ready for Development',
  implemented: 'Implemented',
  deferred: 'Deferred',
};

export const DEFAULT_STORY_STATUS: StoryStatus = 'draft';

/**
 * Verification status records the documented outcome of checking a
 * criterion. The toolkit does not run tests against any system.
 */
export const VERIFICATION_STATUSES: readonly VerificationStatus[] = ['not-tested', 'passed', 'failed', 'blocked'];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  'not-tested': 'Not Tested',
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
};

export const DEFAULT_VERIFICATION_STATUS: VerificationStatus = 'not-tested';

export const STORY_PREFIX = 'US';

export function isStoryStatus(value: unknown): value is StoryStatus {
  return typeof value === 'string' && (STORY_STATUSES as readonly string[]).includes(value);
}

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === 'string' && (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Words that usually signal an untestable criterion. Used only to show a
 * non-blocking hint; it is not an automated quality judgement.
 */
export const VAGUE_TERMS: readonly string[] = [
  'properly',
  'correctly',
  'user-friendly',
  'easy',
  'easily',
  'intuitive',
  'fast',
  'quickly',
  'efficient',
  'efficiently',
  'appropriate',
  'as expected',
  'seamless',
  'seamlessly',
];
