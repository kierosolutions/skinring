import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
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

// Claude Opus 5.5 reads the lesion photos and returns the triage as structured JSON.
const CLAUDE_MODEL = 'claude-opus-5-5';
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

class UnsupportedImageError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported image type ${mimeType}; use JPEG, PNG, GIF or WebP`);
  }
}

const LesionAnalysisSchema = z.object({
  observedFeatures: z.object({
    asymmetry: z.string().describe('Symmetry or asymmetry across perpendicular axes (symmetric, mild asymmetry, marked asymmetry).'),
    borderIrregularity: z.string().describe('Border definition, sharp cutoffs, notched or scalloped contours.'),
    colorVariation: z.string().describe('Colors observed (e.g., uniform light brown, dark brown, black, blue-gray, red, hypopigmentation).'),
    diameterEstimateMm: z.number().describe('Estimated greatest diameter of the lesion in millimeters.'),
    changeSinceLastVisit: z.string().describe('Comparison assessment if baseline was provided (stable, enlarged, altered pigment, or initial baseline).'),
  }),
  riskLevel: z.enum(['low', 'review', 'urgent review']),
  confidence: z.number().describe('Confidence percentage from 0 to 100 based on image clarity, lighting and visibility.'),
  plainLanguageExplanation: z.string().describe('Clear, compassionate explanation for provider and patient explaining visible characteristics without medical diagnostic labels.'),
  clinicalConsiderations: z.string().describe('Practical clinical notes, e.g., recommend dermoscopy, palpation, 3-month follow-up, or urgent specialist referral.'),
  recommendedFollowUpMonths: z.number().int().describe('Suggested follow-up interval in months (e.g. 1 for urgent review, 3 for monitoring, 6 or 12 for routine low risk).'),
  disclaimer: z.string().describe('Mandatory non-diagnostic disclaimer.'),
});

apiRouter.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
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

    // AI triage runs only when ANTHROPIC_API_KEY is configured. There is no fallback result:
    // without a key, or if Claude fails or declines, the client gets 503 and shows "AI analysis not available".
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'AI analysis unavailable',
      });
    }

    try {
      const toImageBlock = (dataUri: string): Anthropic.Beta.BetaImageBlockParam => {
        const { mimeType, data } = extractImageParts(dataUri);
        if (!SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageType)) {
          throw new UnsupportedImageError(mimeType);
        }
        return {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as SupportedImageType, data },
        };
      };

      const content: Anthropic.Beta.BetaContentBlockParam[] = [toImageBlock(currentImage)];

      let comparisonPrompt = '';
      if (baselineImage) {
        content.push(toImageBlock(baselineImage));
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
        ? `Lesion Details:\n- Anatomical location: ${lesionContext.anatomicalLocation || 'Not specified'}\n- Measured ring calibration scale: ${lesionContext.mmPerPixel ? `${Number(lesionContext.mmPerPixel).toFixed(4)} mm/px` : 'Not available'}\n- Calibrated ring inner diameter: ${lesionContext.ringDiameterMm ? `${lesionContext.ringDiameterMm} mm` : 'Not available'}\n- Patient Fitzpatrick skin type: ${lesionContext.fitzpatrickType || 'Not specified'}\n- Risk factors: ${lesionContext.riskFactors ? JSON.stringify(lesionContext.riskFactors) : 'None reported'}\n- ABCDE observations: ${lesionContext.abcde ? JSON.stringify(lesionContext.abcde) : 'None'}`
        : 'No patient context provided.';

      const promptText = `${comparisonPrompt}\n\n${contextSummary}\n\nEvaluate the lesion image(s) captured with the SkinRing standardized spacer. Assess morphological asymmetry, border regularity, color distribution, diameter estimate in mm, and structural change if baseline is provided. Output strictly valid JSON adhering to the response schema.`;

      content.push({ type: 'text', text: promptText });

      const response = await anthropic.beta.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system: systemInstruction,
        messages: [{ role: 'user', content }],
        output_config: {
          effort: 'high',
          format: betaZodOutputFormat(LesionAnalysisSchema),
        },
        // If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });

      if (response.stop_reason === 'refusal') {
        console.warn('Claude declined the lesion analysis:', response.stop_details?.category ?? 'no category');
        return res.status(503).json({
          error: 'AI analysis unavailable',
        });
      }
      if (!response.parsed_output) {
        console.warn('Claude returned no parseable analysis, stop_reason:', response.stop_reason);
        return res.status(503).json({
          error: 'AI analysis unavailable',
        });
      }

      return res.json({
        success: true,
        analysis: response.parsed_output,
        analyzedAt: new Date().toISOString(),
        model: response.model,
      });
    } catch (claudeError: any) {
      if (claudeError instanceof UnsupportedImageError) {
        return res.status(400).json({
          success: false,
          error: claudeError.message,
        });
      }
      console.warn('Claude API call failed:', claudeError?.message || claudeError);
      return res.status(503).json({
        error: 'AI analysis unavailable',
      });
    }
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
