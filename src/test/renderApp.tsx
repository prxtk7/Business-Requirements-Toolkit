import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { loadAllPageModules, routes } from '../app/routes';
import { loadWorkspace, saveWorkspace, STORAGE_KEY } from '../storage/workspaceStorage';
import { createDemoWorkspace } from '../data/demoWorkspace';
import { pruneRiskLinks } from '../domain/risks';
import type { Workspace } from '../domain/types';
import { MemoryStorage } from './MemoryStorage';

// Pages are lazily loaded in the app. Load their modules once per test file, as the
// previous static imports did, so a cold module transform is not raced against
// the short default timeout of `findBy` queries. Each page still renders through
// React.lazy and Suspense exactly as in production.
await loadAllPageModules();

export const FIXED_NOW = '2026-03-02T09:30:00.000Z';

interface RenderAppOptions {
  path?: string;
  storage?: MemoryStorage;
}

/** Render the full application against an in-memory router and storage. */
export function renderApp({ path = '/', storage = new MemoryStorage() }: RenderAppOptions = {}) {
  const initial = loadWorkspace(storage, FIXED_NOW);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // delay: null still dispatches every keyboard and input event for each character;
  // it only skips userEvent's timer pause between keystrokes. That pause costs
  // ~15 ms per character in jsdom and made long typing tests (e.g. Gherkin
  // criteria) take 12+ s. The app itself adds ~1.5 ms per keystroke.
  const user = userEvent.setup({ delay: null });
  const utils = render(
    <AppProviders initial={initial} storage={storage} now={() => FIXED_NOW}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, user, router, storage };
}

/**
 * Enter long text with one paste (one input event) instead of one keystroke per character.
 * The forms are fully controlled and re-render on every input event; in jsdom, under parallel
 * test workers, user.type of long strings pushed several integration tests towards the timeout.
 * Keystroke handling is still exercised by the shorter fields that tests type.
 */
export async function paste(user: ReturnType<typeof userEvent.setup>, element: HTMLElement, text: string) {
  await user.click(element);
  await user.paste(text);
}

/** Storage pre-seeded with a workspace (e.g. demo data with some records removed). */
export function seededStorage(mutate: (workspace: Workspace) => Workspace): MemoryStorage {
  const storage = new MemoryStorage();
  // Risk links to records the fixture removed are pruned, as the app does on every save.
  saveWorkspace(storage, pruneRiskLinks(mutate(createDemoWorkspace(FIXED_NOW)), FIXED_NOW), FIXED_NOW);
  return storage;
}

/**
 * Demo workspace in which no requirement names the Health and Safety Officer as its source, so that
 * stakeholder can be deleted. The demo itself has no unreferenced stakeholder: every one is a requirement
 * source, a risk owner, a story persona or a step owner, and deletion is blocked while any of those links exists.
 */
export function demoWithDeletableHealthSafetyOfficer(): MemoryStorage {
  return seededStorage((ws) => ({
    ...ws,
    requirements: ws.requirements.map((r) => (r.sourceStakeholderId === 'stk_demo_health_safety' ? { ...r, sourceStakeholderId: null } : r)),
  }));
}

/** Demo workspace without requirements (and so without the stories that trace to them): Phase 1/2 behaviour. */
export function demoWithoutRequirements(): MemoryStorage {
  return seededStorage((ws) => ({ ...ws, requirements: [], userStories: [] }));
}

/** Demo workspace without user stories: Phase 3 behaviour with no story links. */
export function demoWithoutStories(): MemoryStorage {
  return seededStorage((ws) => ({ ...ws, userStories: [] }));
}

/** Read the workspace back out of storage, as persisted. */
export function readStoredWorkspace(storage: MemoryStorage): Workspace {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('Nothing persisted');
  return (JSON.parse(raw) as { workspace: Workspace }).workspace;
}
