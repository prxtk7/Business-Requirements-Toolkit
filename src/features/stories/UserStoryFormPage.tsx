import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { ErrorSummary } from '../../components/ui/ErrorSummary';
import { FormActions } from '../../components/ui/FormActions';
import { Panel } from '../../components/ui/Panel';
import { CheckboxGroupField, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { RequirementPriority, StoryStatus } from '../../domain/types';
import { PRIORITY_LABELS, REQUIREMENT_PRIORITIES } from '../../domain/requirementConfig';
import { STORY_STATUSES, STORY_STATUS_LABELS } from '../../domain/storyConfig';
import { compareIdentifiers } from '../../domain/requirements';
import {
  PERSONA_MAX_LENGTH,
  STORY_TITLE_MAX_LENGTH,
  createEmptyStoryInput,
  formatStoryStatement,
  nextStoryIdentifier,
  toStoryInput,
  validateStory,
  type StoryInput,
} from '../../domain/userStories';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useValidatedForm } from '../../hooks/useValidatedForm';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { CriteriaEditor } from './CriteriaEditor';
import { storyPaths } from './storyPaths';

const FIELD_IDS: Record<keyof StoryInput, string> = {
  title: 'story-title',
  persona: 'story-persona',
  need: 'story-need',
  benefit: 'story-benefit',
  description: 'story-description',
  requirementIds: 'story-requirements',
  priority: 'story-priority',
  status: 'story-status',
  criteria: 'story-criteria',
};

/** Select value for "custom persona"; stakeholder options use the stakeholder id. */
const CUSTOM = '__custom__';

/** Handles `/user-stories/new?requirement=` and `/user-stories/:storyId/edit`. */
export function UserStoryFormPage() {
  const { storyId } = useParams();
  const [params] = useSearchParams();
  const { workspace } = useWorkspace();
  const existing = storyId ? workspace.userStories.find((s) => s.id === storyId) : undefined;

  if (storyId && !existing) {
    return (
      <NotFoundPage
        title="User story not found"
        message="This user story may have been deleted, or the link is incorrect."
        backTo={{ to: storyPaths.list, label: 'Back to user stories' }}
      />
    );
  }
  const requested = params.get('requirement');
  const presetRequirement = requested && workspace.requirements.some((r) => r.id === requested) ? requested : null;
  return <StoryForm key={existing?.id ?? 'new'} storyId={existing?.id} presetRequirement={presetRequirement} />;
}

function StoryForm({ storyId, presetRequirement }: { storyId: string | undefined; presetRequirement: string | null }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const existing = storyId ? workspace.userStories.find((s) => s.id === storyId) : undefined;
  const isEdit = existing !== undefined;

  const initial: StoryInput = existing
    ? toStoryInput(existing)
    : { ...createEmptyStoryInput(), requirementIds: presetRequirement ? [presetRequirement] : [] };

  const { form, set, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } = useValidatedForm<StoryInput>(
    initial,
    (values) => validateStory(values, workspace).errors,
    FIELD_IDS,
  );
  const criterionErrors = attempt > 0 ? validateStory(form, workspace).criteria : {};
  useDocumentTitle(isEdit ? `Edit ${existing.identifier}` : 'New user story');

  const identifier = existing?.identifier ?? nextStoryIdentifier(workspace).identifier;
  const cancelTo = isEdit ? storyPaths.detail(existing.id) : storyPaths.list;
  const personaChoice = form.persona.stakeholderId ?? CUSTOM;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result, id } = actions.saveStory(storyId ?? null, form);
    if (!report(result, isEdit ? `${identifier} saved.` : `${identifier} created as ${STORY_STATUS_LABELS[form.status]}.`)) return;
    allowNavigation();
    navigate(storyPaths.detail(id));
  };

  return (
    <>
      <PageHeader
        eyebrow="User Stories"
        title={isEdit ? `Edit ${existing.identifier}` : 'New user story'}
        description="Fields marked * are required. The story statement is built from the user role, need and benefit."
        back={{ to: cancelTo, label: isEdit ? 'Back to user story' : 'Back to user stories' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />

        <Panel title="User story">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_10rem]">
              <TextField
                id={FIELD_IDS.title}
                label="Title"
                value={form.title}
                onChange={(v) => set('title', v)}
                error={errors.title}
                required
                maxLength={STORY_TITLE_MAX_LENGTH + 20}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Identifier</p>
                <p className="mt-2.5 font-mono text-sm font-semibold text-slate-900">{identifier}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                id="story-persona-source"
                label="User role"
                hint="A stakeholder from the register, or a custom persona."
                value={personaChoice}
                options={[
                  ...workspace.stakeholders.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` })),
                  { value: CUSTOM, label: 'Custom persona (not in the stakeholder register)' },
                ]}
                onChange={(v) => {
                  if (v === CUSTOM) set('persona', { stakeholderId: null, label: form.persona.stakeholderId === null ? form.persona.label : '' });
                  else set('persona', { stakeholderId: v, label: workspace.stakeholders.find((s) => s.id === v)?.role ?? '' });
                }}
                required
              />
              <TextField
                id={FIELD_IDS.persona}
                label={form.persona.stakeholderId === null ? 'Custom persona' : 'Role wording in the statement'}
                hint={
                  form.persona.stakeholderId === null
                    ? 'Not a stakeholder record — used only in this story.'
                    : 'How the role reads in “As a …”, e.g. “Service Coordinator”.'
                }
                value={form.persona.label}
                onChange={(v) => set('persona', { ...form.persona, label: v })}
                error={errors.persona}
                required
                maxLength={PERSONA_MAX_LENGTH + 20}
              />
            </div>

            <TextAreaField
              id={FIELD_IDS.need}
              label="I want"
              hint="The capability or action the user needs."
              value={form.need}
              onChange={(v) => set('need', v)}
              error={errors.need}
              required
              rows={2}
            />
            <TextAreaField
              id={FIELD_IDS.benefit}
              label="So that"
              hint="The benefit to the user or the business."
              value={form.benefit}
              onChange={(v) => set('benefit', v)}
              error={errors.benefit}
              required
              rows={2}
            />

            <div className="rounded-md bg-brand-50 px-4 py-3 ring-1 ring-brand-200 ring-inset" aria-live="polite">
              <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">Story statement</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{formatStoryStatement(form)}</p>
            </div>

            <TextAreaField
              id={FIELD_IDS.description}
              label="Additional description"
              value={form.description}
              onChange={(v) => set('description', v)}
              rows={2}
            />
          </div>
        </Panel>

        <Panel title="Linked requirements" description="At least one is required. Link only requirements this story actually delivers.">
          {workspace.requirements.length === 0 ? (
            <p className="text-sm text-slate-500">
              There are no requirements yet.{' '}
              <Link to="/requirements/new" className="font-medium text-brand-700 underline underline-offset-2">
                Add a requirement
              </Link>{' '}
              first.
            </p>
          ) : (
            <CheckboxGroupField
              id={FIELD_IDS.requirementIds}
              label="Requirements"
              options={[...workspace.requirements]
                .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
                .map((r) => ({ value: r.id, label: `${r.identifier} — ${r.title}` }))}
              values={form.requirementIds}
              onChange={(v) => set('requirementIds', v)}
              error={errors.requirementIds}
            />
          )}
        </Panel>

        <Panel title="Priority and status" description="Story priority is set independently of the linked requirements' priority.">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField<RequirementPriority>
              id={FIELD_IDS.priority}
              label="Priority (MoSCoW)"
              value={form.priority}
              options={REQUIREMENT_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
              onChange={(v) => set('priority', v)}
              error={errors.priority}
            />
            <SelectField<StoryStatus>
              id={FIELD_IDS.status}
              label="Status"
              hint={isEdit ? undefined : 'New stories start as Draft.'}
              value={form.status}
              options={STORY_STATUSES.map((s) => ({ value: s, label: STORY_STATUS_LABELS[s] }))}
              onChange={(v) => set('status', v)}
              error={errors.status}
            />
          </div>
        </Panel>

        <Panel title="Acceptance criteria">
          <CriteriaEditor id={FIELD_IDS.criteria} criteria={form.criteria} onChange={(v) => set('criteria', v)} errors={criterionErrors} />
          {errors.criteria && <p className="mt-2 text-sm font-medium text-red-700">{errors.criteria}</p>}
        </Panel>

        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save user story' : 'Create user story'} />
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
