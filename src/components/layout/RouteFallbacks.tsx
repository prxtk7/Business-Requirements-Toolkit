import { isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { Button, ButtonLink } from '../ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { isChunkLoadError } from '../../lib/loadErrors';

/** Shown in the main area while a page's code is downloading. */
export function PageLoading() {
  return (
    <div role="status" className="flex animate-[delayed-fade-in_0.2s_ease-out_0.15s_both] items-center gap-2 pt-8 text-sm text-slate-500">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      Loading page…
    </div>
  );
}

/**
 * Error boundary for every page. Keeps the navigation usable when a page
 * fails to load or render, instead of replacing the whole application.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const chunkFailed = isChunkLoadError(error);
  const title = chunkFailed ? 'This page could not be loaded' : 'Something went wrong';
  useDocumentTitle(title);

  const detail = chunkFailed
    ? 'Part of the application could not be downloaded. This can happen after a connection problem or when a newer version has been published.'
    : isRouteErrorResponse(error)
      ? `The page returned an error (${error.status}${error.statusText ? ` ${error.statusText}` : ''}).`
      : 'The page hit an unexpected error.';

  return (
    <div role="alert" className="mt-8 rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-600" />
      </div>
      <h1 className="mt-4 text-base font-semibold text-slate-900">{title}</h1>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
        {detail} Your saved data is not affected. Reloading the page usually resolves this.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" icon={RotateCw} onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <ButtonLink to="/" variant="secondary">
          Go to workspace summary
        </ButtonLink>
      </div>
    </div>
  );
}
