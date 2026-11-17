import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { ErrorSummary } from '../../components/ui/ErrorSummary';
import { FormActions } from '../../components/ui/FormActions';
import { Panel } from '../../components/ui/Panel';
import { SegmentedField, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { BusinessProcess, Level, ProcessType } from '../../domain/types';
import { LEVELS, LEVEL_LABELS } from '../../domain/types';
import {
  NAME_MAX_LENGTH,
  createEmptyBottleneckInput,
  createEmptyImprovementInput,
  findProcess,
  toBottleneckInput,
  toImprovementInput,
  validateBottleneck,
  validateImprovement,
  type BottleneckInput,
  type ImprovementInput,
} from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useValidatedForm } from '../../hooks/useValidatedForm';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { stepOption } from './stepOption';
import { processPaths } from './processPaths';

const LEVEL_OPTIONS = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
const NO_STEP = '';

/**
 * Resolve the process for a finding route. Bottlenecks belong to AS-IS
 * processes and improvements to TO-BE processes.
 */
function useFindingRoute(expectedType: ProcessType, collection: 'bottlenecks' | 'improvements', idParam: string) {
  const params = useParams();
  const [search] = useSearchParams();
  const { workspace } = useWorkspace();
  const process = findProcess(workspace, params.processId ?? '');
  const recordId = params[idParam];
  const record = recordId ? workspace[collection].find((r) => r.id === recordId) : undefined;
  const stepIds = new Set(process?.steps.map((s) => s.id) ?? []);

  let notFound: ReactNode = null;
  if (!process || process.type !== expectedType) {
    notFound = (
      <NotFoundPage title="Process not found" message="This process may have been deleted." backTo={{ to: processPaths.list, label: 'Back to processes' }} />
    );
  } else if (recordId && (!record || !stepIds.has(record.stepId))) {
    notFound = (
      <NotFoundPage
        title={`${collection === 'bottlenecks' ? 'Bottleneck' : 'Improvement'} not found`}
        message="It may have been deleted, or the link is incorrect."
        backTo={{ to: processPaths.detail(process.id), label: 'Back to process' }}
      />
    );
  }

  const presetStep = search.get('step');
  return { process, recordId: record?.id, presetStepId: presetStep && stepIds.has(presetStep) ? presetStep : '', notFound };
}

function StepSelect({
  id,
  process,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  process: BusinessProcess;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
  hint: string;
}) {
  return (
    <SelectField
      id={id}
      label="Process step"
      hint={hint}
      value={value}
      options={[{ value: NO_STEP, label: 'Select a step…' }, ...process.steps.map(stepOption)]}
      onChange={onChange}
      error={error}
      required
    />
  );
}

// ---------------------------------------------------------------------------
// Bottlenecks
// ---------------------------------------------------------------------------

const BOTTLENECK_IDS: Record<keyof BottleneckInput, string> = {
  stepId: 'bottleneck-step',
  title: 'bottleneck-title',
  description: 'bottleneck-description',
  impact: 'bottleneck-impact',
  severity: 'bottleneck-severity',
  suggestedImprovement: 'bottleneck-suggestion',
};

export function BottleneckFormPage() {
  const route = useFindingRoute('as-is', 'bottlenecks', 'bottleneckId');
  if (route.notFound || !route.process) return <>{route.notFound}</>;
  return <BottleneckForm key={route.recordId ?? 'new'} process={route.process} recordId={route.recordId} presetStepId={route.presetStepId} />;
}

function BottleneckForm({ process, recordId, presetStepId }: { process: BusinessProcess; recordId: string | undefined; presetStepId: string }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const existing = recordId ? workspace.bottlenecks.find((b) => b.id === recordId) : undefined;
  const isEdit = existing !== undefined;
  useDocumentTitle(isEdit ? 'Edit bottleneck' : 'Add bottleneck');

  const { form, set, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } = useValidatedForm<BottleneckInput>(
    existing ? toBottleneckInput(existing) : createEmptyBottleneckInput(presetStepId),
    (values) => validateBottleneck(values, workspace),
    BOTTLENECK_IDS,
  );
  const cancelTo = processPaths.detail(process.id);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result } = actions.saveBottleneck(recordId ?? null, form);
    if (!report(result, isEdit ? 'Bottleneck saved.' : 'Bottleneck added.')) return;
    allowNavigation();
    navigate(cancelTo);
  };

  return (
    <>
      <PageHeader
        eyebrow={`Process Analysis · ${process.name} (AS-IS)`}
        title={isEdit ? 'Edit bottleneck' : 'Add bottleneck'}
        description="Record a problem or inefficiency in the current process and the step where it occurs."
        back={{ to: cancelTo, label: 'Back to process' }}
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />
        <Panel title="Bottleneck">
          <div className="space-y-5">
            <TextField
              id={BOTTLENECK_IDS.title}
              label="Title"
              value={form.title}
              onChange={(v) => set('title', v)}
              error={errors.title}
              required
              maxLength={NAME_MAX_LENGTH + 20}
            />
            <TextAreaField
              id={BOTTLENECK_IDS.description}
              label="Description"
              value={form.description}
              onChange={(v) => set('description', v)}
              error={errors.description}
              required
              rows={3}
            />
            <StepSelect
              id={BOTTLENECK_IDS.stepId}
              process={process}
              value={form.stepId}
              onChange={(v) => set('stepId', v)}
              error={errors.stepId}
              hint="The AS-IS step where the problem occurs."
            />
          </div>
        </Panel>
        <Panel title="Assessment">
          <div className="space-y-5">
            <TextAreaField
              id={BOTTLENECK_IDS.impact}
              label="Impact"
              hint="Effect on customers, staff or the business."
              value={form.impact}
              onChange={(v) => set('impact', v)}
              rows={2}
            />
            <SegmentedField<Level>
              id={BOTTLENECK_IDS.severity}
              label="Severity"
              value={form.severity}
              options={LEVEL_OPTIONS}
              onChange={(v) => set('severity', v)}
              error={errors.severity}
            />
            <TextAreaField
              id={BOTTLENECK_IDS.suggestedImprovement}
              label="Suggested improvement"
              value={form.suggestedImprovement}
              onChange={(v) => set('suggestedImprovement', v)}
              rows={2}
            />
          </div>
        </Panel>
        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save bottleneck' : 'Add bottleneck'} />
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Improvements
// ---------------------------------------------------------------------------

const IMPROVEMENT_IDS: Record<keyof ImprovementInput, string> = {
  stepId: 'improvement-step',
  title: 'improvement-title',
  description: 'improvement-description',
  relatedProblem: 'improvement-problem',
  expectedBenefit: 'improvement-benefit',
  priority: 'improvement-priority',
};

export function ImprovementFormPage() {
  const route = useFindingRoute('to-be', 'improvements', 'improvementId');
  if (route.notFound || !route.process) return <>{route.notFound}</>;
  return <ImprovementForm key={route.recordId ?? 'new'} process={route.process} recordId={route.recordId} presetStepId={route.presetStepId} />;
}

function ImprovementForm({ process, recordId, presetStepId }: { process: BusinessProcess; recordId: string | undefined; presetStepId: string }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const existing = recordId ? workspace.improvements.find((i) => i.id === recordId) : undefined;
  const isEdit = existing !== undefined;
  useDocumentTitle(isEdit ? 'Edit improvement' : 'Add improvement');

  const { form, set, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } = useValidatedForm<ImprovementInput>(
    existing ? toImprovementInput(existing) : createEmptyImprovementInput(presetStepId),
    (values) => validateImprovement(values, workspace),
    IMPROVEMENT_IDS,
  );
  const cancelTo = processPaths.detail(process.id);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result } = actions.saveImprovement(recordId ?? null, form);
    if (!report(result, isEdit ? 'Improvement saved.' : 'Improvement added.')) return;
    allowNavigation();
    navigate(cancelTo);
  };

  return (
    <>
      <PageHeader
        eyebrow={`Process Analysis · ${process.name} (TO-BE)`}
        title={isEdit ? 'Edit improvement' : 'Add improvement'}
        description="Record an improvement the TO-BE process delivers and the step that delivers it."
        back={{ to: cancelTo, label: 'Back to process' }}
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />
        <Panel title="Improvement">
          <div className="space-y-5">
            <TextField
              id={IMPROVEMENT_IDS.title}
              label="Title"
              value={form.title}
              onChange={(v) => set('title', v)}
              error={errors.title}
              required
              maxLength={NAME_MAX_LENGTH + 20}
            />
            <TextAreaField
              id={IMPROVEMENT_IDS.description}
              label="Description"
              value={form.description}
              onChange={(v) => set('description', v)}
              error={errors.description}
              required
              rows={3}
            />
            <StepSelect
              id={IMPROVEMENT_IDS.stepId}
              process={process}
              value={form.stepId}
              onChange={(v) => set('stepId', v)}
              error={errors.stepId}
              hint="The TO-BE step that delivers the improvement."
            />
          </div>
        </Panel>
        <Panel title="Rationale">
          <div className="space-y-5">
            <TextAreaField
              id={IMPROVEMENT_IDS.relatedProblem}
              label="Related business problem"
              hint="The problem this addresses, e.g. a bottleneck recorded on the AS-IS process."
              value={form.relatedProblem}
              onChange={(v) => set('relatedProblem', v)}
              rows={2}
            />
            <TextAreaField
              id={IMPROVEMENT_IDS.expectedBenefit}
              label="Expected benefit"
              value={form.expectedBenefit}
              onChange={(v) => set('expectedBenefit', v)}
              rows={2}
            />
            <SegmentedField<Level>
              id={IMPROVEMENT_IDS.priority}
              label="Priority"
              value={form.priority}
              options={LEVEL_OPTIONS}
              onChange={(v) => set('priority', v)}
              error={errors.priority}
            />
          </div>
        </Panel>
        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save improvement' : 'Add improvement'} />
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
