import { openDB, IDBPDatabase } from 'idb';
import { Patient, Lesion, LesionPhoto, AppSettings } from '../types';
import { generateSampleLesionCanvas } from './sampleData';
import { calculateSha256 } from '../utils/crypto';

const DB_NAME = 'skinring_clinical_db';
const DB_VERSION = 1;

export async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('patients')) {
        const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
        patientStore.createIndex('by_mrn', 'mrn');
      }

      if (!db.objectStoreNames.contains('lesions')) {
        const lesionStore = db.createObjectStore('lesions', { keyPath: 'id' });
        lesionStore.createIndex('by_patient', 'patientId');
      }

      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
        photoStore.createIndex('by_lesion', 'lesionId');
        photoStore.createIndex('by_patient', 'patientId');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
}

// ----------------- Default Settings -----------------
export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  darkMode: true,
  providerName: '',
  clinicName: 'Rural Health & Tele-Derm Network',
  userProfile: {
    name: '',
    role: '',
  },
  ringSettings: {
    ringInnerDiameterMm: 30,
    armLengthMm: 35,
    phoneLensPreset: 'normal',
    autoCapture: true,
    glareSensitivity: 'standard',
  },
  hasSeenDisclaimer: false,
  hasGrantedCameraNotice: false,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const settings = await db.get('settings', 'appSettings');
  if (!settings) {
    await db.put('settings', DEFAULT_SETTINGS, 'appSettings');
    return DEFAULT_SETTINGS;
  }
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    userProfile: settings.userProfile || DEFAULT_SETTINGS.userProfile,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings, 'appSettings');
}

// ----------------- Patient CRUD -----------------
export async function getPatients(): Promise<Patient[]> {
  const db = await getDb();
  return db.getAll('patients');
}

export async function getPatient(id: string): Promise<Patient | undefined> {
  const db = await getDb();
  return db.get('patients', id);
}

export async function savePatient(patient: Patient): Promise<void> {
  const db = await getDb();
  await db.put('patients', patient);
}

export async function deletePatient(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['patients', 'lesions', 'photos'], 'readwrite');
  await tx.objectStore('patients').delete(id);

  // Delete associated lesions and photos
  const lesionIndex = tx.objectStore('lesions').index('by_patient');
  const lesions = await lesionIndex.getAll(id);
  for (const lesion of lesions) {
    await tx.objectStore('lesions').delete(lesion.id);
  }

  const photoIndex = tx.objectStore('photos').index('by_patient');
  const photos = await photoIndex.getAll(id);
  for (const photo of photos) {
    await tx.objectStore('photos').delete(photo.id);
  }

  await tx.done;
}

// ----------------- Lesion CRUD -----------------
export async function getLesionsByPatient(patientId: string): Promise<Lesion[]> {
  const db = await getDb();
  return db.getAllFromIndex('lesions', 'by_patient', patientId);
}

export async function getAllLesions(): Promise<Lesion[]> {
  const db = await getDb();
  return db.getAll('lesions');
}

export async function getLesion(id: string): Promise<Lesion | undefined> {
  const db = await getDb();
  return db.get('lesions', id);
}

export async function saveLesion(lesion: Lesion): Promise<void> {
  const db = await getDb();
  await db.put('lesions', lesion);
}

export async function deleteLesion(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['lesions', 'photos'], 'readwrite');
  await tx.objectStore('lesions').delete(id);

  const photoIndex = tx.objectStore('photos').index('by_lesion');
  const photos = await photoIndex.getAll(id);
  for (const photo of photos) {
    await tx.objectStore('photos').delete(photo.id);
  }

  await tx.done;
}

// ----------------- Photos CRUD -----------------
export async function getPhotosByLesion(lesionId: string): Promise<LesionPhoto[]> {
  const db = await getDb();
  const photos = await db.getAllFromIndex('photos', 'by_lesion', lesionId);
  return photos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function getPhotosByPatient(patientId: string): Promise<LesionPhoto[]> {
  const db = await getDb();
  return db.getAllFromIndex('photos', 'by_patient', patientId);
}

export async function savePhoto(photo: LesionPhoto): Promise<void> {
  const db = await getDb();
  await db.put('photos', photo);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('photos', id);
}

// ----------------- Initial Clinical Seeding -----------------
export async function seedInitialClinicalData(): Promise<void> {
  const db = await getDb();
  const existingPatients = await db.count('patients');
  if (existingPatients > 0) return;

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Patient 1: Elena Vance
  const patient1: Patient = {
    id: 'pat-elena-vance-01',
    mrn: 'MRN-84920',
    name: 'Elena Vance',
    dateOfBirth: '1984-06-14',
    gender: 'Female',
    fitzpatrickType: 'II',
    riskFactors: {
      familyMelanoma: true,
      personalMelanoma: false,
      moleCount: '50-100',
      blisteringSunburns: true,
      immunosuppressed: false,
      fairSkinEyeColor: true,
    },
    consent: {
      given: true,
      date: sixMonthsAgo.toISOString().split('T')[0],
      type: 'digital',
      signerName: 'Elena Vance (Patient)',
      notes: 'Tele-derm consent and local photo documentation authorized.',
    },
    notes: 'Referred from rural health clinic for interscapular back lesion surveillance.',
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Lesion 1: Upper Right Back (Interscapular - shows comparison evolution!)
  const lesion1: Lesion = {
    id: 'lesion-elena-01',
    patientId: patient1.id,
    number: 1,
    name: 'Upper Right Back (Interscapular)',
    bodyLocation: {
      view: 'back',
      x: 62,
      y: 28,
      region: 'Upper Right Back',
    },
    status: 'monitoring',
    abcde: {
      asymmetry: true,
      borderIrregularity: true,
      colorVariegation: true,
      diameterOver6mm: true,
      evolution: true,
      score: 5,
      notes: 'Calibrated diameter grew from 5.4mm to 6.3mm over 6 months. Mild color variegation.',
    },
    argenziano7: {
      atypicalNetwork: true,
      blueWhiteVeil: false,
      atypicalVascular: true,
      irregularStreaks: false,
      irregularPigmentation: true,
      irregularDotsGlobules: true,
      regressionStructures: false,
      score: 4, // 2 (atypical network) + 1 (irregular pigment) + 1 (dots) = 4
    },
    nextFollowUpDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reminderNotes: '3-Month Monitoring Check: verify stabilization or refer for punch biopsy.',
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Lesion 2: Left Forearm (Stable benign compound nevus)
  const lesion2: Lesion = {
    id: 'lesion-elena-02',
    patientId: patient1.id,
    number: 2,
    name: 'Left Forearm (Volar aspect)',
    bodyLocation: {
      view: 'front',
      x: 24,
      y: 44,
      region: 'Left Forearm',
    },
    status: 'stable',
    abcde: {
      asymmetry: false,
      borderIrregularity: false,
      colorVariegation: false,
      diameterOver6mm: false,
      evolution: false,
      score: 0,
      notes: 'Uniform light tan pigment, sharp regular margins.',
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
    nextFollowUpDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reminderNotes: 'Routine 12-month annual full skin check.',
    createdAt: sixMonthsAgo.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Generate calibrated dermoscopic photos with ring spacer
  const baselineImgData = generateSampleLesionCanvas({
    diameterMm: 5.4,
    asymmetry: 0.2,
    irregularBorder: false,
    colorVariegated: false,
    evolutionShift: false,
    timestampText: 'BASELINE - ' + sixMonthsAgo.toISOString().split('T')[0],
  });

  const currentImgData = generateSampleLesionCanvas({
    diameterMm: 6.3,
    asymmetry: 0.45,
    irregularBorder: true,
    colorVariegated: true,
    evolutionShift: true,
    timestampText: 'CURRENT - ' + now.toISOString().split('T')[0],
  });

  const photoForearm = generateSampleLesionCanvas({
    diameterMm: 3.2,
    asymmetry: 0.05,
    irregularBorder: false,
    colorVariegated: false,
    timestampText: 'FOREARM - 3.2mm',
  });

  const baselineHash = await calculateSha256(baselineImgData);
  const currentHash = await calculateSha256(currentImgData);
  const forearmHash = await calculateSha256(photoForearm);

  const photo1Baseline: LesionPhoto = {
    id: 'photo-elena-01-base',
    lesionId: lesion1.id,
    patientId: patient1.id,
    timestamp: sixMonthsAgo.toISOString(),
    capturedBy: 'Demo User',
    imageData: baselineImgData,
    torchOn: true,
    lightingControlled: true,
    ringDetected: true,
    ringDiameterMm: 30,
    mmPerPixel: 0.0595,
    rotationAngleDeg: 0,
    colorReferenceNormalized: true,
    glareDetected: false,
    diameterMmEstimate: 5.4,
    measuredAreaMm2: 22.9,
    circularityScore: 0.89,
    borderIrregularityScore: 0.11,
    isDemo: true,
    sha256: baselineHash,
    notes: 'Baseline documentation with 30mm SkinRing clip spacer and torch illumination.',
  };

  const photo1Current: LesionPhoto = {
    id: 'photo-elena-01-curr',
    lesionId: lesion1.id,
    patientId: patient1.id,
    timestamp: now.toISOString(),
    capturedBy: 'Demo User',
    imageData: currentImgData,
    torchOn: true,
    lightingControlled: true,
    ringDetected: true,
    ringDiameterMm: 30,
    mmPerPixel: 0.0595,
    rotationAngleDeg: 0,
    colorReferenceNormalized: true,
    glareDetected: false,
    diameterMmEstimate: 6.3,
    measuredAreaMm2: 31.2,
    circularityScore: 0.68,
    borderIrregularityScore: 0.32,
    isDemo: true,
    sha256: currentHash,
    notes: 'Follow-up visit. Mild expansion of lateral border and darkening of focal pigment.',
    aiAnalysis: {
      id: 'ai-init-elena-01',
      timestamp: now.toISOString(),
      riskLevel: 'review',
      confidence: 89,
      observedFeatures: {
        asymmetry: 'Moderate asymmetry along the vertical axis with focal peripheral elongation.',
        borderIrregularity: 'Notched contours along superior margin; abrupt pigment cutoff.',
        colorVariation: 'Bicolor pattern with dark central brown and tan-erythematous periphery.',
        diameterEstimateMm: 6.3,
        changeSinceLastVisit: 'Calibrated diameter enlarged by ~0.9mm (16.7% increase) compared to 6-month baseline.',
      },
      plainLanguageExplanation: 'The mole on the upper back shows mild expansion in size and slight irregularity along the top edge since the visit 6 months ago. Because changes over time warrant careful observation, clinical dermatological review is indicated.',
      clinicalConsiderations: 'Lesion demonstrates dynamic morphological evolution on ring calibration. Argenziano score of 4 and ABCDE score of 5 recommend close 3-month dermatoscopic monitoring or diagnostic excision.',
      recommendedFollowUpMonths: 3,
      disclaimer: 'SkinRing is a documentation and triage-support tool, NOT a diagnostic device. Final evaluation must be performed by a qualified healthcare professional.',
    },
  };

  const photo2ForearmRecord: LesionPhoto = {
    id: 'photo-elena-02-base',
    lesionId: lesion2.id,
    patientId: patient1.id,
    timestamp: sixMonthsAgo.toISOString(),
    capturedBy: 'Demo User',
    imageData: photoForearm,
    torchOn: true,
    lightingControlled: true,
    ringDetected: true,
    ringDiameterMm: 30,
    mmPerPixel: 0.0595,
    rotationAngleDeg: 0,
    colorReferenceNormalized: true,
    glareDetected: false,
    diameterMmEstimate: 3.2,
    measuredAreaMm2: 8.0,
    circularityScore: 0.95,
    borderIrregularityScore: 0.05,
    isDemo: true,
    sha256: forearmHash,
    notes: 'Stable typical nevus. Symmetrical globular pattern.',
  };

  // Patient 2: Marcus Thorne (For Ugly Duckling & Multi-lesion testing)
  const patient2: Patient = {
    id: 'pat-marcus-thorne-02',
    mrn: 'MRN-39104',
    name: 'Marcus Thorne',
    dateOfBirth: '1968-11-22',
    gender: 'Male',
    fitzpatrickType: 'III',
    riskFactors: {
      familyMelanoma: false,
      personalMelanoma: true,
      moleCount: '>100',
      blisteringSunburns: true,
      immunosuppressed: false,
      fairSkinEyeColor: false,
    },
    consent: {
      given: true,
      date: threeMonthsAgo.toISOString().split('T')[0],
      type: 'written',
      signerName: 'Marcus Thorne',
      notes: 'Written consent on file in clinic archive.',
    },
    notes: 'High nevus count (>100 atypical moles). Excellent candidate for Ugly Duckling comparative matrix.',
    createdAt: threeMonthsAgo.toISOString(),
    updatedAt: now.toISOString(),
  };

  const lesionMarcus1: Lesion = {
    id: 'lesion-marcus-01',
    patientId: patient2.id,
    number: 1,
    name: 'Left Shoulder (The Outlier / Ugly Duckling)',
    bodyLocation: {
      view: 'back',
      x: 34,
      y: 22,
      region: 'Left Shoulder',
    },
    status: 'monitoring',
    abcde: {
      asymmetry: true,
      borderIrregularity: true,
      colorVariegation: true,
      diameterOver6mm: true,
      evolution: true,
      score: 5,
      notes: 'Distinct outlier from patient\'s common light brown reticular moles.',
    },
    argenziano7: {
      atypicalNetwork: true,
      blueWhiteVeil: true,
      atypicalVascular: false,
      irregularStreaks: true,
      irregularPigmentation: true,
      irregularDotsGlobules: false,
      regressionStructures: false,
      score: 6,
    },
    nextFollowUpDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reminderNotes: 'High priority specialist dermatology consultation.',
    createdAt: threeMonthsAgo.toISOString(),
    updatedAt: now.toISOString(),
  };

  const photoMarcusOutlier = generateSampleLesionCanvas({
    diameterMm: 7.2,
    asymmetry: 0.6,
    irregularBorder: true,
    colorVariegated: true,
    evolutionShift: true,
    timestampText: 'MARCUS #1 (OUTLIER) - 7.2mm',
  });
  const photoMarcusOutlierHash = await calculateSha256(photoMarcusOutlier);

  const photoMarcusRecord: LesionPhoto = {
    id: 'photo-marcus-01-curr',
    lesionId: lesionMarcus1.id,
    patientId: patient2.id,
    timestamp: now.toISOString(),
    capturedBy: 'Demo User',
    imageData: photoMarcusOutlier,
    torchOn: true,
    lightingControlled: true,
    ringDetected: true,
    ringDiameterMm: 30,
    mmPerPixel: 0.0595,
    rotationAngleDeg: 0,
    colorReferenceNormalized: true,
    glareDetected: false,
    diameterMmEstimate: 7.2,
    measuredAreaMm2: 40.7,
    circularityScore: 0.48,
    borderIrregularityScore: 0.52,
    isDemo: true,
    sha256: photoMarcusOutlierHash,
    notes: 'Outlier lesion on shoulder. Dark blue-black variegation and atypical network.',
    aiAnalysis: {
      id: 'ai-marcus-01',
      timestamp: now.toISOString(),
      riskLevel: 'urgent review',
      confidence: 94,
      observedFeatures: {
        asymmetry: 'Severe 2-axis asymmetry with focal eccentric pigment deposition.',
        borderIrregularity: 'Marked scalloped borders with jagged peripheral extensions.',
        colorVariation: 'Multicolor variation: slate-gray, blue-white veil, deep brown and black.',
        diameterEstimateMm: 7.2,
        changeSinceLastVisit: 'Prominent structural divergence from patient\'s normal mole pattern.',
      },
      plainLanguageExplanation: 'This spot on the left shoulder looks markedly different from all other moles on the patient\'s body (Ugly Duckling sign). It exhibits notable irregularity in both shape and color. Urgent specialist evaluation is advised.',
      clinicalConsiderations: 'High Argenziano score of 6 with blue-white veil and atypical pigment network. Urgent referral for excisional biopsy recommended.',
      recommendedFollowUpMonths: 1,
      disclaimer: 'SkinRing is a documentation and triage-support tool, NOT a diagnostic device. Final evaluation must be performed by a qualified healthcare professional.',
    },
  };

  // Save to DB
  await db.put('patients', patient1);
  await db.put('patients', patient2);

  await db.put('lesions', lesion1);
  await db.put('lesions', lesion2);
  await db.put('lesions', lesionMarcus1);

  await db.put('photos', photo1Baseline);
  await db.put('photos', photo1Current);
  await db.put('photos', photo2ForearmRecord);
  await db.put('photos', photoMarcusRecord);
}
