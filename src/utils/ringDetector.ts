/**
 * Real computer-vision ring detection, calibration, orientation alignment,
 * color/brightness normalization, and Otsu lesion segmentation for SkinRing.
 */

export interface RingDetectionResult {
  ringDetected: boolean;
  ringCentered: boolean;
  centerPx: { x: number; y: number } | null;
  measuredRadiusPx: number | null;
  measuredDiameterPx: number | null;
  mmPerPixel: number | null;
  rotationAngleDeg: number;
  notchAngleDeg: number | null;
  colorReferenceNormalized: boolean;
  colorCorrectionFactors?: { rGain: number; gGain: number; bGain: number };
  glareDetected: boolean;
  glarePercentage: number;
  isSharp: boolean;
  sharpnessScore: number;

  // Segmented lesion within ring
  lesionDetected: boolean;
  lesionDiameterMm: number | null;
  lesionAreaMm2: number | null;
  borderIrregularityScore: number | null; // Circularity metric (1.0 = perfect circle, >1.4 = irregular)
  contourPoints: { x: number; y: number }[]; // 0..1 normalized coordinates
}

/**
 * Detect ring in a canvas element or image data.
 * Works on downscaled preview frames (fast) or full-resolution capture frames.
 */
export function analyzeRingAndLesion(
  sourceCanvas: HTMLCanvasElement,
  configuredRingMm: number = 30
): RingDetectionResult {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });

  if (!ctx || width < 20 || height < 20) {
    return createEmptyResult();
  }

  // Work on a normalized processing canvas of 240x240 for fast, consistent CV processing
  const procSize = 240;
  const procCanvas = document.createElement('canvas');
  procCanvas.width = procSize;
  procCanvas.height = procSize;
  const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
  if (!procCtx) return createEmptyResult();

  procCtx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, procSize, procSize);
  const imgData = procCtx.getImageData(0, 0, procSize, procSize);
  const data = imgData.data;

  // 1. Compute Grayscale and Gradient Magnitude
  const gray = new Float32Array(procSize * procSize);
  const rChannel = new Uint8Array(procSize * procSize);
  const gChannel = new Uint8Array(procSize * procSize);
  const bChannel = new Uint8Array(procSize * procSize);

  let glareCount = 0;
  let varianceSum = 0;
  let prevLuma = 0;

  for (let y = 0; y < procSize; y++) {
    for (let x = 0; x < procSize; x++) {
      const idx = (y * procSize + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      rChannel[y * procSize + x] = r;
      gChannel[y * procSize + x] = g;
      bChannel[y * procSize + x] = b;

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[y * procSize + x] = luma;

      // Center area glare check
      const dx = x - procSize / 2;
      const dy = y - procSize / 2;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      if (distFromCenter < procSize * 0.38) {
        if (r > 240 && g > 240 && b > 240) {
          glareCount++;
        }
        varianceSum += Math.abs(luma - prevLuma);
        prevLuma = luma;
      }
    }
  }

  const centerAreaPixels = Math.PI * Math.pow(procSize * 0.38, 2);
  const glarePercentage = (glareCount / centerAreaPixels) * 100;
  const glareDetected = glarePercentage > 4.5;
  const sharpnessScore = varianceSum / centerAreaPixels;
  const isSharp = sharpnessScore > 7.5;

  // 2. Circle / Ring Detection: Circular boundary search
  // The ring spacer inner rim has high contrast against inner skin.
  // Cast 48 radial rays from search centers around the midpoint.
  const searchRadiusMin = procSize * 0.28; // ~67px
  const searchRadiusMax = procSize * 0.46; // ~110px

  const centerCandidates = [
    { x: procSize / 2, y: procSize / 2 },
    { x: procSize / 2 - 8, y: procSize / 2 },
    { x: procSize / 2 + 8, y: procSize / 2 },
    { x: procSize / 2, y: procSize / 2 - 8 },
    { x: procSize / 2, y: procSize / 2 + 8 },
    { x: procSize / 2 - 14, y: procSize / 2 - 14 },
    { x: procSize / 2 + 14, y: procSize / 2 + 14 },
  ];

  let bestCenter = { x: procSize / 2, y: procSize / 2 };
  let bestRadius = 0;
  let bestScore = -1;
  const numRays = 48;

  for (const cand of centerCandidates) {
    const edgePoints: { x: number; y: number; r: number }[] = [];

    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      let maxGrad = -1;
      let peakR = -1;

      // Scan radially for inward/outward dark-to-light or light-to-dark transition of the ring rim
      for (let r = searchRadiusMin; r < searchRadiusMax; r += 1.5) {
        const px = Math.round(cand.x + cosA * r);
        const py = Math.round(cand.y + sinA * r);
        const pxInner = Math.round(cand.x + cosA * (r - 3));
        const pyInner = Math.round(cand.y + sinA * (r - 3));
        const pxOuter = Math.round(cand.x + cosA * (r + 3));
        const pyOuter = Math.round(cand.y + sinA * (r + 3));

        if (
          pxInner >= 0 && pxInner < procSize && pyInner >= 0 && pyInner < procSize &&
          pxOuter >= 0 && pxOuter < procSize && pyOuter >= 0 && pyOuter < procSize
        ) {
          const lumaInner = gray[pyInner * procSize + pxInner];
          const lumaOuter = gray[pyOuter * procSize + pxOuter];
          // Spacer is dark (#1e293b / dark polymer) vs lighter skin inside:
          // or sharp edge transition
          const grad = Math.abs(lumaInner - lumaOuter);
          if (grad > maxGrad) {
            maxGrad = grad;
            peakR = r;
          }
        }
      }

      if (maxGrad > 14 && peakR > 0) {
        edgePoints.push({
          x: cand.x + cosA * peakR,
          y: cand.y + sinA * peakR,
          r: peakR,
        });
      }
    }

    if (edgePoints.length >= 24) {
      // Average radius and consistency (low standard deviation indicates true circle)
      const avgR = edgePoints.reduce((acc, p) => acc + p.r, 0) / edgePoints.length;
      const variance = edgePoints.reduce((acc, p) => acc + Math.pow(p.r - avgR, 2), 0) / edgePoints.length;
      const stdDev = Math.sqrt(variance);

      // Score favours high number of valid edge points and tight circular radius consistency
      const score = (edgePoints.length / numRays) * (1 / (1 + stdDev * 0.2));
      if (score > bestScore && stdDev < 9.0) {
        bestScore = score;
        bestRadius = avgR;
        bestCenter = cand;
      }
    }
  }

  const ringDetected = bestScore > 0.45 && bestRadius >= searchRadiusMin;

  if (!ringDetected) {
    return {
      ...createEmptyResult(),
      glareDetected,
      glarePercentage: Math.round(glarePercentage),
      isSharp,
      sharpnessScore: Math.round(sharpnessScore * 10) / 10,
    };
  }

  // Map detected center and radius from 240x240 proc coordinates to actual source canvas
  const scaleToSource = width / procSize;
  const actualCenterX = bestCenter.x * scaleToSource;
  const actualCenterY = bestCenter.y * scaleToSource;
  const actualRadiusPx = bestRadius * scaleToSource;
  const actualDiameterPx = actualRadiusPx * 2;

  // Real "Ring centered" metric: distance from image center vs threshold (within 8% of image half-width)
  const distFromCenterActual = Math.sqrt(
    Math.pow(actualCenterX - width / 2, 2) + Math.pow(actualCenterY - height / 2, 2)
  );
  const maxAllowableOffset = (Math.min(width, height) / 2) * 0.12;
  const ringCentered = distFromCenterActual <= maxAllowableOffset;

  // Compute mm per pixel from real measured diameter
  const mmPerPixel = configuredRingMm / actualDiameterPx;

  // 3. Orientation Notch Detection
  // Search an annular band at the detected ring rim for the distinctive red notch
  let notchAngleDeg: number | null = null;
  let maxRedDiff = -1;

  for (let deg = 0; deg < 360; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    // Sample along the ring radius +/- 6px
    let localRedSum = 0;
    let localGreenBlueSum = 0;
    let count = 0;

    for (let deltaR = -4; deltaR <= 6; deltaR += 2) {
      const rx = Math.round(bestCenter.x + Math.cos(rad) * (bestRadius + deltaR));
      const ry = Math.round(bestCenter.y + Math.sin(rad) * (bestRadius + deltaR));
      if (rx >= 0 && rx < procSize && ry >= 0 && ry < procSize) {
        const idx = (ry * procSize + rx) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        localRedSum += r;
        localGreenBlueSum += (g + b) / 2;
        count++;
      }
    }

    if (count > 0) {
      const avgRed = localRedSum / count;
      const avgGB = localGreenBlueSum / count;
      const redIndex = avgRed - avgGB; // High red dominance indicates orientation notch
      if (redIndex > maxRedDiff && avgRed > 110) {
        maxRedDiff = redIndex;
        notchAngleDeg = deg;
      }
    }
  }

  // Calculate rotation angle to align notch to 12 o'clock (-90° / 270°)
  let rotationAngleDeg = 0;
  if (notchAngleDeg !== null && maxRedDiff > 30) {
    // Current notch angle is in canvas standard coords (0° is East, 90° is South, 270° is North / 12h)
    const targetNorth = 270;
    let diff = targetNorth - notchAngleDeg;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    rotationAngleDeg = Math.round(diff);
  }

  // 4. White / Grey Reference Patch Sampling
  // Located approximately 90° clockwise from the notch along the ring perimeter
  let colorCorrectionFactors = { rGain: 1.0, gGain: 1.0, bGain: 1.0 };
  let colorReferenceNormalized = false;

  const patchAngleDeg = notchAngleDeg !== null ? (notchAngleDeg + 90) % 360 : 0;
  const patchRad = (patchAngleDeg * Math.PI) / 180;
  const patchCenterPxX = Math.round(bestCenter.x + Math.cos(patchRad) * (bestRadius + 5));
  const patchCenterPxY = Math.round(bestCenter.y + Math.sin(patchRad) * (bestRadius + 5));

  let patchRSum = 0;
  let patchGSum = 0;
  let patchBSum = 0;
  let patchCount = 0;

  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const px = patchCenterPxX + dx;
      const py = patchCenterPxY + dy;
      if (px >= 0 && px < procSize && py >= 0 && py < procSize) {
        const idx = (py * procSize + px) * 4;
        patchRSum += data[idx];
        patchGSum += data[idx + 1];
        patchBSum += data[idx + 2];
        patchCount++;
      }
    }
  }

  if (patchCount > 0) {
    const meanR = patchRSum / patchCount;
    const meanG = patchGSum / patchCount;
    const meanB = patchBSum / patchCount;

    // If reasonable reference patch intensity is found (neutral tone)
    if (meanR > 80 && meanG > 80 && meanB > 80) {
      const targetLuma = (meanR + meanG + meanB) / 3;
      const rGain = Math.min(1.4, Math.max(0.7, targetLuma / Math.max(1, meanR)));
      const gGain = Math.min(1.4, Math.max(0.7, targetLuma / Math.max(1, meanG)));
      const bGain = Math.min(1.4, Math.max(0.7, targetLuma / Math.max(1, meanB)));
      colorCorrectionFactors = {
        rGain: Math.round(rGain * 1000) / 1000,
        gGain: Math.round(gGain * 1000) / 1000,
        bGain: Math.round(bGain * 1000) / 1000,
      };
      colorReferenceNormalized = true;
    }
  }

  // 5. Real Lesion Segmentation inside Ring (Otsu Threshold + Connected Component)
  const innerRadius = bestRadius * 0.82;
  const lesionPixels: boolean[] = new Array(procSize * procSize).fill(false);
  const innerMaskIndices: number[] = [];

  // Compute Otsu threshold on the inner skin region
  const histogram = new Uint32Array(256);
  let innerCount = 0;

  for (let y = 0; y < procSize; y++) {
    for (let x = 0; x < procSize; x++) {
      const dx = x - bestCenter.x;
      const dy = y - bestCenter.y;
      if (dx * dx + dy * dy < innerRadius * innerRadius) {
        const luma = Math.round(gray[y * procSize + x]);
        histogram[luma]++;
        innerMaskIndices.push(y * procSize + x);
        innerCount++;
      }
    }
  }

  // Otsu algorithm
  let otsuThreshold = 100;
  if (innerCount > 100) {
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVar = -1;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = innerCount - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const betweenVar = wB * wF * Math.pow(mB - mF, 2);

      if (betweenVar > maxVar) {
        maxVar = betweenVar;
        otsuThreshold = t;
      }
    }
  }

  // Pigmented lesions are darker than surrounding skin
  // A pixel is segmented as lesion if its luminance < otsuThreshold - margin
  for (const idx of innerMaskIndices) {
    if (gray[idx] < otsuThreshold - 4) {
      lesionPixels[idx] = true;
    }
  }

  // Find connected components in lesionPixels (BFS)
  const visited = new Uint8Array(procSize * procSize);
  let bestComponent: { x: number; y: number }[] = [];
  let bestCompDistToCenter = 999999;

  for (const idx of innerMaskIndices) {
    if (lesionPixels[idx] && !visited[idx]) {
      const component: { x: number; y: number }[] = [];
      const queue: number[] = [idx];
      visited[idx] = 1;

      let compSumX = 0;
      let compSumY = 0;

      while (queue.length > 0) {
        const curr = queue.pop()!;
        const cy = Math.floor(curr / procSize);
        const cx = curr % procSize;
        component.push({ x: cx, y: cy });
        compSumX += cx;
        compSumY += cy;

        // 4-neighborhood
        const neighbors = [
          curr - 1,
          curr + 1,
          curr - procSize,
          curr + procSize,
        ];

        for (const n of neighbors) {
          if (n >= 0 && n < procSize * procSize && lesionPixels[n] && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }

      if (component.length >= 25) {
        // Evaluate distance from component centroid to center
        const compCx = compSumX / component.length;
        const compCy = compSumY / component.length;
        const dist = Math.sqrt(
          Math.pow(compCx - bestCenter.x, 2) + Math.pow(compCy - bestCenter.y, 2)
        );

        if (dist < bestCompDistToCenter) {
          bestCompDistToCenter = dist;
          bestComponent = component;
        }
      }
    }
  }

  const lesionDetected = bestComponent.length >= 25;
  let lesionDiameterMm: number | null = null;
  let lesionAreaMm2: number | null = null;
  let borderIrregularityScore: number | null = null;
  const contourPointsNormalized: { x: number; y: number }[] = [];

  if (lesionDetected) {
    // 1. Compute exact Area in mm²
    const pixelAreaActual = bestComponent.length * Math.pow(scaleToSource, 2);
    lesionAreaMm2 = Math.round(pixelAreaActual * Math.pow(mmPerPixel, 2) * 10) / 10;

    // 2. Find boundary contour points
    const compSet = new Set<number>();
    for (const p of bestComponent) compSet.add(p.y * procSize + p.x);

    const boundaryPoints: { x: number; y: number }[] = [];
    for (const p of bestComponent) {
      const idx = p.y * procSize + p.x;
      // Border if any neighbor is not in component
      if (
        !compSet.has(idx - 1) ||
        !compSet.has(idx + 1) ||
        !compSet.has(idx - procSize) ||
        !compSet.has(idx + procSize)
      ) {
        boundaryPoints.push(p);
      }
    }

    // 3. Maximum Feret Diameter (max distance between any two contour points)
    let maxDistPx = 0;
    // Subsample boundary points if large to calculate max pairwise distance efficiently
    const step = Math.max(1, Math.floor(boundaryPoints.length / 80));
    const sampleBoundary: { x: number; y: number }[] = [];
    for (let i = 0; i < boundaryPoints.length; i += step) {
      sampleBoundary.push(boundaryPoints[i]);
    }

    for (let i = 0; i < sampleBoundary.length; i++) {
      for (let j = i + 1; j < sampleBoundary.length; j++) {
        const dx = sampleBoundary[i].x - sampleBoundary[j].x;
        const dy = sampleBoundary[i].y - sampleBoundary[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDistPx) maxDistPx = dist;
      }
    }

    const actualDiameterPx = maxDistPx * scaleToSource;
    lesionDiameterMm = Math.round(actualDiameterPx * mmPerPixel * 10) / 10;

    // 4. Border Irregularity (Perimeter² / (4π * Area))
    // Smooth circle = 1.0; irregular/notched border = 1.3 - 2.5+
    const perimeterPx = boundaryPoints.length * scaleToSource;
    const circularity = Math.pow(perimeterPx, 2) / (4 * Math.PI * Math.max(1, pixelAreaActual));
    borderIrregularityScore = Math.round(Math.max(1.0, circularity) * 100) / 100;

    // 5. Store angularly-ordered contour points for crisp review drawing
    // Centroid of boundary
    let bCx = 0;
    let bCy = 0;
    for (const p of boundaryPoints) {
      bCx += p.x;
      bCy += p.y;
    }
    bCx /= Math.max(1, boundaryPoints.length);
    bCy /= Math.max(1, boundaryPoints.length);

    // Sort by angle around centroid
    const angularBoundary = boundaryPoints
      .map((p) => ({
        x: p.x / procSize,
        y: p.y / procSize,
        angle: Math.atan2(p.y - bCy, p.x - bCx),
      }))
      .sort((a, b) => a.angle - b.angle);

    // Keep 36 points for smooth SVG polygon rendering
    const pointStep = Math.max(1, Math.floor(angularBoundary.length / 36));
    for (let i = 0; i < angularBoundary.length; i += pointStep) {
      contourPointsNormalized.push({
        x: Math.round(angularBoundary[i].x * 1000) / 1000,
        y: Math.round(angularBoundary[i].y * 1000) / 1000,
      });
    }
  }

  return {
    ringDetected: true,
    ringCentered,
    centerPx: { x: Math.round(actualCenterX), y: Math.round(actualCenterY) },
    measuredRadiusPx: Math.round(actualRadiusPx),
    measuredDiameterPx: Math.round(actualDiameterPx),
    mmPerPixel: Math.round(mmPerPixel * 10000) / 10000,
    rotationAngleDeg,
    notchAngleDeg,
    colorReferenceNormalized,
    colorCorrectionFactors,
    glareDetected,
    glarePercentage: Math.round(glarePercentage),
    isSharp,
    sharpnessScore: Math.round(sharpnessScore * 10) / 10,
    lesionDetected,
    lesionDiameterMm,
    lesionAreaMm2,
    borderIrregularityScore,
    contourPoints: contourPointsNormalized,
  };
}

function createEmptyResult(): RingDetectionResult {
  return {
    ringDetected: false,
    ringCentered: false,
    centerPx: null,
    measuredRadiusPx: null,
    measuredDiameterPx: null,
    mmPerPixel: null,
    rotationAngleDeg: 0,
    notchAngleDeg: null,
    colorReferenceNormalized: false,
    glareDetected: false,
    glarePercentage: 0,
    isSharp: false,
    sharpnessScore: 0,
    lesionDetected: false,
    lesionDiameterMm: null,
    lesionAreaMm2: null,
    borderIrregularityScore: null,
    contourPoints: [],
  };
}

/**
 * Apply real orientation rotation (aligning notch to 12 o'clock) and
 * white-balance/color brightness normalization to the final saved image.
 */
export async function applyCalibrationTransform(
  sourceImageSrc: string,
  rotationAngleDeg: number,
  colorCorrection?: { rGain: number; gGain: number; bGain: number }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceImageSrc);
        return;
      }

      ctx.save();
      // Rotate around canvas center
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotationAngleDeg * Math.PI) / 180);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();

      // Apply white-balance / brightness correction factors if present
      if (colorCorrection && (colorCorrection.rGain !== 1.0 || colorCorrection.gGain !== 1.0 || colorCorrection.bGain !== 1.0)) {
        try {
          const imgData = ctx.getImageData(0, 0, size, size);
          const data = imgData.data;
          const { rGain, gGain, bGain } = colorCorrection;

          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.round(data[i] * rGain));
            data[i + 1] = Math.min(255, Math.round(data[i + 1] * gGain));
            data[i + 2] = Math.min(255, Math.round(data[i + 2] * bGain));
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // Fall back to rotated image
        }
      }

      resolve(canvas.toDataURL('image/jpeg', 0.94));
    };
    img.onerror = () => resolve(sourceImageSrc);
    img.src = sourceImageSrc;
  });
}
