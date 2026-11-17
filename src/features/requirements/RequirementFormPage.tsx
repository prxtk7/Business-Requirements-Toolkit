import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { ErrorSummary } from '../../components/ui/ErrorSummary';
import { FormActions } from '../../components/ui/FormActions';
import { ListEditor } from '../../components/ui/ListEditor';
import { Panel } from '../../components/ui/Panel';
import { CheckboxGroupField, SegmentedField, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { RequirementPriority, RequirementStatus, RequirementType } from '../../domain/types';
import {
  PRIORITY_LABELS,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_STATUSES,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DETAILS,
  STATUS_LABELS,
  isRequirementType,
} from '../../domain/requirementConfig';
import {
  TITLE_MAX_LENGTH,
  compareIdentifiers,
  createEmptyRequirementInput,
  nextIdentifier,
  toRequirementInput,
  validateRequirement,
  type RequirementInput,
} from '../../domain/requirements';
import { PROCESS_TYPE_LABELS } from '../../domain/processes';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useValidatedForm } from '../../hooks/useValidatedForm';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { stepOption } from '../processes/stepOption';
import { requirementPaths } from './requirementPaths';

const FIELD_IDS: Record<keyof RequirementInput, string> = {
  type: 'requirement-type',
  category: 'requirement-category',
  title: 'requirement-title',
  description: 'requirement-description',
  rationale: 'requirement-rationale',
  priority: 'requirement-priority',
  status: 'requirement-status',
  sourceStakeholderId: 'requirement-source',
  objectiveIds: 'requirement-objectives',
  stepIds: 'requirement-steps',
  dependencyIds: 'requirement-dependencies',
  acceptanceCriteria: 'requirement-acceptance',
};

const NO_STAKEHOLDER = '';

/** Handles `/requirements/new?type=` and `/requirements/:requirementId/edit`. */
export function RequirementFormPage() {
  const { requirementId } = useParams();
  const [params] = useSearchParams();
  const { workspace } = useWorkspace();
  const existing = requirementId ? workspace.requirements.find((r) => r.id === requirementId) : undefined;

  if (requirementId && !existing) {
    return (
      <NotFoundPage
        title="Requirement not found"
        message="This requirement may have been deleted, or the link is incorrect."
        backTo={{ to: requirementPaths.list, label: 'Back to requirements' }}
      />
    );
  }
  const requested = params.get('type');
  const initialType: RequirementType = isRequirementType(requested) ? requested : 'functional';
  return <RequirementForm key={existing?.id ?? `new-${initialType}`} requirementId={existing?.id} initialType={initialType} />;
}

function RequirementForm({ requirementId, initialType }: { requirementId: string | undefined; initialType: RequirementType }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const existing = requirementId ? workspace.requirements.find((r) => r.id === requirementId) : undefined;
  const isEdit = existing !== undefined;

  const { form, set, setForm, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } =
    useValidatedForm<RequirementInput>(
      existing ? toRequirementInput(existing) : createEmptyRequirementInput(initialType),
      (values) => validateRequirement(values, workspace, requirementId),
      FIELD_IDS,
    );
  useDocumentTitle(isEdit ? `Edit ${existing.identifier}` : 'New requirement');

  const identifier = existing?.identifier ?? nextIdentifier(workspace, form.type).identifier;
  const cancelTo = isEdit ? requirementPaths.detail(existing.id) : requirementPaths.list;

  const dependencyOptions = [...workspace.requirements]
    .filter((r) => r.id !== requirementId)
    .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
    .map((r) => ({ value: r.id, label: `${r.identifier} — ${r.title}` }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result, id } = actions.saveRequirement(requirementId ?? null, form);
    const saved = workspace.requirements.find((r) => r.id === id)?.identifier ?? identifier;
    if (!report(result, isEdit ? `${saved} saved.` : `${identifier} created as ${STATUS_LABELS[form.status]}.`)) return;
    allowNavigation();
    navigate(requirementPaths.detail(id));
  };

  return (
    <>
      <PageHeader
        eyebrow="Requirements Management"
        title={isEdit ? `Edit ${existing.identifier}` : 'New requirement'}
        description="Fields marked * are required. Links to stakeholders, objectives and process steps make the requirement traceable."
        back={{ to: cancelTo, label: isEdit ? 'Back to requirement' : 'Back to requirements' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />

        <Panel title="Requirement">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              {isEdit ? (
                <div>
                  <p className="text-sm font-medium text-slate-800">Type</p>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {REQUIREMENT_TYPE_DETAILS[form.type].label} — fixed after creation because it determines the identifier.
                  </p>
                </div>
              ) : (
                <SegmentedField<RequirementType>
                  id={FIELD_IDS.type}
                  label="Type"
                  value={form.type}
                  options={REQUIREMENT_TYPES.map((t) => ({ value: t, label: REQUIREMENT_TYPE_DETAILS[t].label }))}
                  onChange={(v) => setForm((current) => ({ ...current, type: v, category: '' }))}
                  error={errors.type}
                />
              )}
              <div>
                <p className="text-sm font-medium text-slate-800">Identifier</p>
                <p className="mt-1.5 font-mono text-sm font-semibold text-slate-900">{identifier}</p>
                {!isEdit && <p className="mt-0.5 text-xs text-slate-500">Assigned automatically when saved; never reused.</p>}
              </div>
            </div>
            <TextField
              id={FIELD_IDS.title}
              label="Title"
              value={form.title}
              onChange={(v) => set('title', v)}
              error={errors.title}
              required
              maxLength={TITLE_MAX_LENGTH + 20}
            />
            <TextAreaField
              id={FIELD_IDS.description}
              label="Description"
              hint="State what the system shall do, or the quality it shall have."
              value={form.description}
              onChange={(v) => set('description', v)}
              error={errors.description}
              required
              rows={3}
            />
            <TextAreaField
              id={FIELD_IDS.rationale}
              label="Business rationale"
              hint="Why the requirement is needed — the problem or benefit behind it."
              value={form.rationale}
              onChange={(v) => set('rationale', v)}
              rows={2}
            />
          </div>
        </Panel>

        <Panel title="Classification and priority">
          <div className="grid gap-5 md:grid-cols-3">
            <SelectField
              id={FIELD_IDS.category}
              label="Category"
              value={form.category}
              options={[
                { value: '', label: 'Select a category…' },
                ...REQUIREMENT_CATEGORIES[form.type].map((c) => ({ value: c.id, label: c.label })),
              ]}
              onChange={(v) => set('category', v)}
              error={errors.category}
              required
            />
            <SelectField<RequirementPriority>
              id={FIELD_IDS.priority}
              label="Priority (MoSCoW)"
              value={form.priority}
              options={REQUIREMENT_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
              onChange={(v) => set('priority', v)}
              error={errors.priority}
              required
            />
            <SelectField<RequirementStatus>
              id={FIELD_IDS.status}
              label="Status"
              hint={isEdit ? undefined : 'New requirements start as Draft.'}
              value={form.status}
              options={REQUIREMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              onChange={(v) => set('status', v)}
              error={errors.status}
              required
            />
          </div>
        </Panel>

        <Panel title="Traceability" description="Link the requirement to existing project information. Leave a link empty if it does not apply — gaps are shown in the traceability matrix.">
          <div className="space-y-6">
            <SelectField
              id={FIELD_IDS.sourceStakeholderId}
              label="Source stakeholder"
              hint="Who raised or owns this requirement."
              value={form.sourceStakeholderId ?? NO_STAKEHOLDER}
              options={[
                { value: NO_STAKEHOLDER, label: 'Not recorded' },
                ...workspace.stakeholders.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` })),
              ]}
              onChange={(v) => set('sourceStakeholderId', v === NO_STAKEHOLDER ? null : v)}
              error={errors.sourceStakeholderId}
            />

            <CheckboxGroupField
              id={FIELD_IDS.objectiveIds}
              label="Related project objectives"
              options={workspace.project.objectives.map((o) => ({ value: o.id, label: o.text }))}
              values={form.objectiveIds}
              onChange={(v) => set('objectiveIds', v)}
              error={errors.objectiveIds}
              emptyMessage="The project overview has no objectives yet."
            />

            <div id={FIELD_IDS.stepIds}>
              <p className="text-sm font-medium text-slate-800">Related process steps</p>
              <p className="mt-1 text-sm text-slate-500">
                Link AS-IS steps the requirement addresses and TO-BE steps it enables.
              </p>
              {workspace.processes.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 italic">
                  No processes documented yet.{' '}
                  <Link to="/processes" className="font-medium text-brand-700 underline underline-offset-2">
                    Document a process
                  </Link>{' '}
                  to link its steps.
                </p>
              ) : (
                <div className="mt-3 grid gap-5 lg:grid-cols-2">
                  {workspace.processes.map((process) => {
                    const ids = new Set(process.steps.map((s) => s.id));
                    return (
                      <CheckboxGroupField
                        key={process.id}
                        id={`${FIELD_IDS.stepIds}-${process.id}`}
                        label={`${process.name} (${PROCESS_TYPE_LABELS[process.type]})`}
                        options={process.steps.map(stepOption)}
                        values={form.stepIds.filter((id) => ids.has(id))}
                        onChange={(selected) => set('stepIds', [...form.stepIds.filter((id) => !ids.has(id)), ...selected])}
                        emptyMessage="This process has no steps yet."
                      />
                    );
                  })}
                </div>
              )}
              {errors.stepIds && <p className="mt-1.5 text-sm font-medium text-red-700">{errors.stepIds}</p>}
            </div>

            <CheckboxGroupField
              id={FIELD_IDS.dependencyIds}
              label="Depends on"
              hint="Requirements that must be in place for this one. Circular chains are not allowed."
              options={dependencyOptions}
              values={form.dependencyIds}
              onChange={(v) => set('dependencyIds', v)}
              error={errors.dependencyIds}
              emptyMessage="There are no other requirements yet."
            />
          </div>
        </Panel>

        <Panel title="Acceptance criteria / verification notes">
          <ListEditor
            id={FIELD_IDS.acceptanceCriteria}
            label="Acceptance criteria"
            itemLabel="criterion"
            hint="Conditions that show the requirement is met. Label any numeric target as illustrative until stakeholders validate it."
            items={form.acceptanceCriteria}
            onChange={(v) => set('acceptanceCriteria', v)}
          />
        </Panel>

        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save requirement' : 'Create requirement'} />
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
