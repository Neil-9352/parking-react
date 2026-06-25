import { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { Step1, Step2, Step1Errors, Step2Errors } from './types/Register';
import { validateStep1, validateStep2, buildRegisterFormData } from './logic/Register';

// ── Style helpers (short, UI-only) ────────────────────────────────────────────
const inputCls =
  'w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors';
const validCls   = 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
const invalidCls = 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50';

function field(hasErr: boolean) {
  return `${inputCls} ${hasErr ? invalidCls : validCls}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);

  const [s1, setS1] = useState<Step1>({
    lot_name: '', address: '', total_slots: '',
    fee_2w_first: '', fee_2w_next: '',
    fee_4w_first: '', fee_4w_next: '',
    layout_image: null,
  });

  const [s2, setS2] = useState<Step2>({
    username: '', password: '', confirm_password: '',
  });

  const [s1Err, setS1Err] = useState<Step1Errors>({});
  const [s2Err, setS2Err] = useState<Step2Errors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Step-1 handlers ──────────────────────────────────────────────────────

  function handleS1Change(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setS1(prev => ({ ...prev, [name]: value }));
    if (s1Err[name as keyof Step1]) setS1Err(prev => ({ ...prev, [name]: '' }));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setS1(prev => ({ ...prev, layout_image: e.target.files?.[0] ?? null }));
  }

  function goToStep2() {
    const errs = validateStep1(s1);
    setS1Err(errs);
    if (Object.keys(errs).length === 0) setStep(2);
  }

  function goToStep1() {
    setStep(1);
  }

  // ── Step-2 handlers ──────────────────────────────────────────────────────

  function handleS2Change(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setS2(prev => ({ ...prev, [name]: value }));
    if (s2Err[name as keyof Step2]) setS2Err(prev => ({ ...prev, [name]: '' }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    const errs = validateStep2(s2);
    setS2Err(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setServerError('');

    try {
      const formData = buildRegisterFormData(s1, s2);
      await axios.post('/api/auth/register', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // On success navigate to login with a success flag
      navigate('/login?registered=1');
    } catch (err) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error
        ? err.response.data.error
        : 'Registration failed. Please try again.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step indicator ───────────────────────────────────────────────────────

  function StepDot({ n }: { n: 1 | 2 }) {
    const done    = n < step;
    const active  = n === step;
    const base    = 'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300';
    const cls = done
      ? `${base} border-emerald-500 bg-emerald-500 text-white`
      : active
        ? `${base} border-blue-600 bg-blue-600 text-white`
        : `${base} border-gray-300 bg-white text-gray-400`;
    return <div className={cls}>{done ? '✓' : n}</div>;
  }

  function Connector() {
    const done = step === 2;
    return (
      <div className={`h-0.5 w-10 self-center transition-colors duration-300 ${done ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <span className="text-4xl">🅿️</span>
          </div>
          <h1 className="text-3xl font-bold text-white">ParkAdmin</h1>
          <p className="text-slate-400 text-sm mt-1">Parking Lot Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">Register New Parking Lot</h2>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-2">
            <StepDot n={1} />
            <Connector />
            <StepDot n={2} />
          </div>
          <p className="text-center text-sm text-gray-500 mb-6">
            {step === 1 ? 'Step 1: Parking Lot Details' : 'Step 2: Admin Credentials'}
          </p>

          {/* Server error */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* ── STEP 1 ── */}
            <div style={{ display: step === 1 ? 'block' : 'none' }}>

              {/* Lot name */}
              <div className="mb-4">
                <label htmlFor="lot_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Parking Lot Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="lot_name" name="lot_name" type="text"
                  value={s1.lot_name} onChange={handleS1Change}
                  maxLength={100} placeholder="e.g. City Centre Parking"
                  className={field(!!s1Err.lot_name)}
                />
                {s1Err.lot_name && <p className="text-red-500 text-xs mt-1">{s1Err.lot_name}</p>}
              </div>

              {/* Address */}
              <div className="mb-4">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="address" name="address" rows={2}
                  value={s1.address} onChange={handleS1Change}
                  maxLength={255} placeholder="e.g. 123 Main Street, Downtown"
                  className={field(!!s1Err.address)}
                />
                {s1Err.address && <p className="text-red-500 text-xs mt-1">{s1Err.address}</p>}
              </div>

              {/* Layout image */}
              <div className="mb-4">
                <label htmlFor="layout_image" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Layout Image <span className="text-gray-400 text-xs">(optional, PNG / JPG / WebP, max 5 MB)</span>
                </label>
                <input
                  id="layout_image" name="layout_image" type="file" accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {s1.layout_image && (
                  <p className="text-xs text-gray-500 mt-1">📎 {s1.layout_image.name}</p>
                )}
              </div>

              {/* Total slots */}
              <div className="mb-4">
                <label htmlFor="total_slots" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Number of Parking Slots <span className="text-red-500">*</span>
                </label>
                <input
                  id="total_slots" name="total_slots" type="number"
                  value={s1.total_slots} onChange={handleS1Change}
                  min={1} max={1000} placeholder="e.g. 20"
                  className={field(!!s1Err.total_slots)}
                />
                {s1Err.total_slots && <p className="text-red-500 text-xs mt-1">{s1Err.total_slots}</p>}
              </div>

              {/* Fee settings */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Parking Fee Settings <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">

                  {/* 2-Wheeler */}
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">🏍️ 2-Wheeler</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="fee_2w_first" className="block text-xs font-medium text-gray-600 mb-1">First Hour (₹)</label>
                        <input
                          id="fee_2w_first" name="fee_2w_first" type="number"
                          value={s1.fee_2w_first} onChange={handleS1Change}
                          min={0} step="0.01" placeholder="e.g. 30"
                          className={field(!!s1Err.fee_2w_first)}
                        />
                        {s1Err.fee_2w_first && <p className="text-red-500 text-xs mt-0.5">{s1Err.fee_2w_first}</p>}
                      </div>
                      <div>
                        <label htmlFor="fee_2w_next" className="block text-xs font-medium text-gray-600 mb-1">Subsequent Hours (₹)</label>
                        <input
                          id="fee_2w_next" name="fee_2w_next" type="number"
                          value={s1.fee_2w_next} onChange={handleS1Change}
                          min={0} step="0.01" placeholder="e.g. 15"
                          className={field(!!s1Err.fee_2w_next)}
                        />
                        {s1Err.fee_2w_next && <p className="text-red-500 text-xs mt-0.5">{s1Err.fee_2w_next}</p>}
                      </div>
                    </div>
                  </div>

                  {/* 4-Wheeler */}
                  <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">🚗 4-Wheeler</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="fee_4w_first" className="block text-xs font-medium text-gray-600 mb-1">First Hour (₹)</label>
                        <input
                          id="fee_4w_first" name="fee_4w_first" type="number"
                          value={s1.fee_4w_first} onChange={handleS1Change}
                          min={0} step="0.01" placeholder="e.g. 50"
                          className={field(!!s1Err.fee_4w_first)}
                        />
                        {s1Err.fee_4w_first && <p className="text-red-500 text-xs mt-0.5">{s1Err.fee_4w_first}</p>}
                      </div>
                      <div>
                        <label htmlFor="fee_4w_next" className="block text-xs font-medium text-gray-600 mb-1">Subsequent Hours (₹)</label>
                        <input
                          id="fee_4w_next" name="fee_4w_next" type="number"
                          value={s1.fee_4w_next} onChange={handleS1Change}
                          min={0} step="0.01" placeholder="e.g. 25"
                          className={field(!!s1Err.fee_4w_next)}
                        />
                        {s1Err.fee_4w_next && <p className="text-red-500 text-xs mt-0.5">{s1Err.fee_4w_next}</p>}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <button
                type="button" onClick={goToStep2}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                Next →
              </button>
            </div>

            {/* ── STEP 2 ── */}
            <div style={{ display: step === 2 ? 'block' : 'none' }}>

              {/* Username */}
              <div className="mb-4">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Admin Username <span className="text-red-500">*</span>
                </label>
                <input
                  id="username" name="username" type="text"
                  value={s2.username} onChange={handleS2Change}
                  maxLength={50} placeholder="Choose a username"
                  autoComplete="username"
                  className={field(!!s2Err.username)}
                />
                {s2Err.username && <p className="text-red-500 text-xs mt-1">{s2Err.username}</p>}
              </div>

              {/* Password */}
              <div className="mb-4">
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="reg-password" name="password" type="password"
                  value={s2.password} onChange={handleS2Change}
                  minLength={6} placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  className={field(!!s2Err.password)}
                />
                {s2Err.password && <p className="text-red-500 text-xs mt-1">{s2Err.password}</p>}
              </div>

              {/* Confirm password */}
              <div className="mb-6">
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirm_password" name="confirm_password" type="password"
                  value={s2.confirm_password} onChange={handleS2Change}
                  minLength={6} placeholder="Re-enter password"
                  autoComplete="new-password"
                  className={field(!!s2Err.confirm_password)}
                />
                {s2Err.confirm_password && (
                  <p className="text-red-500 text-xs mt-1">{s2Err.confirm_password}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button" onClick={goToStep1}
                  className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registering...</>
                  ) : 'Register'}
                </button>
              </div>
            </div>

          </form>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500 mt-5">
            Already registered?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
