import { lazy, type ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { RouteErrorPage } from '../components/layout/RouteFallbacks';
import { NotFoundPage } from '../features/workspace/NotFoundPage';

/*
 * Route-level code splitting. Each feature's pages are loaded on first visit
 * from that feature's `*Pages.ts` module, so a feature becomes one chunk rather than
 * one chunk per page. The layout, workspace state and storage stay in the
 * main bundle because every page needs them. While a page loads, AppLayout
 * shows a loading message; a failed download is handled by RouteErrorPage.
 */
const workspacePages = () => import('../features/workspace/workspacePages');
const overviewPages = () => import('../features/overview/overviewPages');
const stakeholderPages = () => import('../features/stakeholders/stakeholderPages');
const processPages = () => import('../features/processes/processPages');
const requirementPages = () => import('../features/requirements/requirementPages');
const storyPages = () => import('../features/stories/storyPages');
const riskPages = () => import('../features/risks/riskPages');

/**
 * Download every feature's pages. Integration tests call this once up front so
 * module loading is not counted against individual assertions' timeouts.
 */
export function loadAllPageModules() {
  return Promise.all([workspacePages(), overviewPages(), stakeholderPages(), processPages(), requirementPages(), storyPages(), riskPages()]);
}

function page<M extends Record<K, ComponentType>, K extends keyof M & string>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const WorkspaceSummaryPage = page(workspacePages, 'WorkspaceSummaryPage');
const WorkspaceDataPage = page(workspacePages, 'WorkspaceDataPage');
const ProjectOverviewPage = page(overviewPages, 'ProjectOverviewPage');
const ProjectOverviewEditPage = page(overviewPages, 'ProjectOverviewEditPage');
const StakeholdersPage = page(stakeholderPages, 'StakeholdersPage');
const StakeholderDetailPage = page(stakeholderPages, 'StakeholderDetailPage');
const StakeholderFormPage = page(stakeholderPages, 'StakeholderFormPage');
const ProcessesPage = page(processPages, 'ProcessesPage');
const ProcessFormPage = page(processPages, 'ProcessFormPage');
const ProcessDetailPage = page(processPages, 'ProcessDetailPage');
const StepFormPage = page(processPages, 'StepFormPage');
const BottleneckFormPage = page(processPages, 'BottleneckFormPage');
const ImprovementFormPage = page(processPages, 'ImprovementFormPage');
const ProcessComparisonPage = page(processPages, 'ProcessComparisonPage');
const RequirementsPage = page(requirementPages, 'RequirementsPage');
const RequirementFormPage = page(requirementPages, 'RequirementFormPage');
const RequirementDetailPage = page(requirementPages, 'RequirementDetailPage');
const TraceabilityMatrixPage = page(requirementPages, 'TraceabilityMatrixPage');
const UserStoriesPage = page(storyPages, 'UserStoriesPage');
const UserStoryFormPage = page(storyPages, 'UserStoryFormPage');
const UserStoryDetailPage = page(storyPages, 'UserStoryDetailPage');
const StoryCoveragePage = page(storyPages, 'StoryCoveragePage');
const RisksPage = page(riskPages, 'RisksPage');
const RiskFormPage = page(riskPages, 'RiskFormPage');
const RiskDetailPage = page(riskPages, 'RiskDetailPage');
const RiskMatrixPage = page(riskPages, 'RiskMatrixPage');

/** Route table shared by the browser router and the in-memory router used in tests. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        // Pathless wrapper: a page that fails to load or render shows an error
        // inside the layout, so navigation keeps working.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <WorkspaceSummaryPage /> },
          { path: 'overview', element: <ProjectOverviewPage /> },
          { path: 'overview/edit', element: <ProjectOverviewEditPage /> },
          { path: 'stakeholders', element: <StakeholdersPage /> },
          { path: 'stakeholders/new', element: <StakeholderFormPage /> },
          { path: 'stakeholders/:stakeholderId', element: <StakeholderDetailPage /> },
          { path: 'stakeholders/:stakeholderId/edit', element: <StakeholderFormPage /> },
          { path: 'processes', element: <ProcessesPage /> },
          { path: 'processes/new', element: <ProcessFormPage /> },
          { path: 'processes/compare', element: <ProcessComparisonPage /> },
          { path: 'processes/:processId', element: <ProcessDetailPage /> },
          { path: 'processes/:processId/edit', element: <ProcessFormPage /> },
          { path: 'processes/:processId/steps/new', element: <StepFormPage /> },
          { path: 'processes/:processId/steps/:stepId/edit', element: <StepFormPage /> },
          { path: 'processes/:processId/bottlenecks/new', element: <BottleneckFormPage /> },
          { path: 'processes/:processId/bottlenecks/:bottleneckId/edit', element: <BottleneckFormPage /> },
          { path: 'processes/:processId/improvements/new', element: <ImprovementFormPage /> },
          { path: 'processes/:processId/improvements/:improvementId/edit', element: <ImprovementFormPage /> },
          { path: 'requirements', element: <RequirementsPage /> },
          { path: 'requirements/new', element: <RequirementFormPage /> },
          { path: 'requirements/:requirementId', element: <RequirementDetailPage /> },
          { path: 'requirements/:requirementId/edit', element: <RequirementFormPage /> },
          { path: 'traceability', element: <TraceabilityMatrixPage /> },
          { path: 'user-stories', element: <UserStoriesPage /> },
          { path: 'user-stories/new', element: <UserStoryFormPage /> },
          { path: 'user-stories/:storyId', element: <UserStoryDetailPage /> },
          { path: 'user-stories/:storyId/edit', element: <UserStoryFormPage /> },
          { path: 'coverage', element: <StoryCoveragePage /> },
          { path: 'risks', element: <RisksPage /> },
          { path: 'risks/new', element: <RiskFormPage /> },
          { path: 'risks/:riskId', element: <RiskDetailPage /> },
          { path: 'risks/:riskId/edit', element: <RiskFormPage /> },
          { path: 'risk-matrix', element: <RiskMatrixPage /> },
          { path: 'workspace', element: <WorkspaceDataPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
