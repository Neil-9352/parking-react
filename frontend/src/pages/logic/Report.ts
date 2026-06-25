import type { SortDir } from '../types/Report';

export interface ReportParamState {
  activeFilters: Record<string, string>;
  page: number;
  feePage: number;
  sortBy: string;
  sortDir: SortDir;
  feeSortBy: string;
  feeSortDir: SortDir;
}

/**
 * Builds the full query-param object to send to GET /reports.
 * Merges active filters, current pagination, current sort, and any caller overrides.
 */
export function buildReportParams(
  state: ReportParamState,
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    ...state.activeFilters,
    page: String(state.page),
    fee_page: String(state.feePage),
    ...(state.sortBy
      ? { sort_by: state.sortBy, sort_dir: state.sortDir }
      : {}),
    ...(state.feeSortBy
      ? { fee_sort_by: state.feeSortBy, fee_sort_dir: state.feeSortDir }
      : {}),
    ...overrides,
  };
}

/**
 * Formats a datetime string for display in the reports table.
 * Returns '—' for missing/undefined values.
 */
export function formatDateTime(dt?: string): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
