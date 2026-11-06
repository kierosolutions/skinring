import React, { useState } from 'react';
import { Patient, Lesion, LesionPhoto, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { Grid, Eye, AlertTriangle, ShieldCheck, User, Info, Sparkles } from 'lucide-react';

interface UglyDucklingViewProps {
  language: Language;
  patients: Patient[];
  activePatient?: Patient | null;
  onSelectPatient: (patient: Patient) => void;
  onSelectLesion: (lesion: Lesion) => void;
  getPhotosForLesion: (lesionId: string) => LesionPhoto[];
}

export const UglyDucklingView: React.FC<UglyDucklingViewProps> = ({
  language,
  patients,
  activePatient,
  onSelectPatient,
  onSelectLesion,
  getPhotosForLesion,
}) => {
  const t = getTranslation(language);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    activePatient?.id || patients[0]?.id || ''
  );
  const [flaggedOutlierId, setFlaggedOutlierId] = useState<string | null>(null);

  const currentPatient =
    patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-5 flex flex-col gap-4 animate-fadeIn pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Grid className="w-5 h-5 text-amber-400" />
            <span>{t.uglyDucklingTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {t.uglyDucklingSubtitle}
          </p>
        </div>

        {/* Patient Picker */}
        <div className="flex items-center gap-2.5">
          <User className="w-4 h-4 text-cyan-400 shrink-0" />
          <select
            value={selectedPatientId}
            onChange={(e) => {
              setSelectedPatientId(e.target.value);
              const p = patients.find((pat) => pat.id === e.target.value);
              if (p) onSelectPatient(p);
            }}
            className="py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500 font-medium"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.mrn})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clinical Guidance Box */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-300 flex items-start gap-3 shadow-lg">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">The Ugly Duckling Sign:</strong> Most benign nevi in an individual share a similar morphological pattern (color distribution, border style). A melanocytic lesion that looks fundamentally distinct or &ldquo;out of place&rdquo; from the patient&apos;s background phenotype warrants elevated clinical suspicion.
        </p>
      </div>

      {/* Patient's Lesion Matrix Grid */}
      {!currentPatient ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-3xl border border-slate-800">
          No patients available.
        </div>
      ) : (
        <PatientMatrixContent
          patient={currentPatient}
          flaggedOutlierId={flaggedOutlierId}
          onToggleFlagOutlier={(id) =>
            setFlaggedOutlierId(flaggedOutlierId === id ? null : id)
          }
          onSelectLesion={onSelectLesion}
          getPhotosForLesion={getPhotosForLesion}
        />
      )}
    </div>
  );
};

interface PatientMatrixContentProps {
  patient: Patient;
  flaggedOutlierId: string | null;
  onToggleFlagOutlier: (id: string) => void;
  onSelectLesion: (lesion: Lesion) => void;
  getPhotosForLesion: (lesionId: string) => LesionPhoto[];
}

const PatientMatrixContent: React.FC<PatientMatrixContentProps> = ({
  patient,
  flaggedOutlierId,
  onToggleFlagOutlier,
  onSelectLesion,
  getPhotosForLesion,
}) => {
  // Let's retrieve lesions for this patient
  const [lesions, setLesions] = useState<Lesion[]>([]);

  React.useEffect(() => {
    import('../db/index').then(({ getLesionsByPatient }) => {
      getLesionsByPatient(patient.id).then((res) => setLesions(res));
    });
  }, [patient.id]);

  if (lesions.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 text-slate-400">
        <p className="text-sm font-medium">No lesions documented for {patient.name} yet.</p>
        <p className="text-xs text-slate-500 mt-1">Capture photos with the 3D ring to build the patient matrix.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400">
        <span>{lesions.length} Documented Lesions for Comparison</span>
        <span>Tap &quot;Flag Outlier&quot; to highlight suspect lesion</span>
      </div>

      {/* Grid of Lesions Side by Side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {lesions.map((lesion) => {
          const photos = getPhotosForLesion(lesion.id);
          const latestPhoto = photos[photos.length - 1];
          const isFlagged = flaggedOutlierId === lesion.id;
          const isHighScore = lesion.argenziano7.score >= 4 || lesion.abcde.score >= 4;

          return (
            <div
              key={lesion.id}
              className={`rounded-3xl overflow-hidden bg-slate-900 border transition-all shadow-xl flex flex-col ${
                isFlagged
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : isHighScore
                  ? 'border-rose-700/60'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Photo Viewport */}
              <div className="relative aspect-square bg-black overflow-hidden">
                {latestPhoto ? (
                  <img
                    src={latestPhoto.imageData}
                    alt={lesion.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                    No image
                  </div>
                )}

                {/* Number Badge */}
                <div className="absolute top-2.5 left-2.5">
                  <span className="w-8 h-8 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white font-black text-sm flex items-center justify-center shadow-lg">
                    #{lesion.number}
                  </span>
                </div>

                {/* Flagged Outlier Banner */}
                {isFlagged && (
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Outlier</span>
                  </div>
                )}

                {/* Calibrated Ring Scale Watermark */}
                {latestPhoto?.ringDetected && (
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-slate-900/85 backdrop-blur-md text-xs text-cyan-300 font-mono font-medium">
                    {latestPhoto.ringDiameterMm}mm Ring ({latestPhoto.diameterMmEstimate ? `${latestPhoto.diameterMmEstimate.toFixed(1)}mm` : 'Scale'})
                  </div>
                )}
              </div>

              {/* Lesion Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                <div>
                  <h4 className="text-base font-bold text-white truncate">{lesion.name}</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {lesion.bodyLocation.region} ({lesion.bodyLocation.view})
                  </p>

                  <div className="mt-2.5 flex items-center gap-2 text-xs sm:text-sm">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold">
                      ABCDE: {lesion.abcde.score}/5
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        lesion.argenziano7.score >= 3
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      7-Point: {lesion.argenziano7.score} pts
                    </span>
                  </div>
                </div>

                {/* Outlier Toggle & Open Buttons */}
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    onClick={() => onToggleFlagOutlier(lesion.id)}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition border ${
                      isFlagged
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
                    }`}
                  >
                    {isFlagged ? 'Outlier Flagged' : 'Flag Outlier'}
                  </button>

                  <button
                    onClick={() => onSelectLesion(lesion)}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700"
                    title="Open Timeline"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
