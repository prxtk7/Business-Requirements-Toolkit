import {
  ClipboardList,
  FileBarChart,
  FileText,
  GitBranch,
  Grid3x3,
  LayoutGrid,
  Network,
  Target,
  ListChecks,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface PlannedModule {
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Workspace',
    items: [{ label: 'Summary', to: '/', icon: LayoutGrid }],
  },
  {
    heading: 'Analysis',
    items: [
      { label: 'Project Overview', to: '/overview', icon: FileText },
      { label: 'Stakeholders', to: '/stakeholders', icon: Users },
      { label: 'Process Analysis', to: '/processes', icon: GitBranch },
      { label: 'Requirements', to: '/requirements', icon: ListChecks },
      { label: 'Traceability Matrix', to: '/traceability', icon: Network },
      { label: 'User Stories', to: '/user-stories', icon: ClipboardList },
      { label: 'Story Coverage', to: '/coverage', icon: Target },
      { label: 'Risk Register', to: '/risks', icon: ShieldAlert },
      { label: 'Risk Matrix', to: '/risk-matrix', icon: Grid3x3 },
    ],
  },
];

/**
 * Toolkit features on the roadmap; shown in navigation as non-interactive items.
 * "Analysis export" means exporting this toolkit's own records (for example a
 * requirements specification). It is unrelated to the management reports that
 * the fictional FSM system's requirements describe.
 */
export const PLANNED_MODULES: PlannedModule[] = [
  { label: 'Analysis export', icon: FileBarChart },
];
