import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Save } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorSummary, type ErrorSummaryItem } from '../../components/ui/ErrorSummary';
import { ListEditor } from '../../components/ui/ListEditor';
import { Panel } from '../../components/ui/Panel';
import { SegmentedField, TextAreaField, TextField } from '../../components/ui/fields';
import { useToast } from '../../components/ui/toastContext';
import type { Level, StakeholderInput } from '../../domain/types';
import { LEVELS, LEVEL_LABELS } from '../../domain/types';
import {
  STAKEHOLDER_TEXT_MAX_LENGTH,
  STRATEGY_DETAILS,
  createEmptyStakeholderInput,
  getEngagementStrategy,
  toStakeholderInput,
  validateStakeholder,
} from '../../domain/stakeholders';
import { useWorkspace, type CommitResult } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { StrategyBadge } from './StrategyBadge';

const FIELD_IDS: Record<keyof StakeholderInput, string> = {
  name: 'stakeholder-name',
  role: 'stakeholder-role',
  description: 'stakeholder-description',
  interest: 'stakeholder-interest',
  influence: 'stakeholder-influence',
  expectations: 'stakeholder-expectations',
};

const LEVEL_OPTIONS = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));

/** Handles both `/stakeholders/new` and `/stakeholders/:stakeholderId/edit`. */
export function StakeholderFormPage() {
  const { stakeholderId } = useParams();
  const { workspace } = useWorkspace();
  const existing = stakeholderId ? workspace.stakeholders.find((s) => s.id === stakeholderId) : undefined;

  if (stakeholderId && !existing) {
    return (
      <NotFoundPage
        title="Stakeholder not found"
        message="This stakeholder may have been deleted, or the link is incorrect."
        backTo={{ to: '/stakeholders', label: 'Back to stakeholders' }}
      />
    );
  }

  // Keyed so that switching between records resets form state.
  return <StakeholderForm key={existing?.id ?? 'new'} stakeholderId={existing?.id} />;
}

function StakeholderForm({ stakeholderId }: { stakeholderId: string | undefined }) {
  const { workspace, actions } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const isEdit = stakeholderId !== undefined;
  useDocumentTitle(isEdit ? 'Edit stakeholder' : 'Add stakeholder');

  // Initial values are captured once per mounted form.
  const [initial] = useState<StakeholderInput>(() => {
    const record = workspace.stakeholders.find((s) => s.id === stakeholderId);
    return record ? toStakeholderInput(record) : createEmptyStakeholderInput();
  });

  const [form, setForm] = useState<StakeholderInput>(initial);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
  const { blocker, allowNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = submitAttempt > 0 ? validateStakeholder(form, workspace.stakeholders, stakeholderId) : {};
  const summary: ErrorSummaryItem[] = (Object.keys(errors) as Array<keyof StakeholderInput>).map((key) => ({
    fieldId: FIELD_IDS[key],
    message: errors[key] as string,
  }));

  const set = <K extends keyof StakeholderInput>(key: K, value: StakeholderInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const strategy = getEngagementStrategy(form.influence, form.interest);
  const cancelTo = isEdit ? `/stakeholders/${stakeholderId}` : '/stakeholders';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempt((n) => n + 1);
    if (Object.keys(validateStakeholder(form, workspace.stakeholders, stakeholderId)).length > 0) return;

    let targetId: string;
    let result: CommitResult;
    if (isEdit) {
      result = actions.updateStakeholder(stakeholderId, form);
      targetId = stakeholderId;
    } else {
      const created = actions.addStakeholder(form);
      result = created.result;
      targetId = created.stakeholder.id;
    }

    // Refused because of a cross-tab conflict: stay on the form so no input is lost.
    if (!result.ok && result.blocked) {
      toast.error(result.error);
      return;
    }

    const name = form.name.trim();
    if (result.ok) toast.success(isEdit ? `${name} updated.` : `${name} added to the stakeholder register.`);
    else toast.error(result.error);
    allowNavigation();
    navigate(`/stakeholders/${targetId}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Stakeholder Analysis"
        title={isEdit ? `Edit ${initial.name}` : 'Add stakeholder'}
        description="Record who the stakeholder is, what they expect, and how much they care about and can affect the project."
        back={{ to: cancelTo, label: isEdit ? 'Back to stakeholder' : 'Back to stakeholders' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={submitAttempt} />

        <Panel title="Identity">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id={FIELD_IDS.name}
                label="Name"
                hint="A person, team or group."
                value={form.name}
                onChange={(v) => set('name', v)}
                error={errors.name}
                required
                maxLength={STAKEHOLDER_TEXT_MAX_LENGTH + 20}
              />
              <TextField
                id={FIELD_IDS.role}
                label="Role"
                hint="Job title or relationship to the project."
                value={form.role}
                onChange={(v) => set('role', v)}
                error={errors.role}
                required
                maxLength={STAKEHOLDER_TEXT_MAX_LENGTH + 20}
              />
            </div>
            <TextAreaField
              id={FIELD_IDS.description}
              label="Description"
              hint="Responsibilities and how the project affects them."
              value={form.description}
              onChange={(v) => set('description', v)}
              rows={3}
            />
          </div>
        </Panel>

        <Panel title="Assessment" description="Ratings place the stakeholder on the stakeholder map.">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_minmax(0,1.2fr)]">
            <SegmentedField<Level>
              id={FIELD_IDS.interest}
              label="Interest"
              hint="How much the outcome matters to them."
              value={form.interest}
              options={LEVEL_OPTIONS}
              onChange={(v) => set('interest', v)}
              error={errors.interest}
            />
            <SegmentedField<Level>
              id={FIELD_IDS.influence}
              label="Influence"
              hint="Their power to affect decisions or delivery."
              value={form.influence}
              options={LEVEL_OPTIONS}
              onChange={(v) => set('influence', v)}
              error={errors.influence}
            />
            <div className="rounded-md bg-slate-50 p-4 ring-1 ring-slate-200 ring-inset" aria-live="polite">
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Suggested strategy</p>
              <div className="mt-2">
                <StrategyBadge strategy={strategy} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{STRATEGY_DETAILS[strategy].guidance}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Expectations">
          <ListEditor
            id={FIELD_IDS.expectations}
            label="Expectations"
            itemLabel="expectation"
            hint="Needs, concerns or outcomes this stakeholder expects from the project."
            items={form.expectations}
            onChange={(v) => set('expectations', v)}
          />
        </Panel>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white sm:px-5">
          {isDirty && <p className="mr-auto text-sm text-slate-500">Unsaved changes</p>}
          <ButtonLink to={cancelTo} variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" icon={Save}>
            {isEdit ? 'Save changes' : 'Add stakeholder'}
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
