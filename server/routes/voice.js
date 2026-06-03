/**
 * server/routes/voice.js
 *
 * POST /api/voice/speak
 *   Body:  { text: string, voiceName?: string, speakingRate?: number }
 *   Returns: audio/mpeg stream (MP3)
 *
 * Uses the Google Cloud Text-to-Speech REST API.
 * No SDK required — just a fetch to the REST endpoint.
 * Free tier: 1,000,000 characters/month for Neural2 and WaveNet voices.
 *
 * Setup:
 *   1. Enable "Cloud Text-to-Speech API" at https://console.cloud.google.com/apis/library
 *   2. Create an API key (restrict it to the TTS API only for security)
 *   3. Add GOOGLE_TTS_API_KEY to your .env
 *
 * Available Neural2 voices (best quality, free tier):
 *   en-US-Neural2-F  — female, warm and clear  (recommended)
 *   en-US-Neural2-C  — female, professional
 *   en-US-Neural2-D  — male, deep
 *   en-US-Neural2-A  — male, neutral
 *
 * Available WaveNet voices (also great, same free tier):
 *   en-US-Wavenet-F  — female
 *   en-US-Wavenet-D  — male
 */

import express from 'express';

const router = express.Router();

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Default voice — Neural2-F sounds natural and clear for medical context
const DEFAULT_VOICE = process.env.GOOGLE_TTS_VOICE || 'en-US-Neural2-F';
const DEFAULT_RATE  = 0.97; // Slightly slower than default for clarity

const getTtsApiKey = () => process.env.GOOGLE_TTS_API_KEY || null;

/**
 * Clean bot response text before speaking:
 *  - strip markdown symbols (* _ ` # > ~)
 *  - convert links to just their label
 *  - collapse whitespace
 *  - cap at 1000 chars so we don't blow free-tier quota on a single message
 */
const cleanForSpeech = (text) => {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // [label](url) → label
    .replace(/[*_`#>~]/g, '')                   // markdown symbols
    .replace(/⚠️|😊|✅|❌|🔴|🟠|⭐/g, '')     // emoji that don't speak well
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
};

// POST /api/voice/speak
router.post('/speak', async (req, res) => {
  const { text, voiceName, speakingRate, languageCode } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey = getTtsApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'Google Cloud TTS is not configured. Add GOOGLE_TTS_API_KEY to your .env file.'
    });
  }

  const cleanText = cleanForSpeech(text);

  // Map standard language codes to Google TTS voice names if voiceName is not explicitly provided
  let resolvedVoiceName = voiceName;
  let resolvedLangCode = 'en-US';
  if (!resolvedVoiceName) {
    if (languageCode === 'hi') {
      resolvedVoiceName = 'hi-IN-Neural2-A';
      resolvedLangCode = 'hi-IN';
    } else if (languageCode === 'te') {
      resolvedVoiceName = 'te-IN-Standard-A';
      resolvedLangCode = 'te-IN';
    } else {
      resolvedVoiceName = DEFAULT_VOICE;
    }
  } else {
    // If voiceName is provided, try to extract language code from it
    const parts = resolvedVoiceName.split('-');
    if (parts.length >= 2) resolvedLangCode = `${parts[0]}-${parts[1]}`;
  }

  const requestBody = {
    input: { text: cleanText },
    voice: {
      languageCode: resolvedLangCode,
      name: resolvedVoiceName,
      // ssmlGender is inferred from the voice name — no need to set manually
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: speakingRate ?? DEFAULT_RATE,
      pitch: 0,          // natural pitch
      volumeGainDb: 0,   // natural volume
      // Omit effectsProfileId — some keys/voices reject unknown effect profiles
    },
  };

  try {
    const googleRes = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!googleRes.ok) {
      const err = await googleRes.json().catch(() => ({}));
      console.error('Google TTS API error:', googleRes.status, err);

      if (googleRes.status === 400) {
        return res.status(400).json({ error: 'Invalid TTS request. Check voice name or text.' });
      }
      if (googleRes.status === 401 || googleRes.status === 403) {
        return res.status(503).json({
          error: 'Google TTS API key is invalid or the TTS API is not enabled on your project.'
        });
      }
      if (googleRes.status === 429) {
        return res.status(429).json({ error: 'Google TTS quota exceeded. Try again later.' });
      }
      return res.status(502).json({ error: 'Text-to-speech service unavailable.' });
    }

    const { audioContent } = await googleRes.json();

    if (!audioContent) {
      return res.status(502).json({ error: 'No audio returned from Google TTS.' });
    }

    // audioContent is base64-encoded MP3 — decode and send as binary
    const audioBuffer = Buffer.from(audioContent, 'base64');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(audioBuffer);

  } catch (err) {
    console.error('Google TTS route error:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Text-to-speech failed. Please try again.' });
    }
  }
});

export default router;
