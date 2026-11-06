import React from 'react';
import { Patient, Lesion, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  User,
  ArrowLeft,
  Camera,
  MapPin,
  Grid,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface PatientDetailProps {
  language: Language;
  patient: Patient;
  lesions: Lesion[];
  onBack: () => void;
  onSelectLesion: (lesion: Lesion) => void;
  onStartCapture: () => void;
  onOpenBodyMap: () => void;
  onOpenUglyDuckling: () => void;
  onAddNewLesion: () => void;
}

export const PatientDetail: React.FC<PatientDetailProps> = ({
  language,
  patient,
  lesions,
  onBack,
  onSelectLesion,
  onStartCapture,
  onOpenBodyMap,
  onOpenUglyDuckling,
  onAddNewLesion,
}) => {
  const t = getTranslation(language);

  const hasHighRisk =
    patient.riskFactors.personalMelanoma ||
    patient.riskFactors.familyMelanoma ||
    patient.riskFactors.moleCount === '>100';

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-5 flex flex-col gap-4.5 animate-fadeIn pb-24">
      {/* Top back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Patient Directory</span>
        </button>

        <span className="text-xs sm:text-sm font-mono font-bold text-cyan-300 bg-cyan-950 border border-cyan-800 px-3 py-1 rounded-full">
          {patient.mrn}
        </span>
      </div>

      {/* Patient Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-cyan-900/40">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">{patient.name}</h1>
                {hasHighRisk && (
                  <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>High Melanoma Risk</span>
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-300 mt-1">
                DOB: {patient.dateOfBirth} • Gender: {patient.gender}
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Parameters Grid */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-xs uppercase font-bold text-slate-400 block">
              Fitzpatrick Type
            </span>
            <span className="text-sm sm:text-base text-cyan-300 font-extrabold mt-1 block">
              Type {patient.fitzpatrickType}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
            <span className="text-xs uppercase font-bold text-slate-400 block">
              Total Moles
            </span>
            <span className="text-sm sm:text-base text-slate-100 font-bold mt-1 block">
              {patient.riskFactors.moleCount}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 col-span-2 sm:col-span-1">
            <span className="text-xs uppercase font-bold text-slate-400 block">
              Consent Documented
            </span>
            <span className="text-sm text-emerald-400 font-bold mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>{patient.consent.type} ({patient.consent.date})</span>
            </span>
          </div>
        </div>

        {patient.notes && (
          <p className="mt-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed italic bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
            &ldquo;{patient.notes}&rdquo;
          </p>
        )}

        {/* Quick Action Clinical Buttons */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <button
            onClick={onStartCapture}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-500 hover:brightness-110 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-900/40 transition-all cursor-pointer"
          >
            <Camera className="w-5 h-5 mb-1.5" />
            <span>Ring Capture</span>
          </button>

          <button
            onClick={onOpenBodyMap}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-100 font-bold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer"
          >
            <MapPin className="w-5 h-5 text-cyan-400 mb-1.5" />
            <span>Body Map</span>
          </button>

          <button
            onClick={onOpenUglyDuckling}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-100 font-bold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer"
          >
            <Grid className="w-5 h-5 text-amber-400 mb-1.5" />
            <span>Ugly Duckling</span>
          </button>
        </div>
      </div>

      {/* Lesions Section Header */}
      <div className="flex items-center justify-between mt-2">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>{t.lesionsTitle} ({lesions.length})</span>
          </h2>
        </div>

        <button
          onClick={onAddNewLesion}
          className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs sm:text-sm font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addLesion}</span>
        </button>
      </div>

      {/* Lesions List */}
      <div className="space-y-3">
        {lesions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
            <p className="text-base font-semibold text-slate-300">No lesions documented yet for this patient.</p>
            <p className="text-sm text-slate-400 mt-1">Tap &quot;Ring Capture&quot; or place a marker on the Body Map.</p>
          </div>
        ) : (
          lesions.map((lesion) => {
            const isHighScore = lesion.argenziano7.score >= 4 || lesion.abcde.score >= 4;
            const isModerate = lesion.argenziano7.score >= 2 || lesion.abcde.score >= 2;

            return (
              <div
                key={lesion.id}
                onClick={() => onSelectLesion(lesion)}
                className="p-4 sm:p-5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-between gap-3 shadow-md group"
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-base border shrink-0 ${
                    isHighScore
                      ? 'bg-rose-950 border-rose-700 text-rose-300'
                      : isModerate
                      ? 'bg-amber-950 border-amber-700 text-amber-300'
                      : 'bg-emerald-950 border-emerald-700 text-emerald-300'
                  }`}>
                    #{lesion.number}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-400 transition truncate">
                        {lesion.name}
                      </h4>
                      <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {lesion.bodyLocation.view} View
                      </span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-300 mt-1.5 flex-wrap font-medium">
                      <span>Site: {lesion.bodyLocation.region}</span>
                      <span>•</span>
                      <span className="font-bold text-white">ABCDE: {lesion.abcde.score}/5</span>
                      <span>•</span>
                      <span className="font-bold text-white">7-Point: {lesion.argenziano7.score} pts</span>
                    </div>

                    {lesion.nextFollowUpDate && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-cyan-400 font-semibold mt-1">
                        <Calendar className="w-4 h-4" />
                        <span>Next Follow-up: {lesion.nextFollowUpDate}</span>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
