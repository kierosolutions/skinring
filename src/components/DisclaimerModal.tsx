import React from 'react';
import { Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { ShieldAlert, Camera, CheckCircle2, Lock } from 'lucide-react';

interface DisclaimerModalProps {
  language: Language;
  onAccept: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  language,
  onAccept,
}) => {
  const t = getTranslation(language);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 p-6 sm:p-7 shadow-2xl text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header with ring emblem */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border-2 border-rose-500/60 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight">SkinRing</span>
              <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                Notice
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
              Clinical Documentation & Triage Guidance
            </p>
          </div>
        </div>

        {/* Prominent Warning Callout */}
        <div className="mt-5 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-200">
          <h4 className="font-bold text-base flex items-center gap-2 text-rose-300">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{t.disclaimerShort}</span>
          </h4>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-rose-100">
            {t.disclaimerFull}
          </p>
        </div>

        {/* Key Operational Pillars */}
        <div className="mt-4 space-y-3 text-xs sm:text-sm text-slate-300">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-bold text-sm">Calibrated Ring Standardization</strong>
              <span className="text-xs sm:text-sm text-slate-300 leading-relaxed block mt-0.5">
                3D-printed spacer ring provides exact scale (mm/px), lighting standardization with torch control, and orientation alignment.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-850 border border-slate-800">
            <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-bold text-sm">Privacy & Local-First Security</strong>
              <span className="text-xs sm:text-sm text-slate-300 leading-relaxed block mt-0.5">
                Designed following GDPR & HIPAA principles. All patient data, images, and tamper-evident SHA-256 hashes are stored locally in your browser.
              </span>
            </div>
          </div>
        </div>

        {/* Accept Button */}
        <button
          onClick={onAccept}
          className="mt-6 w-full py-4 px-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{t.disclaimerAccept}</span>
        </button>
      </div>
    </div>
  );
};

interface CameraPermissionScreenProps {
  language: Language;
  onGrant: () => void;
  onCancel: () => void;
}

export const CameraPermissionScreen: React.FC<CameraPermissionScreenProps> = ({
  language,
  onGrant,
  onCancel,
}) => {
  const t = getTranslation(language);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 sm:p-7 shadow-2xl text-slate-100 flex flex-col">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
          <Camera className="w-8 h-8 text-cyan-400" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-center text-white">
          {t.cameraNoticeTitle}
        </h3>

        <div className="mt-3.5 p-4 rounded-2xl bg-slate-850 border border-slate-700 text-center">
          <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium">
            &ldquo;{t.cameraNoticeBody}&rdquo;
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-400">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Local capture • Offline capable • No third-party tracking</span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onGrant}
            className="flex-1 py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            <span>{t.cameraNoticeButton}</span>
          </button>
          <button
            onClick={onCancel}
            className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
