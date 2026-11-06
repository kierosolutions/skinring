import React, { useState, useEffect } from 'react';
import { Patient, Lesion, LesionPhoto, AIAnalysisResult, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  Check,
  Loader2,
  Activity,
  Layers,
} from 'lucide-react';

interface AIAnalysisModalProps {
  language: Language;
  patient: Patient;
  lesion: Lesion;
  currentPhoto: LesionPhoto;
  baselinePhoto?: LesionPhoto;
  onSaveAnalysis: (analysis: AIAnalysisResult) => void;
  onClose: () => void;
}

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  language,
  patient,
  lesion,
  currentPhoto,
  baselinePhoto,
  onSaveAnalysis,
  onClose,
}) => {
  const t = getTranslation(language);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(
    currentPhoto.aiAnalysis || null
  );

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        currentImage: currentPhoto.imageData,
        baselineImage: baselinePhoto?.imageData,
        lesionContext: {
          anatomicalLocation: `${lesion.bodyLocation.region} (${lesion.bodyLocation.view})`,
          diameterMm: currentPhoto.diameterMmEstimate || undefined,
          measuredAreaMm2: currentPhoto.measuredAreaMm2 || undefined,
          borderIrregularity: currentPhoto.borderIrregularityScore || undefined,
          mmPerPixel: currentPhoto.mmPerPixel || undefined,
          ringDiameterMm: currentPhoto.ringDiameterMm,
          fitzpatrickType: patient.fitzpatrickType,
          riskFactors: patient.riskFactors,
          abcde: lesion.abcde,
        },
        language,
      };

      let response: Response;
      try {
        response = await fetch('/api/analyze-lesion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (netErr: any) {
        throw new Error('AI analysis not available – no result');
      }

      if (!response.ok || response.status === 503) {
        throw new Error('AI analysis not available – no result');
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI analysis not available – no result');
      }

      const data = await response.json();

      if (!data.success || !data.analysis) {
        throw new Error('AI analysis not available – no result');
      }

      const result: AIAnalysisResult = {
        id: 'ai-' + Date.now(),
        timestamp: new Date().toISOString(),
        riskLevel: data.analysis.riskLevel,
        confidence: data.analysis.confidence,
        observedFeatures: data.analysis.observedFeatures,
        plainLanguageExplanation: data.analysis.plainLanguageExplanation,
        clinicalConsiderations: data.analysis.clinicalConsiderations,
        recommendedFollowUpMonths: data.analysis.recommendedFollowUpMonths || 3,
        disclaimer:
          data.analysis.disclaimer ||
          'SkinRing is a documentation and triage-support tool, NOT a diagnostic device. Final evaluation rests with a qualified healthcare provider.',
      };
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('AI analysis error:', err);
      setAnalysisResult(null);
      setError('AI analysis not available – no result');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If photo already had an analysis, show it; otherwise run automatically
    if (!analysisResult) {
      runAnalysis();
    }
  }, []);

  const handleSave = () => {
    if (analysisResult) {
      onSaveAnalysis(analysisResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Claude Opus 5.5 Vision Triage</span>
              </h3>
              <p className="text-xs text-slate-300">
                Lesion #{lesion.number} ({lesion.name}) • {baselinePhoto ? 'Comparative Analysis (Baseline + Current)' : 'Single Visit Morphology'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mandatory Non-Diagnostic Disclaimer Banner (Always shown!) */}
        <div className="mt-3.5 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs sm:text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-rose-300 block font-bold text-sm">
              {t.disclaimerShort}
            </strong>
            <span className="text-xs leading-relaxed text-rose-100/90 block mt-1">
              This AI analysis provides morphological triage guidance only. It does NOT provide a diagnosis and never replaces physician assessment, in-person dermoscopy, or biopsy.
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <Sparkles className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
              </div>
              <h4 className="text-sm font-bold text-white mt-2">
                Analyzing Calibrated Lesion Morphology...
              </h4>
              <p className="text-xs text-slate-400 max-w-xs">
                Scanning asymmetry, border irregularity, color distribution, and ring calibration scale.
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">AI analysis not available – no result</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                AI evaluation is currently unavailable. No risk level, score, or text generated.
              </p>
              <button
                onClick={runAnalysis}
                className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-md transition"
              >
                Retry Analysis
              </button>
            </div>
          ) : analysisResult ? (
            /* Analysis Results Card */
            <div className="space-y-4">
              {/* Risk Level & Confidence Card */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
                    Assigned Triage Category
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`text-sm sm:text-base font-black uppercase px-3.5 py-1.5 rounded-full ${
                        analysisResult.riskLevel === 'urgent review'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : analysisResult.riskLevel === 'review'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {analysisResult.riskLevel}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
                    Confidence
                  </span>
                  <span className="text-xl sm:text-2xl font-mono font-bold text-cyan-400 mt-1 block">
                    {analysisResult.confidence}%
                  </span>
                </div>
              </div>

              {/* Observed Features Table */}
              <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider block border-b border-slate-800 pb-2">
                  {t.observedFeaturesHeader}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-400 block font-medium">Asymmetry:</span>
                    <span className="text-slate-200">{analysisResult.observedFeatures.asymmetry}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Border Contours:</span>
                    <span className="text-slate-200">{analysisResult.observedFeatures.borderIrregularity}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Color Variation:</span>
                    <span className="text-slate-200">{analysisResult.observedFeatures.colorVariation}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Diameter Estimate:</span>
                    <span className="text-slate-200 font-mono font-semibold">
                      ~{analysisResult.observedFeatures.diameterEstimateMm} mm
                    </span>
                  </div>
                </div>

                {baselinePhoto && (
                  <div className="pt-2.5 border-t border-slate-800 text-xs sm:text-sm">
                    <span className="text-cyan-400 font-medium block">Evolution vs Baseline:</span>
                    <span className="text-slate-200">
                      {analysisResult.observedFeatures.changeSinceLastVisit}
                    </span>
                  </div>
                )}
              </div>

              {/* Plain Language Explanation */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1.5">
                <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider block">
                  {t.plainLanguageHeader}
                </span>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {analysisResult.plainLanguageExplanation}
                </p>
              </div>

              {/* Actionable Clinical Considerations */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-1.5">
                <span className="text-xs sm:text-sm font-bold text-cyan-400 uppercase tracking-wider block">
                  {t.clinicalConsiderationsHeader}
                </span>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {analysisResult.clinicalConsiderations}
                </p>
              </div>

              {/* Follow-up Plan Recommendation */}
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-cyan-400 shrink-0" />
                  <span className="font-semibold text-white">Suggested Follow-Up Window</span>
                </div>
                <span className="text-base font-black text-cyan-300">
                  {analysisResult.recommendedFollowUpMonths} Months
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition"
          >
            Close
          </button>
          {analysisResult && (
            <button
              onClick={handleSave}
              className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold text-white shadow-md transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{t.saveAnalysis}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
