import type { Booking, BookingStatus } from '../types/Bookings';

export interface StatusConfig {
  label: string;
  cls: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  ACTIVE:    { label: 'Active',    cls: 'bg-blue-100 text-blue-800 border border-blue-200' },
  COMPLETED: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-amber-100 text-amber-800 border border-amber-200' },
  NO_SHOW:   { label: 'No Show',   cls: 'bg-red-100 text-red-800 border border-red-200' },
};

export const REFUND_CONFIG: Record<string, StatusConfig> = {
  PENDING:        { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  REFUNDED:       { label: 'Refunded', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  NOT_APPLICABLE: { label: 'N/A',      cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

export const BOOKING_STATUS_KEYS = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

// ── Filter state ─────────────────────────────────────────────────────────────

export interface BookingFilterState {
  regNumber: string;
  vehicleType: string;   // '' | '2-wheeler' | '4-wheeler'
  bookingStatus: string; // '' | ACTIVE | COMPLETED | CANCELLED | NO_SHOW
  refundStatus: string;  // '' | PENDING | REFUNDED | NOT_APPLICABLE
  date: string;          // YYYY-MM-DD (exact date – overrides from/to)
  fromDate: string;      // YYYY-MM-DD
  toDate: string;        // YYYY-MM-DD
}

export const EMPTY_FILTER: BookingFilterState = {
  regNumber: '',
  vehicleType: '',
  bookingStatus: '',
  refundStatus: '',
  date: '',
  fromDate: '',
  toDate: '',
};

export const PAGE_LIMIT = 10;

/**
 * Builds the query-param object to send to GET /slots/bookings.
 * Omits empty/unset values so the backend treats absence as "no filter".
 */
export function buildBookingParams(
  filters: BookingFilterState,
  page = 1,
): Record<string, string> {
  const p: Record<string, string> = {};
  if (filters.regNumber)     p.reg_number     = filters.regNumber.trim().toUpperCase();
  if (filters.vehicleType)   p.vehicle_type   = filters.vehicleType;
  if (filters.bookingStatus) p.booking_status = filters.bookingStatus;
  if (filters.refundStatus)  p.refund_status  = filters.refundStatus;

  // Exact date takes priority; otherwise use range
  if (filters.date) {
    p.date = filters.date;
  } else {
    if (filters.fromDate) p.from_date = filters.fromDate;
    if (filters.toDate)   p.to_date   = filters.toDate;
  }

  p.page  = String(page);
  p.limit = String(PAGE_LIMIT);
  return p;
}

/** Returns the "Showing X–Y of Z" label string for a paginator. */
export function pageRangeLabel(page: number, limit: number, total: number): string {
  if (total === 0) return '0 bookings';
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);
  return `${from}–${to} of ${total}`;
}

/** Returns true if any filter is currently active. */
export function hasActiveFilters(f: BookingFilterState): boolean {
  return !!(f.regNumber || f.vehicleType || f.bookingStatus || f.refundStatus
         || f.date || f.fromDate || f.toDate);
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string in local time. */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formats a datetime string for display as DD/MM/YYYY, HH:MM AM/PM. Returns '—' for missing values. */
export function fmt(dt?: string): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '—';

  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day}/${month}/${year}, ${timeStr}`;
}

/** Formats a date-only or ISO string as DD/MM/YYYY. Returns '—' for missing values. */
export function fmtDate(dt?: string): string {
  if (!dt) return '—';

  // Date-only YYYY-MM-DD: parse manually to avoid timezone shift
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dt)) {
    const [y, m, d] = dt.split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  const d = new Date(dt);
  if (isNaN(d.getTime())) return '—';
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ── Status helpers ────────────────────────────────────────────────────────────

/** Returns the Tailwind text-color class for a booking status counter. */
export function statusCountColor(status: string): string {
  switch (status) {
    case 'ACTIVE':    return 'text-blue-600';
    case 'COMPLETED': return 'text-emerald-600';
    case 'CANCELLED': return 'text-amber-600';
    case 'NO_SHOW':   return 'text-red-600';
    default:          return 'text-gray-600';
  }
}

/** Computes per-status counts from a bookings array. */
export function computeCounts(bookings: Booking[]): Record<string, number> {
  return {
    ACTIVE:    bookings.filter(b => b.booking_status === 'ACTIVE').length,
    COMPLETED: bookings.filter(b => b.booking_status === 'COMPLETED').length,
    CANCELLED: bookings.filter(b => b.booking_status === 'CANCELLED').length,
    NO_SHOW:   bookings.filter(b => b.booking_status === 'NO_SHOW').length,
  };
}

/** @deprecated Status filtering is now server-side via booking_status param. */
export function applyStatusFilter(bookings: Booking[], filterStatus: BookingStatus): Booking[] {
  if (filterStatus === 'ALL') return bookings;
  return bookings.filter(b => b.booking_status === filterStatus);
}
