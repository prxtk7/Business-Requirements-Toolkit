import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cx } from '../../lib/cx';

type Tone = 'info' | 'warning' | 'error';

const tones: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'bg-brand-50 ring-brand-200 text-brand-900', icon: 'text-brand-600', Icon: Info },
  warning: { box: 'bg-amber-50 ring-amber-200 text-amber-900', icon: 'text-amber-600', Icon: AlertTriangle },
  error: { box: 'bg-red-50 ring-red-200 text-red-900', icon: 'text-red-600', Icon: AlertCircle },
};

interface AlertProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({ tone = 'info', title, children, onDismiss, className }: AlertProps) {
  const { box, icon, Icon } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('flex items-start gap-3 rounded-lg px-4 py-3 text-sm ring-1 ring-inset', box, className)}
    >
      <Icon aria-hidden="true" className={cx('mt-0.5 h-4 w-4 shrink-0', icon)} />
      <div className="flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
          aria-label="Dismiss message"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
