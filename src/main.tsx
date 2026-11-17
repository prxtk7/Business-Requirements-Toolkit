import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { routes } from './app/routes';
import { getBrowserStorage, loadWorkspace } from './storage/workspaceStorage';
import './index.css';

// Load persisted data once, before the first render, so the UI never flashes empty state.
const storage = getBrowserStorage();
const initial = loadWorkspace(storage, new Date().toISOString());
const router = createBrowserRouter(routes);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found.');

createRoot(container).render(
  <StrictMode>
    <AppProviders initial={initial} storage={storage}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
