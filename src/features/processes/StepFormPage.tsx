import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { Alert } from '../../components/ui/Alert';
import { ErrorSummary } from '../../components/ui/ErrorSummary';
import { FormActions } from '../../components/ui/FormActions';
import { Panel } from '../../components/ui/Panel';
import { CheckboxGroupField, SegmentedField, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { BusinessProcess, StepChange } from '../../domain/types';
import {
  NAME_MAX_LENGTH,
  STEP_CHANGES,
  STEP_CHANGE_DETAILS,
  createEmptyStepInput,
  findProcess,
  toStepInput,
  validateStep,
  type StepInput,
} from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useValidatedForm } from '../../hooks/useValidatedForm';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { stepOption } from './stepOption';
import { processPaths } from './processPaths';

const FIELD_IDS: Record<keyof StepInput, string> = {
  name: 'step-name',
  description: 'step-description',
  responsible: 'step-responsible',
  input: 'step-input',
  output: 'step-output',
  decision: 'step-decision',
  notes: 'step-notes',
  change: 'step-change',
  sourceStepIds: 'step-sources',
};

/** Select value used for the "enter a role" option; stakeholder options use their id. */
const ROLE_OPTION = '__role__';

/** Handles `/processes/:processId/steps/new` and `/processes/:processId/steps/:stepId/edit`. */
export function StepFormPage() {
  const { processId = '', stepId } = useParams();
  const { workspace } = useWorkspace();
  const process = findProcess(workspace, processId);
  const step = stepId ? process?.steps.find((s) => s.id === stepId) : undefined;

  if (!process || (stepId && !step)) {
    return (
      <NotFoundPage
        title={process ? 'Step not found' : 'Process not found'}
        message="It may have been deleted, or the link is incorrect."
        backTo={process ? { to: processPaths.detail(process.id), label: 'Back to process' } : { to: processPaths.list, label: 'Back to processes' }}
      />
    );
  }
  return <StepForm key={step?.id ?? 'new'} process={process} stepId={step?.id} />;
}

function StepForm({ process, stepId }: { process: BusinessProcess; stepId: string | undefined }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const isEdit = stepId !== undefined;
  const existingIndex = stepId ? process.steps.findIndex((s) => s.id === stepId) : -1;
  const existing = existingIndex >= 0 ? process.steps[existingIndex] : undefined;
  const isToBe = process.type === 'to-be';
  const baseline = process.baselineProcessId ? findProcess(workspace, process.baselineProcessId) : undefined;

  const { form, set, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } = useValidatedForm<StepInput>(
    existing ? toStepInput(existing) : createEmptyStepInput(process.type),
    (values) => validateStep(values, process, workspace),
    FIELD_IDS,
  );
  useDocumentTitle(isEdit ? 'Edit step' : 'Add step');

  const responsibleValue = form.responsible.type === 'stakeholder' ? form.responsible.stakeholderId : ROLE_OPTION;
  const responsibleOptions = [
    ...workspace.stakeholders.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` })),
    { value: ROLE_OPTION, label: 'Another role (not in the stakeholder register)' },
  ];
  // Keep a reference to a stakeholder that no longer exists visible, so the user can see and fix it.
  if (form.responsible.type === 'stakeholder' && !workspace.stakeholders.some((s) => s.id === responsibleValue)) {
    responsibleOptions.unshift({ value: responsibleValue, label: 'Unknown stakeholder (record missing)' });
  }

  const cancelTo = processPaths.detail(process.id);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result } = actions.saveStep(process.id, stepId ?? null, form);
    if (!report(result, isEdit ? 'Step saved.' : `Step added as step ${process.steps.length + 1}.`)) return;
    allowNavigation();
    navigate(cancelTo);
  };

  return (
    <>
      <PageHeader
        eyebrow={`Process Analysis · ${process.name}`}
        title={isEdit ? `Edit step ${existingIndex + 1}` : 'Add step'}
        description={
          isEdit
            ? 'Update the activity. Use the arrows on the process page to change its position.'
            : `The step is added at the end of the process (step ${process.steps.length + 1}). You can reorder it afterwards.`
        }
        back={{ to: cancelTo, label: 'Back to process' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />

        <Panel title="Activity">
          <div className="space-y-5">
            <TextField
              id={FIELD_IDS.name}
              label="Activity name"
              hint="Start with a verb, e.g. “Assign technician”."
              value={form.name}
              onChange={(v) => set('name', v)}
              error={errors.name}
              required
              maxLength={NAME_MAX_LENGTH + 20}
            />
            <TextAreaField
              id={FIELD_IDS.description}
              label="Description"
              value={form.description}
              onChange={(v) => set('description', v)}
              rows={3}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <SelectField
                  id={FIELD_IDS.responsible}
                  label="Responsible"
                  hint="Choose a stakeholder from the register, or enter a role."
                  value={responsibleValue}
                  options={responsibleOptions}
                  onChange={(v) =>
                    set(
                      'responsible',
                      v === ROLE_OPTION ? { type: 'role', role: '' } : { type: 'stakeholder', stakeholderId: v },
                    )
                  }
                  error={form.responsible.type === 'stakeholder' ? errors.responsible : undefined}
                  required
                />
                {workspace.stakeholders.length === 0 && (
                  <p className="mt-1.5 text-sm text-slate-500">
                    The stakeholder register is empty.{' '}
                    <Link to="/stakeholders/new" className="font-medium text-brand-700 underline underline-offset-2">
                      Add stakeholders
                    </Link>{' '}
                    to assign them to steps.
                  </p>
                )}
              </div>
              {form.responsible.type === 'role' && (
                <TextField
                  id="step-role"
                  label="Role"
                  hint="e.g. Customer, Field Service Management System (automated)."
                  value={form.responsible.role}
                  onChange={(v) => set('responsible', { type: 'role', role: v })}
                  error={errors.responsible}
                  required
                />
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Inputs, outputs and decisions">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <TextAreaField id={FIELD_IDS.input} label="Input" value={form.input} onChange={(v) => set('input', v)} rows={2} />
              <TextAreaField id={FIELD_IDS.output} label="Output" value={form.output} onChange={(v) => set('output', v)} rows={2} />
            </div>
            <TextField
              id={FIELD_IDS.decision}
              label="Decision or condition"
              hint="A question or rule evaluated in this step, e.g. “Are the required parts in stock?”"
              value={form.decision}
              onChange={(v) => set('decision', v)}
            />
            <TextAreaField id={FIELD_IDS.notes} label="Notes" value={form.notes} onChange={(v) => set('notes', v)} rows={2} />
          </div>
        </Panel>

        {isToBe && (
          <Panel title="Change from AS-IS" description="Recorded by you; the comparison view does not infer changes.">
            <div className="space-y-5">
              {!baseline && (
                <Alert tone="info">
                  This TO-BE process has no AS-IS baseline, so its steps can only be marked as new.{' '}
                  <Link to={processPaths.edit(process.id)} className="font-medium underline underline-offset-2">
                    Set a baseline
                  </Link>{' '}
                  to link steps and compare.
                </Alert>
              )}
              <SegmentedField<StepChange>
                id={FIELD_IDS.change}
                label="Change type"
                hint={form.change ? STEP_CHANGE_DETAILS[form.change].description : undefined}
                value={form.change ?? 'new'}
                options={STEP_CHANGES.map((c) => ({ value: c, label: STEP_CHANGE_DETAILS[c].label }))}
                onChange={(v) => set('change', v)}
                error={errors.change}
              />
              {baseline && form.change !== 'new' && (
                <CheckboxGroupField
                  id={FIELD_IDS.sourceStepIds}
                  label={`Corresponding AS-IS steps (${baseline.name})`}
                  hint="Select every AS-IS step this step replaces or changes."
                  options={baseline.steps.map(stepOption)}
                  values={form.sourceStepIds}
                  onChange={(v) => set('sourceStepIds', v)}
                  error={errors.sourceStepIds}
                  emptyMessage="The AS-IS baseline has no steps yet."
                />
              )}
            </div>
          </Panel>
        )}

        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save step' : 'Add step'} />
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
