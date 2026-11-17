/** Route helpers so links stay consistent across pages. */
export const riskPaths = {
  list: '/risks',
  matrix: '/risk-matrix',
  create: '/risks/new',
  detail: (id: string) => `/risks/${id}`,
  edit: (id: string) => `/risks/${id}/edit`,
};
