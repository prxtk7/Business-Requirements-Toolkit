import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, Pencil, Plus, Search, SearchX, Target, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import { TableScrollRegion } from '../../components/ui/TableScrollRegion';
import type { RequirementPriority, StoryStatus, UserStory } from '../../domain/types';
import { PRIORITY_LABELS, REQUIREMENT_PRIORITIES, isRequirementPriority } from '../../domain/requirementConfig';
import { STORY_STATUSES, STORY_STATUS_LABELS, isStoryStatus } from '../../domain/storyConfig';
import { compareIdentifiers } from '../../domain/requirements';
import {
  STORY_SORT_LABELS,
  countStoriesByStatus,
  filterStories,
  sortStories,
  type StoryFilter,
  type StorySort,
} from '../../domain/userStories';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate, pluralise } from '../../lib/format';
import { cx } from '../../lib/cx';
import { PriorityBadge } from '../requirements/requirementUi';
import { DeleteStoryDialog } from './DeleteStoryDialog';
import { RequirementIdLinks, StoryStatusBadge } from './storyUi';
import { storyPaths } from './storyPaths';

const SORTS = Object.keys(STORY_SORT_LABELS) as StorySort[];

export function UserStoriesPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<UserStory | null>(null);
  useDocumentTitle('User stories');

  const requirementParam = params.get('requirement');
  const priorityParam = params.get('priority');
  const statusParam = params.get('status');
  const sortParam = params.get('sort') as StorySort | null;
  const filter: StoryFilter = {
    query: params.get('q') ?? '',
    requirementId: requirementParam && workspace.requirements.some((r) => r.id === requirementParam) ? requirementParam : 'all',
    priority: isRequirementPriority(priorityParam) ? (priorityParam as RequirementPriority) : 'all',
    status: isStoryStatus(statusParam) ? (statusParam as StoryStatus) : 'all',
  };
  const sort: StorySort = sortParam && SORTS.includes(sortParam) ? sortParam : 'identifier';

  const all = workspace.userStories;
  const visible = sortStories(filterStories(all, filter), sort);
  const counts = countStoriesByStatus(all);
  const isFiltered = filter.query.trim() !== '' || filter.requirementId !== 'all' || filter.priority !== 'all' || filter.status !== 'all';
  const requirementsOf = (story: UserStory) => workspace.requirements.filter((r) => story.requirementIds.includes(r.id));

  const setParam = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value && value !== 'all' && !(key === 'sort' && value === 'identifier')) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const header = (
    <PageHeader
      eyebrow="User Stories"
      title="User stories"
      description="User-centred specifications derived from the requirements, each with Given/When/Then acceptance criteria."
      actions={
        <>
          {all.length > 0 && (
            <ButtonLink to={storyPaths.coverage} icon={Target}>
              Story coverage
            </ButtonLink>
          )}
          <ButtonLink to={storyPaths.create()} variant="primary" icon={Plus}>
            New user story
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
          icon={BookOpen}
          title="No user stories yet"
          description={
            workspace.requirements.length === 0 ? (
              <>
                User stories trace to requirements. <Link to="/requirements/new" className="font-medium text-brand-700 underline underline-offset-2">Add a requirement</Link> first.
              </>
            ) : (
              'Write stories from the user’s point of view — who needs what, and why — and link each one to the requirements it delivers.'
            )
          }
          action={
            workspace.requirements.length > 0 && (
              <ButtonLink to={storyPaths.create()} variant="primary" icon={Plus}>
                Write first user story
              </ButtonLink>
            )
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
          <p className="text-sm text-slate-500">
            Total <span className="ml-1 text-xl font-semibold text-slate-900 tabular-nums">{all.length}</span>
          </p>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase" id="story-status-counts">
              By status
            </p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="story-status-counts">
              {STORY_STATUSES.map((status) => (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() => setParam('status', filter.status === status ? 'all' : status)}
                    aria-pressed={filter.status === status}
                    className={cx(
                      'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                      filter.status === status ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {STORY_STATUS_LABELS[status]} <span className="tabular-nums">({counts[status]})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Register" description={isFiltered ? `${visible.length} of ${pluralise(all.length, 'user story', 'user stories')}` : pluralise(all.length, 'user story', 'user stories')} flush>
          <div className="space-y-3 border-b border-slate-200 px-5 py-4">
            <div className="relative">
              <label htmlFor="story-search" className="sr-only">
                Search user stories
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="story-search"
                type="search"
                value={filter.query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search by ID, title or user role"
                className="block h-10 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm shadow-sm placeholder:text-slate-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Filter by linked requirement"
                hideLabel
                value={filter.requirementId}
                options={[
                  { value: 'all', label: 'All requirements' },
                  ...[...workspace.requirements]
                    .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
                    .map((r) => ({ value: r.id, label: `${r.identifier} — ${r.title}` })),
                ]}
                onChange={(v) => setParam('requirement', v)}
              />
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
                options={[{ value: 'all', label: 'All statuses' }, ...STORY_STATUSES.map((s) => ({ value: s, label: STORY_STATUS_LABELS[s] }))]}
                onChange={(v) => setParam('status', v)}
              />
              <SelectField
                label="Sort by"
                hideLabel
                value={sort}
                options={SORTS.map((s) => ({ value: s, label: `Sort: ${STORY_SORT_LABELS[s]}` }))}
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
            {isFiltered ? `${pluralise(visible.length, 'user story', 'user stories')} match the current filters.` : ''}
          </p>

          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <SearchX aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No user stories match these filters</p>
            </div>
          ) : (
            <TableScrollRegion label="User stories table">
              <table className="min-w-full divide-y divide-slate-200 text-sm" aria-label="User stories">
                <thead className="bg-slate-50/60">
                  <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    <th scope="col" className="py-3 pr-2 pl-4 sm:px-5">ID</th>
                    <th scope="col" className="px-3 py-3">User story</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">User role</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">Requirements</th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Priority</th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Status</th>
                    <th scope="col" className="hidden px-3 py-3 text-right lg:table-cell">
                      <abbr title="Acceptance criteria" className="no-underline">Criteria</abbr>
                    </th>
                    <th scope="col" className="hidden px-3 py-3 xl:table-cell">Updated</th>
                    <th scope="col" className="hidden px-5 py-3 md:table-cell">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((s) => (
                    <tr key={s.id} className="align-top hover:bg-slate-50/60">
                      <td className="py-3.5 pr-2 pl-4 font-mono text-xs font-semibold whitespace-nowrap text-slate-700 sm:px-5">{s.identifier}</td>
                      <td className="max-w-md px-3 py-3.5">
                        <Link to={storyPaths.detail(s.id)} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {s.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500 lg:hidden">
                          {s.persona.label} · <RequirementIdLinks requirements={requirementsOf(s)} />
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                          <PriorityBadge priority={s.priority} />
                          <StoryStatusBadge status={s.status} />
                        </div>
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">
                        {s.persona.label}
                        {s.persona.stakeholderId === null && <span className="block text-xs text-slate-500">Custom persona</span>}
                      </td>
                      <td className="hidden px-3 py-3.5 lg:table-cell">
                        <RequirementIdLinks requirements={requirementsOf(s)} />
                      </td>
                      <td className="hidden px-3 py-3.5 md:table-cell">
                        <PriorityBadge priority={s.priority} />
                      </td>
                      <td className="hidden px-3 py-3.5 md:table-cell">
                        <StoryStatusBadge status={s.status} />
                      </td>
                      <td className="hidden px-3 py-3.5 text-right text-slate-700 tabular-nums lg:table-cell">{s.criteria.length}</td>
                      <td className="hidden px-3 py-3.5 whitespace-nowrap text-slate-500 xl:table-cell">{formatDate(s.updatedAt)}</td>
                      <td className="hidden px-5 py-3.5 md:table-cell">
                        <div className="flex justify-end gap-1">
                          <ButtonLink to={storyPaths.edit(s.id)} variant="ghost" size="sm" iconOnly icon={Pencil} aria-label={`Edit ${s.identifier}`} />
                          <Button variant="ghost" size="sm" iconOnly icon={Trash2} aria-label={`Delete ${s.identifier}`} onClick={() => setPendingDelete(s)} />
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

      <DeleteStoryDialog story={pendingDelete} onClose={() => setPendingDelete(null)} />
    </>
  );
}
