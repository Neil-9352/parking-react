import { useState, useEffect, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import client, { API_BASE_URL } from '../api/client';

interface ParkingRecord {
  id: number;
  registration_number: string;
  type?: string;
  slot_id: number;
  in_time: string;
  out_time?: string;
  fee?: number;
  fee_id: number;
  receipt_path?: string;
}

interface FeeRow {
  fee_id: number;
  vehicle_type: string;
  first_hour_charge: number;
  rest_hour_charge: number;
  created_at: string;
}

type SortDir = 'asc' | 'desc';

// ── Paginator ──────────────────────────────────────────────────────────────
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
        ${active ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-xs text-gray-400">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </p>
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

// ── Sortable TH ────────────────────────────────────────────────────────────
function SortTh({
  label, colKey, active, dir, onSort, className = '',
}: {
  label: string;
  colKey: string;
  active: boolean;
  dir: SortDir;
  onSort: (col: string) => void;
  className?: string;
}) {
  return (
    <th
      onClick={() => onSort(colKey)}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none group ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>
          {active && dir === 'asc' ? '▲' : '▼'}
        </span>
      </span>
    </th>
  );
}

// ── Plain (non-sortable) TH ────────────────────────────────────────────────
function PlainTh({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${className}`}>
      {label}
    </th>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Report() {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);

  const [fees, setFees] = useState<FeeRow[]>([]);
  const [totalFees, setTotalFees] = useState(0);
  const [feePage, setFeePage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const LIMIT = 10;

  // Record sort state
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Fee sort state
  const [feeSortBy, setFeeSortBy] = useState('');
  const [feeSortDir, setFeeSortDir] = useState<SortDir>('asc');

  // Filter form state
  const [regNumber, setRegNumber] = useState('');
  const [date, setDate] = useState('');
  const [minFee, setMinFee] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Committed filters (only updated on Apply / Reset)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchReports = useCallback(async (params: Record<string, string> = {}, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const res = await client.get('/reports', { params });
      setRecords(res.data.records);
      setTotalRecords(res.data.totalRecords);
      setPage(res.data.page);
      setFees(res.data.fees);
      setTotalFees(res.data.totalFees);
      setFeePage(res.data.feePage);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Build full param object from current state + overrides
  function buildParams(overrides: Record<string, string> = {}): Record<string, string> {
    const p: Record<string, string> = {
      ...activeFilters,
      page: String(page),
      fee_page: String(feePage),
      ...(sortBy ? { sort_by: sortBy, sort_dir: sortDir } : {}),
      ...(feeSortBy ? { fee_sort_by: feeSortBy, fee_sort_dir: feeSortDir } : {}),
      ...overrides,
    };
    return p;
  }

  useEffect(() => {
    async function init() {
      await fetchReports({}, true);
    }
    init();
  }, [fetchReports]);

  // ── Filter handlers ────────────────────────────────────────────
  function handleFilter(e: SyntheticEvent) {
    e.preventDefault();
    const filters: Record<string, string> = {};
    if (regNumber) filters.reg_number = regNumber;
    if (date) filters.date = date;
    if (minFee) filters.min_fee = minFee;
    if (maxFee) filters.max_fee = maxFee;
    if (fromDate) filters.from_date = fromDate;
    if (toDate) filters.to_date = toDate;
    setActiveFilters(filters);
    fetchReports(buildParams({ ...filters, page: '1' }));
  }

  function handleReset() {
    setRegNumber(''); setDate(''); setMinFee(''); setMaxFee(''); setFromDate(''); setToDate('');
    setActiveFilters({});
    setSortBy(''); setFeeSortBy('');
    fetchReports({ page: '1', fee_page: '1' });
  }

  // ── Pagination handlers ────────────────────────────────────────
  function goToPage(p: number) {
    fetchReports(buildParams({ page: String(p) }));
  }

  function goToFeePage(fp: number) {
    fetchReports(buildParams({ fee_page: String(fp) }));
  }

  // ── Sort handlers ──────────────────────────────────────────────
  function handleRecordSort(col: string) {
    const newDir: SortDir = sortBy === col && sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(col);
    setSortDir(newDir);
    fetchReports(buildParams({ sort_by: col, sort_dir: newDir, page: '1' }));
  }

  function handleFeeSort(col: string) {
    const newDir: SortDir = feeSortBy === col && feeSortDir === 'asc' ? 'desc' : 'asc';
    setFeeSortBy(col);
    setFeeSortDir(newDir);
    fetchReports(buildParams({ fee_sort_by: col, fee_sort_dir: newDir, fee_page: '1' }));
  }

  // ── Helpers ────────────────────────────────────────────────────
  function fmt(dt?: string) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  }

  const thBase = 'bg-gray-900 text-white';
  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500';

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-amber-600 px-6 py-4">
          <h1 className="text-xl font-semibold text-white">📊 Vehicle Parking Reports</h1>
        </div>

        <div className="p-6">
          {/* ── Filters ── */}
          <form onSubmit={handleFilter} className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">🔍 Filter Records</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Registration Number</label>
                <input type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)}
                  placeholder="e.g. AS01AB1234" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Specific Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Fee (₹)</label>
                <input type="number" step="0.01" value={minFee} onChange={e => setMinFee(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Fee (₹)</label>
                <input type="number" step="0.01" value={maxFee} onChange={e => setMaxFee(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-sm transition-colors">
                Apply Filters
              </button>
              <button type="button" onClick={handleReset} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm transition-colors">
                Reset
              </button>
            </div>
          </form>

          {/* ── Parking History table ── */}
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Parking History
            {!loading && <span className="ml-2 text-sm font-normal text-gray-400">({totalRecords} records)</span>}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-2">
            <table className="min-w-full text-sm">
              <thead className={thBase}>
                <tr>
                  <PlainTh label="#" />
                  <PlainTh label="Reg. Number" />
                  <PlainTh label="Type" />
                  <PlainTh label="Slot" />
                  <SortTh label="In Time"  colKey="in_time"  active={sortBy === 'in_time'}  dir={sortDir}  onSort={handleRecordSort} />
                  <SortTh label="Out Time" colKey="out_time" active={sortBy === 'out_time'} dir={sortDir}  onSort={handleRecordSort} />
                  <SortTh label="Fee (₹)"  colKey="fee"      active={sortBy === 'fee'}      dir={sortDir}  onSort={handleRecordSort} />
                  <PlainTh label="Receipt" />
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-100 transition-opacity duration-200 ${refreshing ? 'opacity-50' : 'opacity-100'}`}>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No records found for this lot.</td></tr>
                ) : records.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * LIMIT + i + 1}</td>
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{row.registration_number}</td>
                    <td className="px-4 py-3 text-gray-600">{row.type || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{row.slot_id}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(row.in_time)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.out_time ? fmt(row.out_time) : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {row.fee != null ? `₹${parseFloat(String(row.fee)).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.receipt_path ? (
                        <a
                          href={`${API_BASE_URL}/receipts/${row.receipt_path.split('/').pop()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          View
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginator page={page} total={totalRecords} limit={LIMIT} onPage={goToPage} />

          {/* ── Fee Structure table ── */}
          <h2 className="text-base font-semibold text-gray-800 mb-3 mt-8">Fee Structure (Current Lot)</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 mb-2">
            <table className="min-w-full text-sm">
              <thead className={thBase}>
                <tr>
                  <PlainTh label="#" />
                  <PlainTh label="Vehicle Type" />
                  <SortTh label="First Hour (₹)"       colKey="first_hour_charge" active={feeSortBy === 'first_hour_charge'} dir={feeSortDir} onSort={handleFeeSort} />
                  <SortTh label="Subsequent Hour (₹)"  colKey="rest_hour_charge"  active={feeSortBy === 'rest_hour_charge'}  dir={feeSortDir} onSort={handleFeeSort} />
                  <SortTh label="Created At"            colKey="created_at"        active={feeSortBy === 'created_at'}        dir={feeSortDir} onSort={handleFeeSort} />
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-100 transition-opacity duration-200 ${refreshing ? 'opacity-50' : 'opacity-100'}`}>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-6">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td></tr>
                ) : fees.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-400">No fee data found for this lot.</td></tr>
                ) : fees.map((f, i) => (
                  <tr key={f.fee_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-500">{(feePage - 1) * LIMIT + i + 1}</td>
                    <td className="px-4 py-3 font-medium">{f.vehicle_type}</td>
                    <td className="px-4 py-3">₹{parseFloat(String(f.first_hour_charge)).toFixed(2)}</td>
                    <td className="px-4 py-3">₹{parseFloat(String(f.rest_hour_charge)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginator page={feePage} total={totalFees} limit={LIMIT} onPage={goToFeePage} />
        </div>
      </div>
    </div>
  );
}
