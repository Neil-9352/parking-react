import { useState, useEffect } from 'react';
import type { SyntheticEvent, ChangeEvent, ReactNode } from 'react';
import axios from 'axios';
import client, { BACKEND_URL } from '../api/client';
import { useToast } from '../components/ui/Toast';
import type { SettingsData } from './types/Settings';

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="bg-slate-700 px-6 py-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast, ToastContainer } = useToast();

  // Lot form
  const [lotName, setLotName] = useState('');
  const [address, setAddress] = useState('');
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [submittingLot, setSubmittingLot] = useState(false);

  // Password form
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [submittingPass, setSubmittingPass] = useState(false);

  // Slots form
  const [totalSlots, setTotalSlots] = useState<number>(0);
  const [submittingSlots, setSubmittingSlots] = useState(false);

  // Fee form
  const [fee2wFirst, setFee2wFirst] = useState<number>(0);
  const [fee2wNext, setFee2wNext] = useState<number>(0);
  const [fee4wFirst, setFee4wFirst] = useState<number>(0);
  const [fee4wNext, setFee4wNext] = useState<number>(0);
  const [submittingFees, setSubmittingFees] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await client.get('/settings');
        const d: SettingsData = res.data;
        setData(d);
        setLotName(d.lot_name);
        setAddress(d.address);
        setTotalSlots(d.slot_count);
        setFee2wFirst(d.fees['2-wheeler'].first_hour);
        setFee2wNext(d.fees['2-wheeler'].next_hour);
        setFee4wFirst(d.fees['4-wheeler'].first_hour);
        setFee4wNext(d.fees['4-wheeler'].next_hour);
      } catch {
        addToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [addToast]);

  async function handleLotSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setSubmittingLot(true);
    try {
      const formData = new FormData();
      formData.append('lot_name', lotName);
      formData.append('address', address);
      if (layoutFile) formData.append('layout_image', layoutFile);
      await client.post('/settings/lot', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      addToast('Lot details updated successfully!', 'success');
    } catch (err) {
      const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to update lot details';
      addToast(errorMsg, 'error');
    } finally {
      setSubmittingLot(false);
    }
  }

  async function handlePasswordSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (newPass !== confirmPass) { addToast('Passwords do not match', 'error'); return; }
    if (newPass.length < 6) { addToast('Password must be at least 6 characters', 'error'); return; }
    setSubmittingPass(true);
    try {
      await client.post('/auth/change-password', { new_password: newPass, confirm_password: confirmPass });
      addToast('Password changed successfully!', 'success');
      setNewPass(''); setConfirmPass('');
    } catch (err) {
      const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to change password';
      addToast(errorMsg, 'error');
    } finally {
      setSubmittingPass(false);
    }
  }

  async function handleSlotsSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setSubmittingSlots(true);
    try {
      const res = await client.post('/settings/slots', { total_slots: totalSlots });
      addToast(res.data.message || 'Slots updated!', 'success');
      setData(prev => prev ? { ...prev, slot_count: totalSlots } : prev);
    } catch (err) {
      const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to update slots';
      addToast(errorMsg, 'error');
    } finally {
      setSubmittingSlots(false);
    }
  }

  async function handleFeesSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setSubmittingFees(true);
    try {
      await client.post('/settings/fees', {
        fee_2w_first: fee2wFirst, fee_2w_next: fee2wNext,
        fee_4w_first: fee4wFirst, fee_4w_next: fee4wNext,
      });
      addToast('Fee settings updated successfully!', 'success');
    } catch (err) {
      const errorMsg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Failed to update fees';
      addToast(errorMsg, 'error');
    } finally {
      setSubmittingFees(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors";

  return (
    <div className="p-6">
      <ToastContainer />

      {/* Parking Lot Details */}
      <SectionCard title="🏢 Parking Lot Details">
        <form onSubmit={handleLotSubmit} className="space-y-4">
          {data?.layout_image && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Current Layout Image</p>
              <img
                src={`${BACKEND_URL}/${data.layout_image}`}
                alt="Lot layout"
                className="max-h-48 rounded-lg border border-gray-200 shadow-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lot Name</label>
            <input type="text" required value={lotName} onChange={e => setLotName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <input type="text" required value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Layout Image <span className="text-gray-400 text-xs">(optional, max 5MB, PNG/JPG/WebP)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLayoutFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button type="submit" disabled={submittingLot} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors">
            {submittingLot ? 'Updating...' : 'Update Lot Details'}
          </button>
        </form>
      </SectionCard>

      {/* Change Password */}
      <SectionCard title="🔐 Change Admin Password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <input
              type="password" required minLength={6}
              value={newPass} onChange={e => setNewPass(e.target.value)}
              className={inputClass} placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <input
              type="password" required
              value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className={`${inputClass} ${confirmPass && newPass !== confirmPass ? 'border-red-400 focus:ring-red-500' : ''}`}
              placeholder="Repeat new password"
            />
            {confirmPass && newPass !== confirmPass && (
              <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>
          <button type="submit" disabled={submittingPass} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors">
            {submittingPass ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </SectionCard>

      {/* Slot Management */}
      <SectionCard title="🔢 Manage Parking Slots">
        <form onSubmit={handleSlotsSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Current slot count: <strong className="text-gray-800">{data?.slot_count}</strong>
            {' '}— Enter a new value to add or remove slots.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Slots</label>
            <input
              type="number" min={1} required
              value={totalSlots}
              onChange={e => setTotalSlots(parseInt(e.target.value) || 0)}
              className={inputClass}
            />
            {totalSlots > (data?.slot_count || 0) && (
              <p className="text-emerald-600 text-xs mt-1">
                ✅ Will add {totalSlots - (data?.slot_count || 0)} new slot(s)
              </p>
            )}
            {totalSlots < (data?.slot_count || 0) && totalSlots >= 1 && (
              <p className="text-red-500 text-xs mt-1">
                ⚠️ Will remove {(data?.slot_count || 0) - totalSlots} slot(s) from the end
              </p>
            )}
          </div>
          <button type="submit" disabled={submittingSlots} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors">
            {submittingSlots ? 'Updating...' : 'Update Slot Count'}
          </button>
        </form>
      </SectionCard>

      {/* Fee Settings */}
      <SectionCard title="💰 Fee Settings">
        <form onSubmit={handleFeesSubmit} className="space-y-6">
          {/* 2-Wheeler */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-lg">🏍️</span> 2-Wheeler
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">First Hour (₹)</label>
                <input
                  type="number" step="0.01" min={0} required
                  value={fee2wFirst}
                  onChange={e => setFee2wFirst(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Next Hour (₹)</label>
                <input
                  type="number" step="0.01" min={0} required
                  value={fee2wNext}
                  onChange={e => setFee2wNext(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* 4-Wheeler */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-lg">🚗</span> 4-Wheeler
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">First Hour (₹)</label>
                <input
                  type="number" step="0.01" min={0} required
                  value={fee4wFirst}
                  onChange={e => setFee4wFirst(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Next Hour (₹)</label>
                <input
                  type="number" step="0.01" min={0} required
                  value={fee4wNext}
                  onChange={e => setFee4wNext(parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={submittingFees} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors">
            {submittingFees ? 'Saving...' : 'Update Fee Settings'}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
