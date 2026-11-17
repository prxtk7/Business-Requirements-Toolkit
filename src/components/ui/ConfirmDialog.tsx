import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Omit together with `onConfirm` for an informational dialog with a single dismiss button. */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'default';
  onConfirm?: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation dialog. Focus moves to the safe (cancel) action on open,
 * is trapped within the dialog, and returns to the trigger on close. Without
 * `onConfirm` it acts as an informational dialog (e.g. explaining why an
 * action is blocked).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    // The wrapper only traps Tab inside the dialog; it is not itself an interactive control.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden="true" onClick={onCancel} />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl ring-1 ring-slate-200"
      >
        <div className="flex gap-4">
          {tone !== 'default' && (
            <div
              className={
                tone === 'danger'
                  ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50'
                  : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50'
              }
            >
              <AlertTriangle aria-hidden="true" className={tone === 'danger' ? 'h-5 w-5 text-red-700' : 'h-5 w-5 text-amber-600'} />
            </div>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            <div id={bodyId} className="mt-2 text-sm leading-relaxed text-slate-600">
              {children}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {onConfirm && confirmLabel && (
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
