import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Save } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorSummary, type ErrorSummaryItem } from '../../components/ui/ErrorSummary';
import { ListEditor } from '../../components/ui/ListEditor';
import { Panel } from '../../components/ui/Panel';
import { TextAreaField, TextField } from '../../components/ui/fields';
import { useToast } from '../../components/ui/toastContext';
import {
  PROJECT_NAME_MAX_LENGTH,
  toProjectInput,
  createObjectiveId,
  validateProject,
  type ProjectOverviewInput,
} from '../../domain/project';
import { useWorkspace } from '../../state/workspaceContext';
import { Alert } from '../../components/ui/Alert';
import { normaliseObjectives } from '../../domain/project';
import { risksLinkedTo } from '../../domain/risks';
import { RiskUnlinkNote } from '../risks/riskUi';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

/** DOM ids for each validated field, used by the error summary links. */
const FIELD_IDS: Record<keyof ProjectOverviewInput, string> = {
  name: 'project-name',
  organisation: 'project-organisation',
  background: 'project-background',
  problemStatement: 'project-problem',
  objectives: 'project-objectives',
  inScope: 'project-in-scope',
  outOfScope: 'project-out-of-scope',
  successCriteria: 'project-success-criteria',
};

export function ProjectOverviewEditPage() {
  const { workspace, actions } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  useDocumentTitle('Edit Project Overview');

  // Initial values are captured once per mounted form.
  const [initial] = useState<ProjectOverviewInput>(() => toProjectInput(workspace.project));
  const [form, setForm] = useState<ProjectOverviewInput>(initial);
  const [submitAttempt, setSubmitAttempt] = useState(0);

  const isNew = !workspace.project.name;
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
  const { blocker, allowNavigation } = useUnsavedChangesGuard(isDirty);

  // Only show errors after the first submit, then keep them live as the user fixes them.
  // Requirements tracing to an objective prevent it being removed here.
  const validate = (values: ProjectOverviewInput) => validateProject(values, workspace.requirements, workspace.project);
  const errors = submitAttempt > 0 ? validate(form) : {};
  const summary: ErrorSummaryItem[] = (Object.keys(errors) as Array<keyof ProjectOverviewInput>).map((key) => ({
    fieldId: FIELD_IDS[key],
    message: errors[key] as string,
  }));

  const set = <K extends keyof ProjectOverviewInput>(key: K, value: ProjectOverviewInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempt((n) => n + 1);
    if (Object.keys(validate(form)).length > 0) return;

    const result = actions.saveProject(form);
    // Refused because of a cross-tab conflict: stay on the form so no input is lost.
    if (!result.ok && result.blocked) {
      toast.error(result.error);
      return;
    }
    if (result.ok) toast.success('Project overview saved.');
    else toast.error(result.error);
    allowNavigation();
    navigate('/overview');
  };

  return (
    <>
      <PageHeader
        eyebrow="Project Overview"
        title={isNew ? 'Create project overview' : 'Edit project overview'}
        description="Capture the context of the improvement initiative. Fields marked * are required."
        back={{ to: '/overview', label: 'Back to overview' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={submitAttempt} />

        <Panel title="Project details">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={FIELD_IDS.name}
              label="Project name"
              value={form.name}
              onChange={(v) => set('name', v)}
              error={errors.name}
              required
              maxLength={PROJECT_NAME_MAX_LENGTH + 20}
            />
            <TextField
              id={FIELD_IDS.organisation}
              label="Organisation or business unit"
              value={form.organisation}
              onChange={(v) => set('organisation', v)}
            />
          </div>
        </Panel>

        <Panel title="Context">
          <div className="space-y-5">
            <TextAreaField
              id={FIELD_IDS.background}
              label="Background"
              hint="How things work today and why the project has been initiated."
              value={form.background}
              onChange={(v) => set('background', v)}
              rows={5}
            />
            <TextAreaField
              id={FIELD_IDS.problemStatement}
              label="Problem statement"
              hint="The business problem to be solved, who it affects and its impact."
              value={form.problemStatement}
              onChange={(v) => set('problemStatement', v)}
              error={errors.problemStatement}
              required
              rows={5}
            />
          </div>
        </Panel>

        <Panel title="Objectives">
          {(() => {
            const kept = new Set(normaliseObjectives(form.objectives).map((o) => o.id));
            const removed = workspace.project.objectives.filter((o) => !kept.has(o.id)).map((o) => o.id);
            const risks = risksLinkedTo(workspace, 'objectiveIds', removed);
            return risks.length > 0 ? (
              <Alert tone="info" className="mb-4" title="Removed objective is linked to risks">
                <RiskUnlinkNote risks={risks} />
              </Alert>
            ) : null;
          })()}
          <ListEditor
            id={FIELD_IDS.objectives}
            label="Objectives"
            itemLabel="objective"
            hint="What the project must achieve. Start each with a verb, e.g. “Reduce…”, “Enable…”."
            items={form.objectives.map((o) => o.text)}
            keys={form.objectives.map((o) => o.id)}
            onChange={(texts, keys) =>
              set(
                'objectives',
                texts.map((text, i) => ({ id: keys[i] ?? createObjectiveId(), text })),
              )
            }
            error={errors.objectives}
            required
          />
        </Panel>

        <Panel title="Scope">
          <div className="grid gap-6 md:grid-cols-2">
            <ListEditor
              id={FIELD_IDS.inScope}
              label="In scope"
              itemLabel="in-scope item"
              items={form.inScope}
              onChange={(v) => set('inScope', v)}
            />
            <ListEditor
              id={FIELD_IDS.outOfScope}
              label="Out of scope"
              itemLabel="out-of-scope item"
              items={form.outOfScope}
              onChange={(v) => set('outOfScope', v)}
            />
          </div>
        </Panel>

        <Panel title="Success criteria">
          <ListEditor
            id={FIELD_IDS.successCriteria}
            label="Success criteria"
            itemLabel="success criterion"
            hint="Measurable conditions that show the objectives have been met."
            items={form.successCriteria}
            onChange={(v) => set('successCriteria', v)}
          />
        </Panel>

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white sm:px-5">
          {isDirty && <p className="mr-auto text-sm text-slate-500">Unsaved changes</p>}
          <ButtonLink to="/overview" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" icon={Save}>
            Save overview
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
