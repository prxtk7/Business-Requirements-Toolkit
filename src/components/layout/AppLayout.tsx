import { Fragment, Suspense, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { WorkspaceNotices } from './WorkspaceNotices';
import { PageLoading } from './RouteFallbacks';
import { useWorkspace } from '../../state/workspaceContext';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { revision } = useWorkspace();

  // Close the mobile navigation whenever the route changes (including browser
  // back/forward), adjusting state during render rather than in an effect.
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }

  /** Close the drawer and return focus to the button that opened it. */
  const dismissMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  /** A link in the drawer was followed: close it and continue in the page content. */
  const navigateFromMenu = () => {
    setMenuOpen(false);
    mainRef.current?.focus({ preventScroll: true });
  };

  // While open: focus starts on the close button and Escape dismisses the drawer.
  useEffect(() => {
    if (!menuOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  /** Keep Tab and Shift+Tab cycling inside the open drawer (it is a modal dialog). */
  const trapFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !drawerRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !drawerRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-800 shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen(true)}
          className="-ml-2 rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-slate-900">BA Toolkit</span>
      </div>

      {/* Mobile drawer: a modal dialog while open (focus stays inside; Escape or the backdrop closes it). */}
      <div className="fixed inset-0 z-40 lg:hidden" hidden={!menuOpen}>
        <div className="absolute inset-0 bg-slate-900/30" aria-hidden="true" onClick={dismissMenu} />
        {/* onKeyDown only keeps Tab inside the open dialog (WAI-ARIA modal dialog pattern). */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={drawerRef}
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          onKeyDown={trapFocus}
          className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl"
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={dismissMenu}
            className="absolute top-4 right-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close navigation"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          {menuOpen && <Sidebar onNavigate={navigateFromMenu} />}
        </div>
      </div>

      <div className="lg:pl-64">
        <main id="main-content" ref={mainRef} tabIndex={-1} className="focus:outline-none">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            <WorkspaceNotices />
            {/* Remount pages after reloading the workspace so forms start from the latest data. */}
            <Fragment key={revision}>
              {/* Pages are loaded on demand (see app/routes.tsx). */}
              <Suspense fallback={<PageLoading />}>
                <Outlet />
              </Suspense>
            </Fragment>
          </div>
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
