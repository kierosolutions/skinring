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
  circularityScore: number | null; // 4 * PI * Area / Perimeter^2
  borderIrregularityScore: number | null; // 1 - circularity
  contourPoints: { x: number; y: number }[]; // 0..1 normalized coordinates
}

/**
 * Standard CIE L*a*b* conversion from sRGB
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const rLin = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  const gLin = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  const bLin = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  const X = (rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375) / 0.95047;
  const Y = (rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.0721750) / 1.00000;
  const Z = (rLin * 0.0193339 + gLin * 0.1191920 + bLin * 0.9503041) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [L, a, bVal];
}

/** Inner diameter of the printed SkinRing gadget's skin ring (hardware/frame.stl). */
export const DEFAULT_RING_INNER_DIAMETER_MM = 50;

/**
 * Detect ring in a canvas element or image data.
 * Works on downscaled preview frames (fast) or full-resolution capture frames.
 */
export function analyzeRingAndLesion(
  sourceCanvas: HTMLCanvasElement,
  configuredRingMm: number = DEFAULT_RING_INNER_DIAMETER_MM
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

  // 5. Real Lesion Segmentation in Lab Color Space
  // Precompute Lab color for all pixels
  const labL = new Float32Array(procSize * procSize);
  const labA = new Float32Array(procSize * procSize);
  const labB = new Float32Array(procSize * procSize);

  for (let y = 0; y < procSize; y++) {
    for (let x = 0; x < procSize; x++) {
      const pIdx = y * procSize + x;
      const idx4 = pIdx * 4;
      const [l, a, b] = rgbToLab(data[idx4], data[idx4 + 1], data[idx4 + 2]);
      labL[pIdx] = l;
      labA[pIdx] = a;
      labB[pIdx] = b;
    }
  }

  // Sample skin ring just inside the SkinRing inner rim
  const skinRInner = bestRadius * 0.72;
  const skinROuter = bestRadius * 0.88;
  const skinLList: number[] = [];
  const skinAList: number[] = [];
  const skinBList: number[] = [];

  for (let y = 0; y < procSize; y++) {
    for (let x = 0; x < procSize; x++) {
      const dx = x - bestCenter.x;
      const dy = y - bestCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= skinRInner && dist <= skinROuter) {
        const pIdx = y * procSize + x;
        skinLList.push(labL[pIdx]);
        skinAList.push(labA[pIdx]);
        skinBList.push(labB[pIdx]);
      }
    }
  }

  skinLList.sort((a, b) => a - b);
  skinAList.sort((a, b) => a - b);
  skinBList.sort((a, b) => a - b);
  const skinL = skinLList[Math.floor(skinLList.length / 2)] ?? 70;
  const skinA = skinAList[Math.floor(skinAList.length / 2)] ?? 15;
  const skinB = skinBList[Math.floor(skinBList.length / 2)] ?? 20;

  // Compute color distance deltaE in Lab against surrounding skin
  const innerRadius = bestRadius * 0.88;
  const innerIndices: number[] = [];
  const deltaEValues = new Float32Array(procSize * procSize);
  let maxDeltaE = 0;

  for (let y = 0; y < procSize; y++) {
    for (let x = 0; x < procSize; x++) {
      const dx = x - bestCenter.x;
      const dy = y - bestCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < innerRadius) {
        const pIdx = y * procSize + x;
        const dL = labL[pIdx] - skinL;
        const da = labA[pIdx] - skinA;
        const db = labB[pIdx] - skinB;
        const dE = Math.sqrt(dL * dL + da * da + db * db);
        deltaEValues[pIdx] = dE;
        if (dE > maxDeltaE) maxDeltaE = dE;
        innerIndices.push(pIdx);
      }
    }
  }

  // Otsu algorithm on color distance histogram
  const numBins = 256;
  const hist = new Uint32Array(numBins);
  const scaleFactor = maxDeltaE > 0 ? (numBins - 1) / maxDeltaE : 1;

  for (const pIdx of innerIndices) {
    const bin = Math.min(numBins - 1, Math.max(0, Math.round(deltaEValues[pIdx] * scaleFactor)));
    hist[bin]++;
  }

  const totalInner = innerIndices.length;
  let sumTotal = 0;
  for (let i = 0; i < numBins; i++) sumTotal += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxBetweenVar = -1;
  let bestBin = Math.round(numBins * 0.2);

  for (let t = 0; t < numBins; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalInner - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumTotal - sumB) / wF;
    const betweenVar = wB * wF * Math.pow(mB - mF, 2);

    if (betweenVar > maxBetweenVar) {
      maxBetweenVar = betweenVar;
      bestBin = t;
    }
  }

  const otsuThresholdDeltaE = maxDeltaE > 0 ? bestBin / scaleFactor : 10;
  const initialMask = new Uint8Array(procSize * procSize);
  for (const pIdx of innerIndices) {
    if (deltaEValues[pIdx] >= otsuThresholdDeltaE) {
      initialMask[pIdx] = 1;
    }
  }

  // Morphological Closing (Dilation then Erosion)
  const dilated = new Uint8Array(procSize * procSize);
  for (let y = 1; y < procSize - 1; y++) {
    for (let x = 1; x < procSize - 1; x++) {
      const pIdx = y * procSize + x;
      if (
        initialMask[pIdx] ||
        initialMask[pIdx - 1] || initialMask[pIdx + 1] ||
        initialMask[pIdx - procSize] || initialMask[pIdx + procSize] ||
        initialMask[pIdx - procSize - 1] || initialMask[pIdx - procSize + 1] ||
        initialMask[pIdx + procSize - 1] || initialMask[pIdx + procSize + 1]
      ) {
        dilated[pIdx] = 1;
      }
    }
  }

  const closed = new Uint8Array(procSize * procSize);
  for (let y = 1; y < procSize - 1; y++) {
    for (let x = 1; x < procSize - 1; x++) {
      const pIdx = y * procSize + x;
      if (
        dilated[pIdx] &&
        dilated[pIdx - 1] && dilated[pIdx + 1] &&
        dilated[pIdx - procSize] && dilated[pIdx + procSize] &&
        dilated[pIdx - procSize - 1] && dilated[pIdx - procSize + 1] &&
        dilated[pIdx + procSize - 1] && dilated[pIdx + procSize + 1]
      ) {
        closed[pIdx] = 1;
      }
    }
  }

  // Fill holes inside inner radius
  const outerReach = new Uint8Array(procSize * procSize);
  const floodQueue: number[] = [];

  for (let y = 0; y < procSize; y++) {
    for (let x = 0; x < procSize; x++) {
      const dx = x - bestCenter.x;
      const dy = y - bestCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const pIdx = y * procSize + x;
      if (dist >= innerRadius - 2) {
        outerReach[pIdx] = 1;
        floodQueue.push(pIdx);
      }
    }
  }

  let head = 0;
  while (head < floodQueue.length) {
    const curr = floodQueue[head++];
    const neighbors = [curr - 1, curr + 1, curr - procSize, curr + procSize];
    for (const n of neighbors) {
      if (n >= 0 && n < procSize * procSize && !outerReach[n] && !closed[n]) {
        outerReach[n] = 1;
        floodQueue.push(n);
      }
    }
  }

  const filledMask = new Uint8Array(closed);
  for (const pIdx of innerIndices) {
    if (!outerReach[pIdx]) {
      filledMask[pIdx] = 1;
    }
  }

  // Connected components: Keep largest connected component that touches the image center
  const visitedComp = new Uint8Array(procSize * procSize);
  const touchingComponents: { pixels: number[]; count: number }[] = [];
  const allComponents: { pixels: number[]; count: number; distToCenter: number }[] = [];
  const centerRadius = procSize * 0.12;

  for (const pIdx of innerIndices) {
    if (filledMask[pIdx] && !visitedComp[pIdx]) {
      const compPixels: number[] = [];
      const q: number[] = [pIdx];
      visitedComp[pIdx] = 1;
      let touchesCenter = false;
      let minDistToCenter = 999999;

      while (q.length > 0) {
        const curr = q.pop()!;
        compPixels.push(curr);
        const cx = curr % procSize;
        const cy = Math.floor(curr / procSize);
        const dCenter = Math.hypot(cx - bestCenter.x, cy - bestCenter.y);
        if (dCenter < minDistToCenter) minDistToCenter = dCenter;
        if (dCenter <= centerRadius) touchesCenter = true;

        const nbs = [curr - 1, curr + 1, curr - procSize, curr + procSize];
        for (const n of nbs) {
          if (n >= 0 && n < procSize * procSize && filledMask[n] && !visitedComp[n]) {
            visitedComp[n] = 1;
            q.push(n);
          }
        }
      }

      if (compPixels.length >= 25) {
        allComponents.push({ pixels: compPixels, count: compPixels.length, distToCenter: minDistToCenter });
        if (touchesCenter) {
          touchingComponents.push({ pixels: compPixels, count: compPixels.length });
        }
      }
    }
  }

  let selectedPixels: number[] = [];
  if (touchingComponents.length > 0) {
    touchingComponents.sort((a, b) => b.count - a.count);
    selectedPixels = touchingComponents[0].pixels;
  } else if (allComponents.length > 0) {
    allComponents.sort((a, b) => a.distToCenter - b.distToCenter);
    selectedPixels = allComponents[0].pixels;
  }

  const lesionDetected = selectedPixels.length >= 25;
  let lesionDiameterMm: number | null = null;
  let lesionAreaMm2: number | null = null;
  let circularityScore: number | null = null;
  let borderIrregularityScore: number | null = null;
  const contourPointsNormalized: { x: number; y: number }[] = [];

  if (lesionDetected) {
    const pixelSet = new Set<number>(selectedPixels);
    const boundaryPoints: { x: number; y: number }[] = [];

    for (const p of selectedPixels) {
      const px = p % procSize;
      const py = Math.floor(p / procSize);
      if (
        !pixelSet.has(p - 1) ||
        !pixelSet.has(p + 1) ||
        !pixelSet.has(p - procSize) ||
        !pixelSet.has(p + procSize)
      ) {
        boundaryPoints.push({ x: px, y: py });
      }
    }

    // Centroid of boundary
    let bCx = 0;
    let bCy = 0;
    for (const bp of boundaryPoints) {
      bCx += bp.x;
      bCy += bp.y;
    }
    bCx /= Math.max(1, boundaryPoints.length);
    bCy /= Math.max(1, boundaryPoints.length);

    // Sort by angle around centroid to form a continuous traced boundary chain
    const orderedContour = boundaryPoints
      .map((p) => ({
        x: p.x,
        y: p.y,
        angle: Math.atan2(p.y - bCy, p.x - bCx),
      }))
      .sort((a, b) => a.angle - b.angle);

    // Compute perimeter from the real contour (sum of Euclidean distances between successive boundary points)
    let perimeterProc = 0;
    const N = orderedContour.length;
    for (let i = 0; i < N; i++) {
      const p1 = orderedContour[i];
      const p2 = orderedContour[(i + 1) % N];
      perimeterProc += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    const perimeterActual = perimeterProc * scaleToSource;
    const areaActual = selectedPixels.length * Math.pow(scaleToSource, 2);

    // Exact area in mm²
    lesionAreaMm2 = Math.round(areaActual * Math.pow(mmPerPixel, 2) * 10) / 10;

    // Circularity = 4 * PI * Area / Perimeter^2
    const rawCircularity = (4 * Math.PI * areaActual) / Math.pow(perimeterActual, 2);
    const clampedCircularity = Math.min(1.0, Math.max(0.01, rawCircularity));
    circularityScore = Math.round(clampedCircularity * 100) / 100;

    // Border irregularity = 1 - circularity
    const rawBorderIrreg = 1 - clampedCircularity;
    borderIrregularityScore = Math.round(Math.max(0, rawBorderIrreg) * 100) / 100;

    // Max Feret Diameter of that contour in mm (using measured mm/px)
    let maxFeretPx = 0;
    const feretStep = Math.max(1, Math.floor(boundaryPoints.length / 100));
    const feretSamples: { x: number; y: number }[] = [];
    for (let i = 0; i < boundaryPoints.length; i += feretStep) {
      feretSamples.push(boundaryPoints[i]);
    }

    for (let i = 0; i < feretSamples.length; i++) {
      for (let j = i + 1; j < feretSamples.length; j++) {
        const d = Math.hypot(feretSamples[i].x - feretSamples[j].x, feretSamples[i].y - feretSamples[j].y);
        if (d > maxFeretPx) maxFeretPx = d;
      }
    }

    const maxFeretSourcePx = maxFeretPx * scaleToSource;
    lesionDiameterMm = Math.round(maxFeretSourcePx * mmPerPixel * 10) / 10;

    // Store 40 normalized contour points for SVG rendering
    const pointStep = Math.max(1, Math.floor(orderedContour.length / 40));
    for (let i = 0; i < orderedContour.length; i += pointStep) {
      contourPointsNormalized.push({
        x: Math.round((orderedContour[i].x / procSize) * 1000) / 1000,
        y: Math.round((orderedContour[i].y / procSize) * 1000) / 1000,
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
    circularityScore,
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
    circularityScore: null,
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
