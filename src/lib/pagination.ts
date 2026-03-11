export type PaginatedSlice<T> = {
  items: T[];
  hasMore: boolean;
};

export const DEFAULT_LIMIT = 100;
export const MIN_LIMIT = 1;

export function normalizePaginationLimit(input: unknown): number {
  const parsed = Number(input);
  const safeValue = Number.isFinite(parsed) ? Math.trunc(parsed) : DEFAULT_LIMIT;
  if (safeValue < MIN_LIMIT) return MIN_LIMIT;
  return safeValue;
}

export function getLimitSentinel(limit: number): number {
  return Math.max(MIN_LIMIT, Math.trunc(limit)) + 1;
}

export function sliceWithHasMore<T>(rows: T[], limit: number): PaginatedSlice<T> {
  const normalizedLimit = Math.max(MIN_LIMIT, Math.trunc(limit));
  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
  return { items, hasMore };
}
