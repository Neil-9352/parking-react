/**
 * Captures the current video frame onto the canvas and returns it as a
 * base64-encoded JPEG data URL suitable for sending to the ANPR API.
 *
 * @param videoRef - ref to the live <video> element
 * @param canvasRef - ref to the hidden <canvas> element used as a scratch buffer
 * @returns base64 data URL string (image/jpeg)
 */
export function captureFrameFromVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): string {
  const video = videoRef.current!;
  const canvas = canvasRef.current!;
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}
