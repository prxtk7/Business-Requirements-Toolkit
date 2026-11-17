/**
 * Human-readable sequential identifiers such as FR-001, NFR-002 and US-003.
 *
 * Each identifier family keeps a stored counter of the last number issued.
 * The next number is the higher of that counter and the highest number in
 * use, so identifiers are never reissued after deletion, even if a counter
 * were somehow behind the data.
 */

export function formatNumbered(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, '0')}`;
}

/** Number part of `PREFIX-nnn`, or null if the identifier has a different prefix or format. */
export function parseNumbered(identifier: string, prefix: string): number | null {
  const match = /^([A-Z]+)-(\d+)$/.exec(identifier);
  return match && match[1] === prefix ? Number(match[2]) : null;
}

export function nextNumber(lastIssued: number, identifiersInUse: readonly string[], prefix: string): number {
  const highestInUse = identifiersInUse.reduce((max, id) => Math.max(max, parseNumbered(id, prefix) ?? 0), 0);
  return Math.max(lastIssued, highestInUse) + 1;
}
