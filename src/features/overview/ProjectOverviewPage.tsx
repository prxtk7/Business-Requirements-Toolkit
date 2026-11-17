import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { requirementsLinkedToObjective } from '../../domain/requirements';
import { FileText, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { getProjectCompleteness, isProjectEmpty } from '../../domain/project';
import { useWorkspace } from '../../state/workspaceContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/format';
import { CompletenessChecklist } from './CompletenessChecklist';

function NotDocumented() {
  return <p className="text-sm text-slate-500 italic">Not documented yet.</p>;
}

function Prose({ text }: { text: string }) {
  if (!text) return <NotDocumented />;
  return <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{text}</p>;
}

function ItemList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  if (items.length === 0) return <NotDocumented />;
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={ordered ? 'list-decimal space-y-2 pl-5' : 'list-disc space-y-2 pl-5'}>
      {items.map((item, i) => (
        <li key={i} className="pl-1 text-sm leading-relaxed text-slate-700 marker:text-slate-400">
          {item}
        </li>
      ))}
    </List>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function ProjectOverviewPage() {
  const { workspace } = useWorkspace();
  const { project } = workspace;
  useDocumentTitle('Project Overview');
  const { hash } = useLocation();

  // Links from requirements point at a specific objective (#objective-<id>).
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.({ block: 'center' });
  }, [hash]);

  if (isProjectEmpty(project)) {
    return (
      <>
        <PageHeader eyebrow="Project Overview" title="Project Overview" />
        <EmptyState
          icon={FileText}
          title="No project overview yet"
          description="Start by describing the project: its background, the problem it solves, objectives, scope and how success will be measured. This becomes the reference point for every other analysis module."
          action={
            <ButtonLink to="/overview/edit" variant="primary" icon={Pencil}>
              Create project overview
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Project Overview"
        title={project.name || 'Untitled project'}
        description={
          <>
            {project.organisation && <span className="font-medium text-slate-700">{project.organisation}</span>}
            {project.organisation && project.updatedAt && <span aria-hidden="true"> · </span>}
            {project.updatedAt && <span>Last updated {formatDateTime(project.updatedAt)}</span>}
          </>
        }
        actions={
          <ButtonLink to="/overview/edit" variant="primary" icon={Pencil}>
            Edit overview
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel>
          <Section title="Background">
            <Prose text={project.background} />
          </Section>
          <Section title="Problem statement">
            <Prose text={project.problemStatement} />
          </Section>
          <Section title="Objectives">
            {project.objectives.length === 0 ? (
              <NotDocumented />
            ) : (
              <ol className="list-decimal space-y-2 pl-5">
                {project.objectives.map((objective) => {
                  const linked = requirementsLinkedToObjective(workspace, objective.id);
                  return (
                    <li
                      key={objective.id}
                      id={`objective-${objective.id}`}
                      className="scroll-mt-24 pl-1 text-sm leading-relaxed text-slate-700 marker:text-slate-400"
                    >
                      {objective.text}
                      {linked.length > 0 && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Traced by{' '}
                          {linked.map((r, i) => (
                            <span key={r.id}>
                              {i > 0 && ', '}
                              <Link to={`/requirements/${r.id}`} className="font-medium text-brand-700 hover:underline">
                                {r.identifier}
                              </Link>
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
          <Section title="Scope">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-900">In scope</h3>
                <ItemList items={project.inScope} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-900">Out of scope</h3>
                <ItemList items={project.outOfScope} />
              </div>
            </div>
          </Section>
          <Section title="Success criteria">
            <ItemList items={project.successCriteria} ordered />
          </Section>
        </Panel>

        <div className="space-y-6">
          <Panel title="Completeness" as="h2">
            <CompletenessChecklist items={getProjectCompleteness(project)} />
          </Panel>
        </div>
      </div>
    </>
  );
}
