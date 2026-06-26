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

/** Returns today's date as a YYYY-MM-DD string in local time. */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formats a datetime string for display. Returns '—' for missing values. */
export function fmt(dt?: string): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

/** Formats a date string for display. Returns '—' for missing values. */
export function fmtDate(dt?: string): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

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

/** Filters a bookings list by status (or returns all if 'ALL'). */
export function applyStatusFilter(bookings: Booking[], filterStatus: BookingStatus): Booking[] {
  if (filterStatus === 'ALL') return bookings;
  return bookings.filter(b => b.booking_status === filterStatus);
}
