import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { UnsavedChangesDialog } from '../../components/layout/UnsavedChangesDialog';
import { ErrorSummary } from '../../components/ui/ErrorSummary';
import { FormActions } from '../../components/ui/FormActions';
import { Panel } from '../../components/ui/Panel';
import { CheckboxGroupField, SelectField, TextAreaField, TextField } from '../../components/ui/fields';
import type { RiskLinks, RiskResponse, RiskStatus } from '../../domain/types';
import {
  IMPACT_LABELS,
  PROBABILITY_LABELS,
  RATINGS,
  RESPONSE_DETAILS,
  RISK_CATEGORIES,
  RISK_RESPONSES,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
  isRating,
} from '../../domain/riskConfig';
import {
  OWNER_NAME_MAX_LENGTH,
  RISK_TITLE_MAX_LENGTH,
  assessRisk,
  createEmptyRiskInput,
  nextRiskIdentifier,
  toRiskInput,
  validateRisk,
  type RiskInput,
} from '../../domain/risks';
import { PROCESS_TYPE_LABELS } from '../../domain/processes';
import { compareIdentifiers } from '../../domain/requirements';
import { compareStoryIdentifiers } from '../../domain/userStories';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useValidatedForm } from '../../hooks/useValidatedForm';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { stepOption } from '../processes/stepOption';
import { ScoringGuide, SeverityBadge } from './riskUi';
import { riskPaths } from './riskPaths';

const FIELD_IDS: Record<keyof RiskInput, string> = {
  title: 'risk-title',
  description: 'risk-description',
  category: 'risk-category',
  probability: 'risk-probability',
  impact: 'risk-impact',
  response: 'risk-response',
  mitigation: 'risk-mitigation',
  contingency: 'risk-contingency',
  owner: 'risk-owner',
  status: 'risk-status',
  links: 'risk-links',
};

const CUSTOM = '__custom__';

/** Handles `/risks/new` and `/risks/:riskId/edit`. */
export function RiskFormPage() {
  const { riskId } = useParams();
  const { workspace } = useWorkspace();
  const existing = riskId ? workspace.risks.find((r) => r.id === riskId) : undefined;
  if (riskId && !existing) {
    return <NotFoundPage title="Risk not found" message="This risk may have been deleted, or the link is incorrect." backTo={{ to: riskPaths.list, label: 'Back to risk register' }} />;
  }
  return <RiskForm key={existing?.id ?? 'new'} riskId={existing?.id} />;
}

function RiskForm({ riskId }: { riskId: string | undefined }) {
  const { workspace, actions } = useWorkspace();
  const navigate = useNavigate();
  const report = useCommitFeedback();
  const existing = riskId ? workspace.risks.find((r) => r.id === riskId) : undefined;
  const isEdit = existing !== undefined;

  const { form, set, errors, summary, attempt, isDirty, trySubmit, blocker, allowNavigation } = useValidatedForm<RiskInput>(
    existing ? toRiskInput(existing) : createEmptyRiskInput(),
    (values) => validateRisk(values, workspace),
    FIELD_IDS,
  );
  useDocumentTitle(isEdit ? `Edit ${existing.identifier}` : 'New risk');

  const identifier = existing?.identifier ?? nextRiskIdentifier(workspace).identifier;
  const cancelTo = isEdit ? riskPaths.detail(existing.id) : riskPaths.list;
  const assessment = isRating(form.probability) && isRating(form.impact) ? assessRisk(form) : null;
  const setLinks = (kind: keyof RiskLinks, ids: string[]) => set('links', { ...form.links, [kind]: ids });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trySubmit()) return;
    const { result, id } = actions.saveRisk(riskId ?? null, form);
    if (!report(result, isEdit ? `${identifier} saved.` : `${identifier} recorded as ${RISK_STATUS_LABELS[form.status]}.`)) return;
    allowNavigation();
    navigate(riskPaths.detail(id));
  };

  return (
    <>
      <PageHeader
        eyebrow="Risk Management"
        title={isEdit ? `Edit ${existing.identifier}` : 'New risk'}
        description="Fields marked * are required. Related project records are optional."
        back={{ to: cancelTo, label: isEdit ? 'Back to risk' : 'Back to risk register' }}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <ErrorSummary errors={summary} attempt={attempt} />

        <Panel title="Risk">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_10rem]">
              <TextField id={FIELD_IDS.title} label="Title" value={form.title} onChange={(v) => set('title', v)} error={errors.title} required maxLength={RISK_TITLE_MAX_LENGTH + 20} />
              <div>
                <p className="text-sm font-medium text-slate-800">Risk ID</p>
                <p className="mt-2.5 font-mono text-sm font-semibold text-slate-900">{identifier}</p>
              </div>
            </div>
            <TextAreaField
              id={FIELD_IDS.description}
              label="Description"
              hint="What could happen, and why it could happen."
              value={form.description}
              onChange={(v) => set('description', v)}
              error={errors.description}
              required
              rows={3}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                id={FIELD_IDS.category}
                label="Category"
                value={form.category}
                options={[{ value: '', label: 'Select a category…' }, ...RISK_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
                onChange={(v) => set('category', v)}
                error={errors.category}
                required
              />
              <SelectField<RiskStatus>
                id={FIELD_IDS.status}
                label="Status"
                hint={isEdit ? undefined : 'New risks start as Identified.'}
                value={form.status}
                options={RISK_STATUSES.map((s) => ({ value: s, label: RISK_STATUS_LABELS[s] }))}
                onChange={(v) => set('status', v)}
                error={errors.status}
                required
              />
            </div>
          </div>
        </Panel>

        <Panel title="Assessment">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-3">
              <SelectField
                id={FIELD_IDS.probability}
                label="Probability"
                value={String(form.probability)}
                options={RATINGS.map((n) => ({ value: String(n), label: `${n} — ${PROBABILITY_LABELS[n]}` }))}
                onChange={(v) => set('probability', Number(v))}
                error={errors.probability}
                required
              />
              <SelectField
                id={FIELD_IDS.impact}
                label="Impact"
                value={String(form.impact)}
                options={RATINGS.map((n) => ({ value: String(n), label: `${n} — ${IMPACT_LABELS[n]}` }))}
                onChange={(v) => set('impact', Number(v))}
                error={errors.impact}
                required
              />
              <div className="rounded-md bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset" aria-live="polite">
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Calculated score</p>
                {assessment ? (
                  <p className="mt-1.5 flex items-center gap-2 text-sm">
                    <span className="text-slate-600 tabular-nums">
                      {form.probability} × {form.impact} =
                    </span>
                    <span className="text-xl font-semibold text-slate-900 tabular-nums">{assessment.score}</span>
                    <SeverityBadge severity={assessment.severity} />
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-500">Select probability and impact.</p>
                )}
              </div>
            </div>
            <ScoringGuide />
          </div>
        </Panel>

        <Panel title="Response">
          <div className="space-y-5">
            <SelectField<RiskResponse>
              id={FIELD_IDS.response}
              label="Response strategy"
              hint={RESPONSE_DETAILS[form.response]?.description}
              value={form.response}
              options={RISK_RESPONSES.map((r) => ({ value: r, label: RESPONSE_DETAILS[r].label }))}
              onChange={(v) => set('response', v)}
              error={errors.response}
              required
            />
            <div className="grid gap-5 md:grid-cols-2">
              <TextAreaField
                id={FIELD_IDS.mitigation}
                label="Mitigation plan"
                hint="Actions to reduce the probability or impact. Required for a Mitigate response."
                value={form.mitigation}
                onChange={(v) => set('mitigation', v)}
                error={errors.mitigation}
                rows={3}
              />
              <TextAreaField
                id={FIELD_IDS.contingency}
                label="Contingency plan"
                hint="What to do if the risk happens."
                value={form.contingency}
                onChange={(v) => set('contingency', v)}
                rows={3}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Ownership">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              id={FIELD_IDS.owner}
              label="Owner"
              hint="The person responsible for managing this risk."
              value={form.owner.stakeholderId ?? CUSTOM}
              options={[
                ...workspace.stakeholders.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` })),
                { value: CUSTOM, label: 'Someone not in the stakeholder register' },
              ]}
              onChange={(v) => set('owner', v === CUSTOM ? { stakeholderId: null, customName: '' } : { stakeholderId: v, customName: '' })}
              error={form.owner.stakeholderId !== null ? errors.owner : undefined}
              required
            />
            {form.owner.stakeholderId === null && (
              <TextField
                id="risk-owner-name"
                label="Owner name"
                hint="Not a stakeholder record — recorded on this risk only."
                value={form.owner.customName}
                onChange={(v) => set('owner', { stakeholderId: null, customName: v })}
                error={errors.owner}
                required
                maxLength={OWNER_NAME_MAX_LENGTH + 20}
              />
            )}
          </div>
        </Panel>

        <Panel title="Related project records" description="Optional. Link the records this risk affects; deleting one of them later removes the link, not the risk.">
          <div id={FIELD_IDS.links} className="space-y-6">
            {errors.links && <p className="text-sm font-medium text-red-700">{errors.links}</p>}
            <div className="grid gap-6 lg:grid-cols-2">
              <CheckboxGroupField
                id="risk-link-stakeholders"
                label="Stakeholders"
                options={workspace.stakeholders.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` }))}
                values={form.links.stakeholderIds}
                onChange={(v) => setLinks('stakeholderIds', v)}
                emptyMessage="No stakeholders recorded."
              />
              <CheckboxGroupField
                id="risk-link-objectives"
                label="Project objectives"
                options={workspace.project.objectives.map((o) => ({ value: o.id, label: o.text }))}
                values={form.links.objectiveIds}
                onChange={(v) => setLinks('objectiveIds', v)}
                emptyMessage="The project overview has no objectives."
              />
              {workspace.processes.map((process) => {
                const ids = new Set(process.steps.map((s) => s.id));
                return (
                  <CheckboxGroupField
                    key={process.id}
                    id={`risk-link-steps-${process.id}`}
                    label={`${process.name} (${PROCESS_TYPE_LABELS[process.type]})`}
                    options={process.steps.map(stepOption)}
                    values={form.links.stepIds.filter((id) => ids.has(id))}
                    onChange={(selected) => setLinks('stepIds', [...form.links.stepIds.filter((id) => !ids.has(id)), ...selected])}
                    emptyMessage="This process has no steps."
                  />
                );
              })}
              <CheckboxGroupField
                id="risk-link-requirements"
                label="Requirements"
                options={[...workspace.requirements]
                  .sort((a, b) => compareIdentifiers(a.identifier, b.identifier))
                  .map((r) => ({ value: r.id, label: `${r.identifier} — ${r.title}` }))}
                values={form.links.requirementIds}
                onChange={(v) => setLinks('requirementIds', v)}
                emptyMessage="No requirements recorded."
              />
              <CheckboxGroupField
                id="risk-link-stories"
                label="User stories"
                options={[...workspace.userStories]
                  .sort((a, b) => compareStoryIdentifiers(a.identifier, b.identifier))
                  .map((s) => ({ value: s.id, label: `${s.identifier} — ${s.title}` }))}
                values={form.links.storyIds}
                onChange={(v) => setLinks('storyIds', v)}
                emptyMessage="No user stories recorded."
              />
            </div>
          </div>
        </Panel>

        <FormActions isDirty={isDirty} cancelTo={cancelTo} submitLabel={isEdit ? 'Save risk' : 'Record risk'} />
      </form>

      <UnsavedChangesDialog blocker={blocker} />
    </>
  );
}
