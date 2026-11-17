import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { ToastContext, type ToastApi, type ToastTone } from './toastContext';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const DURATION: Record<ToastTone, number> = { success: 4000, error: 8000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, tone, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {/* Separate live regions so errors are announced assertively. */}
        <div aria-live="polite" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts
            .filter((t) => t.tone === 'success')
            .map((t) => (
              <Toast key={t.id} toast={t} onDismiss={dismiss} />
            ))}
        </div>
        <div aria-live="assertive" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts
            .filter((t) => t.tone === 'error')
            .map((t) => (
              <Toast key={t.id} toast={t} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION[toast.tone]);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  const Icon = toast.tone === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cx(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-white p-4 shadow-lg ring-1',
        toast.tone === 'success' ? 'ring-emerald-200' : 'ring-red-200',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cx('mt-0.5 h-5 w-5 shrink-0', toast.tone === 'success' ? 'text-emerald-600' : 'text-red-600')}
      />
      <p className="flex-1 text-sm text-slate-800">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 rounded p-1 text-slate-500 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
