// Shared bounded pagination for admin collections. Deliberately small: parse
// ?page/?pageSize into safe skip/take and build the response metadata. This is
// a project convention, not a framework — endpoints keep their own filters and
// serialization.
import { toPositiveInt } from './validators.js';

export const PAGE_DEFAULT = 1;
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

// Only strict positive integers are accepted: 'true', '1.5', '-1', arrays and
// oversized values never become offsets. Empty/absent values fall back to the
// defaults so plain list requests keep working.
export function parsePagination(query, { defaultPageSize = PAGE_SIZE_DEFAULT, maxPageSize = PAGE_SIZE_MAX } = {}) {
  const rawPage = query.page;
  const rawSize = query.pageSize ?? query.limit;
  const page = rawPage === undefined || rawPage === null || rawPage === '' ? PAGE_DEFAULT : toPositiveInt(rawPage);
  const pageSize = rawSize === undefined || rawSize === null || rawSize === '' ? defaultPageSize : toPositiveInt(rawSize);
  if (page === null || pageSize === null || pageSize > maxPageSize) return null;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginationMeta({ page, pageSize }, total) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 };
}

// Standard success response: { data, pagination }. The id tiebreaker keeps
// ordering deterministic when rows share a sort timestamp.
export const DESC_ORDER = (sortField) => [{ [sortField]: 'desc' }, { id: 'desc' }];

export function paginated(res, items, parsed, total) {
  return res.json({ data: items, pagination: paginationMeta(parsed, total) });
}

// Search inputs feed Prisma `contains` filters; a hard cap keeps abusive
// queries from carrying arbitrarily long patterns.
export const MAX_SEARCH_LENGTH = 100;
export const clampSearch = (value) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, MAX_SEARCH_LENGTH) : null;
};
