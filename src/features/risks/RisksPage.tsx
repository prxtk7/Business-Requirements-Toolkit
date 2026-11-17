import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Grid3x3, Pencil, Plus, Search, SearchX, ShieldAlert, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import { TableScrollRegion } from '../../components/ui/TableScrollRegion';
import type { Risk, RiskResponse, RiskSeverity, RiskStatus } from '../../domain/types';
import {
  RESPONSE_DETAILS,
  RISK_CATEGORIES,
  RISK_RESPONSES,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  isRiskCategory,
  isRiskResponse,
  isRiskStatus,
  riskCategoryLabel,
} from '../../domain/riskConfig';
import {
  RISK_SORT_LABELS,
  filterRisks,
  ownerKey,
  ownerName,
  sortRisks,
  summariseRisks,
  type RiskFilter,
  type RiskSort,
} from '../../domain/risks';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDate, pluralise } from '../../lib/format';
import { cx } from '../../lib/cx';
import { DeleteRiskDialog } from './DeleteRiskDialog';
import { RiskScore, RiskStatusBadge } from './riskUi';
import { SEVERITY_STYLE } from './riskStyles';
import { riskPaths } from './riskPaths';

const SORTS = Object.keys(RISK_SORT_LABELS) as RiskSort[];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
        active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

export function RisksPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Risk | null>(null);
  useDocumentTitle('Risk register');

  const all = workspace.risks;
  const ownerOptions = [...new Map(all.map((r) => [ownerKey(r.owner), ownerName(r.owner, workspace)])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));

  const p = (key: string) => params.get(key);
  const severityParam = p('severity');
  const filter: RiskFilter = {
    query: p('q') ?? '',
    category: isRiskCategory(p('category')) ? (p('category') as string) : 'all',
    severity: SEVERITIES.includes(severityParam as RiskSeverity) ? (severityParam as RiskSeverity) : 'all',
    status: isRiskStatus(p('status')) ? (p('status') as RiskStatus) : 'all',
    response: isRiskResponse(p('response')) ? (p('response') as RiskResponse) : 'all',
    owner: ownerOptions.some((o) => o.value === p('owner')) ? (p('owner') as string) : 'all',
  };
  const sortParam = p('sort') as RiskSort | null;
  const sort: RiskSort = sortParam && SORTS.includes(sortParam) ? sortParam : 'identifier';

  const visible = sortRisks(filterRisks(all, filter, workspace), sort);
  const summary = summariseRisks(all);
  const isFiltered = Object.entries(filter).some(([key, value]) => (key === 'query' ? String(value).trim() !== '' : value !== 'all'));

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
      eyebrow="Risk Management"
      title="Risk register"
      description="Risks to the project: what could happen, how serious it would be, who owns it and how it is being handled."
      actions={
        <>
          {all.length > 0 && (
            <ButtonLink to={riskPaths.matrix} icon={Grid3x3}>
              Risk matrix
            </ButtonLink>
          )}
          <ButtonLink to={riskPaths.create} variant="primary" icon={Plus}>
            New risk
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
          icon={ShieldAlert}
          title="No risks recorded yet"
          description="Record what could go wrong with the project, rate its probability and impact, and agree who owns it and how it will be handled."
          action={
            <ButtonLink to={riskPaths.create} variant="primary" icon={Plus}>
              Record first risk
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
          <p className="text-sm text-slate-500">
            Total <span className="ml-1 text-xl font-semibold text-slate-900 tabular-nums">{summary.total}</span>
          </p>
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase" id="severity-counts">
                By severity
              </p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="severity-counts">
                {SEVERITIES.map((s) => (
                  <li key={s}>
                    <Chip active={filter.severity === s} onClick={() => setParam('severity', filter.severity === s ? 'all' : s)}>
                      <span className={cx('mr-1.5 inline-block h-2 w-2 rounded-sm align-middle', SEVERITY_STYLE[s].swatch)} aria-hidden="true" />
                      {SEVERITY_LABELS[s]} <span className="tabular-nums">({summary.bySeverity[s]})</span>
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase" id="risk-status-counts">
                By status
              </p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="risk-status-counts">
                {RISK_STATUSES.map((s) => (
                  <li key={s}>
                    <Chip active={filter.status === s} onClick={() => setParam('status', filter.status === s ? 'all' : s)}>
                      {RISK_STATUS_LABELS[s]} <span className="tabular-nums">({summary.byStatus[s]})</span>
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Register" description={isFiltered ? `${visible.length} of ${pluralise(all.length, 'risk')}` : pluralise(all.length, 'risk')} flush>
          <div className="space-y-3 border-b border-slate-200 px-5 py-4">
            <div className="relative">
              <label htmlFor="risk-search" className="sr-only">
                Search risks
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="risk-search"
                type="search"
                value={filter.query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search by ID, title, description or owner"
                className="block h-10 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm shadow-sm placeholder:text-slate-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SelectField label="Filter by category" hideLabel value={filter.category} options={[{ value: 'all', label: 'All categories' }, ...RISK_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]} onChange={(v) => setParam('category', v)} />
              <SelectField label="Filter by severity" hideLabel value={filter.severity} options={[{ value: 'all', label: 'All severities' }, ...SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))]} onChange={(v) => setParam('severity', v)} />
              <SelectField label="Filter by status" hideLabel value={filter.status} options={[{ value: 'all', label: 'All statuses' }, ...RISK_STATUSES.map((s) => ({ value: s, label: RISK_STATUS_LABELS[s] }))]} onChange={(v) => setParam('status', v)} />
              <SelectField label="Filter by response strategy" hideLabel value={filter.response} options={[{ value: 'all', label: 'All responses' }, ...RISK_RESPONSES.map((r) => ({ value: r, label: RESPONSE_DETAILS[r].label }))]} onChange={(v) => setParam('response', v)} />
              <SelectField label="Filter by owner" hideLabel value={filter.owner} options={[{ value: 'all', label: 'All owners' }, ...ownerOptions]} onChange={(v) => setParam('owner', v)} />
              <SelectField label="Sort by" hideLabel value={sort} options={SORTS.map((s) => ({ value: s, label: `Sort: ${RISK_SORT_LABELS[s]}` }))} onChange={(v) => setParam('sort', v)} />
            </div>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={() => setParams(sort === 'identifier' ? {} : { sort }, { replace: true })}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="sr-only" role="status">
            {isFiltered ? `${pluralise(visible.length, 'risk')} match the current filters.` : ''}
          </p>

          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <SearchX aria-hidden="true" className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-800">No risks match these filters</p>
            </div>
          ) : (
            <TableScrollRegion label="Risks table">
              <table className="min-w-full divide-y divide-slate-200 text-sm" aria-label="Risks">
                <thead className="bg-slate-50/60">
                  <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    <th scope="col" className="py-3 pr-2 pl-4 sm:px-5">ID</th>
                    <th scope="col" className="px-3 py-3">Risk</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">Category</th>
                    <th scope="col" className="hidden px-3 py-3 text-center xl:table-cell">
                      <abbr title="Probability" className="no-underline">P</abbr>
                    </th>
                    <th scope="col" className="hidden px-3 py-3 text-center xl:table-cell">
                      <abbr title="Impact" className="no-underline">I</abbr>
                    </th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Score</th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Status</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">Owner</th>
                    <th scope="col" className="hidden px-3 py-3 xl:table-cell">Updated</th>
                    <th scope="col" className="hidden px-5 py-3 md:table-cell">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-slate-50/60">
                      <td className="py-3.5 pr-2 pl-4 font-mono text-xs font-semibold whitespace-nowrap text-slate-700 sm:px-5">{r.identifier}</td>
                      <td className="max-w-md px-3 py-3.5">
                        <Link to={riskPaths.detail(r.id)} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {r.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500 lg:hidden">
                          {riskCategoryLabel(r.category)} · {ownerName(r.owner, workspace)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                          <RiskScore risk={r} />
                          <RiskStatusBadge status={r.status} />
                        </div>
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">{riskCategoryLabel(r.category)}</td>
                      <td className="hidden px-3 py-3.5 text-center tabular-nums xl:table-cell">{r.probability}</td>
                      <td className="hidden px-3 py-3.5 text-center tabular-nums xl:table-cell">{r.impact}</td>
                      <td className="hidden px-3 py-3.5 md:table-cell">
                        <RiskScore risk={r} />
                      </td>
                      <td className="hidden px-3 py-3.5 md:table-cell">
                        <RiskStatusBadge status={r.status} />
                      </td>
                      <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">
                        {ownerName(r.owner, workspace)}
                        {r.owner.stakeholderId === null && <span className="block text-xs text-slate-500">Custom owner</span>}
                      </td>
                      <td className="hidden px-3 py-3.5 whitespace-nowrap text-slate-500 xl:table-cell">{formatDate(r.updatedAt)}</td>
                      <td className="hidden px-5 py-3.5 md:table-cell">
                        <div className="flex justify-end gap-1">
                          <ButtonLink to={riskPaths.edit(r.id)} variant="ghost" size="sm" iconOnly icon={Pencil} aria-label={`Edit ${r.identifier}`} />
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

      <DeleteRiskDialog risk={pendingDelete} onClose={() => setPendingDelete(null)} />
    </>
  );
}
