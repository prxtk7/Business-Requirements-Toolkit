import { useId } from 'react';
import { NavLink } from 'react-router';
import { Database } from 'lucide-react';
import { NAV_SECTIONS, PLANNED_MODULES } from '../../app/navigation';
import { useWorkspace } from '../../state/workspaceContext';
import { cx } from '../../lib/cx';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  cx(
    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

/** `onNavigate` runs when a link is followed (used to close the mobile drawer). */
export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { workspace } = useWorkspace();
  const projectName = workspace.project.name || 'Untitled project';
  // Unique per instance: the sidebar is rendered twice while the mobile drawer is open.
  const plannedHeadingId = useId();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-800" aria-hidden="true">
            <svg viewBox="0 0 32 32" className="h-5 w-5">
              <path d="M8 10h16M8 16h11M8 22h6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">BA Toolkit</p>
            <p className="text-xs text-slate-500">Requirements &amp; Process Analysis</p>
          </div>
        </div>

        <div className="mt-5 rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Current project</p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-800" title={projectName}>
            {projectName}
          </p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading} className="mt-4 first:mt-0">
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink to={to} end={to === '/'} className={linkClasses} onClick={onNavigate}>
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-6">
          <p id={plannedHeadingId} className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Planned modules
          </p>
          <ul aria-labelledby={plannedHeadingId} className="space-y-0.5">
            {PLANNED_MODULES.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500">
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-slate-200 px-3 py-3">
        <NavLink to="/workspace" className={linkClasses} onClick={onNavigate}>
          <Database aria-hidden="true" className="h-4 w-4 shrink-0" />
          Workspace data
        </NavLink>
      </div>
    </div>
  );
}
