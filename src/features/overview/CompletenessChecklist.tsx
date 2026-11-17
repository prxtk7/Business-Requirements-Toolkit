import { CheckCircle2, Circle } from 'lucide-react';
import type { CompletenessItem } from '../../domain/project';
import { cx } from '../../lib/cx';

export function CompletenessChecklist({ items }: { items: CompletenessItem[] }) {
  const done = items.filter((i) => i.complete).length;
  const percent = Math.round((done / items.length) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{done}</span> of {items.length} sections documented
        </p>
        <p className="text-xs tabular-nums text-slate-500">{percent}%</p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Project overview completeness"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {item.complete ? (
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle aria-hidden="true" className="h-4 w-4 text-slate-300" />
            )}
            <span className={cx(item.complete ? 'text-slate-700' : 'text-slate-500')}>{item.label}</span>
            <span className="sr-only">{item.complete ? '(documented)' : '(not yet documented)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
