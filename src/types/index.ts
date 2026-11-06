export type FitzpatrickType = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export type Language = 'en' | 'es' | 'de';

export type RiskLevel = 'low' | 'review' | 'urgent review';

export interface PatientRiskFactors {
  familyMelanoma: boolean;
  personalMelanoma: boolean;
  moleCount: '<50' | '50-100' | '>100' | 'atypical';
  blisteringSunburns: boolean;
  immunosuppressed: boolean;
  fairSkinEyeColor: boolean;
}

export interface PatientConsent {
  given: boolean;
  date: string;
  type: 'written' | 'verbal' | 'digital';
  signerName: string;
  notes?: string;
}

export interface Patient {
  id: string;
  mrn: string; // Medical Record Number
  name: string;
  dateOfBirth: string;
  gender: string;
  fitzpatrickType: FitzpatrickType;
  riskFactors: PatientRiskFactors;
  consent: PatientConsent;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BodyLocation {
  view: 'front' | 'back';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  region: string; // e.g. "Upper Right Back", "Left Forearm"
}

export interface ABCDEData {
  asymmetry: boolean;
  borderIrregularity: boolean;
  colorVariegation: boolean;
  diameterOver6mm: boolean;
  evolution: boolean;
  score: number;
  notes: string;
}

export interface Argenziano7Data {
  // Major criteria (2 pts each)
  atypicalNetwork: boolean;
  blueWhiteVeil: boolean;
  atypicalVascular: boolean;
  // Minor criteria (1 pt each)
  irregularStreaks: boolean;
  irregularPigmentation: boolean;
  irregularDotsGlobules: boolean;
  regressionStructures: boolean;
  score: number;
}

export interface ObservedFeatures {
  asymmetry: string;
  borderIrregularity: string;
  colorVariation: string;
  diameterEstimateMm: number;
  changeSinceLastVisit: string;
}

export interface AIAnalysisResult {
  id: string;
  timestamp: string;
  riskLevel: RiskLevel;
  confidence: number;
  observedFeatures: ObservedFeatures;
  plainLanguageExplanation: string;
  clinicalConsiderations: string;
  recommendedFollowUpMonths: number;
  disclaimer: string;
}

export interface UserProfile {
  name: string;
  role: string;
}

export interface LesionPhoto {
  id: string;
  lesionId: string;
  patientId: string;
  timestamp: string;
  capturedBy: string;
  imageData: string;
  torchOn: boolean;
  lightingControlled: boolean;
  ringDetected: boolean;
  ringDiameterMm: number;
  mmPerPixel: number | null;
  rotationAngleDeg: number;
  colorReferenceNormalized: boolean;
  colorNormalizationFactors?: { rGain: number; gGain: number; bGain: number };
  glareDetected: boolean;
  diameterMmEstimate: number | null;
  measuredAreaMm2?: number | null;
  circularityScore?: number | null;
  borderIrregularityScore?: number | null;
  contourPoints?: { x: number; y: number }[];
  isDemo?: boolean;
  sha256: string;
  notes?: string;
  aiAnalysis?: AIAnalysisResult;
}

export interface Lesion {
  id: string;
  patientId: string;
  number: number;
  name: string;
  bodyLocation: BodyLocation;
  status: 'monitoring' | 'biopsied' | 'excised' | 'stable' | 'resolved';
  abcde: ABCDEData;
  argenziano7: Argenziano7Data;
  nextFollowUpDate: string; // ISO date
  reminderNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RingSettings {
  ringInnerDiameterMm: number;
  armLengthMm: number;
  phoneLensPreset: 'normal' | 'macro' | 'ultra-wide';
  autoCapture: boolean;
  glareSensitivity: 'standard' | 'high';
}

export interface AppSettings {
  language: Language;
  darkMode: boolean;
  providerName: string;
  clinicName: string;
  userProfile: UserProfile;
  ringSettings: RingSettings;
  hasSeenDisclaimer: boolean;
  hasGrantedCameraNotice: boolean;
}
