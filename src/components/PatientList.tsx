import React, { useState } from 'react';
import { Patient, FitzpatrickType, PatientRiskFactors, PatientConsent, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  Shield,
  X,
  Check,
} from 'lucide-react';

interface PatientListProps {
  language: Language;
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onCreatePatient: (newPatient: Patient) => void;
}

const FITZPATRICK_DESCRIPTIONS: Record<FitzpatrickType, string> = {
  I: 'Type I: Pale white, always burns, never tans (very high risk)',
  II: 'Type II: Fair, usually burns, tans with difficulty',
  III: 'Type III: Medium white, sometimes mild burn, tans gradually',
  IV: 'Type IV: Olive / moderate brown, rarely burns, tans easily',
  V: 'Type V: Brown, very rarely burns, tans very easily',
  VI: 'Type VI: Dark brown / black, never burns, deeply pigmented',
};

export const PatientList: React.FC<PatientListProps> = ({
  language,
  patients,
  onSelectPatient,
  onCreatePatient,
}) => {
  const t = getTranslation(language);
  const [searchQuery, setSearchQuery] = useState('');
  const [fitzFilter, setFitzFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states for new patient
  const [name, setName] = useState('');
  const [mrn, setMrn] = useState(`MRN-${Math.floor(10000 + Math.random() * 90000)}`);
  const [dob, setDob] = useState('1985-05-15');
  const [gender, setGender] = useState('Female');
  const [fitzpatrickType, setFitzpatrickType] = useState<FitzpatrickType>('II');
  const [notes, setNotes] = useState('');

  // Risk factors
  const [riskFactors, setRiskFactors] = useState<PatientRiskFactors>({
    familyMelanoma: false,
    personalMelanoma: false,
    moleCount: '50-100',
    blisteringSunburns: false,
    immunosuppressed: false,
    fairSkinEyeColor: true,
  });

  // Consent
  const [consentType, setConsentType] = useState<'digital' | 'written' | 'verbal'>('digital');
  const [consentSigner, setConsentSigner] = useState('');
  const [consentGiven, setConsentGiven] = useState(true);

  // Filtered patients
  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFitz = fitzFilter === 'all' || p.fitzpatrickType === fitzFilter;
    return matchesSearch && matchesFitz;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPatient: Patient = {
      id: 'pat-' + Date.now(),
      mrn: mrn.trim() || `MRN-${Math.floor(10000 + Math.random() * 90000)}`,
      name: name.trim(),
      dateOfBirth: dob,
      gender,
      fitzpatrickType,
      riskFactors,
      consent: {
        given: consentGiven,
        date: new Date().toISOString().split('T')[0],
        type: consentType,
        signerName: consentSigner.trim() || `${name} (Patient)`,
        notes: 'Clinical tele-derm photo documentation authorization documented.',
      },
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreatePatient(newPatient);
    setShowCreateModal(false);

    // Reset form
    setName('');
    setNotes('');
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-5 flex flex-col gap-4.5 animate-fadeIn pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-cyan-400" />
            <span>{t.patientsTitle}</span>
          </h2>
          <p className="text-sm text-slate-300 font-medium mt-1">
            Documented skin lesion records with consent, risk factors &amp; calibrated tracking
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto flex items-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-cyan-900/40 transition-all cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>{t.newPatient}</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPatients}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm sm:text-base text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-slate-300 whitespace-nowrap">Fitzpatrick:</span>
          <select
            value={fitzFilter}
            onChange={(e) => setFitzFilter(e.target.value)}
            aria-label="Fitzpatrick skin type filter"
            className="py-3 px-3 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-medium text-slate-200 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="all">All Types (I-VI)</option>
            <option value="I">Type I</option>
            <option value="II">Type II</option>
            <option value="III">Type III</option>
            <option value="IV">Type IV</option>
            <option value="V">Type V</option>
            <option value="VI">Type VI</option>
          </select>
        </div>
      </div>

      {/* Patient List Cards */}
      <div className="space-y-3">
        {filteredPatients.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
            <p className="text-base font-semibold">{t.noPatientsFound}</p>
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const hasHighRisk =
              patient.riskFactors.personalMelanoma ||
              patient.riskFactors.familyMelanoma ||
              patient.riskFactors.moleCount === '>100';

            return (
              <div
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className="group p-4 sm:p-5 rounded-2xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-between gap-3 shadow-lg"
              >
                <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-base text-cyan-300 shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                    {patient.name.charAt(0)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white truncate">{patient.name}</h3>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {patient.mrn}
                      </span>
                      {hasHighRisk && (
                        <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>High Risk</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-300 mt-1.5 flex-wrap font-medium">
                      <span>DOB: {patient.dateOfBirth}</span>
                      <span>•</span>
                      <span className="text-cyan-400 font-bold">Fitzpatrick {patient.fitzpatrickType}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <FileCheck className="w-4 h-4 text-emerald-400" />
                        <span>Consent: {patient.consent.type}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition shrink-0" />
              </div>
            );
          })
        )}
      </div>

      {/* New Patient Registration Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>{t.newPatient}</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {/* Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Johnathan Doe"
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                    MRN / Patient ID
                  </label>
                  <input
                    type="text"
                    value={mrn}
                    onChange={(e) => setMrn(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-mono text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Fitzpatrick Type Selection */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                  {t.fitzpatrickLabel}
                </label>
                <select
                  value={fitzpatrickType}
                  onChange={(e) => setFitzpatrickType(e.target.value as FitzpatrickType)}
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-cyan-300 font-bold focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="I">{FITZPATRICK_DESCRIPTIONS.I}</option>
                  <option value="II">{FITZPATRICK_DESCRIPTIONS.II}</option>
                  <option value="III">{FITZPATRICK_DESCRIPTIONS.III}</option>
                  <option value="IV">{FITZPATRICK_DESCRIPTIONS.IV}</option>
                  <option value="V">{FITZPATRICK_DESCRIPTIONS.V}</option>
                  <option value="VI">{FITZPATRICK_DESCRIPTIONS.VI}</option>
                </select>
              </div>

              {/* Risk Factors Checklist */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-2.5">
                <span className="block text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                  {t.riskFactorsLabel}
                </span>

                <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={riskFactors.familyMelanoma}
                    onChange={(e) =>
                      setRiskFactors({ ...riskFactors, familyMelanoma: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-800 text-cyan-500"
                  />
                  <span>{t.rfFamilyMelanoma}</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={riskFactors.personalMelanoma}
                    onChange={(e) =>
                      setRiskFactors({ ...riskFactors, personalMelanoma: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-800 text-cyan-500"
                  />
                  <span>{t.rfPersonalMelanoma}</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={riskFactors.blisteringSunburns}
                    onChange={(e) =>
                      setRiskFactors({ ...riskFactors, blisteringSunburns: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-800 text-cyan-500"
                  />
                  <span>{t.rfSunburns}</span>
                </label>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm text-slate-300 pt-2 border-t border-slate-800 gap-2">
                  <span className="font-medium">{t.rfMoleCount}:</span>
                  <select
                    value={riskFactors.moleCount}
                    onChange={(e) =>
                      setRiskFactors({
                        ...riskFactors,
                        moleCount: e.target.value as any,
                      })
                    }
                    className="bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs sm:text-sm text-white"
                  >
                    <option value="<50">&lt; 50</option>
                    <option value="50-100">50 - 100</option>
                    <option value=">100">&gt; 100</option>
                    <option value="atypical">&gt; 100 with Atypical Dysplastic Mole Syndrome</option>
                  </select>
                </div>
              </div>

              {/* Consent Documentation Section */}
              <div className="p-4 rounded-2xl bg-slate-850 border border-slate-800 space-y-3">
                <span className="block text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>{t.consentLabel}</span>
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsentType('digital')}
                    className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold border text-center transition ${
                      consentType === 'digital'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Digital In-App
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsentType('written')}
                    className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold border text-center transition ${
                      consentType === 'written'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Signed Paper
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsentType('verbal')}
                    className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold border text-center transition ${
                      consentType === 'verbal'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Verbal Clinical
                  </button>
                </div>

                <input
                  type="text"
                  value={consentSigner}
                  onChange={(e) => setConsentSigner(e.target.value)}
                  placeholder="Consenting Person Name (defaults to patient)"
                  className="w-full p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500"
                />
              </div>

              {/* Clinical Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                  General Patient Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Telehealth patient in remote region; prior history of sun exposure..."
                  className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-bold text-white shadow-md transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Create Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
