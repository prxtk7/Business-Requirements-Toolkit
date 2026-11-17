import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Pencil, Plus, Search, SearchX, Trash2, Users } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import { TableScrollRegion } from '../../components/ui/TableScrollRegion';
import type { Stakeholder } from '../../domain/types';
import { LEVEL_LABELS } from '../../domain/types';
import {
  ENGAGEMENT_STRATEGIES,
  STRATEGY_DETAILS,
  filterStakeholders,
  getEngagementStrategy,
  sortByPriority,
  type EngagementStrategy,
} from '../../domain/stakeholders';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pluralise } from '../../lib/format';
import { StakeholderGrid } from './StakeholderGrid';
import { StrategyBadge } from './StrategyBadge';
import { DeleteStakeholderDialog } from './DeleteStakeholderDialog';

type StrategyFilter = EngagementStrategy | 'all';

const STRATEGY_OPTIONS: { value: StrategyFilter; label: string }[] = [
  { value: 'all', label: 'All strategies' },
  ...ENGAGEMENT_STRATEGIES.map((s) => ({ value: s, label: STRATEGY_DETAILS[s].label })),
];

function parseStrategy(value: string | null): StrategyFilter {
  return value && (ENGAGEMENT_STRATEGIES as readonly string[]).includes(value) ? (value as EngagementStrategy) : 'all';
}

export function StakeholdersPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Stakeholder | null>(null);
  useDocumentTitle('Stakeholders');

  const query = params.get('q') ?? '';
  const strategy = parseStrategy(params.get('strategy'));
  const all = workspace.stakeholders;
  const visible = sortByPriority(filterStakeholders(all, { query, strategy }));
  const isFiltered = query.trim() !== '' || strategy !== 'all';

  const updateParam = (key: 'q' | 'strategy', value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value && value !== 'all') next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const header = (
    <PageHeader
      eyebrow="Stakeholder Analysis"
      title="Stakeholders"
      description="Identify who is affected by or can influence the project, what they expect, and how to engage them."
      actions={
        all.length > 0 && (
          <ButtonLink to="/stakeholders/new" variant="primary" icon={Plus}>
            Add stakeholder
          </ButtonLink>
        )
      }
    />
  );

  if (all.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Users}
          title="No stakeholders yet"
          description="Add the people, teams and groups with an interest in the project. Rating their interest and influence places them on the stakeholder map and suggests an engagement strategy."
          action={
            <ButtonLink to="/stakeholders/new" variant="primary" icon={Plus}>
              Add first stakeholder
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
        <Panel
          title="Stakeholder map"
          description="Position on the grid determines the recommended engagement strategy."
        >
          <StakeholderGrid stakeholders={all} />
        </Panel>

        <Panel title="Stakeholder register" description={pluralise(all.length, 'stakeholder')} flush>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <label htmlFor="stakeholder-search" className="sr-only">
                Search stakeholders
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                id="stakeholder-search"
                type="search"
                value={query}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder="Search by name, role or description"
                className="block h-10 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm shadow-sm placeholder:text-slate-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500"
              />
            </div>
            <div className="sm:w-52">
              <SelectField
                label="Filter by engagement strategy"
                hideLabel
                value={strategy}
                options={STRATEGY_OPTIONS}
                onChange={(v) => updateParam('strategy', v)}
              />
            </div>
          </div>

          <p className="sr-only" role="status">
            {isFiltered ? `${pluralise(visible.length, 'stakeholder')} match the current filters.` : ''}
          </p>

          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <SearchX aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No stakeholders match these filters</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            </div>
          ) : (
            <TableScrollRegion label="Stakeholder register table">
              <table className="min-w-full divide-y divide-slate-200 text-sm" aria-label="Stakeholder register">
                <thead className="bg-slate-50/60">
                  <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    <th scope="col" className="px-5 py-3">
                      Stakeholder
                    </th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">
                      Interest
                    </th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">
                      Influence
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Strategy
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="max-w-xs px-5 py-3.5">
                        <Link to={`/stakeholders/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {s.name}
                        </Link>
                        <p className="mt-0.5 truncate text-slate-500" title={s.role}>
                          {s.role}
                        </p>
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 md:table-cell">{LEVEL_LABELS[s.interest]}</td>
                      <td className="hidden px-3 py-3.5 text-slate-700 md:table-cell">{LEVEL_LABELS[s.influence]}</td>
                      <td className="px-3 py-3.5">
                        <StrategyBadge strategy={getEngagementStrategy(s.influence, s.interest)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <ButtonLink
                            to={`/stakeholders/${s.id}/edit`}
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Pencil}
                            aria-label={`Edit ${s.name}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Trash2}
                            aria-label={`Delete ${s.name}`}
                            onClick={() => setPendingDelete(s)}
                          />
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

      <DeleteStakeholderDialog stakeholder={pendingDelete} onClose={() => setPendingDelete(null)} />
    </>
  );
}
