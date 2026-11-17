import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ListChecks, Network, Pencil, Plus, Search, SearchX, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import { TableScrollRegion } from '../../components/ui/TableScrollRegion';
import type { Requirement, RequirementPriority, RequirementStatus, RequirementType } from '../../domain/types';
import {
  PRIORITY_LABELS,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DETAILS,
  STATUS_LABELS,
  categoryLabel,
  isCategoryForType,
  isRequirementPriority,
  isRequirementStatus,
  isRequirementType,
} from '../../domain/requirementConfig';
import {
  SORT_LABELS,
  filterRequirements,
  sortRequirements,
  summariseRequirements,
  type RequirementFilter,
  type RequirementSort,
} from '../../domain/requirements';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate, pluralise } from '../../lib/format';
import { cx } from '../../lib/cx';
import { DeleteRequirementDialog } from './DeleteRequirementDialog';
import { PriorityBadge, StatusBadge, TypeLabel } from './requirementUi';
import { requirementPaths } from './requirementPaths';

const SORTS = Object.keys(SORT_LABELS) as RequirementSort[];

/** Read and sanitise the register filters from the URL. */
function readFilter(params: URLSearchParams): { filter: RequirementFilter; sort: RequirementSort } {
  const type = params.get('type');
  const priority = params.get('priority');
  const status = params.get('status');
  const category = params.get('category') ?? 'all';
  const sort = params.get('sort') as RequirementSort | null;
  const validType: RequirementType | 'all' = isRequirementType(type) ? type : 'all';
  const validCategory =
    category !== 'all' &&
    (validType === 'all' ? REQUIREMENT_TYPES.some((t) => isCategoryForType(t, category)) : isCategoryForType(validType, category))
      ? category
      : 'all';
  return {
    filter: {
      query: params.get('q') ?? '',
      type: validType,
      category: validCategory,
      priority: isRequirementPriority(priority) ? (priority as RequirementPriority) : 'all',
      status: isRequirementStatus(status) ? (status as RequirementStatus) : 'all',
    },
    sort: sort && SORTS.includes(sort) ? sort : 'identifier',
  };
}

export function RequirementsPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Requirement | null>(null);
  useDocumentTitle('Requirements');

  const { filter, sort } = readFilter(params);
  const all = workspace.requirements;
  const visible = sortRequirements(filterRequirements(all, filter), sort);
  const summary = summariseRequirements(all);
  const isFiltered = filter.query.trim() !== '' || filter.type !== 'all' || filter.category !== 'all' || filter.priority !== 'all' || filter.status !== 'all';
  const storyCount = (requirementId: string) => workspace.userStories.filter((s) => s.requirementIds.includes(requirementId)).length;
  const stakeholderName = (id: string | null) => (id ? (workspace.stakeholders.find((s) => s.id === id)?.name ?? 'Missing stakeholder') : null);

  const setParam = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value && value !== 'all' && !(key === 'sort' && value === 'identifier')) next.set(key, value);
        else next.delete(key);
        // A category only makes sense for its own type.
        const category = next.get('category');
        const type = next.get('type');
        if (key === 'type' && category && isRequirementType(type) && !isCategoryForType(type, category)) next.delete('category');
        return next;
      },
      { replace: true },
    );
  };

  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...REQUIREMENT_TYPES.filter((t) => filter.type === 'all' || filter.type === t).flatMap((t) =>
      REQUIREMENT_CATEGORIES[t].map((c) => ({
        value: c.id,
        label: filter.type === 'all' ? `${c.label} (${REQUIREMENT_TYPE_DETAILS[t].short})` : c.label,
      })),
    ),
  ];

  const header = (
    <PageHeader
      eyebrow="Requirements Management"
      title="Requirements register"
      description="Functional and non-functional requirements for the project, classified, prioritised with MoSCoW and traced to stakeholders, objectives and process steps."
      actions={
        <>
          {all.length > 0 && (
            <ButtonLink to={requirementPaths.traceability} icon={Network}>
              Traceability matrix
            </ButtonLink>
          )}
          <ButtonLink to={requirementPaths.create()} variant="primary" icon={Plus}>
            New requirement
          </ButtonLink>
        </>
      }
    />
  );

  if (all.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={ListChecks}
          title="No requirements yet"
          description="Capture what the solution must do (functional) and how well it must do it (non-functional). Link each requirement to the stakeholder who raised it, the objectives it supports and the process steps it affects."
          action={
            <ButtonLink to={requirementPaths.create()} variant="primary" icon={Plus}>
              Add first requirement
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        <Panel>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Total</dt>
              <dd className="text-xl font-semibold text-slate-900 tabular-nums">{summary.total}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Functional</dt>
              <dd className="text-xl font-semibold text-slate-900 tabular-nums">{summary.functional}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Non-functional</dt>
              <dd className="text-xl font-semibold text-slate-900 tabular-nums">{summary.nonFunctional}</dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase" id="status-counts">
              By status
            </p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="status-counts">
              {REQUIREMENT_STATUSES.map((status) => (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() => setParam('status', filter.status === status ? 'all' : status)}
                    aria-pressed={filter.status === status}
                    className={cx(
                      'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                      filter.status === status
                        ? 'bg-brand-700 text-white ring-brand-700'
                        : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {STATUS_LABELS[status]} <span className="tabular-nums">({summary.byStatus[status]})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Register" description={isFiltered ? `${visible.length} of ${pluralise(all.length, 'requirement')}` : pluralise(all.length, 'requirement')} flush>
          <div className="space-y-3 border-b border-slate-200 px-5 py-4">
            <div className="relative">
              <label htmlFor="requirement-search" className="sr-only">
                Search requirements
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="requirement-search"
                type="search"
                value={filter.query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search by ID, title or description"
                className="block h-10 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm shadow-sm placeholder:text-slate-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SelectField
                label="Filter by type"
                hideLabel
                value={filter.type}
                options={[{ value: 'all', label: 'All types' }, ...REQUIREMENT_TYPES.map((t) => ({ value: t, label: REQUIREMENT_TYPE_DETAILS[t].label }))]}
                onChange={(v) => setParam('type', v)}
              />
              <SelectField label="Filter by category" hideLabel value={filter.category} options={categoryOptions} onChange={(v) => setParam('category', v)} />
              <SelectField
                label="Filter by priority"
                hideLabel
                value={filter.priority}
                options={[{ value: 'all', label: 'All priorities' }, ...REQUIREMENT_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]}
                onChange={(v) => setParam('priority', v)}
              />
              <SelectField
                label="Filter by status"
                hideLabel
                value={filter.status}
                options={[{ value: 'all', label: 'All statuses' }, ...REQUIREMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
                onChange={(v) => setParam('status', v)}
              />
              <SelectField
                label="Sort by"
                hideLabel
                value={sort}
                options={SORTS.map((s) => ({ value: s, label: `Sort: ${SORT_LABELS[s]}` }))}
                onChange={(v) => setParam('sort', v)}
              />
            </div>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={() => setParams(sort === 'identifier' ? {} : { sort }, { replace: true })}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="sr-only" role="status">
            {isFiltered ? `${pluralise(visible.length, 'requirement')} match the current filters.` : ''}
          </p>

          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <SearchX aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No requirements match these filters</p>
            </div>
          ) : (
            <TableScrollRegion label="Requirements table">
              <table className="min-w-full divide-y divide-slate-200 text-sm" aria-label="Requirements">
                <thead className="bg-slate-50/60">
                  <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    <th scope="col" className="px-5 py-3">ID</th>
                    <th scope="col" className="px-3 py-3">Requirement</th>
                    <th scope="col" className="hidden px-3 py-3 xl:table-cell">Type</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">Category</th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Priority</th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Status</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">Source</th>
                    <th scope="col" className="hidden px-3 py-3 text-right lg:table-cell">
                      <abbr title="Linked user stories" className="no-underline">Stories</abbr>
                    </th>
                    <th scope="col" className="hidden px-3 py-3 xl:table-cell">Updated</th>
                    <th scope="col" className="hidden px-5 py-3 text-right md:table-cell">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-slate-50/60">
                      <td className="py-3.5 pr-2 pl-4 font-mono text-xs font-semibold whitespace-nowrap text-slate-700 sm:px-5">{r.identifier}</td>
                      <td className="max-w-md px-3 py-3.5">
                        <Link to={requirementPaths.detail(r.id)} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {r.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500 lg:hidden">
                          {categoryLabel(r.type, r.category)}
                          {stakeholderName(r.sourceStakeholderId) && ` · ${stakeholderName(r.sourceStakeholderId)}`}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                          <PriorityBadge priority={r.priority} />
                          <StatusBadge status={r.status} />
                        </div>
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 xl:table-cell">
                        <TypeLabel type={r.type} />
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">{categoryLabel(r.type, r.category)}</td>
                      <td className="hidden px-3 py-3.5 md:table-cell">
                        <PriorityBadge priority={r.priority} />
                      </td>
                      <td className="hidden px-3 py-3.5 md:table-cell">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">
                        {stakeholderName(r.sourceStakeholderId) ?? <span className="text-slate-500 italic">Not recorded</span>}
                      </td>
                      <td className="hidden px-3 py-3.5 text-right tabular-nums lg:table-cell">
                        {storyCount(r.id) > 0 ? (
                          <Link to={`/user-stories?requirement=${r.id}`} className="text-brand-700 hover:underline" aria-label={`${storyCount(r.id)} user stories for ${r.identifier}`}>
                            {storyCount(r.id)}
                          </Link>
                        ) : (
                          <span className="text-slate-500" title="No user stories">0</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-3.5 whitespace-nowrap text-slate-500 xl:table-cell">{formatDate(r.updatedAt)}</td>
                      <td className="hidden px-5 py-3.5 md:table-cell">
                        <div className="flex justify-end gap-1">
                          <ButtonLink to={requirementPaths.edit(r.id)} variant="ghost" size="sm" iconOnly icon={Pencil} aria-label={`Edit ${r.identifier}`} />
                          <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`Delete ${r.identifier}`} onClick={() => setPendingDelete(r)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollRegion>
          )}
        </Panel>
      </div>

      <DeleteRequirementDialog requirement={pendingDelete} onClose={() => setPendingDelete(null)} />
    </>
  );
}
