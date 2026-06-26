import { useState, useEffect, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import client from '../api/client';
import { useToast } from '../components/ui/Toast';
import type { Booking } from './types/Bookings';
import {
  STATUS_CONFIG,
  REFUND_CONFIG,
  BOOKING_STATUS_KEYS,
  EMPTY_FILTER,
  PAGE_LIMIT,
  todayStr,
  fmt,
  fmtDate,
  statusCountColor,
  buildBookingParams,
  hasActiveFilters,
  pageRangeLabel,
} from './logic/Bookings';
import type { BookingFilterState } from './logic/Bookings';

// ── Paginator ─────────────────────────────────────────────────────────────────

function Paginator({
  page, total, limit, onPage,
}: {
  page: number; total: number; limit: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const btn = (label: React.ReactNode, target: number, disabled: boolean, active = false) => (
    <button
      key={String(label)}
      onClick={() => !disabled && onPage(target)}
      disabled={disabled}
      className={`min-w-[34px] h-8 px-2 text-sm rounded-lg font-medium transition-colors
        ${active ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-gray-400">{pageRangeLabel(page, limit, total)}</p>
      <div className="flex gap-1">
        {btn('‹', page - 1, page === 1)}
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} className="px-1 self-end text-gray-400 text-sm">…</span>
            : btn(p, p as number, false, p === page)
        )}
        {btn('›', page + 1, page === totalPages)}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function RefundBadge({ status }: { status: string }) {
  const cfg = REFUND_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Bookings() {
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status tab for quick filtering (maps to booking_status server param)
  const [statusTab, setStatusTab] = useState('');

  // Draft = what user is currently editing in the form
  const [draft, setDraft] = useState<BookingFilterState>({ ...EMPTY_FILTER, date: todayStr() });
  // Active = committed filters that were last applied/reset
  const [active, setActive] = useState<BookingFilterState>({ ...EMPTY_FILTER, date: todayStr() });

  const { addToast, ToastContainer } = useToast();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async (
    filters: BookingFilterState,
    pg: number,
    tab: string,
    isInitial = false,
  ) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    // Merge the status tab into the filter (tab overrides the form's bookingStatus)
    const merged: BookingFilterState = tab
      ? { ...filters, bookingStatus: tab }
      : filters;

    try {
      const params = buildBookingParams(merged, pg);
      const res = await client.get('/slots/bookings', { params });
      setBookings(res.data.bookings);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch {
      addToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    async function init() {
      const initial = { ...EMPTY_FILTER, date: todayStr() };
      await fetchBookings(initial, 1, '', true);
    }
    init();
  }, [fetchBookings]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleApply(e: SyntheticEvent) {
    e.preventDefault();
    setActive({ ...draft });
    setStatusTab(''); // clear tab so draft's bookingStatus (if set) applies
    fetchBookings({ ...draft }, 1, '');
  }

  function handleReset() {
    const reset = EMPTY_FILTER;
    setDraft(reset);
    setActive(reset);
    setStatusTab('');
    fetchBookings(reset, 1, '');
  }

  function handleTabClick(tab: string) {
    const next = statusTab === tab ? '' : tab;
    setStatusTab(next);
    fetchBookings(active, 1, next);
  }

  function goToPage(pg: number) {
    fetchBookings(active, pg, statusTab);
  }

  function set(field: keyof BookingFilterState, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }));
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtersOn = hasActiveFilters(active);

  const activeDateLabel = active.date
    ? `for ${fmtDate(active.date)}`
    : 'all dates';

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400';
  const selectClass = inputClass + ' bg-white';

  return (
    <div className="p-6">
      <ToastContainer />

      {/* ── Header ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">📅 Bookings</h1>
            <p className="text-indigo-200 text-sm mt-0.5">
              Showing {activeDateLabel}
              {active.regNumber  ? ` · Plate: ${active.regNumber}` : ''}
              {active.vehicleType ? ` · ${active.vehicleType}` : ''}
              {(statusTab || active.bookingStatus) ? ` · ${STATUS_CONFIG[statusTab || active.bookingStatus]?.label ?? ''}` : ''}
              {active.refundStatus ? ` · Refund: ${REFUND_CONFIG[active.refundStatus]?.label ?? active.refundStatus}` : ''}
            </p>
          </div>
          <button
            onClick={() => fetchBookings(active, page, statusTab)}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Status tabs — click to filter server-side */}
        <div className="grid grid-cols-4 divide-x divide-gray-200">
          {BOOKING_STATUS_KEYS.map(s => (
            <button
              key={s}
              onClick={() => handleTabClick(s)}
              className={`p-4 text-center transition-colors hover:bg-gray-50 ${statusTab === s ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50' : ''}`}
            >
              <p className={`text-2xl font-bold ${statusCountColor(s)}`}>
                {statusTab === s ? total : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-medium">{STATUS_CONFIG[s].label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter form ── */}
      <form
        onSubmit={handleApply}
        className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">🔍 Search &amp; Filter</h2>
          {filtersOn && (
            <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Filters active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
          {/* Registration number */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Registration Number</label>
            <input
              type="text"
              value={draft.regNumber}
              onChange={e => set('regNumber', e.target.value)}
              placeholder="e.g. AS01AB1234"
              className={inputClass}
            />
          </div>

          {/* Vehicle type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Type</label>
            <select value={draft.vehicleType} onChange={e => set('vehicleType', e.target.value)} className={selectClass}>
              <option value="">All types</option>
              <option value="2-wheeler">🏍️ 2-Wheeler</option>
              <option value="4-wheeler">🚗 4-Wheeler</option>
            </select>
          </div>

          {/* Booking status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Booking Status
              {statusTab && <span className="ml-1 text-amber-500 text-xs">(tab overrides)</span>}
            </label>
            <select
              value={draft.bookingStatus}
              onChange={e => set('bookingStatus', e.target.value)}
              disabled={!!statusTab}
              className={selectClass + (statusTab ? ' opacity-50 cursor-not-allowed' : '')}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>

          {/* Refund status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Refund Status</label>
            <select value={draft.refundStatus} onChange={e => set('refundStatus', e.target.value)} className={selectClass}>
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
              <option value="NOT_APPLICABLE">N/A</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={draft.date}
              onChange={e => set('date', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <button
            type="submit"
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm transition-colors"
          >
            Reset
          </button>
          {statusTab && (
            <button
              type="button"
              onClick={() => handleTabClick(statusTab)}
              className="text-xs px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors border border-indigo-200"
            >
              ✕ Clear "{STATUS_CONFIG[statusTab]?.label}" tab
            </button>
          )}
          <span className="ml-auto text-sm text-gray-400">
            {total} booking{total !== 1 ? 's' : ''} total
          </span>
        </div>
      </form>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No bookings found</p>
          <p className="text-sm mt-1">Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        <>
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-opacity duration-200 ${refreshing ? 'opacity-50' : 'opacity-100'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Registration</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Slot</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Start</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">End</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Deposit</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Refund</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b, i) => (
                    <tr key={b.booking_id} className={`hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * PAGE_LIMIT + i + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-800">{b.registration_number}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.vehicle_type === '2-wheeler' ? '🏍️ 2W' : b.vehicle_type === '4-wheeler' ? '🚗 4W' : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">#{b.slot_no}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(b.expected_start_time)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(b.expected_end_time)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.booking_status} />
                        {b.cancellation_time && (
                          <p className="text-xs text-gray-400 mt-0.5">at {fmt(b.cancellation_time)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">₹{Number(b.booking_amount).toFixed(0)}</td>
                      <td className="px-4 py-3">
                        <RefundBadge status={b.refund_status} />
                        {b.refund_amount != null && b.refund_status === 'REFUNDED' && (
                          <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                            ₹{Number(b.refund_amount).toFixed(2)} ({b.refund_percentage}%)
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {b.user_name ? (
                          <div>
                            <p className="text-gray-700 font-medium">{b.user_name}</p>
                            <p className="text-xs text-gray-400">{b.user_phone}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Walk-in</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Paginator page={page} total={total} limit={PAGE_LIMIT} onPage={goToPage} />
        </>
      )}
    </div>
  );
}
