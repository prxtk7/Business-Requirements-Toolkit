import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { describedBy } from './describedBy';

const controlBase =
  'block w-full rounded-md border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-brand-500 disabled:bg-slate-50 disabled:text-slate-500';

function controlClasses(hasError: boolean) {
  return cx(controlBase, hasError ? 'border-red-600' : 'border-slate-300');
}

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, required, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-slate-500">(optional)</span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface CommonFieldProps {
  /** Stable id; also used as the anchor target from the error summary. */
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  placeholder?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  required,
  placeholder,
  maxLength,
}: CommonFieldProps & { maxLength?: number }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <input
        id={fieldId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(controlClasses(Boolean(error)), 'h-10')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        aria-required={required || undefined}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  required,
  placeholder,
  rows = 4,
}: CommonFieldProps & { rows?: number }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={fieldId}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={cx(controlClasses(Boolean(error)), 'py-2 leading-relaxed')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        aria-required={required || undefined}
        placeholder={placeholder}
      />
    </FieldShell>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * Segmented single-choice control built on native radio inputs, so keyboard
 * arrow-key navigation and screen reader semantics come for free.
 */
export function SegmentedField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  error,
}: {
  id?: string;
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const generated = useId();
  const groupId = id ?? generated;
  return (
    <fieldset id={groupId} aria-describedby={describedBy(groupId, hint, error)}>
      <legend className="block text-sm font-medium text-slate-800">{label}</legend>
      {hint && (
        <p id={`${groupId}-hint`} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      )}
      <div className="mt-1.5 flex w-full rounded-md shadow-sm sm:inline-flex sm:w-auto">
        {options.map((option, index) => {
          const optionId = `${groupId}-${option.value}`;
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cx(
                'relative min-w-0 flex-1 cursor-pointer border px-2 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-4',
                'has-[:focus-visible]:z-10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500',
                index === 0 && 'rounded-l-md',
                index === options.length - 1 && 'rounded-r-md',
                index > 0 && '-ml-px',
                checked
                  ? 'z-[1] border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={groupId}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${groupId}-error`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hideLabel,
  hint,
  error,
  required,
}: {
  id?: string;
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  /** Visually hide the label (e.g. compact filters). Hint and error are not shown in this mode. */
  hideLabel?: boolean;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const select = (
    <select
      id={fieldId}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cx(controlClasses(Boolean(error)), 'h-10 pr-8')}
      aria-invalid={error ? true : undefined}
      aria-describedby={hideLabel ? undefined : describedBy(fieldId, hint, error)}
      aria-required={required || undefined}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (hideLabel) {
    return (
      <div>
        <label htmlFor={fieldId} className="sr-only">
          {label}
        </label>
        {select}
      </div>
    );
  }

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      {select}
    </FieldShell>
  );
}

/** Multiple-choice list built on native checkboxes inside a fieldset. */
export function CheckboxGroupField({
  id,
  label,
  options,
  values,
  onChange,
  hint,
  error,
  emptyMessage = 'No options available.',
}: {
  id?: string;
  label: string;
  options: readonly Option<string>[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  hint?: string | undefined;
  error?: string | undefined;
  emptyMessage?: string;
}) {
  const generated = useId();
  const groupId = id ?? generated;
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...values, value] : values.filter((v) => v !== value));

  return (
    <fieldset id={groupId} aria-describedby={describedBy(groupId, hint, error)}>
      <legend className="block text-sm font-medium text-slate-800">{label}</legend>
      {hint && (
        <p id={`${groupId}-hint`} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      )}
      {options.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 italic">{emptyMessage}</p>
      ) : (
        <div
          className={cx(
            'mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border bg-white p-2',
            error ? 'border-red-600' : 'border-slate-300',
          )}
        >
          {options.map((option) => {
            const optionId = `${groupId}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex cursor-pointer items-start gap-2.5 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  id={optionId}
                  type="checkbox"
                  checked={values.includes(option.value)}
                  onChange={(e) => toggle(option.value, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-700"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {error && (
        <p id={`${groupId}-error`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
