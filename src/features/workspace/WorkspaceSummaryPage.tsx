import { Link } from 'react-router';
import { ArrowRight, ClipboardList, FileText, GitBranch, ListChecks, Plus, ShieldAlert, Users } from 'lucide-react';
import { summariseCoverage } from '../../domain/storyCoverage';
import { summariseRisks } from '../../domain/risks';
import { summariseRequirements } from '../../domain/requirements';
import { PageHeader } from '../../components/layout/PageHeader';
import { ButtonLink } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { getProjectCompleteness } from '../../domain/project';
import { ENGAGEMENT_STRATEGIES, STRATEGY_DETAILS, countByStrategy, sortByPriority } from '../../domain/stakeholders';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pluralise } from '../../lib/format';
import { cx } from '../../lib/cx';
import { CompletenessChecklist } from '../overview/CompletenessChecklist';
import { STRATEGY_STYLE } from '../stakeholders/strategyStyles';

export function WorkspaceSummaryPage() {
  const { workspace } = useWorkspace();
  const { project, stakeholders } = workspace;
  useDocumentTitle('Workspace summary');
  const requirementSummary = summariseRequirements(workspace.requirements);
  const coverage = summariseCoverage(workspace);
  const riskSummary = summariseRisks(workspace.risks);

  const completeness = getProjectCompleteness(project);
  const counts = countByStrategy(stakeholders);
  const keyStakeholders = sortByPriority(stakeholders).filter((s) => s.influence === 'high' && s.interest === 'high');

  return (
    <>
      <PageHeader
        eyebrow="Workspace summary"
        title={project.name || 'Untitled project'}
        description={project.organisation || 'Overview of analysis progress across modules.'}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Project overview"
          actions={
            <Link to="/overview" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
              Open <ArrowRight aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">project overview</span>
            </Link>
          }
        >
          {project.problemStatement ? (
            <div className="mb-5">
              <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Problem statement</h3>
              <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-slate-700">{project.problemStatement}</p>
            </div>
          ) : (
            <div className="mb-5 flex items-start gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                No problem statement yet.{' '}
                <Link to="/overview/edit" className="font-medium text-brand-700 underline underline-offset-2">
                  Describe the project
                </Link>{' '}
                to anchor the analysis.
              </p>
            </div>
          )}
          <CompletenessChecklist items={completeness} />
        </Panel>

        <Panel
          title="Stakeholders"
          description={pluralise(stakeholders.length, 'stakeholder')}
          actions={
            <Link to="/stakeholders" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
              Open <ArrowRight aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">stakeholders</span>
            </Link>
          }
        >
          {stakeholders.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p>No stakeholders recorded. Identify who is affected by the project and who can influence it.</p>
              </div>
              <ButtonLink to="/stakeholders/new" size="sm" variant="secondary" icon={Plus}>
                Add stakeholder
              </ButtonLink>
            </div>
          ) : (
            <>
              <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">By engagement strategy</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {ENGAGEMENT_STRATEGIES.map((strategy) => (
                  <li key={strategy}>
                    <Link
                      to={`/stakeholders?strategy=${strategy}`}
                      className="-mx-2 flex items-center justify-between rounded px-2 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2.5 text-slate-700">
                        <span className={cx('h-2 w-2 rounded-full', STRATEGY_STYLE[strategy].dot)} aria-hidden="true" />
                        {STRATEGY_DETAILS[strategy].label}
                      </span>
                      <span className="font-medium text-slate-900 tabular-nums">{counts[strategy]}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              {keyStakeholders.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Key stakeholders (high interest, high influence)
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {keyStakeholders.map((s) => (
                      <li key={s.id} className="text-sm">
                        <Link to={`/stakeholders/${s.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {s.name}
                        </Link>
                        <span className="text-slate-500"> — {s.role}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Panel>
        <Panel
          title="Process analysis"
          className="lg:col-span-2"
          actions={
            <Link to="/processes" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
              Open <ArrowRight aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">process analysis</span>
            </Link>
          }
        >
          {workspace.processes.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <GitBranch aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p>No processes documented. Map the current (AS-IS) process to find bottlenecks, then design the TO-BE process.</p>
              </div>
              <ButtonLink to="/processes/new?type=as-is" size="sm" variant="secondary" icon={Plus}>
                Document AS-IS process
              </ButtonLink>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['AS-IS processes', workspace.processes.filter((p) => p.type === 'as-is').length],
                ['TO-BE processes', workspace.processes.filter((p) => p.type === 'to-be').length],
                ['Bottlenecks', workspace.bottlenecks.length],
                ['Improvements', workspace.improvements.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>

        <Panel
          title="Requirements"
          className="lg:col-span-2"
          actions={
            <Link to="/requirements" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
              Open <ArrowRight aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">requirements register</span>
            </Link>
          }
        >
          {requirementSummary.total === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <ListChecks aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p>No requirements recorded. Capture what the solution must do and trace each requirement to its source.</p>
              </div>
              <ButtonLink to="/requirements/new" size="sm" variant="secondary" icon={Plus}>
                Add requirement
              </ButtonLink>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Requirements summary">
              {(
                [
                  ['Total', requirementSummary.total, '/requirements'],
                  ['Functional', requirementSummary.functional, '/requirements?type=functional'],
                  ['Non-functional', requirementSummary.nonFunctional, '/requirements?type=non-functional'],
                  ['Must Have', requirementSummary.must, '/requirements?priority=must'],
                  ['Approved', requirementSummary.approved, '/requirements?status=approved'],
                  ['Awaiting review', requirementSummary.awaitingReview, null],
                ] as [string, number, string | null][]
              ).map(([label, value, to]) => (
                <div key={label} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
                  <dt className="text-xs font-medium text-slate-500">
                    {to ? (
                      <Link to={to} className="hover:text-brand-700 hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </dt>
                  <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {requirementSummary.total > 0 && (
            <p className="mt-3 text-xs text-slate-500">“Awaiting review” counts requirements with status Proposed or Under Review.</p>
          )}
        </Panel>

        <Panel
          title="User stories and acceptance criteria"
          className="lg:col-span-2"
          actions={
            <Link to="/coverage" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
              Coverage <ArrowRight aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">of requirements by user stories</span>
            </Link>
          }
        >
          {coverage.totalStories === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <ClipboardList aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p>No user stories yet. Translate requirements into user stories with Given/When/Then acceptance criteria.</p>
              </div>
              <ButtonLink to="/user-stories/new" size="sm" variant="secondary" icon={Plus}>
                Write user story
              </ButtonLink>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="User story summary">
                {(
                  [
                    ['User stories', coverage.totalStories, '/user-stories'],
                    ['Requirements covered', coverage.requirementsCovered, '/coverage?show=covered'],
                    ['Without stories', coverage.requirementsWithoutStories, '/coverage?show=uncovered'],
                    ['Acceptance criteria', coverage.criteria.total, null],
                    ['Criteria passed', coverage.criteria.passed, null],
                    ['Criteria not tested', coverage.criteria['not-tested'], null],
                  ] as [string, number, string | null][]
                ).map(([label, value, to]) => (
                  <div key={label} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
                    <dt className="text-xs font-medium text-slate-500">
                      {to ? (
                        <Link to={to} className="hover:text-brand-700 hover:underline">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </dt>
                    <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                {coverage.criteria.failed} failed and {coverage.criteria.blocked} blocked criteria. Verification statuses are documented
                outcomes; the toolkit does not run tests.
              </p>
            </>
          )}
        </Panel>

        <Panel
          title="Risk management"
          className="lg:col-span-2"
          actions={
            <div className="flex items-center gap-4">
              <Link to="/risks" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
                Register <ArrowRight aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">of risks</span>
              </Link>
              <Link to="/risk-matrix" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
                Matrix <ArrowRight aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">of risks</span>
              </Link>
            </div>
          }
        >
          {riskSummary.total === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p>No risks recorded. Identify what could go wrong with the project and how it will be handled.</p>
              </div>
              <ButtonLink to="/risks/new" size="sm" variant="secondary" icon={Plus}>
                Record risk
              </ButtonLink>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Risk summary">
              {(
                [
                  ['Total risks', riskSummary.total, '/risks'],
                  ['Critical', riskSummary.bySeverity.critical, '/risks?severity=critical'],
                  ['High', riskSummary.bySeverity.high, '/risks?severity=high'],
                  ['Medium', riskSummary.bySeverity.medium, '/risks?severity=medium'],
                  ['Low', riskSummary.bySeverity.low, '/risks?severity=low'],
                  ['Open', riskSummary.open, null],
                  ['Materialised', riskSummary.materialised, '/risks?status=materialised'],
                  ['Closed', riskSummary.closed, '/risks?status=closed'],
                ] as [string, number, string | null][]
              ).map(([label, value, to]) => (
                <div key={label} className="rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
                  <dt className="text-xs font-medium text-slate-500">
                    {to ? (
                      <Link to={to} className="hover:text-brand-700 hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </dt>
                  <dd className="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {riskSummary.total > 0 && (
            <p className="mt-3 text-xs text-slate-500">Open = Identified, Under Assessment, Response Planned, In Progress or Monitoring.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
