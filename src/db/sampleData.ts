/**
 * Helper to generate realistic dermoscopic sample images with calibrated ring spacer,
 * orientation notch at 12 o'clock, and reference calibration patch.
 */
export function generateSampleLesionCanvas(options: {
  size?: number;
  diameterMm?: number;
  ringMm?: number;
  asymmetry?: number; // 0 to 1
  irregularBorder?: boolean;
  colorVariegated?: boolean;
  evolutionShift?: boolean;
  timestampText?: string;
  seed?: number;
}): string {
  const size = options.size || 600;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = size / 2;
  const cy = size / 2;
  const ringMm = options.ringMm || 30;
  const ringRadiusPx = size * 0.42; // Ring inner edge
  const mmPerPixel = ringMm / (ringRadiusPx * 2);

  // Background skin tone (Fitzpatrick II/III)
  const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, size * 0.7);
  bgGrad.addColorStop(0, '#f5d5be');
  bgGrad.addColorStop(0.7, '#e8be9f');
  bgGrad.addColorStop(1, '#d8ac8b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle skin texture/pores
  ctx.fillStyle = 'rgba(180, 120, 90, 0.08)';
  for (let i = 0; i < 400; i++) {
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    ctx.beginPath();
    ctx.arc(rx, ry, Math.random() * 2 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw 3D-Printed Ring Spacer Border (Known inner diameter)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadiusPx, 0, Math.PI * 2);
  ctx.arc(cx, cy, size * 0.49, 0, Math.PI * 2, true);
  ctx.fillStyle = '#1e293b'; // Dark matte polymer spacer
  ctx.fill();

  // Calibration tick marks every 30 degrees
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * (ringRadiusPx + 2);
    const y1 = cy + Math.sin(rad) * (ringRadiusPx + 2);
    const x2 = cx + Math.cos(rad) * (ringRadiusPx + 14);
    const y2 = cy + Math.sin(rad) * (ringRadiusPx + 14);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 12 o'clock Orientation Notch (Red distinctive alignment notch)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - ringRadiusPx - 2);
  ctx.lineTo(cx + 10, cy - ringRadiusPx - 2);
  ctx.lineTo(cx, cy - ringRadiusPx + 16);
  ctx.closePath();
  ctx.fill();

  // Reference White & Grey calibration patch at 3 o'clock
  const patchX = cx + ringRadiusPx + 4;
  const patchY = cy - 20;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(patchX, patchY, 14, 20);
  ctx.fillStyle = '#808080';
  ctx.fillRect(patchX, patchY + 20, 14, 20);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(patchX, patchY, 14, 40);

  // Ring text inscription: "SkinRing 30mm"
  ctx.fillStyle = '#64748b';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKINRING 30mm', cx, cy + ringRadiusPx + 28);
  ctx.restore();

  // Draw Lesion (Pigmented Melanocytic lesion)
  const diameterMm = options.diameterMm || 6.0;
  const lesionRadiusPx = (diameterMm / mmPerPixel) / 2;
  const asymmetryFactor = options.asymmetry || 0.3;

  ctx.save();
  // Draw lesion shape with natural organic polygonal wobble
  ctx.beginPath();
  const numPoints = 32;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Asymmetry and irregularity
    const asymX = Math.cos(angle) > 0 ? 1 + asymmetryFactor * 0.4 : 1 - asymmetryFactor * 0.2;
    const borderNoise = options.irregularBorder
      ? Math.sin(angle * 5) * 6 + Math.cos(angle * 7) * 4
      : Math.sin(angle * 3) * 2;
    const r = lesionRadiusPx * asymX + borderNoise;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    points.push({ x: px, y: py });
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  // Color fill
  const lesionGrad = ctx.createRadialGradient(
    cx - (options.evolutionShift ? 15 : 5),
    cy - 10,
    10,
    cx,
    cy,
    lesionRadiusPx * 1.2
  );

  if (options.colorVariegated) {
    lesionGrad.addColorStop(0, '#1c1917'); // Dark black/brown core
    lesionGrad.addColorStop(0.35, '#451a03'); // Dark reddish brown
    lesionGrad.addColorStop(0.65, '#78350f'); // Tan brown
    lesionGrad.addColorStop(0.9, '#a16207'); // Light peripheral brown
    lesionGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');
  } else {
    lesionGrad.addColorStop(0, '#573016');
    lesionGrad.addColorStop(0.6, '#713f12');
    lesionGrad.addColorStop(0.95, '#854d0e');
    lesionGrad.addColorStop(1, 'rgba(133, 77, 14, 0)');
  }

  ctx.fillStyle = lesionGrad;
  ctx.fill();

  // Dermoscopic pigment network & dots
  ctx.fillStyle = 'rgba(28, 25, 23, 0.4)';
  for (let i = 0; i < 28; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * (lesionRadiusPx * 0.85);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, Math.random() * 2.5 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Atypical vascular or streak features if evolution
  if (options.evolutionShift) {
    ctx.strokeStyle = 'rgba(185, 28, 28, 0.35)'; // Faint erythema / atypical vascular
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 10);
    ctx.bezierCurveTo(cx - 10, cy + 25, cx + 15, cy + 20, cx + 30, cy + 10);
    ctx.stroke();
  }
  ctx.restore();

  // Stamp timestamp / visit watermark in corner
  if (options.timestampText) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(16, size - 44, 260, 28);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(options.timestampText, 24, size - 26);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}
