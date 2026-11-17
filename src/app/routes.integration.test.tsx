import { lazy, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from './AppProviders';
import { NAV_SECTIONS } from './navigation';
import { AppLayout } from '../components/layout/AppLayout';
import { RouteErrorPage } from '../components/layout/RouteFallbacks';
import { isChunkLoadError } from '../lib/loadErrors';
import { loadWorkspace } from '../storage/workspaceStorage';
import { MemoryStorage } from '../test/MemoryStorage';
import { FIXED_NOW, renderApp } from '../test/renderApp';

describe('route-level code splitting', () => {
  it('shows a loading message inside the layout while a page loads, then the page', async () => {
    // First render of this lazy page in this file, so it suspends once.
    renderApp({ path: '/risk-matrix' });

    expect(screen.getByText('Loading page…')).toBeInTheDocument();
    // Navigation stays available while the page loads.
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 1, name: 'Risk matrix' })).toBeInTheDocument();
    expect(screen.queryByText('Loading page…')).not.toBeInTheDocument();
  });

  it('loads every page listed in the navigation', async () => {
    // Document title each page sets once it has rendered.
    const expectedTitles: Record<string, string> = {
      '/': 'Workspace summary',
      '/overview': 'Project Overview',
      '/stakeholders': 'Stakeholders',
      '/processes': 'Process Analysis',
      '/requirements': 'Requirements',
      '/traceability': 'Traceability matrix',
      '/user-stories': 'User stories',
      '/coverage': 'Story coverage',
      '/risks': 'Risk register',
      '/risk-matrix': 'Risk matrix',
    };
    const items = NAV_SECTIONS.flatMap((section) => section.items);
    expect(items.map((i) => i.to).sort()).toEqual(Object.keys(expectedTitles).sort());

    // Start elsewhere so every navigation item, including Summary, is a real navigation.
    const { user, router } = renderApp({ path: '/workspace' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await screen.findByRole('heading', { level: 1, name: 'Workspace data' });

    for (const item of items) {
      await user.click(within(nav).getByRole('link', { name: item.label }));
      await waitFor(() => expect(document.title).toBe(`${expectedTitles[item.to]} · BA Toolkit`));
      expect(router.state.location.pathname).toBe(item.to);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.queryByText('Loading page…')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /could not be loaded|Something went wrong/ })).not.toBeInTheDocument();
    }
  });
});

describe('route error handling', () => {
  function renderWithPage(element: ReactNode) {
    const storage = new MemoryStorage();
    const router = createMemoryRouter(
      [{ path: '/', element: <AppLayout />, children: [{ errorElement: <RouteErrorPage />, children: [{ index: true, element }] }] }],
      { initialEntries: ['/'] },
    );
    render(
      <AppProviders initial={loadWorkspace(storage, FIXED_NOW)} storage={storage} now={() => FIXED_NOW}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
  }

  it('explains a failed page download inside the layout and offers a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Missing = lazy(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/riskPages-abc123.js')),
    );
    renderWithPage(<Missing />);

    expect(await screen.findByRole('heading', { level: 1, name: 'This page could not be loaded' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your saved data is not affected.');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to workspace summary' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('shows a generic message when a page fails to render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('Unexpected state');
    }
    renderWithPage(<Broken />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The page hit an unexpected error.');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://example.test/assets/a.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://example.test/assets/a.js',
  ])('recognises "%s"', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('ignores other errors and non-errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
