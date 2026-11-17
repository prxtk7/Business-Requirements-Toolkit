import type { ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button, ButtonLink } from './Button';

/** Sticky save/cancel bar used at the bottom of record forms. */
export function FormActions({
  isDirty,
  cancelTo,
  submitLabel,
  extra,
}: {
  isDirty: boolean;
  cancelTo: string;
  submitLabel: string;
  extra?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white sm:px-5">
      {isDirty && <p className="mr-auto text-sm text-slate-500">Unsaved changes</p>}
      {extra}
      <ButtonLink to={cancelTo} variant="secondary">
        Cancel
      </ButtonLink>
      <Button type="submit" variant="primary" icon={Save}>
        {submitLabel}
      </Button>
    </div>
  );
}
