/**
 * True when an error comes from failing to download a lazily loaded module,
 * e.g. after a network drop or once a newer deployment has replaced the
 * hashed chunk files. Browsers word this differently, so match the known
 * messages rather than one exact string.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /dynamically imported module|importing a module script failed|error loading dynamically imported module|loading (css )?chunk [\w-]+ failed/i.test(
    error.message,
  );
}
