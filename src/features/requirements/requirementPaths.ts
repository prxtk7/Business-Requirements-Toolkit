import type { RequirementType } from '../../domain/types';

/** Route helpers so links stay consistent across pages. */
export const requirementPaths = {
  list: '/requirements',
  create: (type?: RequirementType) => (type ? `/requirements/new?type=${type}` : '/requirements/new'),
  detail: (id: string) => `/requirements/${id}`,
  edit: (id: string) => `/requirements/${id}/edit`,
  traceability: '/traceability',
};
