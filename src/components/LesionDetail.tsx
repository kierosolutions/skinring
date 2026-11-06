import React, { useState } from 'react';
import { Patient, Lesion, LesionPhoto, AppSettings, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { formatShortHash } from '../utils/crypto';
import { generateClinicalPdfReport } from '../utils/pdfGenerator';
import {
  ArrowLeft,
  Camera,
  Split,
  FileText,
  Sparkles,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ChevronRight,
  Download,
  Info,
} from 'lucide-react';

interface LesionDetailProps {
  language: Language;
  patient: Patient;
  lesion: Lesion;
  photos: LesionPhoto[];
  settings: AppSettings;
  onBack: () => void;
  onAddPhoto: () => void;
  onOpenComparison: () => void;
  onOpenChecklists: () => void;
  onOpenAIAnalysis: (currentPhoto: LesionPhoto, baselinePhoto?: LesionPhoto) => void;
}

export const LesionDetail: React.FC<LesionDetailProps> = ({
  language,
  patient,
  lesion,
  photos,
  settings,
  onBack,
  onAddPhoto,
  onOpenComparison,
  onOpenChecklists,
  onOpenAIAnalysis,
}) => {
  const t = getTranslation(language);
  const [selectedPhoto, setSelectedPhoto] = useState<LesionPhoto | null>(photos[photos.length - 1] || null);

  const baselinePhoto = photos.length > 1 ? photos[0] : undefined;
  const latestPhoto = photos[photos.length - 1];

  const handleExportPdf = () => {
    generateClinicalPdfReport(patient, lesion, photos, settings);
  };

  const handleTriggerAI = () => {
    if (!latestPhoto) return;
    onOpenAIAnalysis(latestPhoto, baselinePhoto);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-5 flex flex-col gap-4.5 animate-fadeIn pb-24">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {patient.name}</span>
        </button>

        <span className="text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
          Lesion #{lesion.number}
        </span>
      </div>

      {/* Lesion Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white">{lesion.name}</h1>
              <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {lesion.status}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-300 mt-1">
              Site: {lesion.bodyLocation.region} ({lesion.bodyLocation.view.toUpperCase()} View) • Documented since{' '}
              {new Date(lesion.createdAt).toLocaleDateString()}
            </p>
          </div>

          <button
            onClick={onAddPhoto}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-cyan-900/40 transition-all shrink-0 cursor-pointer"
          >
            <Camera className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">Add Visit Photo</span>
            <span className="sm:hidden">Photo</span>
          </button>
        </div>

        {/* Clinical Summary Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-xs uppercase font-bold text-slate-400 block">ABCDE Score</span>
            <span className="text-base sm:text-lg font-black text-white mt-1 block">{lesion.abcde.score} / 5</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-xs uppercase font-bold text-slate-400 block">7-Point Dermoscopy</span>
            <span className={`text-base sm:text-lg font-black mt-1 block ${
              lesion.argenziano7.score >= 3 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {lesion.argenziano7.score} pts {lesion.argenziano7.score >= 3 ? '(Flagged)' : ''}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-xs uppercase font-bold text-slate-400 block">Photos on File</span>
            <span className="text-base sm:text-lg font-black text-white mt-1 block">{photos.length} Visits</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-xs uppercase font-bold text-slate-400 block">Next Follow-Up</span>
            <span className="text-sm font-bold text-cyan-300 mt-1 block truncate">
              {lesion.nextFollowUpDate || 'Routine'}
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {photos.length >= 2 ? (
            <button
              onClick={onOpenComparison}
              className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs sm:text-sm font-bold border border-slate-700 transition cursor-pointer"
            >
              <Split className="w-4.5 h-4.5 text-cyan-400" />
              <span>{t.compareVisits}</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 p-3 rounded-2xl bg-slate-800/40 text-slate-500 text-xs sm:text-sm border border-slate-800 cursor-not-allowed">
              <Split className="w-4 h-4" />
              <span>Need 2 Photos</span>
            </div>
          )}

          <button
            onClick={onOpenChecklists}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs sm:text-sm font-bold border border-slate-700 transition cursor-pointer"
          >
            <FileText className="w-4.5 h-4.5 text-sky-400" />
            <span>Checklists</span>
          </button>

          <button
            onClick={handleTriggerAI}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 hover:brightness-110 text-white text-xs sm:text-sm font-bold shadow-md shadow-cyan-900/40 transition cursor-pointer"
          >
            <Sparkles className="w-4.5 h-4.5" />
            <span>AI Triage</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-100 text-xs sm:text-sm font-bold border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-4.5 h-4.5 text-emerald-400" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Latest AI Triage Card (if available) */}
      {latestPhoto?.aiAnalysis && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Gemini AI Morphological Triage</span>
                  <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                    latestPhoto.aiAnalysis.riskLevel === 'urgent review'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : latestPhoto.aiAnalysis.riskLevel === 'review'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {latestPhoto.aiAnalysis.riskLevel}
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Confidence: {latestPhoto.aiAnalysis.confidence}% • Analyzed {new Date(latestPhoto.aiAnalysis.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Mandatory Non-Diagnostic Notice */}
          <div className="mt-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-snug">{latestPhoto.aiAnalysis.disclaimer}</p>
          </div>

          <div className="mt-3 space-y-2 text-xs text-slate-200">
            <p>
              <strong className="text-white">Explanation:</strong> {latestPhoto.aiAnalysis.plainLanguageExplanation}
            </p>
            <p>
              <strong className="text-white">Clinical Note:</strong> {latestPhoto.aiAnalysis.clinicalConsiderations}
            </p>
            <div className="flex items-center gap-2 text-cyan-300 font-semibold pt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Recommended Follow-up: {latestPhoto.aiAnalysis.recommendedFollowUpMonths} Months</span>
            </div>
          </div>
        </div>
      )}

      {/* Photo Timeline Section */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>{t.lesionTimeline}</span>
        </h2>

        <div className="space-y-4">
          {photos.map((photo, index) => {
            const isBaseline = index === 0 && photos.length > 1;
            const isLatest = index === photos.length - 1;

            return (
              <div
                key={photo.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col sm:flex-row gap-4"
              >
                {/* Photo Thumbnail / Full preview */}
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-square w-full sm:w-44 shrink-0 border border-slate-800 shadow-inner">
                  <img
                    src={photo.imageData}
                    alt="Dermoscopic visit capture"
                    className="w-full h-full object-cover"
                  />
                  {/* Badge */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {photo.isDemo && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/95 text-slate-950 text-[10px] font-black tracking-wide shadow-md">
                        Demo
                      </span>
                    )}
                    {isLatest ? (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-600/90 text-white text-[10px] font-bold shadow-md">
                        Latest
                      </span>
                    ) : isBaseline ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 text-[10px] font-bold border border-slate-700">
                        Baseline
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Photo Metadata Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm sm:text-base font-bold text-white">
                        Visit {index + 1}: {new Date(photo.timestamp).toLocaleDateString()} at{' '}
                        {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-300 font-medium">By: {photo.capturedBy}</span>
                    </div>

                    {/* Calibrated Badges */}
                    <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                      {photo.ringDetected ? (
                        <span className="px-2.5 py-1 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold">
                          Ring: {photo.ringDiameterMm}mm Calibrated ({photo.mmPerPixel?.toFixed(3)} mm/px)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                          Uncalibrated Fallback
                        </span>
                      )}

                      <span className={`px-2.5 py-1 rounded-xl font-bold border ${
                        photo.torchOn
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        Torch: {photo.torchOn ? 'ON' : 'OFF'}
                      </span>

                      {typeof photo.diameterMmEstimate === 'number' && photo.diameterMmEstimate > 0 ? (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-100 font-bold border border-slate-700">
                          Measured Diam: {photo.diameterMmEstimate.toFixed(1)} mm
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800/60 text-slate-400 border border-slate-700 font-medium">
                          Diam: Not measured
                        </span>
                      )}

                      {typeof photo.measuredAreaMm2 === 'number' && photo.measuredAreaMm2 > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-100 font-bold border border-slate-700">
                          Area: {photo.measuredAreaMm2.toFixed(1)} mm²
                        </span>
                      )}

                      {typeof photo.borderIrregularityScore === 'number' && (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-100 font-bold border border-slate-700">
                          Border Irreg: {photo.borderIrregularityScore.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* SHA-256 Tamper-Proof Badge */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-400 pt-1">
                      <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
                      <span className="font-bold">{t.verifiedHash}:</span>
                      <span className="font-mono text-xs text-slate-300 font-medium">
                        {formatShortHash(photo.sha256)}
                      </span>
                    </div>

                    {photo.notes && (
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic pt-1">
                        &ldquo;{photo.notes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
