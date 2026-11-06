import React, { useState, useEffect, useRef } from 'react';
import { Patient, Lesion, LesionPhoto, RingSettings, AppSettings, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { calculateSha256, formatShortHash } from '../utils/crypto';
import { generateSampleLesionCanvas } from '../db/sampleData';
import {
  analyzeRingAndLesion,
  applyCalibrationTransform,
  RingDetectionResult,
} from '../utils/ringDetector';
import {
  Camera,
  Flashlight,
  FlashlightOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Upload,
  Check,
  ShieldCheck,
  Layers,
  HelpCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CameraCaptureProps {
  language: Language;
  patients: Patient[];
  activePatient?: Patient | null;
  activeLesion?: Lesion | null;
  ringSettings: RingSettings;
  settings: AppSettings;
  onPhotoSaved: (photo: LesionPhoto, patientId: string, lesionId: string) => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  language,
  patients,
  activePatient,
  activeLesion,
  ringSettings,
  settings,
  onPhotoSaved,
  onCancel,
}) => {
  const t = getTranslation(language);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera states
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [fallbackMode, setFallbackMode] = useState<boolean>(false); // without ring

  // Real-time Live Ring Detection & Guidance HUD states (measured from CV loop, no constants)
  const [liveRingDetected, setLiveRingDetected] = useState<boolean>(false);
  const [ringCentered, setRingCentered] = useState<boolean>(false);
  const [isSharp, setIsSharp] = useState<boolean>(false);
  const [glareDetected, setGlareDetected] = useState<boolean>(false);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState<number>(0);

  // Captured photo preview & metadata
  const [capturedPhoto, setCapturedPhoto] = useState<LesionPhoto | null>(null);
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(activePatient?.id || (patients[0]?.id || ''));
  const [selectedLesionId, setSelectedLesionId] = useState<string>(activeLesion?.id || '');
  const [photoNotes, setPhotoNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // 1. Initialize Camera Stream with Rear Camera and Torch
  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        setCameraError(null);
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 3840, min: 1280 },
            height: { ideal: 2160, min: 720 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setHasCameraAccess(true);

        // Check and apply Torch (Flashlight)
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities ? (videoTrack.getCapabilities() as any) : {};
          if (capabilities.torch) {
            setTorchSupported(true);
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true } as any],
              });
              setTorchActive(true);
            } catch (err) {
              console.warn('Could not activate torch automatically:', err);
              setTorchActive(false);
            }
          } else {
            setTorchSupported(false);
            setTorchActive(false);
          }
        }
      } catch (err: any) {
        console.warn('Camera initialization error:', err);
        if (isMounted) {
          setHasCameraAccess(false);
          setCameraError(err.name === 'NotAllowedError' ? 'Camera permission was denied' : err.message || 'No camera available');
        }
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        if (track && (track.getCapabilities as any)?.().torch) {
          track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => {});
        }
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // 2. Real-time Live Frame Ring Detection (Hough/edge gradient circle fit on live frames)
  useEffect(() => {
    if (!hasCameraAccess || capturedPhoto) return;

    let animFrame: number;
    let consecutiveGoodFrames = 0;

    const analyzeFrame = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrame = requestAnimationFrame(analyzeFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) {
        animFrame = requestAnimationFrame(analyzeFrame);
        return;
      }

      const sampleSize = 240;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        animFrame = requestAnimationFrame(analyzeFrame);
        return;
      }

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const minDim = Math.min(vw, vh);
      const cropX = (vw - minDim) / 2;
      const cropY = (vh - minDim) / 2;

      ctx.drawImage(video, cropX, cropY, minDim, minDim, 0, 0, sampleSize, sampleSize);

      try {
        // Run real computer-vision analysis on the frame
        const cvResult: RingDetectionResult = analyzeRingAndLesion(
          canvas,
          ringSettings.ringInnerDiameterMm || 30
        );

        setLiveRingDetected(cvResult.ringDetected);
        // "Ring centered" comes directly from the measured circle's center vs image center
        setRingCentered(cvResult.ringCentered);
        setIsSharp(cvResult.isSharp);
        setGlareDetected(cvResult.glareDetected);

        // Auto-Capture Countdown Logic based strictly on measured CV conditions
        if (
          ringSettings.autoCapture &&
          !fallbackMode &&
          cvResult.ringDetected &&
          cvResult.ringCentered &&
          cvResult.isSharp &&
          !cvResult.glareDetected
        ) {
          consecutiveGoodFrames++;
          const progress = Math.min(100, Math.floor((consecutiveGoodFrames / 30) * 100));
          setAutoCaptureProgress(progress);

          if (consecutiveGoodFrames >= 30) {
            triggerCapture();
            consecutiveGoodFrames = 0;
            setAutoCaptureProgress(0);
          }
        } else {
          consecutiveGoodFrames = 0;
          setAutoCaptureProgress(0);
        }
      } catch (e) {
        // Frame analysis error handling
      }

      animFrame = requestAnimationFrame(analyzeFrame);
    };

    animFrame = requestAnimationFrame(analyzeFrame);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [hasCameraAccess, capturedPhoto, ringSettings.autoCapture, ringSettings.ringInnerDiameterMm, fallbackMode]);

  // 3. Trigger Photo Capture (from live video stream)
  const triggerCapture = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const captureCanvas = document.createElement('canvas');
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;
    captureCanvas.width = width;
    captureCanvas.height = height;

    const ctx = captureCanvas.getContext('2d');
    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Crop center square
    const squareSize = Math.min(width, height);
    const sqCanvas = document.createElement('canvas');
    sqCanvas.width = squareSize;
    sqCanvas.height = squareSize;
    const sqCtx = sqCanvas.getContext('2d');
    if (sqCtx) {
      const sx = (width - squareSize) / 2;
      const sy = (height - squareSize) / 2;
      sqCtx.drawImage(captureCanvas, sx, sy, squareSize, squareSize, 0, 0, squareSize, squareSize);
    }

    await processCapturedCanvas(sqCanvas, !fallbackMode);
    setIsProcessing(false);
  };

  // 4. Sample / Upload fallback for testing without camera
  const handleUseSample = async () => {
    setIsProcessing(true);
    const sampleSize = 600;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleSize;
    sampleCanvas.height = sampleSize;
    const sCtx = sampleCanvas.getContext('2d');

    const sampleDataUrl = generateSampleLesionCanvas({
      diameterMm: 6.4,
      asymmetry: 0.35,
      irregularBorder: true,
      colorVariegated: true,
      timestampText: `CALIBRATED ${ringSettings.ringInnerDiameterMm || 30}mm - ${new Date().toLocaleDateString()}`,
    });

    const img = new Image();
    img.onload = async () => {
      if (sCtx) sCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
      await processCapturedCanvas(sampleCanvas, true, true);
      setIsProcessing(false);
    };
    img.src = sampleDataUrl;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const result = evt.target?.result as string;
      if (result) {
        setIsProcessing(true);
        const img = new Image();
        img.onload = async () => {
          const size = Math.min(img.width, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
            await processCapturedCanvas(canvas, !fallbackMode);
          }
          setIsProcessing(false);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  // 5. Process Captured Image: Real Ring Detection, Notch Rotation, Calibration & Lesion Segmentation
  const processCapturedCanvas = async (
    canvas: HTMLCanvasElement,
    attemptRingCalibration: boolean,
    isSampleDemo: boolean = false
  ) => {
    const configuredRingMm = ringSettings.ringInnerDiameterMm || 30;

    // Run real computer vision analysis on the high-res canvas
    const cvResult: RingDetectionResult = attemptRingCalibration
      ? analyzeRingAndLesion(canvas, configuredRingMm)
      : {
          ringDetected: false,
          ringCentered: false,
          centerPx: null,
          measuredRadiusPx: null,
          measuredDiameterPx: null,
          mmPerPixel: null,
          rotationAngleDeg: 0,
          notchAngleDeg: null,
          colorReferenceNormalized: false,
          glareDetected: false,
          glarePercentage: 0,
          isSharp: true,
          sharpnessScore: 10,
          lesionDetected: false,
          lesionDiameterMm: null,
          lesionAreaMm2: null,
          circularityScore: null,
          borderIrregularityScore: null,
          contourPoints: [],
        };

    let processedDataUrl = canvas.toDataURL('image/jpeg', 0.94);

    // If ring was detected, rotate so the orientation notch is at 12 o'clock and apply white-balance normalization
    if (cvResult.ringDetected) {
      processedDataUrl = await applyCalibrationTransform(
        processedDataUrl,
        cvResult.rotationAngleDeg,
        cvResult.colorCorrectionFactors
      );
    }

    // Tamper-evident SHA-256 hash of the final calibrated image
    const sha256 = await calculateSha256(processedDataUrl);

    // Use clinician profile from settings (or Demo User if sample demo)
    const clinicianName = isSampleDemo
      ? 'Demo User'
      : settings.userProfile?.name?.trim() || settings.providerName?.split(',')[0]?.trim() || 'Clinician';
    const clinicianRole = isSampleDemo ? '' : settings.userProfile?.role?.trim();
    const capturedByString = clinicianRole ? `${clinicianName}, ${clinicianRole}` : clinicianName;

    const newPhoto: LesionPhoto = {
      id: 'photo-' + Date.now(),
      lesionId: selectedLesionId,
      patientId: selectedPatientId,
      timestamp: new Date().toISOString(),
      capturedBy: capturedByString,
      imageData: processedDataUrl,
      torchOn: torchActive,
      lightingControlled: torchActive,
      ringDetected: cvResult.ringDetected,
      ringDiameterMm: configuredRingMm,
      // NO FAKE NUMBERS: mmPerPixel is computed strictly from the MEASURED diameter of the detected ring
      mmPerPixel: cvResult.mmPerPixel,
      // Real rotation angle measured from orientation notch
      rotationAngleDeg: cvResult.rotationAngleDeg,
      colorReferenceNormalized: cvResult.colorReferenceNormalized,
      colorNormalizationFactors: cvResult.colorCorrectionFactors,
      glareDetected: cvResult.glareDetected,
      diameterMmEstimate: cvResult.lesionDiameterMm,
      measuredAreaMm2: cvResult.lesionAreaMm2,
      circularityScore: cvResult.circularityScore,
      borderIrregularityScore: cvResult.borderIrregularityScore,
      contourPoints: cvResult.contourPoints,
      isDemo: isSampleDemo,
      sha256: sha256,
      notes: cvResult.ringDetected
        ? `Calibrated 30mm SkinRing capture. Ring diameter: ${cvResult.measuredDiameterPx}px (${cvResult.mmPerPixel?.toFixed(4)} mm/px). Notch aligned by ${cvResult.rotationAngleDeg}°.`
        : 'Uncalibrated capture: Ring was not detected in image. Scale and cross-visit alignment unavailable.',
    };

    setCapturedPhoto(newPhoto);
  };

  // 6. Save photo to patient record
  const handleSavePhoto = () => {
    if (!capturedPhoto || !selectedPatientId) return;
    onPhotoSaved(capturedPhoto, selectedPatientId, selectedLesionId || 'new');
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchActive;
        await track.applyConstraints({ advanced: [{ torch: nextState } as any] });
        setTorchActive(nextState);
      } catch (e) {
        console.warn('Toggle torch failed', e);
      }
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] pb-24 bg-slate-950 text-white flex flex-col items-center">
      {/* Hidden canvas for live frame processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Review Mode (after photo is captured) */}
      {capturedPhoto ? (
        <div className="w-full max-w-xl mx-auto p-4 flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">Capture Review & Calibration</h2>
            </div>
            <button
              onClick={() => setCapturedPhoto(null)}
              className="text-xs sm:text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 transition"
            >
              Retake
            </button>
          </div>

          {/* Captured Image Display with Segmented Lesion Outline & Reticle */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-700 bg-black aspect-square max-h-[420px] mx-auto shadow-2xl w-full">
            <img
              src={capturedPhoto.imageData}
              alt="Captured skin lesion"
              className="w-full h-full object-cover"
            />

            {/* Detected Lesion Outline Overlay (SVG) */}
            {showOutline && capturedPhoto.contourPoints && capturedPhoto.contourPoints.length > 2 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polygon
                  points={capturedPhoto.contourPoints
                    .map((p) => `${p.x * 100},${p.y * 100}`)
                    .join(' ')}
                  fill="rgba(34, 211, 238, 0.22)"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                  strokeDasharray="2,2"
                />
              </svg>
            )}

            {/* Toggle outline button */}
            {capturedPhoto.contourPoints && capturedPhoto.contourPoints.length > 2 && (
              <button
                type="button"
                onClick={() => setShowOutline(!showOutline)}
                className="absolute top-3 right-3 z-30 px-2.5 py-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-md"
              >
                {showOutline ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                <span>{showOutline ? 'Outline On' : 'Outline Off'}</span>
              </button>
            )}

            {/* Demo indicator if test sample */}
            {capturedPhoto.isDemo && (
              <div className="absolute top-3 left-3 z-30 px-2.5 py-1 rounded-xl bg-amber-500/90 text-slate-950 font-bold text-xs shadow-md">
                Calibrated Test Sample (Demo)
              </div>
            )}

            {/* Real Measured Calibration Details Watermark Overlay */}
            <div className="absolute bottom-2 left-2 right-2 p-3 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs text-slate-200 flex flex-col gap-1.5 shadow-xl">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  {capturedPhoto.ringDetected
                    ? `Ring: ${capturedPhoto.ringDiameterMm}mm Calibrated (${capturedPhoto.mmPerPixel ? capturedPhoto.mmPerPixel.toFixed(4) : 'N/A'} mm/px)`
                    : 'Ring Not Detected (Uncalibrated)'}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${capturedPhoto.torchOn ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'}`}>
                  {capturedPhoto.torchOn ? 'Torch On' : 'Lighting Uncontrolled'}
                </span>
              </div>

              {/* Real Measurements Display */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800 text-[11px] sm:text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Max Diameter:</span>
                  <span className="text-white font-bold">
                    {capturedPhoto.diameterMmEstimate !== null
                      ? `${capturedPhoto.diameterMmEstimate.toFixed(1)} mm`
                      : 'Not measured'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Surface Area:</span>
                  <span className="text-white font-bold">
                    {capturedPhoto.measuredAreaMm2 !== null && capturedPhoto.measuredAreaMm2 !== undefined
                      ? `${capturedPhoto.measuredAreaMm2.toFixed(1)} mm²`
                      : 'Not measured'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Circularity / Irreg:</span>
                  <span className="text-white font-bold">
                    {capturedPhoto.circularityScore !== null && capturedPhoto.circularityScore !== undefined && capturedPhoto.borderIrregularityScore !== null && capturedPhoto.borderIrregularityScore !== undefined
                      ? `${capturedPhoto.circularityScore.toFixed(2)} / ${capturedPhoto.borderIrregularityScore.toFixed(2)}`
                      : 'Not measured'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                <span>By: <strong className="text-slate-300">{capturedPhoto.capturedBy}</strong></span>
                <span className="font-mono text-emerald-400">SHA-256: {formatShortHash(capturedPhoto.sha256)}</span>
              </div>
            </div>
          </div>

          {/* Patient and Lesion Assignment Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                Assign to Patient:
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500 font-medium"
              >
                {patients.map((pat) => (
                  <option key={pat.id} value={pat.id}>
                    {pat.name} ({pat.mrn}) — Fitzpatrick Type {pat.fitzpatrickType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                Clinical Observation Notes:
              </label>
              <textarea
                rows={2}
                value={photoNotes}
                onChange={(e) => setPhotoNotes(e.target.value)}
                placeholder="e.g. Ring seated flush on forearm. Real CV segmented outline confirmed."
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setCapturedPhoto(null)}
                className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
              >
                Retake Photo
              </button>
              <button
                onClick={handleSavePhoto}
                className="flex-1 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shadow-lg shadow-cyan-900/40 transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Save to Timeline</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Live Viewfinder Mode */
        <div className="w-full max-w-xl mx-auto flex flex-col h-full relative">
          {/* Top Status & Controls Bar */}
          <div className="p-3.5 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${hasCameraAccess ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs sm:text-sm font-bold text-slate-200">
                {fallbackMode ? t.fallbackModeTitle : t.captureTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Fallback Mode Toggle */}
              <button
                onClick={() => setFallbackMode(!fallbackMode)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition border ${
                  fallbackMode
                    ? 'bg-amber-950/60 text-amber-300 border-amber-700'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Toggle ringless fallback mode"
              >
                {fallbackMode ? t.useRingMode : t.useFallbackMode}
              </button>

              {/* Torch Toggle Button */}
              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl border transition ${
                    torchActive
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title={torchActive ? 'Turn off torch' : 'Turn on torch'}
                >
                  {torchActive ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                </button>
              )}

              {/* Guide modal button */}
              <button
                onClick={() => setShowGuideModal(true)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition"
                title="Ring spacer instructions"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Torch warning banner if unsupported or inactive */}
          {!torchActive && !fallbackMode && (
            <div className="mx-3.5 mb-2 p-2.5 rounded-2xl bg-amber-950/80 border border-amber-800/80 text-amber-200 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t.torchNotice} (Photo will be marked &quot;lighting not controlled&quot;)</span>
            </div>
          )}

          {/* Fallback mode warning */}
          {fallbackMode && (
            <div className="mx-3.5 mb-2 p-2.5 rounded-2xl bg-rose-950/70 border border-rose-800/70 text-rose-200 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{t.fallbackModeWarning}</span>
            </div>
          )}

          {/* Live Video Viewfinder Container */}
          <div className="relative mx-3.5 aspect-square rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-2xl flex items-center justify-center">
            {hasCameraAccess ? (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              /* Camera unavailable placeholder / desktop test fallback */
              <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Camera className="w-12 h-12 text-slate-600" />
                <p className="text-sm sm:text-base font-semibold text-slate-300">
                  {cameraError || 'Camera stream initializing...'}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 max-w-xs">
                  On desktop simulator, test with calibrated dermoscopic sample lesions or upload an image.
                </p>
                <div className="flex gap-2.5 mt-2">
                  <button
                    onClick={handleUseSample}
                    className="py-2.5 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs sm:text-sm font-bold shadow-md transition"
                  >
                    Load Calibrated Sample
                  </button>
                  <label className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold cursor-pointer transition border border-slate-700">
                    Upload Photo
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* HUD Overlay: Calibrated Ring Guide & Reticle */}
            {!fallbackMode ? (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Simulated 3D Ring Outline */}
                <div
                  className={`relative w-[76%] aspect-square rounded-full border-4 transition-colors duration-300 flex items-center justify-center ${
                    ringCentered && isSharp && !glareDetected
                      ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                      : glareDetected
                      ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                      : 'border-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                  }`}
                >
                  {/* 12 o'clock Orientation Notch */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-rose-500 rotate-45 rounded-xs border-2 border-white shadow-md" />

                  {/* Calibration Tick Marks (3, 6, 9 o'clock) */}
                  <div className="absolute top-1/2 -right-2.5 -translate-y-1/2 w-2.5 h-1 bg-white rounded-full" />
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-2.5 bg-white rounded-full" />
                  <div className="absolute top-1/2 -left-2.5 -translate-y-1/2 w-2.5 h-1 bg-white rounded-full" />

                  {/* Reference Grey/White Calibration Patch at 3 o'clock */}
                  <div className="absolute top-1/2 -right-6 -translate-y-1/2 flex flex-col border border-slate-400 rounded overflow-hidden shadow-sm">
                    <div className="w-3.5 h-3 bg-white" />
                    <div className="w-3.5 h-3 bg-neutral-400" />
                  </div>

                  {/* Center Lesion Aim Reticle */}
                  <div className="w-8 h-8 rounded-full border border-dashed border-cyan-300/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  </div>

                  {/* Known Diameter Label */}
                  <span className="absolute bottom-3 text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase bg-slate-900/85 px-2.5 py-0.5 rounded-full border border-cyan-800/60">
                    Ring {ringSettings.ringInnerDiameterMm}mm
                  </span>
                </div>
              </div>
            ) : (
              /* Fallback Distance & Scale Guide */
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-amber-400/80 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border border-amber-400/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  </div>
                </div>
                <div className="mt-2 px-3 py-1 rounded-full bg-black/75 text-amber-300 text-xs font-semibold border border-amber-500/40">
                  Align ruler / distance guide (lower comparability)
                </div>
              </div>
            )}

            {/* Glare Warning Popup Banner over Viewfinder */}
            {glareDetected && (
              <div className="absolute top-4 left-4 right-4 z-30 p-3 rounded-2xl bg-amber-500/95 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl backdrop-blur-md animate-bounce">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t.glareWarning}</span>
              </div>
            )}

            {/* Auto-Capture Progress Ring */}
            {autoCaptureProgress > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-950/95 border border-emerald-500/60 text-emerald-300 text-xs sm:text-sm font-bold shadow-lg backdrop-blur-md">
                <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span>Auto-capturing ({autoCaptureProgress}%)</span>
              </div>
            )}
          </div>

          {/* Live HUD Badges Bar (Measured live from computer vision) */}
          <div className="mx-3.5 mt-3 grid grid-cols-3 gap-2.5 text-center">
            {/* Ring Centering Badge */}
            <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${ringCentered ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-500'}`} />
              <span className="text-xs sm:text-sm text-slate-200 font-bold">
                {ringCentered ? t.ringCentered : t.ringOffCenter}
              </span>
            </div>

            {/* Sharpness Badge */}
            <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isSharp ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs sm:text-sm text-slate-200 font-bold">
                {isSharp ? t.ringSharp : t.ringBlurry}
              </span>
            </div>

            {/* Glare Badge */}
            <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${glareDetected ? 'bg-amber-400' : 'bg-emerald-400 shadow-sm shadow-emerald-400'}`} />
              <span className="text-xs sm:text-sm text-slate-200 font-bold">
                {glareDetected ? 'Glare Warning' : t.glareClear}
              </span>
            </div>
          </div>

          {/* Primary One-Handed Capture Controls */}
          <div className="mt-5 px-6 flex items-center justify-between">
            {/* Clinical Sample / Upload */}
            <button
              onClick={handleUseSample}
              className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white p-2.5 rounded-2xl active:scale-95 transition cursor-pointer"
              title="Use calibrated test lesion"
            >
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              <span className="text-xs font-semibold">Test Sample</span>
            </button>

            {/* Big Thumb Shutter Button */}
            <div className="relative">
              <button
                onClick={triggerCapture}
                disabled={isProcessing}
                className="w-22 h-22 rounded-full border-4 border-slate-700 p-1 flex items-center justify-center bg-slate-900 hover:scale-105 active:scale-95 transition shadow-2xl shadow-cyan-500/30 cursor-pointer"
                title="Capture Photo"
              >
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-slate-950 font-bold shadow-inner">
                  <Camera className="w-9 h-9" />
                </div>
              </button>
            </div>

            {/* File Upload from Gallery */}
            <label className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white p-2.5 rounded-2xl cursor-pointer active:scale-95 transition">
              <Upload className="w-5 h-5 text-cyan-400" />
              <span className="text-xs font-semibold">Upload</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* Guide Info Modal for 3D Ring Setup */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-200">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <span>3D-Printed Spacer Ring Usage</span>
            </h3>
            <div className="mt-3.5 space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>
                <strong>1. Attachment:</strong> Clip the 3D-printed spacer over the phone&apos;s camera corner. The ring maintains a constant distance between lens and skin.
              </p>
              <p>
                <strong>2. Placement:</strong> Rest the ring gently on the skin centered over the lesion. Do not press hard to avoid blanching vascular patterns.
              </p>
              <p>
                <strong>3. Orientation:</strong> Align the red notch at 12 o&apos;clock (superior/cephalic position). This ensures cross-visit alignment.
              </p>
              <p>
                <strong>4. Standardization:</strong> Torch illumination + reference patch normalize brightness and color across different smartphones.
              </p>
            </div>
            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
