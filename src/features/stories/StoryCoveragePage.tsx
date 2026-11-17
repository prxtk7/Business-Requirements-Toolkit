import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import { TableScrollRegion } from '../../components/ui/TableScrollRegion';
import { buildCoverage, filterCoverage, summariseCoverage, type CoverageFilter } from '../../domain/storyCoverage';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { VERIFICATION_DISCLAIMER } from './storyUi';
import { storyPaths } from './storyPaths';

const FILTERS: { value: CoverageFilter; label: string }[] = [
  { value: 'all', label: 'All requirements' },
  { value: 'uncovered', label: 'Without user stories' },
  { value: 'covered', label: 'With user stories' },
];

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">
        {value}
        {detail && <span className="ml-1 text-sm font-normal text-slate-500">{detail}</span>}
      </dd>
    </div>
  );
}

export function StoryCoveragePage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  useDocumentTitle('Story coverage');

  const filter = (FILTERS.find((f) => f.value === params.get('show'))?.value ?? 'all') as CoverageFilter;
  const summary = summariseCoverage(workspace);
  const rows = filterCoverage(buildCoverage(workspace), filter);

  const header = (
    <PageHeader
      eyebrow="User Stories"
      title="Requirement coverage"
      description="How requirements are translated into user stories, and the documented verification of their acceptance criteria."
      back={{ to: storyPaths.list, label: 'User stories' }}
    />
  );

  if (workspace.requirements.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={BookOpen}
          title="No requirements to cover"
          description="Coverage shows which requirements have user stories. Add requirements first."
          action={<ButtonLink to="/requirements/new" variant="primary">Add requirement</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        <Panel title="Story coverage" description="Whether each requirement has at least one user story.">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="User stories" value={summary.totalStories} />
            <Stat label="Requirements covered" value={summary.requirementsCovered} detail={`of ${summary.totalRequirements}`} />
            <Stat label="Requirements without stories" value={summary.requirementsWithoutStories} detail={`of ${summary.totalRequirements}`} />
          </dl>
        </Panel>

        <Panel title="Acceptance criteria verification" description="Documented outcomes across all stories — separate from story status.">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Total criteria" value={summary.criteria.total} />
            <Stat label="Passed" value={summary.criteria.passed} />
            <Stat label="Not tested" value={summary.criteria['not-tested']} />
            <Stat label="Failed" value={summary.criteria.failed} />
            <Stat label="Blocked" value={summary.criteria.blocked} />
          </dl>
          <p className="mt-3 text-xs text-slate-500">{VERIFICATION_DISCLAIMER}</p>
        </Panel>

        <Panel
          title="Coverage by requirement"
          actions={
            <div className="w-56">
              <SelectField label="Show" hideLabel value={filter} options={FILTERS} onChange={(v) => setParams(v === 'all' ? {} : { show: v }, { replace: true })} />
            </div>
          }
          flush
        >
          <TableScrollRegion label="Requirement coverage table">
            <table className="min-w-full divide-y divide-slate-200 text-sm" aria-label="Requirement coverage">
              <thead className="bg-slate-50/60">
                <tr className="text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  <th scope="col" className="py-3 pr-2 pl-4 sm:px-5">Requirement</th>
                  <th scope="col" className="hidden px-3 py-3 md:table-cell">Title</th>
                  <th scope="col" className="px-3 py-3">User stories</th>
                  <th scope="col" className="hidden px-3 py-3 text-right sm:table-cell">Stories</th>
                  <th scope="col" className="px-3 py-3">Coverage</th>
                  <th scope="col" className="hidden px-5 py-3 lg:table-cell">Criteria verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.requirement.id} className={row.covered ? 'align-top' : 'bg-amber-50/40 align-top'}>
                    <td className="py-3 pr-2 pl-4 sm:px-5">
                      <Link to={`/requirements/${row.requirement.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        {row.requirement.identifier}
                      </Link>
                      <span className="mt-0.5 block text-xs text-slate-600 md:hidden">{row.requirement.title}</span>
                    </td>
                    <td className="hidden px-3 py-3 text-slate-800 md:table-cell">{row.requirement.title}</td>
                    <td className="px-3 py-3">
                      {row.stories.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.stories.map((s) => (
                            <li key={s.id}>
                              <Link to={storyPaths.detail(s.id)} className="font-mono text-xs font-semibold text-brand-700 hover:underline" title={s.title}>
                                {s.identifier}
                              </Link>{' '}
                              <span className="hidden text-xs text-slate-600 xl:inline">{s.title}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{row.stories.length}</td>
                    <td className="px-3 py-3">
                      {row.covered ? (
                        <span className="text-sm text-emerald-800">Covered</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
                          <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                          No user stories
                        </span>
                      )}
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 lg:table-cell">
                      {row.criteria.total === 0 ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <>
                          {row.criteria.passed} of {row.criteria.total} passed
                          {row.criteria.failed + row.criteria.blocked > 0 && (
                            <span className="block text-xs text-slate-500">
                              {row.criteria.failed} failed · {row.criteria.blocked} blocked
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollRegion>
        </Panel>
      </div>
    </>
  );
}
