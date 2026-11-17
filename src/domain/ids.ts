/**
 * Generate a unique identifier with a readable prefix, e.g. `stk_3f9c...`.
 * Uses the Web Crypto API, which is available in all supported browsers and
 * in the test environment.
 */
export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
