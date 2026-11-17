import { Link } from 'react-router';
import type { Level, Stakeholder } from '../../domain/types';
import { LEVEL_LABELS } from '../../domain/types';
import {
  ENGAGEMENT_STRATEGIES,
  STRATEGY_DETAILS,
  countByStrategy,
  getEngagementStrategy,
  gridCellKey,
  groupByGridCell,
} from '../../domain/stakeholders';
import { cx } from '../../lib/cx';
import { STRATEGY_STYLE } from './strategyStyles';

const INFLUENCE_ROWS: Level[] = ['high', 'medium', 'low'];
const INTEREST_COLUMNS: Level[] = ['low', 'medium', 'high'];

/**
 * Interest / influence grid. Influence runs bottom-to-top and interest
 * left-to-right, matching the conventional stakeholder map orientation.
 */
export function StakeholderGrid({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const cells = groupByGridCell(stakeholders);
  const counts = countByStrategy(stakeholders);

  return (
    <div>
      <div className="flex gap-3">
        {/* Y axis label */}
        <div className="flex w-5 shrink-0 items-center justify-center">
          <span className="-rotate-90 text-xs font-semibold tracking-wider whitespace-nowrap text-slate-500 uppercase">
            Influence
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <table className="w-full table-fixed border-separate border-spacing-1.5">
            <caption className="sr-only">
              Stakeholders mapped by influence (rows) and interest (columns), with the resulting engagement strategy
            </caption>
            {/* table-fixed takes widths from columns, so size the row-label column explicitly. */}
            <colgroup>
              <col className="w-14 sm:w-16" />
              <col />
              <col />
              <col />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th scope="col">Influence</th>
                {INTEREST_COLUMNS.map((interest) => (
                  <th key={interest} scope="col">
                    Interest: {LEVEL_LABELS[interest]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INFLUENCE_ROWS.map((influence) => (
                <tr key={influence}>
                  <th scope="row" className="pr-1 text-right align-middle text-xs font-medium text-slate-500">
                    <span className="sr-only">Influence: </span>
                    {LEVEL_LABELS[influence]}
                  </th>
                  {INTEREST_COLUMNS.map((interest) => {
                    const strategy = getEngagementStrategy(influence, interest);
                    const members = cells.get(gridCellKey(influence, interest)) ?? [];
                    return (
                      <td
                        key={interest}
                        className={cx('h-28 rounded-md p-2 align-top ring-1 ring-slate-200/70 ring-inset sm:h-32', STRATEGY_STYLE[strategy].cell)}
                      >
                        <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase sm:text-[11px]">
                          {STRATEGY_DETAILS[strategy].label}
                        </p>
                        {members.length > 0 && (
                          <ul className="mt-1.5 flex flex-wrap gap-1">
                            {members.map((s) => (
                              <li key={s.id} className="max-w-full">
                                <Link
                                  to={`/stakeholders/${s.id}`}
                                  className="block max-w-full truncate rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-brand-800 hover:ring-brand-300"
                                  title={`${s.name} — ${s.role}`}
                                >
                                  {s.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr aria-hidden="true">
                {/* Empty corner cell beside the row headings: not a control, nothing to label. */}
                {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                <td />
                {INTEREST_COLUMNS.map((interest) => (
                  <td key={interest} className="pt-1 text-center text-xs font-medium text-slate-500">
                    {LEVEL_LABELS[interest]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-center text-xs font-semibold tracking-wider text-slate-500 uppercase" aria-hidden="true">
            Interest
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
        {ENGAGEMENT_STRATEGIES.map((strategy) => (
          <div key={strategy} className="flex gap-2.5">
            <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', STRATEGY_STYLE[strategy].dot)} aria-hidden="true" />
            <div>
              <dt className="text-sm font-medium text-slate-800">
                {STRATEGY_DETAILS[strategy].label}{' '}
                <span className="font-normal text-slate-500 tabular-nums">({counts[strategy]})</span>
              </dt>
              <dd className="text-sm text-slate-500">{STRATEGY_DETAILS[strategy].guidance}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
