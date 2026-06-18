import { useState, useEffect, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import axios from 'axios';
import client from '../api/client';
import { useToast } from '../components/ui/Toast';

export default function ManualEntry() {
  const [slots, setSlots] = useState<number[]>([]);
  const [regNumber, setRegNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('2-wheeler');
  const [slotNo, setSlotNo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const { addToast, ToastContainer } = useToast();

  const loadSlots = useCallback(async () => {
    try {
      const res = await client.get<{ slot_no: number }[]>('/vehicles/available-slots');
      setSlots(res.data.map(s => s.slot_no));
    } catch {
      addToast('Failed to load available slots', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    async function init() {
      await loadSlots();
    }
    init();
  }, [loadSlots]);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (!slotNo) { addToast('Please select a slot', 'error'); return; }
    setSubmitting(true);
    try {
      await client.post('/vehicles/entry', {
        reg_number: regNumber.toUpperCase().trim(),
        vehicle_type: vehicleType,
        slot_no: parseInt(slotNo),
      });
      addToast('Vehicle parked successfully!', 'success');
      setRegNumber('');
      setSlotNo('');
      await loadSlots();
    } catch (err) {
      const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to park vehicle';
      addToast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-violet-600 px-6 py-4">
          <h1 className="text-xl font-semibold text-white">🚗 Manual Vehicle Entry</h1>
          <p className="text-violet-100 text-sm mt-1">Add a vehicle by entering details manually</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="reg_number" className="block text-sm font-medium text-gray-700 mb-1.5">
              Vehicle Registration Number <span className="text-red-500">*</span>
            </label>
            <input
              id="reg_number"
              type="text"
              required
              value={regNumber}
              onChange={e => setRegNumber(e.target.value.toUpperCase())}
              placeholder="e.g. AS01AB1234"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-mono uppercase"
            />
          </div>

          <div>
            <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700 mb-1.5">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              id="vehicle_type"
              value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
            >
              <option value="2-wheeler">🏍️ 2-Wheeler (Bike / Scooter)</option>
              <option value="4-wheeler">🚗 4-Wheeler (Car / SUV)</option>
            </select>
          </div>

          <div>
            <label htmlFor="slot_no" className="block text-sm font-medium text-gray-700 mb-1.5">
              Parking Slot <span className="text-red-500">*</span>
            </label>
            <select
              id="slot_no"
              required
              value={slotNo}
              onChange={e => setSlotNo(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
            >
              <option value="">-- Select a slot --</option>
              {slots.length > 0
                ? slots.map(s => <option key={s} value={s}>Slot {s}</option>)
                : <option value="" disabled>No available slots</option>
              }
            </select>
            {slots.length === 0 && (
              <p className="text-amber-600 text-xs mt-1.5">⚠️ No unoccupied slots available at this time.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || slots.length === 0}
            className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Parking...</>
            ) : 'Park Vehicle'}
          </button>
        </form>
      </div>
    </div>
  );
}
