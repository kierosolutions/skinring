import React, { useState } from 'react';
import { Lesion, ABCDEData, Argenziano7Data, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { FileText, CheckCircle2, AlertTriangle, ShieldCheck, X, Check } from 'lucide-react';

interface ChecklistsModalProps {
  language: Language;
  lesion: Lesion;
  onSave: (abcde: ABCDEData, argenziano7: Argenziano7Data) => void;
  onClose: () => void;
}

export const ChecklistsModal: React.FC<ChecklistsModalProps> = ({
  language,
  lesion,
  onSave,
  onClose,
}) => {
  const t = getTranslation(language);

  const [activeTab, setActiveTab] = useState<'abcde' | 'argenziano'>('abcde');

  // ABCDE State
  const [abcde, setAbcde] = useState<ABCDEData>({ ...lesion.abcde });

  // Argenziano State
  const [argenziano, setArgenziano] = useState<Argenziano7Data>({ ...lesion.argenziano7 });

  // Update ABCDE score dynamically
  const toggleAbcde = (key: keyof Omit<ABCDEData, 'score' | 'notes'>) => {
    const updated = { ...abcde, [key]: !abcde[key] };
    let score = 0;
    if (updated.asymmetry) score++;
    if (updated.borderIrregularity) score++;
    if (updated.colorVariegation) score++;
    if (updated.diameterOver6mm) score++;
    if (updated.evolution) score++;
    updated.score = score;
    setAbcde(updated);
  };

  // Update Argenziano score dynamically
  const toggleArgenziano = (key: keyof Omit<Argenziano7Data, 'score'>) => {
    const updated = { ...argenziano, [key]: !argenziano[key] };
    let score = 0;
    // Major (2 pts)
    if (updated.atypicalNetwork) score += 2;
    if (updated.blueWhiteVeil) score += 2;
    if (updated.atypicalVascular) score += 2;
    // Minor (1 pt)
    if (updated.irregularStreaks) score += 1;
    if (updated.irregularPigmentation) score += 1;
    if (updated.irregularDotsGlobules) score += 1;
    if (updated.regressionStructures) score += 1;
    updated.score = score;
    setArgenziano(updated);
  };

  const handleSave = () => {
    onSave(abcde, argenziano);
    onClose();
  };

  const isArgenzianoHigh = argenziano.score >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base sm:text-lg font-bold text-white">
              Clinical Checklists — Lesion #{lesion.number}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex mt-4 bg-slate-800 p-1.5 rounded-2xl text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('abcde')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'abcde'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>ABCDE Form</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 text-cyan-300 font-bold">
              {abcde.score}/5
            </span>
          </button>

          <button
            onClick={() => setActiveTab('argenziano')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
              activeTab === 'argenziano'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>7-Point Score</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isArgenzianoHigh
                  ? 'bg-rose-950 text-rose-300'
                  : 'bg-slate-900 text-slate-300'
              }`}
            >
              {argenziano.score} pts
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {activeTab === 'abcde' ? (
            /* ABCDE Form */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-850 border border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">Total ABCDE Score</span>
                <span className="text-base sm:text-lg font-black text-cyan-400">{abcde.score} / 5 Criteria</span>
              </div>

              {/* Criteria toggles */}
              <div className="space-y-2.5">
                <label
                  onClick={() => toggleAbcde('asymmetry')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    abcde.asymmetry
                      ? 'bg-cyan-950/40 border-cyan-500 text-white'
                      : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={abcde.asymmetry}
                    readOnly
                    className="mt-1 w-4 h-4 rounded bg-slate-800 text-cyan-500 shrink-0"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">A - Asymmetry</strong>
                    <span className="text-xs text-slate-300">
                      One half does not match the other half across orthogonal axes.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => toggleAbcde('borderIrregularity')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    abcde.borderIrregularity
                      ? 'bg-cyan-950/40 border-cyan-500 text-white'
                      : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={abcde.borderIrregularity}
                    readOnly
                    className="mt-1 w-4 h-4 rounded bg-slate-800 text-cyan-500 shrink-0"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">B - Border Irregularity</strong>
                    <span className="text-xs text-slate-300">
                      Edges are ragged, notched, scalloped, blurred, or poorly circumscribed.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => toggleAbcde('colorVariegation')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    abcde.colorVariegation
                      ? 'bg-cyan-950/40 border-cyan-500 text-white'
                      : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={abcde.colorVariegation}
                    readOnly
                    className="mt-1 w-4 h-4 rounded bg-slate-800 text-cyan-500 shrink-0"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">C - Color Variegation</strong>
                    <span className="text-xs text-slate-300">
                      Color is not uniform: multiple shades of tan, dark brown, black, red, or white.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => toggleAbcde('diameterOver6mm')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    abcde.diameterOver6mm
                      ? 'bg-cyan-950/40 border-cyan-500 text-white'
                      : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={abcde.diameterOver6mm}
                    readOnly
                    className="mt-1 w-4 h-4 rounded bg-slate-800 text-cyan-500 shrink-0"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">D - Diameter &gt; 6mm</strong>
                    <span className="text-xs text-slate-300">
                      Calibrated diameter exceeds 6.0 mm (or noticeable expansion).
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => toggleAbcde('evolution')}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    abcde.evolution
                      ? 'bg-cyan-950/40 border-cyan-500 text-white'
                      : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={abcde.evolution}
                    readOnly
                    className="mt-1 w-4 h-4 rounded bg-slate-800 text-cyan-500 shrink-0"
                  />
                  <div>
                    <strong className="block text-sm font-bold text-white">E - Evolution / Change</strong>
                    <span className="text-xs text-slate-300">
                      Patient or calibrated images show active morphologic change or symptoms (itching, bleeding).
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-1.5">
                  Provider Notes on ABCDE
                </label>
                <textarea
                  rows={2}
                  value={abcde.notes}
                  onChange={(e) => setAbcde({ ...abcde, notes: e.target.value })}
                  placeholder="Clinical remarks on morphology..."
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>
            </div>
          ) : (
            /* Argenziano 7-Point Dermoscopy Checklist */
            <div className="space-y-4">
              {/* Score Callout */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isArgenzianoHigh
                    ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                    : 'bg-slate-850 border-slate-800 text-slate-200'
                }`}
              >
                <div>
                  <span className="text-sm font-bold block">
                    {t.scoreSummary.replace('{score}', argenziano.score.toString())}
                  </span>
                  <p className="text-xs mt-1 text-slate-300">
                    {isArgenzianoHigh ? t.scoreInterpretationHigh : t.scoreInterpretationLow}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${
                    isArgenzianoHigh ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {argenziano.score}
                </div>
              </div>

              {/* Major Criteria (2 pts each) */}
              <div>
                <span className="block text-xs sm:text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  {t.majorCriteria}
                </span>

                <div className="space-y-2">
                  <label
                    onClick={() => toggleArgenziano('atypicalNetwork')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.atypicalNetwork
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.atypicalNetwork}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300">
                      +2 pts
                    </span>
                  </label>

                  <label
                    onClick={() => toggleArgenziano('blueWhiteVeil')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.blueWhiteVeil
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.blueWhiteVeil}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300">
                      +2 pts
                    </span>
                  </label>

                  <label
                    onClick={() => toggleArgenziano('atypicalVascular')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.atypicalVascular
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.atypicalVascular}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300">
                      +2 pts
                    </span>
                  </label>
                </div>
              </div>

              {/* Minor Criteria (1 pt each) */}
              <div>
                <span className="block text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {t.minorCriteria}
                </span>

                <div className="space-y-2">
                  <label
                    onClick={() => toggleArgenziano('irregularStreaks')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.irregularStreaks
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.irregularStreaks}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                      +1 pt
                    </span>
                  </label>

                  <label
                    onClick={() => toggleArgenziano('irregularPigmentation')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.irregularPigmentation
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.irregularPigment}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                      +1 pt
                    </span>
                  </label>

                  <label
                    onClick={() => toggleArgenziano('irregularDotsGlobules')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.irregularDotsGlobules
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.irregularDots}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                      +1 pt
                    </span>
                  </label>

                  <label
                    onClick={() => toggleArgenziano('regressionStructures')}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm cursor-pointer select-none transition ${
                      argenziano.regressionStructures
                        ? 'bg-cyan-950/40 border-cyan-500 text-white font-medium'
                        : 'bg-slate-850 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{t.regressionStructures}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                      +1 pt
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-slate-800 flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold text-white shadow-md transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Checklist</span>
          </button>
        </div>
      </div>
    </div>
  );
};
