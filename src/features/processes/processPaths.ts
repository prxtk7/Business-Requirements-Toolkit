import type { ProcessType } from '../../domain/types';

/** Route helpers so links stay consistent across pages. */
export const processPaths = {
  list: '/processes',
  compare: (toBeId?: string) => (toBeId ? `/processes/compare?toBe=${toBeId}` : '/processes/compare'),
  create: (type?: ProcessType) => (type ? `/processes/new?type=${type}` : '/processes/new'),
  detail: (id: string) => `/processes/${id}`,
  edit: (id: string) => `/processes/${id}/edit`,
  newStep: (id: string) => `/processes/${id}/steps/new`,
  editStep: (id: string, stepId: string) => `/processes/${id}/steps/${stepId}/edit`,
  newBottleneck: (id: string, stepId?: string) =>
    `/processes/${id}/bottlenecks/new${stepId ? `?step=${stepId}` : ''}`,
  editBottleneck: (id: string, bottleneckId: string) => `/processes/${id}/bottlenecks/${bottleneckId}/edit`,
  newImprovement: (id: string, stepId?: string) =>
    `/processes/${id}/improvements/new${stepId ? `?step=${stepId}` : ''}`,
  editImprovement: (id: string, improvementId: string) => `/processes/${id}/improvements/${improvementId}/edit`,
};
