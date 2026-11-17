import { Link, useSearchParams } from 'react-router';
import { Grid3x3, ListChecks, Plus } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import { IMPACT_LABELS, PROBABILITY_LABELS, SEVERITY_BANDS, SEVERITY_LABELS } from '../../domain/riskConfig';
import { buildRiskMatrix, isOpenRisk, ownerName } from '../../domain/risks';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { pluralise } from '../../lib/format';
import { cx } from '../../lib/cx';
import { RiskStatusBadge } from './riskUi';
import { SEVERITY_STYLE } from './riskStyles';
import { riskPaths } from './riskPaths';

type Scope = 'all' | 'open';

export function RiskMatrixPage() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useSearchParams();
  useDocumentTitle('Risk matrix');

  const scope: Scope = params.get('show') === 'open' ? 'open' : 'all';
  const risks = scope === 'open' ? workspace.risks.filter(isOpenRisk) : workspace.risks;
  const matrix = buildRiskMatrix(risks);
  const selectedP = Number(params.get('p'));
  const selectedI = Number(params.get('i'));
  const selected = matrix.flat().find((c) => c.probability === selectedP && c.impact === selectedI);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  const header = (
    <PageHeader
      eyebrow="Risk Management"
      title="Risk matrix"
      description="Risks plotted by probability and impact. Each cell shows its score (probability × impact) and how many risks fall in it; select a cell to list them."
      actions={
        <ButtonLink to={riskPaths.list} icon={ListChecks}>
          Risk register
        </ButtonLink>
      }
    />
  );

  if (workspace.risks.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Grid3x3}
          title="No risks to plot"
          description="Record risks with a probability and impact rating to see them on the matrix."
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
        <Panel
          title="Probability × impact"
          description={`${pluralise(risks.length, 'risk')} shown`}
          actions={
            <div className="w-48">
              <SelectField<Scope>
                label="Risks to show"
                hideLabel
                value={scope}
                options={[
                  { value: 'all', label: 'All risks' },
                  { value: 'open', label: 'Open risks only' },
                ]}
                onChange={(v) => update({ show: v === 'open' ? 'open' : null })}
              />
            </div>
          }
        >
          <div className="flex gap-2 sm:gap-3">
            <div className="flex w-4 shrink-0 items-center justify-center sm:w-5">
              <span className="-rotate-90 text-xs font-semibold tracking-wider whitespace-nowrap text-slate-500 uppercase">Probability</span>
            </div>
            <div className="min-w-0 flex-1">
              <table className="w-full table-fixed border-separate border-spacing-1">
                <caption className="sr-only">
                  Risk matrix: probability from 5 (top) to 1 (bottom) against impact from 1 (left) to 5 (right). Each cell shows the score and
                  the number of risks.
                </caption>
                <colgroup>
                  <col className="w-11 sm:w-28" />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    {/* Empty corner cell beside the row headings: not a control, nothing to label. */}
                    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                    <td />
                    {[1, 2, 3, 4, 5].map((impact) => (
                      <th key={impact} scope="col" className="sr-only">
                        Impact {impact} — {IMPACT_LABELS[impact]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row[0]!.probability}>
                      <th scope="row" className="pr-1 text-right align-middle text-xs font-medium text-slate-600">
                        <span className="tabular-nums">{row[0]!.probability}</span>
                        <span className="hidden sm:inline"> {PROBABILITY_LABELS[row[0]!.probability]}</span>
                      </th>
                      {row.map((cell) => {
                        const isSelected = selected === cell;
                        const count = cell.risks.length;
                        return (
                          <td key={cell.impact} className="p-0">
                            <button
                              type="button"
                              onClick={() => update(isSelected ? { p: null, i: null } : { p: String(cell.probability), i: String(cell.impact) })}
                              aria-pressed={isSelected}
                              aria-label={`Probability ${cell.probability} ${PROBABILITY_LABELS[cell.probability]}, impact ${cell.impact} ${IMPACT_LABELS[cell.impact]}: score ${cell.score}, ${SEVERITY_LABELS[cell.severity]}, ${pluralise(count, 'risk')}`}
                              className={cx(
                                'flex h-14 w-full flex-col items-center justify-center rounded-md text-center ring-inset transition-shadow sm:h-20',
                                SEVERITY_STYLE[cell.severity].cell,
                                isSelected ? 'ring-2 ring-brand-700' : 'ring-1 ring-black/5 hover:ring-2 hover:ring-slate-400',
                              )}
                            >
                              <span className={cx('tabular-nums', count > 0 ? 'text-lg font-semibold sm:text-2xl' : 'text-sm opacity-40')} aria-hidden="true">
                                {count > 0 ? count : '·'}
                              </span>
                              <span className="text-[10px] tabular-nums opacity-70 sm:text-xs" aria-hidden="true">
                                score {cell.score}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr aria-hidden="true">
                    {/* Empty corner cell beside the row headings: not a control, nothing to label. */}
                    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                    <td />
                    {[1, 2, 3, 4, 5].map((impact) => (
                      <td key={impact} className="pt-1 text-center text-xs font-medium text-slate-600">
                        <span className="tabular-nums">{impact}</span>
                        <span className="hidden md:block">{IMPACT_LABELS[impact]}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="mt-1 text-center text-xs font-semibold tracking-wider text-slate-500 uppercase" aria-hidden="true">
                Impact
              </p>
            </div>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-700" aria-label="Severity legend">
            {[...SEVERITY_BANDS].reverse().map((band) => (
              <li key={band.severity} className="flex items-center gap-2">
                <span className={cx('h-3 w-3 rounded-sm', SEVERITY_STYLE[band.severity].swatch)} aria-hidden="true" />
                <span>
                  <span className="font-medium">{band.label}</span> score {band.min}–{band.max}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={
            selected
              ? `Probability ${selected.probability} (${PROBABILITY_LABELS[selected.probability]}) × impact ${selected.impact} (${IMPACT_LABELS[selected.impact]})`
              : 'Selected cell'
          }
          description={selected ? `Score ${selected.score} · ${SEVERITY_LABELS[selected.severity]} · ${pluralise(selected.risks.length, 'risk')}` : undefined}
          flush
        >
          <div aria-live="polite">
            {!selected ? (
              <p className="px-5 py-6 text-sm text-slate-500">Select a cell in the matrix to list its risks.</p>
            ) : selected.risks.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">No risks in this cell.</p>
            ) : (
              <ul className="divide-y divide-slate-100" aria-label="Risks in the selected cell">
                {selected.risks.map((r) => (
                  <li key={r.id} className="flex flex-col items-start gap-1.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link to={riskPaths.detail(r.id)} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        {r.identifier}
                      </Link>{' '}
                      <Link to={riskPaths.detail(r.id)} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-slate-500">Owner: {ownerName(r.owner, workspace)}</p>
                    </div>
                    <RiskStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
