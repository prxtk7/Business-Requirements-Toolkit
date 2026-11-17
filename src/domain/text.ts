/** Trim every entry and drop blank ones. Used for all list-style fields. */
export function normaliseList(items: readonly string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
