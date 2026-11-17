import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface ErrorSummaryItem {
  /** DOM id of the field to focus. */
  fieldId: string;
  message: string;
}

/**
 * Summary of form validation errors shown above the form after a failed
 * submit. Receives focus so screen reader users hear what went wrong, and
 * each entry links to the field that needs fixing.
 */
export function ErrorSummary({ errors, attempt }: { errors: ErrorSummaryItem[]; attempt: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
    // Re-focus on every failed submit attempt only. Depending on the error count
    // would steal focus from the field being edited whenever an error appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (errors.length === 0) return null;

  const focusField = (fieldId: string) => {
    const target = document.getElementById(fieldId);
    const focusable =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
        ? target
        : target?.querySelector<HTMLElement>('input, textarea, select, button');
    target?.scrollIntoView?.({ block: 'center' });
    focusable?.focus();
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-lg bg-red-50 p-4 ring-1 ring-inset ring-red-200 focus:outline-2 focus:outline-red-600"
    >
      <div className="flex gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <h2 id="error-summary-title" className="text-sm font-semibold text-red-900">
            {errors.length === 1 ? 'There is a problem' : `There are ${errors.length} problems`} with this form
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
            {errors.map((error) => (
              <li key={error.fieldId}>
                <a
                  href={`#${error.fieldId}`}
                  className="underline underline-offset-2 hover:text-red-950"
                  onClick={(event) => {
                    event.preventDefault();
                    focusField(error.fieldId);
                  }}
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
