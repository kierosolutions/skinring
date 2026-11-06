/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Patient,
  Lesion,
  LesionPhoto,
  AppSettings,
  Language,
  AIAnalysisResult,
  ABCDEData,
  Argenziano7Data,
} from './types';
import {
  getSettings,
  saveSettings,
  getPatients,
  savePatient,
  getLesionsByPatient,
  getAllLesions,
  saveLesion,
  getPhotosByLesion,
  savePhoto,
  seedInitialClinicalData,
  DEFAULT_SETTINGS,
} from './db/index';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { DisclaimerModal, CameraPermissionScreen } from './components/DisclaimerModal';
import { PatientList } from './components/PatientList';
import { PatientDetail } from './components/PatientDetail';
import { LesionDetail } from './components/LesionDetail';
import { CameraCapture } from './components/CameraCapture';
import { BodyMap } from './components/BodyMap';
import { ChangeComparison } from './components/ChangeComparison';
import { ChecklistsModal } from './components/ChecklistsModal';
import { AIAnalysisModal } from './components/AIAnalysisModal';
import { UglyDucklingView } from './components/UglyDucklingView';
import { RemindersView } from './components/RemindersView';
import { SettingsView } from './components/SettingsView';
import { getTranslation } from './i18n/translations';

export default function App() {
  // App Settings & States
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<NavTab>('patients');

  // Active Context
  const [patients, setPatients] = useState<Patient[]>([]);
  const [lesions, setLesions] = useState<Lesion[]>([]);
  const [photosMap, setPhotosMap] = useState<Record<string, LesionPhoto[]>>({});

  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [activeLesion, setActiveLesion] = useState<Lesion | null>(null);

  // Modals & Subflows
  const [showFirstLaunchDisclaimer, setShowFirstLaunchDisclaimer] = useState<boolean>(false);
  const [showCameraPermissionNotice, setShowCameraPermissionNotice] = useState<boolean>(false);
  const [showChangeComparison, setShowChangeComparison] = useState<boolean>(false);
  const [showChecklistsModal, setShowChecklistsModal] = useState<boolean>(false);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [aiAnalysisPhotos, setAiAnalysisPhotos] = useState<{
    current: LesionPhoto;
    baseline?: LesionPhoto;
  } | null>(null);

  // 1. Initial Load & Seeding
  useEffect(() => {
    async function loadData() {
      try {
        await seedInitialClinicalData();
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);

        // Show first-launch non-diagnostic disclaimer if not previously acknowledged
        if (!loadedSettings.hasSeenDisclaimer) {
          setShowFirstLaunchDisclaimer(true);
        }

        const loadedPatients = await getPatients();
        setPatients(loadedPatients);

        if (loadedPatients.length > 0) {
          setActivePatient(loadedPatients[0]);
        }

        const loadedLesions = await getAllLesions();
        setLesions(loadedLesions);

        // Load photos for all lesions
        const pMap: Record<string, LesionPhoto[]> = {};
        for (const lesion of loadedLesions) {
          pMap[lesion.id] = await getPhotosByLesion(lesion.id);
        }
        setPhotosMap(pMap);
      } catch (err) {
        console.error('Database load error:', err);
      } finally {
        setIsDbLoaded(true);
      }
    }

    loadData();
  }, []);

  // Sync dark mode class with root html element
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Handle First Launch Disclaimer Acceptance
  const handleAcceptDisclaimer = async () => {
    const updated = { ...settings, hasSeenDisclaimer: true };
    setSettings(updated);
    await saveSettings(updated);
    setShowFirstLaunchDisclaimer(false);
  };

  // Handle Camera Permission Screen
  const handleCameraTabClick = () => {
    if (!settings.hasGrantedCameraNotice) {
      setShowCameraPermissionNotice(true);
    } else {
      setCurrentTab('capture');
    }
  };

  const handleGrantCamera = async () => {
    const updated = { ...settings, hasGrantedCameraNotice: true };
    setSettings(updated);
    await saveSettings(updated);
    setShowCameraPermissionNotice(false);
    setCurrentTab('capture');
  };

  // Navigation tab handler
  const handleTabChange = (tab: NavTab) => {
    if (tab === 'capture') {
      handleCameraTabClick();
      return;
    }
    // Clear subflow modals if open
    setShowChangeComparison(false);
    setCurrentTab(tab);
  };

  // Language & Dark mode handlers
  const handleLanguageChange = async (lang: Language) => {
    const updated = { ...settings, language: lang };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleToggleDarkMode = async () => {
    const updated = { ...settings, darkMode: !settings.darkMode };
    setSettings(updated);
    await saveSettings(updated);
  };

  // Patient Creation
  const handleCreatePatient = async (newPatient: Patient) => {
    await savePatient(newPatient);
    setPatients((prev) => [newPatient, ...prev]);
    setActivePatient(newPatient);
    setActiveLesion(null);
  };

  // Refresh photos helper
  const reloadLesionPhotos = async (lesionId: string) => {
    const photos = await getPhotosByLesion(lesionId);
    setPhotosMap((prev) => ({ ...prev, [lesionId]: photos }));
  };

  // Photo Saved from Guided Capture
  const handlePhotoSaved = async (
    photo: LesionPhoto,
    patientId: string,
    lesionId: string
  ) => {
    let targetLesionId = lesionId;

    // If "new" or empty lesion specified, create a new numbered lesion record for this patient
    if (!targetLesionId || targetLesionId === 'new') {
      const patientLesions = lesions.filter((l) => l.patientId === patientId);
      const nextNum = patientLesions.length + 1;
      const newLesion: Lesion = {
        id: 'lesion-' + Date.now(),
        patientId,
        number: nextNum,
        name: `Lesion #${nextNum} (New Documented Site)`,
        bodyLocation: {
          view: 'front',
          x: 50,
          y: 40,
          region: 'Anterior Torso',
        },
        status: 'monitoring',
        abcde: {
          asymmetry: false,
          borderIrregularity: false,
          colorVariegation: false,
          diameterOver6mm: (photo.diameterMmEstimate || 0) >= 6,
          evolution: false,
          score: (photo.diameterMmEstimate || 0) >= 6 ? 1 : 0,
          notes: 'Initial capture with calibrated SkinRing spacer.',
        },
        argenziano7: {
          atypicalNetwork: false,
          blueWhiteVeil: false,
          atypicalVascular: false,
          irregularStreaks: false,
          irregularPigmentation: false,
          irregularDotsGlobules: false,
          regressionStructures: false,
          score: 0,
        },
        nextFollowUpDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        reminderNotes: 'Follow-up dermoscopic re-evaluation.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveLesion(newLesion);
      setLesions((prev) => [...prev, newLesion]);
      targetLesionId = newLesion.id;
      setActiveLesion(newLesion);
    }

    // Save photo with target lesion id
    const finalPhoto = { ...photo, lesionId: targetLesionId, patientId };
    await savePhoto(finalPhoto);
    await reloadLesionPhotos(targetLesionId);

    // Switch to active patient and lesion
    const pat = patients.find((p) => p.id === patientId);
    if (pat) setActivePatient(pat);

    const targetL = lesions.find((l) => l.id === targetLesionId);
    if (targetL) setActiveLesion(targetL);

    setCurrentTab('patients');
  };

  // Add lesion from Body Map tap
  const handleAddLesionAtLocation = async (
    view: 'front' | 'back',
    x: number,
    y: number,
    regionName: string
  ) => {
    if (!activePatient) return;
    const patientLesions = lesions.filter((l) => l.patientId === activePatient.id);
    const nextNum = patientLesions.length + 1;

    const newLesion: Lesion = {
      id: 'lesion-' + Date.now(),
      patientId: activePatient.id,
      number: nextNum,
      name: `${regionName} #${nextNum}`,
      bodyLocation: {
        view,
        x,
        y,
        region: regionName,
      },
      status: 'monitoring',
      abcde: {
        asymmetry: false,
        borderIrregularity: false,
        colorVariegation: false,
        diameterOver6mm: false,
        evolution: false,
        score: 0,
        notes: 'Documented via anatomical body map marker.',
      },
      argenziano7: {
        atypicalNetwork: false,
        blueWhiteVeil: false,
        atypicalVascular: false,
        irregularStreaks: false,
        irregularPigmentation: false,
        irregularDotsGlobules: false,
        regressionStructures: false,
        score: 0,
      },
      nextFollowUpDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      reminderNotes: 'Routine surveillance for mapped site.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveLesion(newLesion);
    setLesions((prev) => [...prev, newLesion]);
    setActiveLesion(newLesion);
  };

  // Save Checklists
  const handleSaveChecklists = async (abcde: ABCDEData, argenziano7: Argenziano7Data) => {
    if (!activeLesion) return;
    const updated: Lesion = {
      ...activeLesion,
      abcde,
      argenziano7,
      updatedAt: new Date().toISOString(),
    };
    await saveLesion(updated);
    setLesions((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setActiveLesion(updated);
  };

  // Save AI Analysis to latest photo
  const handleSaveAIAnalysis = async (analysis: AIAnalysisResult) => {
    if (!activeLesion || !aiAnalysisPhotos) return;
    const updatedPhoto: LesionPhoto = {
      ...aiAnalysisPhotos.current,
      aiAnalysis: analysis,
    };
    await savePhoto(updatedPhoto);
    await reloadLesionPhotos(activeLesion.id);

    // Also update follow up suggestion on lesion if recommended
    if (analysis.recommendedFollowUpMonths) {
      const followUpDate = new Date(
        Date.now() + analysis.recommendedFollowUpMonths * 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0];
      const updatedLesion: Lesion = {
        ...activeLesion,
        nextFollowUpDate: followUpDate,
        reminderNotes: `AI suggested ${analysis.recommendedFollowUpMonths}-month follow-up window based on morphology.`,
        updatedAt: new Date().toISOString(),
      };
      await saveLesion(updatedLesion);
      setLesions((prev) => prev.map((l) => (l.id === updatedLesion.id ? updatedLesion : l)));
      setActiveLesion(updatedLesion);
    }
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  // Reset Demo Data
  const handleResetDemoData = async () => {
    const { getDb } = await import('./db/index');
    const db = await getDb();
    await db.clear('patients');
    await db.clear('lesions');
    await db.clear('photos');
    await seedInitialClinicalData();

    const loadedPatients = await getPatients();
    setPatients(loadedPatients);
    if (loadedPatients.length > 0) setActivePatient(loadedPatients[0]);

    const loadedLesions = await getAllLesions();
    setLesions(loadedLesions);

    const pMap: Record<string, LesionPhoto[]> = {};
    for (const lesion of loadedLesions) {
      pMap[lesion.id] = await getPhotosByLesion(lesion.id);
    }
    setPhotosMap(pMap);
    setActiveLesion(null);
    setCurrentTab('patients');
  };

  // Active patient lesions
  const activePatientLesions = activePatient
    ? lesions.filter((l) => l.patientId === activePatient.id)
    : [];

  const activeLesionPhotos = activeLesion ? photosMap[activeLesion.id] || [] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Header */}
      <Header
        language={settings.language}
        onLanguageChange={handleLanguageChange}
        darkMode={settings.darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        activePatient={activePatient}
        onSelectPatient={() => {
          setActiveLesion(null);
          setCurrentTab('patients');
        }}
        onGoHome={() => {
          setActiveLesion(null);
          setCurrentTab('patients');
        }}
        onOpenSettings={() => {
          setActiveLesion(null);
          setShowChangeComparison(false);
          setCurrentTab('settings');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-4 pt-3 sm:pt-5">
        {!isDbLoaded ? (
          <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">
            Initializing SkinRing Secure Clinical Storage...
          </div>
        ) : (
          <>
            {/* 1. PATIENTS TAB */}
            {currentTab === 'patients' && !activeLesion && (
              <>
                {activePatient ? (
                  <PatientDetail
                    language={settings.language}
                    patient={activePatient}
                    lesions={activePatientLesions}
                    onBack={() => setActivePatient(null)}
                    onSelectLesion={(lesion) => setActiveLesion(lesion)}
                    onStartCapture={() => handleCameraTabClick()}
                    onOpenBodyMap={() => setCurrentTab('bodymap')}
                    onOpenUglyDuckling={() => setCurrentTab('uglyduckling')}
                    onAddNewLesion={() => setCurrentTab('bodymap')}
                  />
                ) : (
                  <PatientList
                    language={settings.language}
                    patients={patients}
                    onSelectPatient={(p) => setActivePatient(p)}
                    onCreatePatient={handleCreatePatient}
                  />
                )}
              </>
            )}

            {/* 2. LESION TIMELINE DETAIL VIEW */}
            {currentTab === 'patients' && activePatient && activeLesion && (
              <>
                {showChangeComparison ? (
                  <ChangeComparison
                    language={settings.language}
                    lesion={activeLesion}
                    photos={activeLesionPhotos}
                    onBack={() => setShowChangeComparison(false)}
                  />
                ) : (
                  <LesionDetail
                    language={settings.language}
                    patient={activePatient}
                    lesion={activeLesion}
                    photos={activeLesionPhotos}
                    settings={settings}
                    onBack={() => setActiveLesion(null)}
                    onAddPhoto={() => handleCameraTabClick()}
                    onOpenComparison={() => setShowChangeComparison(true)}
                    onOpenChecklists={() => setShowChecklistsModal(true)}
                    onOpenAIAnalysis={(curr, base) => {
                      setAiAnalysisPhotos({ current: curr, baseline: base });
                      setShowAIModal(true);
                    }}
                  />
                )}
              </>
            )}

            {/* 3. GUIDED CAPTURE TAB */}
            {currentTab === 'capture' && (
              <CameraCapture
                language={settings.language}
                patients={patients}
                activePatient={activePatient}
                activeLesion={activeLesion}
                ringSettings={settings.ringSettings}
                settings={settings}
                onPhotoSaved={handlePhotoSaved}
                onCancel={() => setCurrentTab('patients')}
              />
            )}

            {/* 4. BODY MAP TAB */}
            {currentTab === 'bodymap' && (
              <>
                {activePatient ? (
                  <BodyMap
                    language={settings.language}
                    patient={activePatient}
                    lesions={activePatientLesions}
                    onSelectLesion={(l) => {
                      setActiveLesion(l);
                      setCurrentTab('patients');
                    }}
                    onAddLesionAtLocation={handleAddLesionAtLocation}
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-3xl border border-slate-800">
                    <p className="text-base font-semibold text-white">Select a patient to view anatomical body map.</p>
                    <button
                      onClick={() => setCurrentTab('patients')}
                      className="mt-3.5 py-3 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-bold text-white shadow-md transition"
                    >
                      Go to Patients
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 5. UGLY DUCKLING TAB */}
            {currentTab === 'uglyduckling' && (
              <UglyDucklingView
                language={settings.language}
                patients={patients}
                activePatient={activePatient}
                onSelectPatient={(p) => setActivePatient(p)}
                onSelectLesion={(l) => {
                  setActiveLesion(l);
                  setCurrentTab('patients');
                }}
                getPhotosForLesion={(id) => photosMap[id] || []}
              />
            )}

            {/* 6. REMINDERS TAB */}
            {currentTab === 'reminders' && (
              <RemindersView
                language={settings.language}
                patients={patients}
                lesions={lesions}
                onSelectLesion={(l, p) => {
                  setActivePatient(p);
                  setActiveLesion(l);
                  setCurrentTab('patients');
                }}
                onUpdateFollowUpDate={async (lesionId, newDate) => {
                  const target = lesions.find((l) => l.id === lesionId);
                  if (target) {
                    const upd = { ...target, nextFollowUpDate: newDate };
                    await saveLesion(upd);
                    setLesions((prev) => prev.map((l) => (l.id === lesionId ? upd : l)));
                  }
                }}
              />
            )}

            {/* 7. SETTINGS TAB */}
            {currentTab === 'settings' && (
              <SettingsView
                language={settings.language}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onResetDemoData={handleResetDemoData}
                onClose={() => setCurrentTab('patients')}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom One-Handed Navigation Bar */}
      <Navigation
        currentTab={currentTab}
        onTabChange={handleTabChange}
        language={settings.language}
      />

      {/* First-Launch Non-Diagnostic Disclaimer Modal */}
      {showFirstLaunchDisclaimer && (
        <DisclaimerModal
          language={settings.language}
          onAccept={handleAcceptDisclaimer}
        />
      )}

      {/* Camera Permission Pre-Flight Screen */}
      {showCameraPermissionNotice && (
        <CameraPermissionScreen
          language={settings.language}
          onGrant={handleGrantCamera}
          onCancel={() => setShowCameraPermissionNotice(false)}
        />
      )}

      {/* Clinical Checklists Modal (ABCDE & Argenziano 7-Point) */}
      {showChecklistsModal && activeLesion && (
        <ChecklistsModal
          language={settings.language}
          lesion={activeLesion}
          onSave={handleSaveChecklists}
          onClose={() => setShowChecklistsModal(false)}
        />
      )}

      {/* Gemini AI Morphological Triage Modal */}
      {showAIModal && activePatient && activeLesion && aiAnalysisPhotos && (
        <AIAnalysisModal
          language={settings.language}
          patient={activePatient}
          lesion={activeLesion}
          currentPhoto={aiAnalysisPhotos.current}
          baselinePhoto={aiAnalysisPhotos.baseline}
          onSaveAnalysis={handleSaveAIAnalysis}
          onClose={() => setShowAIModal(false)}
        />
      )}
    </div>
  );
}
