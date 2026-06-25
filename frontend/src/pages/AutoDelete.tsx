import { useRef, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import client, { API_BASE_URL } from '../api/client';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import type { RemoveResult } from './types/AutoDelete';
import { captureFrameFromVideo } from './logic/camera';

export default function AutoDelete() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<RemoveResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [noMatchInfo, setNoMatchInfo] = useState<{ plate: string; message: string } | null>(null);
  const { ToastContainer } = useToast();

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCaptured(false);
    } catch (e) {
      setCameraError('Camera access failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Start camera automatically on mount, clean up on unmount
  useEffect(() => {
    async function init() {
      await startCamera();
    }
    init();
    return () => { stopCamera(); };
  }, [startCamera, stopCamera]);

  function handleCapture() {
    captureFrameFromVideo(videoRef, canvasRef);
    setCaptured(true);
    if (videoRef.current) videoRef.current.style.display = 'none';
    if (canvasRef.current) canvasRef.current.style.display = 'block';
  }

  function handleRetake() {
    setCaptured(false);
    setErrorMsg('');
    setNoMatchInfo(null);
    if (videoRef.current) videoRef.current.style.display = 'block';
    if (canvasRef.current) canvasRef.current.style.display = 'none';
  }

  async function handleSubmit() {
    setLoading(true);
    setErrorMsg('');
    setNoMatchInfo(null);
    const image_base64 = captureFrameFromVideo(videoRef, canvasRef);
    try {
      const res = await client.post('/vehicles/auto-delete', { image_base64 });
      const data: RemoveResult = res.data;
      if (data.status === 'no_match') {
        setNoMatchInfo({ plate: data.plate, message: data.message || 'No matching vehicle found' });
      } else {
        setResult(data);
        setModalOpen(true);
      }
    } catch (err) {
      setErrorMsg(axios.isAxiosError(err) && err.response?.data?.error ? err.response.data.error : 'Server error');
    } finally {
      setLoading(false);
    }
  }

  function handleModalClose() {
    setModalOpen(false);
    setResult(null);
    setErrorMsg('');
    handleRetake();
  }

  return (
    <div className="p-6">
      <ToastContainer />
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-red-600 px-6 py-4">
          <h1 className="text-xl font-semibold text-white">🗑️ Automatic Vehicle Removal</h1>
          <p className="text-red-100 text-sm mt-1">Frame the number plate clearly, then capture</p>
        </div>

        <div className="p-6">
          {cameraError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{cameraError}</div>
          )}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{errorMsg}</div>
          )}
          {noMatchInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-800 font-medium text-sm">⚠️ No Match Found</p>
              <p className="text-amber-700 text-sm mt-1">Plate: <strong className="font-mono">{noMatchInfo.plate}</strong></p>
              <p className="text-amber-700 text-sm">{noMatchInfo.message}</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full max-w-xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg shadow-md bg-gray-900"
                style={{ display: captured ? 'none' : 'block' }}
              />
              <canvas
                ref={canvasRef}
                className="w-full rounded-lg shadow-md"
                style={{ display: captured ? 'block' : 'none' }}
              />
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {!captured && (
                <button onClick={handleCapture} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors">
                  📸 Capture
                </button>
              )}
              {captured && (
                <>
                  <button onClick={handleRetake} className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm transition-colors">
                    Retake
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                    ) : 'Remove Vehicle'}
                  </button>
                </>
              )}
              <a href="/slots" className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium rounded-lg text-sm transition-colors">
                View Slots
              </a>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        title="Vehicle Removed"
        footer={
          <>
            {result?.receipt_filename && (
              <button
                onClick={() => window.open(`${API_BASE_URL}/receipts/${result?.receipt_filename}`, '_blank')}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm"
              >
                📄 Download Receipt
              </button>
            )}
            <button onClick={handleModalClose} className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm">
              Close
            </button>
          </>
        }
      >
        {result && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Plate</p>
                <p className="font-bold text-gray-900 font-mono">{result.plate}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Type</p>
                <p className="font-bold text-gray-900">{result.type}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Slot</p>
                <p className="font-bold text-gray-900">{result.slot}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Duration</p>
                <p className="font-bold text-gray-900">{result.duration_hours}h</p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-emerald-800 font-bold text-base">Total: ₹{result.charge?.toFixed(2)}</p>
            </div>
            {result.booking_id && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-xs">
                Booking #{result.booking_id} completed. Deposit ₹{result.booking_amount?.toFixed(2)} — {result.refund_status}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
