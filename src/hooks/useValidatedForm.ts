import { useState } from 'react';
import type { ValidationErrors } from '../domain/types';
import type { ErrorSummaryItem } from '../components/ui/ErrorSummary';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

/**
 * Form state for record editors: tracks values, dirty state (with the
 * unsaved-changes guard), and validation errors that appear after the first
 * submit attempt and then stay live while the user fixes them.
 */
export function useValidatedForm<T extends object>(
  initial: T,
  validate: (values: T) => ValidationErrors<T>,
  fieldIds: Record<keyof T, string>,
) {
  // Initial values are captured once per mounted form.
  const [initialValues] = useState<T>(initial);
  const [form, setForm] = useState<T>(initial);
  const [attempt, setAttempt] = useState(0);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialValues);
  const { blocker, allowNavigation } = useUnsavedChangesGuard(isDirty);

  const errors: ValidationErrors<T> = attempt > 0 ? validate(form) : {};
  const summary: ErrorSummaryItem[] = (Object.keys(errors) as Array<keyof T>).map((key) => ({
    fieldId: fieldIds[key],
    message: errors[key] as string,
  }));

  const set = <K extends keyof T>(key: K, value: T[K]) => setForm((current) => ({ ...current, [key]: value }));

  /** Record a submit attempt; returns true when the form is valid. */
  const trySubmit = (): boolean => {
    setAttempt((n) => n + 1);
    return Object.keys(validate(form)).length === 0;
  };

  return { form, set, setForm, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation, initialValues };
}
