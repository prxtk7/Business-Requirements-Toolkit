import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import { SelectField } from '../../components/ui/fields';
import type { AcceptanceCriterion, UserStory, VerificationStatus } from '../../domain/types';
import { VERIFICATION_LABELS, VERIFICATION_STATUSES } from '../../domain/storyConfig';
import { compareIdentifiers } from '../../domain/requirements';
import { criterionLabel, formatStoryStatement } from '../../domain/userStories';
import { countCriteria } from '../../domain/storyCoverage';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useCommitFeedback } from '../../hooks/useCommitFeedback';
import { formatDateTime, pluralise } from '../../lib/format';
import { NotFoundPage } from '../workspace/NotFoundPage';
import { PriorityBadge, StatusBadge } from '../requirements/requirementUi';
import { DeleteStoryDialog } from './DeleteStoryDialog';
import { StoryStatusBadge, VERIFICATION_DISCLAIMER, VerificationBadge } from './storyUi';
import { storyPaths } from './storyPaths';

function Clause({ keyword, children }: { keyword: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2 text-sm">
      <dt className="font-mono text-xs font-semibold tracking-wider text-brand-700 uppercase">{keyword}</dt>
      <dd className="leading-relaxed text-slate-800">{children}</dd>
    </div>
  );
}

function CriterionCard({ story, criterion }: { story: UserStory; criterion: AcceptanceCriterion }) {
  const { actions } = useWorkspace();
  const report = useCommitFeedback();
  const label = `${story.identifier} ${criterionLabel(criterion)}`;
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-slate-500">{label}</p>
          <h3 className="mt-0.5 font-medium text-slate-900">{criterion.title}</h3>
        </div>
        <VerificationBadge status={criterion.verification} />
      </div>
      <dl className="mt-3 space-y-1.5">
        <Clause keyword="Given">{criterion.given}</Clause>
        <Clause keyword="When">{criterion.when}</Clause>
        <Clause keyword="Then">{criterion.then}</Clause>
      </dl>
      {criterion.notes && <p className="mt-3 text-sm text-slate-500 italic">{criterion.notes}</p>}
      <div className="mt-3 border-t border-slate-100 pt-3 sm:w-60">
        <SelectField<VerificationStatus>
          id={`verify-${criterion.id}`}
          label={`Verification status of ${label}`}
          hideLabel
          value={criterion.verification}
          options={VERIFICATION_STATUSES.map((s) => ({ value: s, label: `Verification: ${VERIFICATION_LABELS[s]}` }))}
          onChange={(v) => report(actions.setCriterionVerification(story.id, criterion.id, v), `${label} marked ${VERIFICATION_LABELS[v]}.`)}
        />
      </div>
    </li>
  );
}

export function UserStoryDetailPage() {
  const { storyId = '' } = useParams();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const story = workspace.userStories.find((s) => s.id === storyId);
  useDocumentTitle(story ? `${story.identifier} ${story.title}` : 'User story not found');

  if (!story) {
    return (
      <NotFoundPage
        title="User story not found"
        message="This user story may have been deleted, or the link is incorrect."
        backTo={{ to: storyPaths.list, label: 'Back to user stories' }}
      />
    );
  }

  const stakeholder = story.persona.stakeholderId ? workspace.stakeholders.find((s) => s.id === story.persona.stakeholderId) : undefined;
  const requirements = workspace.requirements
    .filter((r) => story.requirementIds.includes(r.id))
    .sort((a, b) => compareIdentifiers(a.identifier, b.identifier));
  const missingLinks = story.requirementIds.length - requirements.length;
  const counts = countCriteria([story]);

  return (
    <>
      <PageHeader
        eyebrow={`User Stories · ${story.identifier}`}
        title={story.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={story.priority} />
            <StoryStatusBadge status={story.status} />
          </span>
        }
        back={{ to: storyPaths.list, label: 'All user stories' }}
        actions={
          <>
            <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            <ButtonLink to={storyPaths.edit(story.id)} variant="primary" icon={Pencil}>
              Edit user story
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="User story statement">
            <blockquote className="border-l-4 border-brand-300 pl-4 text-base leading-relaxed text-slate-900">
              {formatStoryStatement(story)}
            </blockquote>
            {story.description && <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">{story.description}</p>}
          </Panel>

          <Panel
            title="Acceptance criteria"
            description={`${pluralise(counts.total, 'criterion', 'criteria')} · ${counts.passed} passed · ${counts['not-tested']} not tested · ${counts.failed} failed · ${counts.blocked} blocked`}
            actions={
              <ButtonLink to={storyPaths.edit(story.id)} size="sm" icon={Plus}>
                Add or edit criteria
              </ButtonLink>
            }
          >
            <p className="mb-4 text-xs text-slate-500">{VERIFICATION_DISCLAIMER}</p>
            {story.criteria.length > 0 ? (
              <ol className="space-y-3" aria-label="Acceptance criteria">
                {story.criteria.map((c) => (
                  <CriterionCard key={c.id} story={story} criterion={c} />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-amber-800">No acceptance criteria yet. A story is hard to verify without them.</p>
            )}
          </Panel>

          <Panel title="Linked requirements">
            {missingLinks > 0 && (
              <p className="mb-3 text-sm text-amber-800">{missingLinks} linked requirement(s) no longer exist. Edit the story to review its links.</p>
            )}
            <ul className="space-y-2.5">
              {requirements.map((r) => (
                <li key={r.id} className="text-sm">
                  <Link to={`/requirements/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                    {r.identifier}
                  </Link>{' '}
                  <span className="text-slate-800">{r.title}</span>{' '}
                  <span className="inline-flex gap-1.5 align-middle">
                    <PriorityBadge priority={r.priority} />
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Requirement priority and status are shown for context; they are set separately from the story's.</p>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Story overview">
            <dl className="space-y-3 text-sm">
              {(
                [
                  ['Identifier', <span key="Identifier" className="font-mono font-semibold">{story.identifier}</span>],
                  ['Priority', <PriorityBadge key="Priority" priority={story.priority} />],
                  ['Status', <StoryStatusBadge key="Status" status={story.status} />],
                  ['Criteria', story.criteria.length],
                ] as [string, ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="User role">
            <p className="text-sm font-medium text-slate-900">{story.persona.label}</p>
            {story.persona.stakeholderId === null ? (
              <p className="mt-1 text-sm text-slate-500">Custom persona — not a record in the stakeholder register.</p>
            ) : stakeholder ? (
              <p className="mt-1 text-sm text-slate-500">
                From the stakeholder register:{' '}
                <Link to={`/stakeholders/${stakeholder.id}`} className="font-medium text-brand-700 hover:underline">
                  {stakeholder.name}
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-800">The linked stakeholder record no longer exists.</p>
            )}
          </Panel>

          <Panel title="Business benefit">
            <p className="text-sm leading-relaxed text-slate-700">So that {story.benefit}.</p>
          </Panel>

          <Panel title="Change history">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900">{formatDateTime(story.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-slate-900">{formatDateTime(story.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      <DeleteStoryDialog story={confirmDelete ? story : null} onClose={() => setConfirmDelete(false)} onDeleted={() => navigate(storyPaths.list, { replace: true })} />
    </>
  );
}
