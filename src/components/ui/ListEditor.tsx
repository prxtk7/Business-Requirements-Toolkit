import { useEffect, useId, useRef } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from './Button';
import { describedBy } from './describedBy';
import { cx } from '../../lib/cx';

interface ListEditorProps {
  id?: string;
  label: string;
  /** Singular noun used in per-item accessible labels, e.g. "objective". */
  itemLabel: string;
  items: string[];
  /**
   * Optional stable keys parallel to `items` (e.g. record ids). They follow
   * each item through edits, moves and removals; newly added items get null.
   */
  keys?: readonly (string | null)[];
  onChange: (items: string[], keys: (string | null)[]) => void;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  placeholder?: string;
}

/**
 * Editable ordered list of short text entries (objectives, scope items,
 * expectations, ...). Blank entries are allowed while editing and are
 * removed by the domain layer on save.
 */
export function ListEditor({
  id,
  label,
  itemLabel,
  items,
  keys,
  onChange,
  hint,
  error,
  required,
  placeholder,
}: ListEditorProps) {
  const generated = useId();
  const groupId = id ?? generated;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndex.current !== null) {
      inputRefs.current[focusIndex.current]?.focus();
      focusIndex.current = null;
    }
  });

  const currentKeys: (string | null)[] = items.map((_, i) => keys?.[i] ?? null);

  const update = (index: number, value: string) =>
    onChange(
      items.map((item, i) => (i === index ? value : item)),
      currentKeys,
    );

  const add = () => {
    focusIndex.current = items.length;
    onChange([...items, ''], [...currentKeys, null]);
  };

  const remove = (index: number) => {
    focusIndex.current = items.length > 1 ? Math.max(0, index - 1) : null;
    onChange(
      items.filter((_, i) => i !== index),
      currentKeys.filter((_, i) => i !== index),
    );
  };

  const swap = <T,>(list: T[], a: number, b: number): T[] => {
    const next = [...list];
    [next[a], next[b]] = [next[b] as T, next[a] as T];
    return next;
  };

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    focusIndex.current = target;
    onChange(swap(items, index, target), swap(currentKeys, index, target));
  };

  const capitalised = itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1);

  return (
    <fieldset id={groupId} aria-describedby={describedBy(groupId, hint, error)}>
      <legend className="block text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-slate-500">(optional)</span>
        )}
      </legend>
      {hint && (
        <p id={`${groupId}-hint`} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      )}

      {items.length > 0 && (
        <ol className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li key={currentKeys[index] ?? `index-${index}`} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-500" aria-hidden="true">
                {index + 1}.
              </span>
              <input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                value={item}
                onChange={(e) => update(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
                aria-label={`${capitalised} ${index + 1}`}
                placeholder={placeholder}
                className={cx(
                  'block h-10 w-full min-w-0 rounded-md border bg-white px-3 text-sm text-slate-900 shadow-sm',
                  'placeholder:text-slate-500 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500',
                  error ? 'border-red-600' : 'border-slate-300',
                )}
              />
              <div className="flex shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ArrowUp}
                  aria-label={`Move ${itemLabel} ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ArrowDown}
                  aria-label={`Move ${itemLabel} ${index + 1} down`}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={X}
                  aria-label={`Remove ${itemLabel} ${index + 1}`}
                  onClick={() => remove(index)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <Button variant="secondary" size="sm" icon={Plus} onClick={add} className="mt-2">
        Add {itemLabel}
      </Button>

      {error && (
        <p id={`${groupId}-error`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
