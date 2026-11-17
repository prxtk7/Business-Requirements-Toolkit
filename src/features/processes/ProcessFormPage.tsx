import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { ErrorSummary } from '../../components/ui/ErrorSummary';
import { FormActions } from '../../components/ui/FormActions';
import { Panel } from '../../components/ui/Panel';
import { SegmentedField, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { ProcessType } from '../../domain/types';
import {
  NAME_MAX_LENGTH,
  PROCESS_TYPES,
  PROCESS_TYPE_LABELS,
  createEmptyProcessInput,
  findProcess,
  isProcessType,
  toProcessInput,
  validateProcess,
  type ProcessInput,
} from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useValidatedForm } from '../../hooks/useValidatedForm';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { ProcessTypeBadge } from './processUi';
import { processPaths } from './processPaths';

const FIELD_IDS: Record<keyof ProcessInput, string> = {
  type: 'process-type',
  name: 'process-name',
  description: 'process-description',
  objective: 'process-objective',
  trigger: 'process-trigger',
  startCondition: 'process-start',
  endCondition: 'process-end',
  baselineProcessId: 'process-baseline',
};

const NO_BASELINE = '';

/** Handles `/processes/new?type=` and `/processes/:processId/edit`. */
export function ProcessFormPage() {
  const { processId } = useParams();
  const [params] = useSearchParams();
  const { workspace } = useWorkspace();
  const existing = processId ? findProcess(workspace, processId) : undefined;

  if (processId && !existing) {
    return <NotFoundPage title="Process not found" message="This process may have been deleted." backTo={{ to: processPaths.list, label: 'Back to processes' }} />;
  }

  const requestedType = params.get('type');
  const initialType: ProcessType = isProcessType(requestedType) ? requestedType : 'as-is';
  return <ProcessForm key={existing?.id ?? `new-${initialType}`} processId={existing?.id} initialType={initialType} />;
}

function ProcessForm({ processId, initialType }: { processId: string | undefined; initialType: ProcessType }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const isEdit = processId !== undefined;
  const existing = processId ? findProcess(workspace, processId) : undefined;

  const { form, set, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } = useValidatedForm<ProcessInput>(
    existing ? toProcessInput(existing) : createEmptyProcessInput(initialType),
    (values) => validateProcess(values, workspace, processId),
    FIELD_IDS,
  );
  const typeLabel = PROCESS_TYPE_LABELS[form.type];
  useDocumentTitle(isEdit ? `Edit ${typeLabel} process` : `New ${typeLabel} process`);

  const baselineOptions = [
    { value: NO_BASELINE, label: 'No baseline (comparison not available)' },
    ...workspace.processes.filter((p) => p.type === 'as-is').map((p) => ({ value: p.id, label: p.name })),
  ];
  const cancelTo = isEdit ? processPaths.detail(processId) : processPaths.list;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result, id } = actions.saveProcess(processId ?? null, form);
    if (!report(result, isEdit ? 'Process details saved.' : `${typeLabel} process created. Add its steps next.`)) return;
    allowNavigation();
    navigate(processPaths.detail(id));
  };

  return (
    <>
      <PageHeader
        eyebrow="Process Analysis"
        title={isEdit ? `Edit ${form.name || 'process'}` : `New ${typeLabel} process`}
        description="Describe the process boundaries: what starts it, what it achieves and when it ends. Fields marked * are required."
        back={{ to: cancelTo, label: isEdit ? 'Back to process' : 'Back to processes' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />

        <Panel title="Process">
          <div className="space-y-5">
            {isEdit ? (
              <div>
                <p className="text-sm font-medium text-slate-800">Process type</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-500">
                  <ProcessTypeBadge type={form.type} /> The type is fixed once a process is created.
                </div>
              </div>
            ) : (
              <SegmentedField<ProcessType>
                id={FIELD_IDS.type}
                label="Process type"
                hint="AS-IS describes current practice; TO-BE describes the proposed future process."
                value={form.type}
                options={PROCESS_TYPES.map((t) => ({ value: t, label: PROCESS_TYPE_LABELS[t] }))}
                onChange={(v) => {
                  set('type', v);
                  if (v === 'as-is') set('baselineProcessId', null);
                }}
                error={errors.type}
              />
            )}
            <TextField
              id={FIELD_IDS.name}
              label="Process name"
              value={form.name}
              onChange={(v) => set('name', v)}
              error={errors.name}
              required
              maxLength={NAME_MAX_LENGTH + 20}
            />
            <TextAreaField
              id={FIELD_IDS.description}
              label="Description"
              hint="Scope of the process and who it serves."
              value={form.description}
              onChange={(v) => set('description', v)}
              rows={3}
            />
            <TextAreaField
              id={FIELD_IDS.objective}
              label="Objective"
              hint="What the process is meant to achieve."
              value={form.objective}
              onChange={(v) => set('objective', v)}
              error={errors.objective}
              required
              rows={2}
            />
          </div>
        </Panel>

        <Panel title="Boundaries">
          <div className="space-y-5">
            <TextField
              id={FIELD_IDS.trigger}
              label="Trigger"
              hint="The event that starts the process."
              value={form.trigger}
              onChange={(v) => set('trigger', v)}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <TextAreaField
                id={FIELD_IDS.startCondition}
                label="Start condition"
                value={form.startCondition}
                onChange={(v) => set('startCondition', v)}
                rows={2}
              />
              <TextAreaField
                id={FIELD_IDS.endCondition}
                label="End condition"
                value={form.endCondition}
                onChange={(v) => set('endCondition', v)}
                rows={2}
              />
            </div>
          </div>
        </Panel>

        {form.type === 'to-be' && (
          <Panel title="Comparison baseline">
            <SelectField
              id={FIELD_IDS.baselineProcessId}
              label="AS-IS process this design improves"
              hint="Linking a baseline lets you map TO-BE steps to AS-IS steps and compare the two processes."
              value={form.baselineProcessId ?? NO_BASELINE}
              options={baselineOptions}
              onChange={(v) => set('baselineProcessId', v === NO_BASELINE ? null : v)}
              error={errors.baselineProcessId}
            />
          </Panel>
        )}

        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save details' : 'Create process'} />
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
