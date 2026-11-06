import React, { useState } from 'react';
import { AppSettings, RingSettings, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  Settings,
  Sliders,
  Camera,
  Globe,
  Moon,
  Lock,
  Download,
  Upload,
  RefreshCw,
  Building,
  Check,
  Shield,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';

interface SettingsViewProps {
  language: Language;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetDemoData: () => void;
  onClose?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  settings,
  onUpdateSettings,
  onResetDemoData,
  onClose,
}) => {
  const t = getTranslation(language);

  const [ringInnerDiameter, setRingInnerDiameter] = useState<number>(
    settings.ringSettings.ringInnerDiameterMm || 30
  );
  const [armLength, setArmLength] = useState<number>(
    settings.ringSettings.armLengthMm || 35
  );
  const [phoneLensPreset, setPhoneLensPreset] = useState<'normal' | 'macro' | 'ultra-wide'>(
    settings.ringSettings.phoneLensPreset || 'normal'
  );
  const [autoCapture, setAutoCapture] = useState<boolean>(
    settings.ringSettings.autoCapture
  );

  const [userName, setUserName] = useState<string>(
    settings.userProfile?.name || settings.providerName?.split(',')[0] || ''
  );
  const [userRole, setUserRole] = useState<string>(
    settings.userProfile?.role || ''
  );
  const [clinicName, setClinicName] = useState<string>(settings.clinicName || 'Rural Health & Tele-Derm Network');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleSave = () => {
    const updatedRing: RingSettings = {
      ...settings.ringSettings,
      ringInnerDiameterMm: ringInnerDiameter,
      armLengthMm: armLength,
      phoneLensPreset,
      autoCapture,
    };

    const userProfile = {
      name: userName.trim(),
      role: userRole.trim(),
    };

    onUpdateSettings({
      ...settings,
      providerName: userProfile.name ? (userProfile.role ? `${userProfile.name}, ${userProfile.role}` : userProfile.name) : '',
      clinicName,
      userProfile,
      ringSettings: updatedRing,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleExportData = async () => {
    const { getPatients, getAllLesions, getDb } = await import('../db/index');
    const patients = await getPatients();
    const lesions = await getAllLesions();
    const db = await getDb();
    const photos = await db.getAll('photos');

    const exportBundle = {
      app: 'SkinRing',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      encryptionStandard: 'AES-GCM / SHA-256 Verified',
      patients,
      lesions,
      photos,
      settings,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SkinRing_Encrypted_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-5 flex flex-col gap-4 animate-fadeIn pb-24">
      {/* Top Back Navigation if opened from header */}
      {onClose && (
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-white py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <span>{t.settingsTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Hardware spacer specifications, clinic identity, and local privacy management
        </p>
      </div>

      {/* 3D-Printed Clip Ring Hardware Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">{t.ringSettings}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div>
            <label className="block text-slate-200 font-bold mb-1.5">
              {t.innerDiameter}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={45}
                step={1}
                value={ringInnerDiameter}
                onChange={(e) => setRingInnerDiameter(parseInt(e.target.value, 10))}
                className="flex-1 accent-cyan-400 h-2 bg-slate-800 rounded-lg"
              />
              <span className="font-mono font-bold text-cyan-400 text-sm sm:text-base w-16 text-right">
                {ringInnerDiameter} mm
              </span>
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Default 30 mm (Standard dermoscopy ring size)
            </span>
          </div>

          <div>
            <label className="block text-slate-200 font-bold mb-1.5">
              {t.armLength}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={60}
                step={1}
                value={armLength}
                onChange={(e) => setArmLength(parseInt(e.target.value, 10))}
                className="flex-1 accent-cyan-400 h-2 bg-slate-800 rounded-lg"
              />
              <span className="font-mono font-bold text-cyan-400 text-sm sm:text-base w-16 text-right">
                {armLength} mm
              </span>
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Distance from smartphone lens corner to ring plane
            </span>
          </div>
        </div>

        {/* Lens Preset */}
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-2">
            {t.lensPreset}
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setPhoneLensPreset('normal')}
              className={`p-3 rounded-2xl text-xs sm:text-sm font-semibold border text-center transition ${
                phoneLensPreset === 'normal'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Smartphone className="w-5 h-5 mx-auto mb-1.5" />
              <span>{t.lensNormal}</span>
            </button>

            <button
              type="button"
              onClick={() => setPhoneLensPreset('macro')}
              className={`p-3 rounded-2xl text-xs sm:text-sm font-semibold border text-center transition ${
                phoneLensPreset === 'macro'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Camera className="w-5 h-5 mx-auto mb-1.5" />
              <span>{t.lensMacro}</span>
            </button>

            <button
              type="button"
              onClick={() => setPhoneLensPreset('ultra-wide')}
              className={`p-3 rounded-2xl text-xs sm:text-sm font-semibold border text-center transition ${
                phoneLensPreset === 'ultra-wide'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Sliders className="w-5 h-5 mx-auto mb-1.5" />
              <span>{t.lensUltraWide}</span>
            </button>
          </div>
        </div>

        {/* Auto Capture Toggle */}
        <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 cursor-pointer select-none">
          <div>
            <strong className="block text-sm font-bold text-white">
              {t.autoCaptureToggle}
            </strong>
            <span className="text-xs text-slate-300 mt-0.5 block">
              Captures hands-free when ring is detected centered and in focus for 1 second.
            </span>
          </div>
          <input
            type="checkbox"
            checked={autoCapture}
            onChange={(e) => setAutoCapture(e.target.checked)}
            className="w-5 h-5 rounded bg-slate-800 text-cyan-500 border-slate-600 focus:ring-cyan-500 shrink-0"
          />
        </label>
      </div>

      {/* Provider & Clinic Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
          <Building className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">Clinician Profile & Identity</h3>
        </div>

        <div className="space-y-3.5 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Clinician Name (Captured By)</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Dr. Alex Morgan"
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Clinical Role / Title</label>
              <input
                type="text"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                placeholder="e.g. MD (Dermatology), NP, Telehealth Provider"
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">{t.clinicNameLabel}</label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-hidden focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Local Privacy & Data Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800">
          <Lock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm sm:text-base font-bold text-white">{t.privacyDataMgmt}</h3>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {t.privacyNote}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="flex-1 py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>{t.exportAllData}</span>
          </button>

          <button
            onClick={onResetDemoData}
            className="py-3 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs sm:text-sm font-medium border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>{t.clearLocalData}</span>
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          className="w-full py-4 px-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-xl shadow-cyan-900/30 transition flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          <span>{isSaved ? 'Settings Saved Successfully!' : 'Save Configuration'}</span>
        </button>
      </div>
    </div>
  );
};
