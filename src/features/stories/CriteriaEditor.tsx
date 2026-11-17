import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Lightbulb, Plus, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { VerificationStatus } from '../../domain/types';
import { VERIFICATION_LABELS, VERIFICATION_STATUSES } from '../../domain/storyConfig';
import {
  createEmptyCriterion,
  criterionLabel,
  findVagueTerms,
  moveItem,
  type CriterionErrors,
  type CriterionInput,
} from '../../domain/userStories';
import { VERIFICATION_DISCLAIMER } from './storyUi';

interface CriteriaEditorProps {
  id: string;
  criteria: CriterionInput[];
  onChange: (criteria: CriterionInput[]) => void;
  errors: Record<string, CriterionErrors>;
}

/**
 * Edits the ordered list of Given/When/Then acceptance criteria for a story.
 * Changes are kept in the story form and saved with the story.
 */
export function CriteriaEditor({ id, criteria, onChange, errors }: CriteriaEditorProps) {
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (focusId.current) {
      document.getElementById(`criterion-${focusId.current}-title`)?.focus();
      focusId.current = null;
    }
  });

  const update = (criterionId: string, patch: Partial<CriterionInput>) =>
    onChange(criteria.map((c) => (c.id === criterionId ? { ...c, ...patch } : c)));

  const add = () => {
    const criterion = createEmptyCriterion();
    focusId.current = criterion.id;
    onChange([...criteria, criterion]);
  };

  return (
    <div id={id}>
      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200 ring-inset">
        <p>
          Describe observable behaviour: the starting context (<strong>Given</strong>), the action or event (
          <strong>When</strong>) and the expected result (<strong>Then</strong>). The keywords are added automatically.
        </p>
        <p className="mt-1 text-xs text-slate-500">{VERIFICATION_DISCLAIMER}</p>
      </div>

      {criteria.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 italic">No acceptance criteria yet.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {criteria.map((c, index) => {
            const e = errors[c.id] ?? {};
            const vague = findVagueTerms(c.then);
            const name = `Acceptance criterion ${index + 1}`;
            return (
              <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <fieldset id={`criterion-${c.id}`} className="relative">
                  <legend className="pr-28 text-sm font-semibold text-slate-900">
                    {name}
                    {c.number !== null && <span className="ml-2 font-mono text-xs font-medium text-slate-500">{criterionLabel({ number: c.number })}</span>}
                  </legend>
                  <div className="absolute top-0 right-0 flex">
                      <Button variant="ghost" size="sm" iconOnly icon={ArrowUp} aria-label={`Move ${name.toLowerCase()} up`} disabled={index === 0} onClick={() => onChange(moveItem(criteria, index, -1))} />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={ArrowDown}
                        aria-label={`Move ${name.toLowerCase()} down`}
                        disabled={index === criteria.length - 1}
                        onClick={() => onChange(moveItem(criteria, index, 1))}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={X}
                        aria-label={`Remove ${name.toLowerCase()}`}
                        onClick={() => onChange(criteria.filter((x) => x.id !== c.id))}
                      />
                  </div>
                  <div className="mt-3 space-y-4">
                    <TextField id={`criterion-${c.id}-title`} label="Title" value={c.title} onChange={(v) => update(c.id, { title: v })} error={e.title} required />
                    <div className="grid gap-4 lg:grid-cols-3">
                      <TextAreaField id={`criterion-${c.id}-given`} label="Given" hint="Starting context or precondition." value={c.given} onChange={(v) => update(c.id, { given: v })} error={e.given} required rows={3} />
                      <TextAreaField id={`criterion-${c.id}-when`} label="When" hint="Action or event." value={c.when} onChange={(v) => update(c.id, { when: v })} error={e.when} required rows={3} />
                      <TextAreaField id={`criterion-${c.id}-then`} label="Then" hint="Expected, observable outcome." value={c.then} onChange={(v) => update(c.id, { then: v })} error={e.then} required rows={3} />
                    </div>
                    {vague.length > 0 && (
                      <p className="flex items-start gap-1.5 text-sm text-amber-800" aria-live="polite">
                        <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          “{vague.join('”, “')}” can be hard to test. Consider stating what can be observed instead (for example, what appears on
                          screen or what is recorded).
                        </span>
                      </p>
                    )}
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                      <TextAreaField id={`criterion-${c.id}-notes`} label="Notes" value={c.notes} onChange={(v) => update(c.id, { notes: v })} rows={2} />
                      <SelectField<VerificationStatus>
                        id={`criterion-${c.id}-verification`}
                        label="Verification status"
                        value={c.verification}
                        options={VERIFICATION_STATUSES.map((s) => ({ value: s, label: VERIFICATION_LABELS[s] }))}
                        onChange={(v) => update(c.id, { verification: v })}
                        error={e.verification}
                        required
                      />
                    </div>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}

      <Button variant="secondary" size="sm" icon={Plus} onClick={add} className="mt-4">
        Add acceptance criterion
      </Button>
    </div>
  );
}
