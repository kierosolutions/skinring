import React, { useState } from 'react';
import { Lesion, LesionPhoto, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  Split,
  Columns2,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  MoveHorizontal,
} from 'lucide-react';

interface ChangeComparisonProps {
  language: Language;
  lesion: Lesion;
  photos: LesionPhoto[];
  onBack: () => void;
}

export const ChangeComparison: React.FC<ChangeComparisonProps> = ({
  language,
  lesion,
  photos,
  onBack,
}) => {
  const t = getTranslation(language);

  // Default to first photo as Visit A (baseline) and last photo as Visit B (current)
  const [visitAIndex, setVisitAIndex] = useState<number>(0);
  const [visitBIndex, setVisitBIndex] = useState<number>(Math.max(1, photos.length - 1));
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0-100
  const [viewMode, setViewMode] = useState<'slider' | 'sideBySide'>('slider');

  const photoA = photos[visitAIndex] || photos[0];
  const photoB = photos[visitBIndex] || photos[photos.length - 1];

  // Calibrated metrics - NO hard-coded defaults
  const diamA = photoA?.diameterMmEstimate;
  const diamB = photoB?.diameterMmEstimate;
  const hasMeasurements = typeof diamA === 'number' && typeof diamB === 'number' && diamA > 0 && diamB > 0;

  const diamDelta = hasMeasurements ? diamB! - diamA! : null;
  const diamPercent = hasMeasurements ? Math.round((diamDelta! / diamA!) * 100) : null;

  // Surface area: use actual segmented area if available, else pi * r^2
  const areaA = photoA?.measuredAreaMm2 ?? (typeof diamA === 'number' ? Math.PI * Math.pow(diamA / 2, 2) : null);
  const areaB = photoB?.measuredAreaMm2 ?? (typeof diamB === 'number' ? Math.PI * Math.pow(diamB / 2, 2) : null);
  const hasAreaMeasurements = typeof areaA === 'number' && typeof areaB === 'number' && areaA > 0 && areaB > 0;
  const areaDeltaPercent = hasAreaMeasurements ? Math.round(((areaB! - areaA!) / areaA!) * 100) : null;

  // Color normalization shift
  const hasColorNorm = Boolean(photoA?.colorReferenceNormalized && photoB?.colorReferenceNormalized);

  // Morphological change status threshold (e.g. >10% growth or >0.5mm enlargement)
  const isChanged = hasMeasurements ? (Math.abs(diamDelta!) >= 0.5 || Math.abs(diamPercent!) >= 12) : null;

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const posX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (posX / rect.width) * 100));
    setSliderPosition(percentage);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-5 flex flex-col gap-4 animate-fadeIn pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-white py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Lesion #{lesion.number}</span>
        </button>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs sm:text-sm">
          <button
            onClick={() => setViewMode('slider')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-semibold transition ${
              viewMode === 'slider'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MoveHorizontal className="w-4 h-4" />
            <span>Split Slider</span>
          </button>
          <button
            onClick={() => setViewMode('sideBySide')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-semibold transition ${
              viewMode === 'sideBySide'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-4 h-4" />
            <span>Side by Side</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <Split className="w-5 h-5 text-cyan-400" />
          <span>{t.comparisonTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Calibrated cross-visit alignment via the SkinRing ring geometry &amp; 12 o&apos;clock orientation notch
        </p>
      </div>

      {/* Visit Selectors Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Reference Visit A (Baseline):
          </label>
          <select
            value={visitAIndex}
            onChange={(e) => setVisitAIndex(parseInt(e.target.value, 10))}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
          >
            {photos.map((p, idx) => (
              <option key={p.id} value={idx}>
                Visit {idx + 1} ({new Date(p.timestamp).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Comparison Visit B (Follow-up):
          </label>
          <select
            value={visitBIndex}
            onChange={(e) => setVisitBIndex(parseInt(e.target.value, 10))}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
          >
            {photos.map((p, idx) => (
              <option key={p.id} value={idx}>
                Visit {idx + 1} ({new Date(p.timestamp).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Viewport */}
      {viewMode === 'slider' ? (
        /* Interactive Split Overlay Slider */
        <div className="relative w-full aspect-square max-h-[460px] mx-auto rounded-3xl overflow-hidden bg-black border border-slate-700 shadow-2xl select-none cursor-ew-resize">
          <div
            className="w-full h-full relative"
            onMouseMove={handleSliderMove}
            onTouchMove={handleSliderMove}
          >
            {/* Visit B image (Full underneath) */}
            <img
              src={photoB.imageData}
              alt="Visit B"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* Visit A image (Clipped on top based on slider) */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ width: `${sliderPosition}%` }}
            >
              <img
                src={photoA.imageData}
                alt="Visit A"
                className="absolute inset-0 w-full h-full object-cover max-w-none"
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* Vertical Split Line Divider */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] pointer-events-none z-20"
              style={{ left: `${sliderPosition}%` }}
            >
              {/* Circular Thumb Handle */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold">
                <MoveHorizontal className="w-4 h-4 text-cyan-400" />
              </div>
            </div>

            {/* Labels in Corners */}
            <div className="absolute top-3 left-3 z-30 pointer-events-none">
              <span className="px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-xs font-bold text-white border border-slate-700 shadow-md">
                A: {new Date(photoA.timestamp).toLocaleDateString()} ({typeof diamA === 'number' ? `${diamA.toFixed(1)}mm` : 'Not measured'})
              </span>
            </div>

            <div className="absolute top-3 right-3 z-30 pointer-events-none">
              <span className="px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-xs font-bold text-cyan-300 border border-slate-700 shadow-md">
                B: {new Date(photoB.timestamp).toLocaleDateString()} ({typeof diamB === 'number' ? `${diamB.toFixed(1)}mm` : 'Not measured'})
              </span>
            </div>

            {/* Orientation Notch Indicator */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center">
              <div className="w-2.5 h-2.5 bg-rose-500 rotate-45 border border-white" />
              <span className="text-[10px] text-white/90 font-mono font-bold mt-0.5">12h</span>
            </div>
          </div>
        </div>
      ) : (
        /* Side by Side View */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-square relative shadow-lg">
            <img src={photoA.imageData} alt="Visit A" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 right-2 p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-xs text-slate-200">
              <div className="font-bold text-white text-sm">Visit A ({new Date(photoA.timestamp).toLocaleDateString()})</div>
              <div className="text-slate-300 text-xs mt-0.5 font-medium">
                Calibrated Diam: {typeof diamA === 'number' ? `${diamA.toFixed(1)} mm` : 'Not measured'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-square relative shadow-lg">
            <img src={photoB.imageData} alt="Visit B" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 right-2 p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-xs text-slate-200">
              <div className="font-bold text-cyan-300 text-sm">Visit B ({new Date(photoB.timestamp).toLocaleDateString()})</div>
              <div className="text-slate-300 text-xs mt-0.5 font-medium">
                Calibrated Diam: {typeof diamB === 'number' ? `${diamB.toFixed(1)} mm` : 'Not measured'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quantitative Calibrated Change Report Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {/* Status Callout Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {isChanged === null ? (
              <ShieldCheck className="w-5 h-5 text-slate-400" />
            ) : isChanged ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            )}
            <h3 className="text-sm sm:text-base font-bold text-white">
              {isChanged === null
                ? 'Comparative Calibration Pending'
                : isChanged
                ? t.statusChanged
                : t.statusStable}
            </h3>
          </div>

          <span
            className={`text-xs font-black uppercase px-3 py-1 rounded-full ${
              isChanged === null
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : isChanged
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}
          >
            {isChanged === null
              ? 'Uncalibrated / Partial'
              : isChanged
              ? 'Evolution Flagged'
              : 'Stable Tolerances'}
          </span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          {isChanged === null
            ? 'Quantitative delta and evolution percentage calculations require calibrated ring detection on both visits. Fallback uncalibrated photos cannot be measured with sub-millimeter precision.'
            : isChanged
            ? t.changedDescription
            : t.stableDescription}
        </p>

        {/* Calibrated Measurements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
            <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
              {t.diameterChange}
            </span>
            {hasMeasurements && diamDelta !== null && diamPercent !== null ? (
              <>
                <span
                  className={`text-lg sm:text-xl font-black mt-1 block ${
                    diamDelta > 0 ? 'text-amber-400' : 'text-slate-200'
                  }`}
                >
                  {diamDelta > 0 ? `+${diamDelta.toFixed(1)}` : diamDelta.toFixed(1)} mm
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block font-medium">
                  ({diamPercent > 0 ? `+${diamPercent}` : diamPercent}%)
                </span>
              </>
            ) : (
              <>
                <span className="text-base sm:text-lg font-bold text-slate-400 mt-1 block">
                  Not measured
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">
                  Requires 2 calibrated visits
                </span>
              </>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
            <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
              {t.areaChange}
            </span>
            {hasAreaMeasurements && areaDeltaPercent !== null ? (
              <>
                <span
                  className={`text-lg sm:text-xl font-black mt-1 block ${
                    areaDeltaPercent > 0 ? 'text-amber-400' : 'text-slate-200'
                  }`}
                >
                  {areaDeltaPercent > 0 ? `+${areaDeltaPercent}` : areaDeltaPercent}%
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block font-medium">
                  Surface Expansion
                </span>
              </>
            ) : (
              <>
                <span className="text-base sm:text-lg font-bold text-slate-400 mt-1 block">
                  Not measured
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">
                  Segmentation pending
                </span>
              </>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
            <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
              {t.colorShift}
            </span>
            {hasColorNorm ? (
              <>
                <span className="text-lg sm:text-xl font-black text-cyan-300 mt-1 block">
                  Calibrated
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block font-medium">
                  Reference patch aligned
                </span>
              </>
            ) : (
              <>
                <span className="text-base sm:text-lg font-bold text-slate-400 mt-1 block">
                  Not measured
                </span>
                <span className="text-xs text-slate-500 mt-0.5 block font-medium">
                  Lighting unnormalized
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
