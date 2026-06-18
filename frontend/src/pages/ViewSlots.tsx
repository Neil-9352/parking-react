import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import client, { API_BASE_URL } from '../api/client';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

interface Slot {
  slot_id: number;
  slot_no: number;
  status: 'occupied' | 'unoccupied' | 'booked';
  registration_number?: string;
  type?: string;
  in_time?: string;
  booking_id?: number;
  booked_reg?: string;
  expected_start_time?: string;
  expected_end_time?: string;
  booked_type?: string;
}

interface ReceiptData {
  registration_number: string;
  vehicle_type: string;
  hours_parked: number;
  fee: number;
  receipt_filename: string;
}

function getDisplayStatus(slot: Slot): 'occupied' | 'booked' | 'unoccupied' {
  if (slot.status === 'occupied') return 'occupied';
  if (slot.booking_id) return 'booked';
  return 'unoccupied';
}

function slotColors(status: string) {
  switch (status) {
    case 'occupied': return 'border-red-300 bg-red-50';
    case 'booked': return 'border-amber-300 bg-amber-50';
    default: return 'border-emerald-300 bg-emerald-50';
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'occupied': return <span className="px-1.5 py-0.5 text-xs font-bold bg-red-600 text-white rounded-full">Occupied</span>;
    case 'booked': return <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">Booked</span>;
    default: return <span className="px-1.5 py-0.5 text-xs font-bold bg-emerald-600 text-white rounded-full">Free</span>;
  }
}

function slotIcon(slot: Slot, displayStatus: string) {
  if (displayStatus === 'occupied') return slot.type === '2-wheeler' ? '🏍️' : '🚗';
  if (displayStatus === 'booked') return slot.booked_type === '2-wheeler' ? '🏍️' : '🚗';
  return '🅿️';
}

function fmt(dt?: string) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ViewSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const { addToast, ToastContainer } = useToast();

  const fetchSlots = useCallback(async () => {
    try {
      const res = await client.get('/slots');
      setSlots(res.data);
    } catch {
      addToast('Failed to load slots', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    async function init() {
      await fetchSlots();
    }
    init();
  }, [fetchSlots]);

  function handleRemoveClick(slot: Slot) {
    setSelectedSlot(slot);
    setConfirmOpen(true);
  }

  async function handleConfirmRemove() {
    if (!selectedSlot) return;
    setRemoving(true);
    try {
      const res = await client.post(`/slots/remove/${selectedSlot.slot_id}`);
      setConfirmOpen(false);
      setReceiptData(res.data);
      setReceiptModal(true);
      addToast('Vehicle removed successfully!', 'success');
      fetchSlots();
    } catch (err) {
      const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to remove vehicle';
      addToast(errorMsg, 'error');
      setConfirmOpen(false);
    } finally {
      setRemoving(false);
      setSelectedSlot(null);
    }
  }

  const occupied = slots.filter(s => s.status === 'occupied').length;
  const booked = slots.filter(s => getDisplayStatus(s) === 'booked').length;
  const free = slots.length - occupied - booked;

  return (
    <div className="p-6">
      <ToastContainer />

      {/* Header card with stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-teal-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">📋 Parking Lot Overview</h1>
          <button
            onClick={fetchSlots}
            className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-200">
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{occupied}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Occupied</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{booked}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Booked</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{free}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">Available</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>Occupied</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>Booked</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>Free</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No parking slots found for this lot.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {slots.map(slot => {
            const displayStatus = getDisplayStatus(slot);
            return (
              <div
                key={slot.slot_id}
                className={`slot-card border-2 rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200 ${slotColors(displayStatus)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-700">#{slot.slot_no}</span>
                  <StatusBadge status={displayStatus} />
                </div>

                <div className="text-3xl text-center my-2">{slotIcon(slot, displayStatus)}</div>

                {displayStatus === 'occupied' && (
                  <div className="text-xs space-y-1">
                    <p className="font-mono font-bold text-gray-800 truncate">{slot.registration_number}</p>
                    <p className="text-gray-500 truncate text-xs">{fmt(slot.in_time)}</p>
                    <button
                      onClick={() => handleRemoveClick(slot)}
                      className="w-full mt-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {displayStatus === 'booked' && (
                  <div className="text-xs space-y-0.5">
                    <p className="font-mono font-bold text-gray-800 truncate">{slot.booked_reg}</p>
                    <p className="text-gray-500 text-xs truncate">From: {fmt(slot.expected_start_time)}</p>
                  </div>
                )}

                {displayStatus === 'unoccupied' && (
                  <p className="text-xs text-gray-400 text-center mt-1">Available</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Remove Modal */}
      <Modal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setSelectedSlot(null); }}
        title="Confirm Vehicle Removal"
        footer={
          <>
            <button
              onClick={() => { setConfirmOpen(false); setSelectedSlot(null); }}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRemove}
              disabled={removing}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg text-sm flex items-center gap-2"
            >
              {removing ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Removing...</>
              ) : 'Remove Vehicle'}
            </button>
          </>
        }
      >
        <p className="text-gray-700 text-sm">
          Remove vehicle <strong className="font-mono">{selectedSlot?.registration_number}</strong> from Slot <strong>{selectedSlot?.slot_no}</strong>?
        </p>
        <p className="text-gray-500 text-xs mt-2">A PDF receipt will be generated automatically.</p>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        open={receiptModal}
        onClose={() => setReceiptModal(false)}
        title="📄 Vehicle Removed — Receipt Ready"
        footer={
          <>
            {receiptData?.receipt_filename && (
              <button
                onClick={() => window.open(`${API_BASE_URL}/receipts/${receiptData.receipt_filename}`, '_blank')}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm"
              >
                Download Receipt
              </button>
            )}
            <button onClick={() => setReceiptModal(false)} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm">
              Close
            </button>
          </>
        }
      >
        {receiptData && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Registration</p>
                <p className="font-bold font-mono">{receiptData.registration_number}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Type</p>
                <p className="font-bold">{receiptData.vehicle_type}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Duration</p>
                <p className="font-bold">{receiptData.hours_parked}h</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Fee</p>
                <p className="font-bold text-emerald-700">₹{receiptData.fee?.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
