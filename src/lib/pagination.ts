export type PaginatedSlice<T> = {
  items: T[];
  hasMore: boolean;
};

export const DEFAULT_LIMIT = 100;
export const MIN_LIMIT = 1;

export function normalizePaginationLimit(input: unknown): number {
  if (input === null || input === undefined || input === "") return DEFAULT_LIMIT;
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

export type PaginationInput = {
  page?: unknown;
  pageSize?: unknown;
};

export type NormalizedPagination = {
  page: number;
  pageSize: number;
};

export type PaginationRange = {
  offset: number;
  from: number;
  to: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function normalizePage(page: unknown, defaultPage = 1): number {
  const parsed = Number(page);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : defaultPage;
}

export function normalizePageSize(
  pageSize: unknown,
  defaultSize = 50,
  maxSize = 100,
  minSize = 1
): number {
  const parsed = Number(pageSize);
  if (!Number.isFinite(parsed) || parsed < minSize) return defaultSize;
  return Math.min(maxSize, Math.trunc(parsed));
}

export function normalizePagination(
  input?: PaginationInput,
  options?: {
    defaultPage?: number;
    defaultPageSize?: number;
    maxPageSize?: number;
    minPageSize?: number;
  }
): NormalizedPagination {
  return {
    page: normalizePage(input?.page, options?.defaultPage ?? 1),
    pageSize: normalizePageSize(
      input?.pageSize,
      options?.defaultPageSize ?? 50,
      options?.maxPageSize ?? 100,
      options?.minPageSize ?? 1
    ),
  };
}

export function calculatePaginationRange(page: number, pageSize: number): PaginationRange {
  const offset = (page - 1) * pageSize;
  return {
    offset,
    from: offset,
    to: offset + pageSize - 1,
  };
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(Math.max(0, total) / pageSize) : 0,
  };
}

