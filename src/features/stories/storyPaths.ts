/** Route helpers so links stay consistent across pages. */
export const storyPaths = {
  list: '/user-stories',
  create: (requirementId?: string) => (requirementId ? `/user-stories/new?requirement=${requirementId}` : '/user-stories/new'),
  detail: (id: string) => `/user-stories/${id}`,
  edit: (id: string) => `/user-stories/${id}/edit`,
  coverage: '/coverage',
};
