import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Parse JSON payloads up to 30MB for high-resolution dermoscopic image analysis
app.use(express.json({ limit: '30mb' }));

// Dedicated API router to guarantee all /api endpoints are handled before static/Vite fallbacks
const apiRouter = express.Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

apiRouter.post('/analyze-lesion', async (req: Request, res: Response) => {
  try {
    const {
      currentImage,
      baselineImage,
      lesionContext,
      language = 'en',
    } = req.body;

    if (!currentImage) {
      return res.status(400).json({
        success: false,
        error: 'currentImage is required for lesion analysis',
      });
    }

    // Helper to extract base64 data and mime type
    const extractImageParts = (dataUri: string) => {
      const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        return {
          mimeType: matches[1],
          data: matches[2],
        };
      }
      return {
        mimeType: 'image/jpeg',
        data: dataUri.replace(/^data:image\/\w+;base64,/, ''),
      };
    };

    // If GEMINI_API_KEY is available in the environment, call Google Gemini Vision API
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const currentImgPart = extractImageParts(currentImage);
        const parts: any[] = [
          {
            inlineData: {
              mimeType: currentImgPart.mimeType,
              data: currentImgPart.data,
            },
          },
        ];

        let comparisonPrompt = '';
        if (baselineImage) {
          const baselineImgPart = extractImageParts(baselineImage);
          parts.push({
            inlineData: {
              mimeType: baselineImgPart.mimeType,
              data: baselineImgPart.data,
            },
          });
          comparisonPrompt = 'Two images are provided. Image 1 is the CURRENT visit photo. Image 2 is the BASELINE/PREVIOUS visit photo. Perform comparative lesion morphology analysis to evaluate evolution.';
        }

        const langInstruction =
          language === 'es'
            ? 'Please write the plainLanguageExplanation and clinicalConsiderations in Spanish.'
            : language === 'de'
            ? 'Please write the plainLanguageExplanation and clinicalConsiderations in German.'
            : 'Please write the plainLanguageExplanation and clinicalConsiderations in English.';

        const systemInstruction = `You are an AI-assisted dermoscopy and skin-lesion documentation and triage-support tool called SkinRing.
SkinRing is strictly a documentation and triage-support aid, NOT a diagnostic medical device.
CRITICAL MANDATORY RULES:
1. NEVER declare or state a medical diagnosis (e.g., do NOT state "This is melanoma" or "This is seborrheic keratosis").
2. Describe observed objective morphological features: asymmetry, border characteristics, color variability, diameter estimate in millimeters, and comparison changes if a baseline is present.
3. Categorize triage risk level strictly into one of three values:
   - "low" (uniform, stable, typical benign features)
   - "review" (equivocal features, slight asymmetry or border irregularity, warrants routine or 3-month clinical follow-up)
   - "urgent review" (marked asymmetry, abrupt border cut-off, multiple colors, rapid evolution, or high-risk Argenziano signs; warrants prompt face-to-face evaluation by a dermatologist or qualified specialist).
4. Always emphasize that final assessment, dermatoscope examination, and histopathological correlation rest solely with a qualified healthcare provider.
5. ${langInstruction}`;

        const contextSummary = lesionContext
          ? `Lesion Details:\n- Anatomical location: ${lesionContext.anatomicalLocation || 'Not specified'}\n- Measured ring calibration scale: ${lesionContext.mmPerPixel ? `${Number(lesionContext.mmPerPixel).toFixed(4)} mm/px` : 'Not available'}\n- Calibrated ring inner diameter: ${lesionContext.ringDiameterMm || 30} mm\n- Patient Fitzpatrick skin type: ${lesionContext.fitzpatrickType || 'Not specified'}\n- Risk factors: ${lesionContext.riskFactors ? JSON.stringify(lesionContext.riskFactors) : 'None reported'}\n- ABCDE observations: ${lesionContext.abcde ? JSON.stringify(lesionContext.abcde) : 'None'}`
          : 'No patient context provided.';

        const promptText = `${comparisonPrompt}\n\n${contextSummary}\n\nEvaluate the lesion image(s) captured with the SkinRing standardized spacer. Assess morphological asymmetry, border regularity, color distribution, diameter estimate in mm, and structural change if baseline is provided. Output strictly valid JSON adhering to the response schema.`;

        parts.push({ text: promptText });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                observedFeatures: {
                  type: Type.OBJECT,
                  properties: {
                    asymmetry: {
                      type: Type.STRING,
                      description: 'Symmetry or asymmetry across perpendicular axes (symmetric, mild asymmetry, marked asymmetry).',
                    },
                    borderIrregularity: {
                      type: Type.STRING,
                      description: 'Border definition, sharp cutoffs, notched or scalloped contours.',
                    },
                    colorVariation: {
                      type: Type.STRING,
                      description: 'Colors observed (e.g., uniform light brown, dark brown, black, blue-gray, red, hypopigmentation).',
                    },
                    diameterEstimateMm: {
                      type: Type.NUMBER,
                      description: 'Estimated greatest diameter of the lesion in millimeters.',
                    },
                    changeSinceLastVisit: {
                      type: Type.STRING,
                      description: 'Comparison assessment if baseline was provided (stable, enlarged, altered pigment, or initial baseline).',
                    },
                  },
                  required: ['asymmetry', 'borderIrregularity', 'colorVariation', 'diameterEstimateMm', 'changeSinceLastVisit'],
                },
                riskLevel: {
                  type: Type.STRING,
                  description: 'Must be low, review, or urgent review',
                },
                confidence: {
                  type: Type.NUMBER,
                  description: 'Confidence percentage from 0 to 100 based on image clarity, lighting and visibility.',
                },
                plainLanguageExplanation: {
                  type: Type.STRING,
                  description: 'Clear, compassionate explanation for provider and patient explaining visible characteristics without medical diagnostic labels.',
                },
                clinicalConsiderations: {
                  type: Type.STRING,
                  description: 'Practical clinical notes, e.g., recommend dermoscopy, palpation, 3-month follow-up, or urgent specialist referral.',
                },
                recommendedFollowUpMonths: {
                  type: Type.INTEGER,
                  description: 'Suggested follow-up interval in months (e.g. 1 for urgent review, 3 for monitoring, 6 or 12 for routine low risk).',
                },
                disclaimer: {
                  type: Type.STRING,
                  description: 'Mandatory non-diagnostic disclaimer.',
                },
              },
              required: [
                'observedFeatures',
                'riskLevel',
                'confidence',
                'plainLanguageExplanation',
                'clinicalConsiderations',
                'recommendedFollowUpMonths',
                'disclaimer',
              ],
            },
          },
        });

        const text = response.text || '{}';
        const parsedData = JSON.parse(text);

        return res.json({
          success: true,
          analysis: parsedData,
          analyzedAt: new Date().toISOString(),
          model: 'gemini-3.8-flash',
        });
      } catch (geminiError: any) {
        console.warn('Gemini API call failed:', geminiError?.message || geminiError);
        return res.status(503).json({
          error: 'AI analysis unavailable',
        });
      }
    }

    // If GEMINI_API_KEY is not configured, return 503
    return res.status(503).json({
      error: 'AI analysis unavailable',
    });
  } catch (error: any) {
    console.error('Error in /api/analyze-lesion:', error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to process lesion image',
    });
  }
});

// Explicit 404 handler for any unmatched /api routes to prevent falling through to HTML index
apiRouter.all('*', (req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Mount /api router FIRST before static or Vite SPA fallbacks
app.use('/api', apiRouter);

// JSON error handling middleware for Express
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Express error handler:', err);
  return res.status(400).json({
    success: false,
    error: err.message || 'Internal request processing error',
  });
});

// Setup Vite middlewares in development or static serve in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SkinRing server running at http://localhost:${port}`);
  });
}

startServer();
