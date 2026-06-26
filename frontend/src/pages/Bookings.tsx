import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useToast } from '../components/ui/Toast';
import type { Booking, BookingStatus } from './types/Bookings';
import {
  STATUS_CONFIG,
  REFUND_CONFIG,
  BOOKING_STATUS_KEYS,
  todayStr,
  fmt,
  fmtDate,
  statusCountColor,
  computeCounts,
  applyStatusFilter,
} from './logic/Bookings';

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function RefundBadge({ status }: { status: string }) {
  const cfg = REFUND_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [filterStatus, setFilterStatus] = useState<BookingStatus>('ALL');
  const { addToast, ToastContainer } = useToast();

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = date ? `?date=${date}` : '';
      const res = await client.get(`/slots/bookings${params}`);
      setBookings(res.data);
    } catch {
      addToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [date, addToast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filtered = applyStatusFilter(bookings, filterStatus);
  const counts = computeCounts(bookings);

  return (
    <div className="p-6">
      <ToastContainer />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">📅 Bookings</h1>
            {date && (
              <p className="text-indigo-200 text-sm mt-0.5">
                Showing bookings for {fmtDate(date)}
              </p>
            )}
          </div>
          <button
            onClick={fetchBookings}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Summary stats — click to filter */}
        <div className="grid grid-cols-4 divide-x divide-gray-200">
          {BOOKING_STATUS_KEYS.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(prev => prev === s ? 'ALL' : s)}
              className={`p-4 text-center transition-colors hover:bg-gray-50 ${filterStatus === s ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50' : ''}`}
            >
              <p className={`text-2xl font-bold ${statusCountColor(s)}`}>{counts[s]}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">{STATUS_CONFIG[s].label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Date:</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {date && (
            <button
              onClick={() => setDate('')}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear (show all)
            </button>
          )}
        </div>
        {filterStatus !== 'ALL' && (
          <button
            onClick={() => setFilterStatus('ALL')}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
          >
            ✕ Clear status filter
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No bookings found</p>
          <p className="text-sm mt-1">
            {date ? `No bookings for ${fmtDate(date)}` : 'No bookings in the system yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                {filtered.map(b => (
                  <tr key={b.booking_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{b.booking_id}</td>
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
      )}
    </div>
  );
}
