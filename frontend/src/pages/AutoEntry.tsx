import { useRef, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import client from '../api/client';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

interface EntryResult {
  plate: string;
  type: string;
  slot: number;
  entry_type: string;
  early_walkin: boolean;
  booking_id?: number;
  cancelled_booking_id?: number;
  refund_amount?: number;
  displaced_booking_id?: number;
}

export default function AutoEntry() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [result, setResult] = useState<EntryResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
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

  function drawToCanvas(): string {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function handleCapture() {
    drawToCanvas();
    setCaptured(true);
    if (videoRef.current) videoRef.current.style.display = 'none';
    if (canvasRef.current) canvasRef.current.style.display = 'block';
  }

  function handleRetake() {
    setCaptured(false);
    setErrorMsg('');
    if (videoRef.current) videoRef.current.style.display = 'block';
    if (canvasRef.current) canvasRef.current.style.display = 'none';
  }

  async function handleSubmit() {
    setLoading(true);
    setErrorMsg('');
    const image_base64 = drawToCanvas();
    try {
      const res = await client.post('/vehicles/auto-entry', { image_base64 });
      setResult(res.data);
      setModalOpen(true);
    } catch (err) {
      setErrorMsg(axios.isAxiosError(err) && err.response?.data?.error ? err.response.data.error : 'Server error');
      setModalOpen(true);
      setResult(null);
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
        <div className="bg-blue-600 px-6 py-4">
          <h1 className="text-xl font-semibold text-white">📸 Automatic Vehicle Entry</h1>
          <p className="text-blue-100 text-sm mt-1">Frame the number plate clearly, then capture</p>
        </div>

        <div className="p-6">
          {cameraError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{cameraError}</div>
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
                <button
                  onClick={handleCapture}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
                >
                  📸 Capture
                </button>
              )}
              {captured && (
                <>
                  <button
                    onClick={handleRetake}
                    className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg text-sm transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : 'Submit'}
                  </button>
                </>
              )}
              <a
                href="/manual-entry"
                className="px-5 py-2.5 border border-red-300 hover:bg-red-50 text-red-600 font-medium rounded-lg text-sm transition-colors"
              >
                Manual Entry
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        title="Vehicle Parking Status"
        footer={
          <button onClick={handleModalClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm">
            OK
          </button>
        }
      >
        {errorMsg ? (
          <div className="text-red-600 bg-red-50 rounded-lg p-4 text-sm">{errorMsg}</div>
        ) : result && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Plate</p>
                <p className="font-bold text-gray-900 text-base">{result.plate}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Type</p>
                <p className="font-bold text-gray-900">{result.type}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Assigned Slot</p>
                <p className="font-bold text-gray-900 text-lg">{result.slot}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs font-medium uppercase mb-1">Entry Type</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  result.entry_type === 'booked' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                }`}>
                  {result.entry_type}
                </span>
              </div>
            </div>

            {result.early_walkin && result.cancelled_booking_id && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs">
                ⚠️ <strong>Early arrival detected.</strong> Booking #{result.cancelled_booking_id} cancelled.
                Refund of <strong>₹{result.refund_amount}</strong> (90%) will be processed.
              </div>
            )}
            {result.entry_type === 'walkin_on_booked' && result.displaced_booking_id && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-xs">
                ℹ️ Booking #{result.displaced_booking_id} displaced (full refund). Slot reassigned.
              </div>
            )}
            {result.booking_id && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-xs">
                ✅ Pre-booked slot assigned. Booking #{result.booking_id}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
