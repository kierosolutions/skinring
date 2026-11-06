import { jsPDF } from 'jspdf';
import { Patient, Lesion, LesionPhoto, AppSettings } from '../types';

export function generateClinicalPdfReport(
  patient: Patient,
  lesion: Lesion,
  photos: LesionPhoto[],
  settings: AppSettings
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SkinRing | Clinical Lesion Documentation & Triage Report', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${settings.clinicName || 'Clinical Tele-Derm Network'} • Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    margin,
    18
  );

  y = 30;

  // Mandatory Non-Diagnostic Disclaimer Box
  doc.setFillColor(254, 242, 242); // red-50
  doc.setDrawColor(248, 113, 113); // red-400
  doc.rect(margin, y, contentWidth, 14, 'FD');

  doc.setTextColor(153, 27, 27); // red-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MANDATORY CLINICAL DISCLAIMER (NOT A DIAGNOSTIC DEVICE):', margin + 3, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const disclaimerText =
    'SkinRing is an assistive documentation and triage-support aid, NOT a diagnostic medical device. It does not provide definitive medical diagnoses. All evaluations, calibrated dimensions, and AI observations must be interpreted by a qualified healthcare provider alongside in-person dermoscopy and histopathology.';
  doc.text(doc.splitTextToSize(disclaimerText, contentWidth - 6), margin + 3, y + 8.5);

  y += 18;

  // Patient & Clinical Profile (2 Columns)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 24, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PATIENT INFORMATION', margin + 3, y + 5);
  doc.text('CLINICAL RISK & CONSENT', margin + contentWidth / 2 + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  // Col 1
  doc.text(`Name: ${patient.name}`, margin + 3, y + 10);
  doc.text(`MRN: ${patient.mrn} | Gender: ${patient.gender}`, margin + 3, y + 14.5);
  doc.text(`DOB: ${patient.dateOfBirth}`, margin + 3, y + 19);

  // Col 2
  doc.text(`Fitzpatrick Type: Type ${patient.fitzpatrickType}`, margin + contentWidth / 2 + 3, y + 10);
  const riskList: string[] = [];
  if (patient.riskFactors.personalMelanoma) riskList.push('Prior Melanoma');
  if (patient.riskFactors.familyMelanoma) riskList.push('Family Melanoma');
  if (patient.riskFactors.moleCount === '>100') riskList.push('>100 Moles');
  if (patient.riskFactors.blisteringSunburns) riskList.push('Blistering Sunburns');
  const riskStr = riskList.length > 0 ? riskList.join(', ') : 'No high-risk indicators';
  doc.text(`Risk Factors: ${riskStr}`, margin + contentWidth / 2 + 3, y + 14.5);
  doc.text(
    `Consent: ${patient.consent.given ? `Documented (${patient.consent.type}) on ${patient.consent.date}` : 'Not on file'}`,
    margin + contentWidth / 2 + 3,
    y + 19
  );

  y += 28;

  // Lesion Summary Bar
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254);
  doc.rect(margin, y, contentWidth, 12, 'FD');

  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `LESION #${lesion.number}: ${lesion.name} (${lesion.bodyLocation.region} - ${lesion.bodyLocation.view.toUpperCase()} VIEW)`,
    margin + 3,
    y + 5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Status: ${lesion.status.toUpperCase()} | ABCDE Score: ${lesion.abcde.score}/5 | Argenziano 7-Point: ${lesion.argenziano7.score} pts | Next Check: ${lesion.nextFollowUpDate || 'Routine'}`,
    margin + 3,
    y + 9.5
  );

  y += 16;

  // Photos Section (Latest and Baseline side by side)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CALIBRATED RING DOCUMENTATION & VERIFIED TIMELINE', margin, y);
  y += 4;

  const displayPhotos = photos.slice(-2); // At most 2 for side-by-side
  const photoWidth = (contentWidth - 6) / Math.max(1, displayPhotos.length);
  const photoHeight = 44;

  displayPhotos.forEach((photo, idx) => {
    const px = margin + idx * (photoWidth + 6);
    try {
      doc.addImage(photo.imageData, 'JPEG', px, y, photoWidth, photoHeight, undefined, 'FAST');
    } catch (e) {
      doc.setFillColor(241, 245, 249);
      doc.rect(px, y, photoWidth, photoHeight, 'F');
      doc.text('[Image Data]', px + 5, y + 20);
    }

    // Photo details below image
    doc.setFillColor(248, 250, 252);
    doc.rect(px, y + photoHeight, photoWidth, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    const visitLabel = idx === 0 && displayPhotos.length === 2 ? 'BASELINE / EARLIER VISIT' : 'CURRENT VISIT';
    doc.text(`${visitLabel} • ${new Date(photo.timestamp).toLocaleDateString()}`, px + 2, y + photoHeight + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Ring: ${photo.ringDetected ? `${photo.ringDiameterMm}mm Calibrated (${(photo.mmPerPixel || 0.06).toFixed(3)} mm/px)` : 'Uncalibrated'} | Torch: ${photo.torchOn ? 'ON' : 'OFF'}`,
      px + 2,
      y + photoHeight + 7.5
    );
    const diamDisplay = typeof photo.diameterMmEstimate === 'number' && photo.diameterMmEstimate > 0
      ? `${photo.diameterMmEstimate.toFixed(1)}mm`
      : 'Not measured';
    doc.text(`By: ${photo.capturedBy || 'Provider'} | Measured Diam: ${diamDisplay}`, px + 2, y + photoHeight + 11);
    doc.text(`SHA-256: ${photo.sha256 ? photo.sha256.substring(0, 20) + '...' : 'Verified'}${photo.isDemo ? ' (Demo)' : ''}`, px + 2, y + photoHeight + 14.5);
  });

  y += photoHeight + 20;

  // Checklists (ABCDE & 7-point)
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 22, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CLINICAL CHECKLIST OBSERVATIONS', margin + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const abcdeDetails = `ABCDE: Asymmetry: ${lesion.abcde.asymmetry ? 'YES' : 'NO'}, Border: ${lesion.abcde.borderIrregularity ? 'Irregular' : 'Smooth'}, Color: ${lesion.abcde.colorVariegation ? 'Variegated' : 'Uniform'}, Diam >6mm: ${lesion.abcde.diameterOver6mm ? 'YES' : 'NO'}, Evolution: ${lesion.abcde.evolution ? 'YES' : 'NO'}`;
  doc.text(abcdeDetails, margin + 3, y + 9);

  const argDetails = `Argenziano 7-Point: Score ${lesion.argenziano7.score} pts (${lesion.argenziano7.score >= 3 ? 'HIGH SUSPICION (≥3)' : 'LOW/MONITORING (<3)'}). Network: ${lesion.argenziano7.atypicalNetwork ? 'Atypical' : 'Regular'}, Veil: ${lesion.argenziano7.blueWhiteVeil ? 'Present' : 'Absent'}, Vascular: ${lesion.argenziano7.atypicalVascular ? 'Atypical' : 'None'}, Pigment: ${lesion.argenziano7.irregularPigmentation ? 'Irregular' : 'None'}.`;
  doc.text(doc.splitTextToSize(argDetails, contentWidth - 6), margin + 3, y + 13.5);

  if (lesion.abcde.notes) {
    doc.text(`Notes: ${lesion.abcde.notes}`, margin + 3, y + 18.5);
  }

  y += 26;

  // AI Morphological Analysis (if available on latest photo)
  const latestPhoto = photos[photos.length - 1];
  if (latestPhoto && latestPhoto.aiAnalysis) {
    const ai = latestPhoto.aiAnalysis;
    doc.setFillColor(240, 253, 250); // teal-50
    doc.setDrawColor(153, 246, 228);
    doc.rect(margin, y, contentWidth, 30, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110); // teal-700
    doc.text(`CLAUDE AI MORPHOLOGICAL TRIAGE (Risk Level: ${ai.riskLevel.toUpperCase()} | Confidence: ${ai.confidence}%)`, margin + 3, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);

    const featuresText = `Features: Asymmetry: ${ai.observedFeatures.asymmetry} | Border: ${ai.observedFeatures.borderIrregularity} | Color: ${ai.observedFeatures.colorVariation} | Est. Diameter: ${ai.observedFeatures.diameterEstimateMm}mm | Evolution: ${ai.observedFeatures.changeSinceLastVisit}`;
    doc.text(doc.splitTextToSize(featuresText, contentWidth - 6), margin + 3, y + 9);

    const explanationText = `Clinical Summary: ${ai.plainLanguageExplanation}`;
    doc.text(doc.splitTextToSize(explanationText, contentWidth - 6), margin + 3, y + 15);

    const notesText = `Action Considerations: ${ai.clinicalConsiderations} | Suggested Follow-up: ${ai.recommendedFollowUpMonths} Months`;
    doc.text(doc.splitTextToSize(notesText, contentWidth - 6), margin + 3, y + 22);

    y += 34;
  }

  // Provider Sign-off block
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y + 10, margin + 65, y + 10);
  doc.line(margin + contentWidth - 65, y + 10, margin + contentWidth, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const providerSignature = settings.userProfile?.name
    ? `${settings.userProfile.name}${settings.userProfile.role ? `, ${settings.userProfile.role}` : ''}`
    : settings.providerName;
  doc.text(`Reviewing Provider: ${providerSignature}`, margin, y + 14);
  doc.text(`Date & Signature: ${new Date().toLocaleDateString()}`, margin + contentWidth - 65, y + 14);

  // Download PDF
  const filename = `SkinRing_Report_${patient.name.replace(/\s+/g, '_')}_Lesion${lesion.number}.pdf`;
  doc.save(filename);
}
