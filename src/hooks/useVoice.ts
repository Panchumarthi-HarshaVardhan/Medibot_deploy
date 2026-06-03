import { authFetch } from '@/utils/api';
/**
 * useVoice
 *
 * Speech Input  : Web Speech API (SpeechRecognition) — free, browser-native
 * Speech Output : Google Cloud TTS Neural2 — natural, human-like voice
 *                 Routed through /api/voice/speak to keep the API key server-side
 *
 * Free tier: 1,000,000 characters/month (Neural2 & WaveNet voices)
 * Setup: add GOOGLE_TTS_API_KEY to your .env
 */

import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export type VoiceState = 'idle' | 'listening' | 'speaking';

export interface UseVoiceReturn {
  voiceState: VoiceState;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => string;
  speak: (text: string, options?: { languageCode?: string; voiceName?: string }) => Promise<void>;
  cancelSpeech: () => void;
  isSupported: { stt: boolean; tts: boolean };
  error: string | null;
  clearError: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isSttSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

// TTS is supported as long as the server endpoint is reachable (always true)
const isTtsSupported = () => true;

const getSpeechRecognitionClass = (): typeof SpeechRecognition | null => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const speakWithBrowser = (text: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Text-to-speech is not supported in this browser.'));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 800));
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('Browser speech failed.'));
    window.speechSynthesis.speak(utterance);
  });

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useVoice = (): UseVoiceReturn => {
  const [voiceState, setVoiceState]     = useState<VoiceState>('idle');
  const [transcript, setTranscript]     = useState('');
  const [error, setError]               = useState<string | null>(null);

  const recognitionRef    = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef   = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ── startListening (Web Speech API — unchanged) ───────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (voiceState === 'listening') return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = '';
    setTranscript('');
    setError(null);

    recognition.onstart = () => setVoiceState('listening');

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) finalTranscriptRef.current += final;
      setTranscript(finalTranscriptRef.current || interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      switch (event.error) {
        case 'not-allowed':
          setError('Microphone permission denied. Allow microphone access in your browser settings.'); break;
        case 'no-speech':
          setError('No speech detected. Please speak clearly and try again.'); break;
        case 'network':
          setError('Network error during speech recognition.'); break;
        default:
          setError(`Speech recognition error: ${event.error}`);
      }
      setVoiceState('idle');
    };

    recognition.onend = () => {
      setVoiceState(prev => (prev === 'listening' ? 'idle' : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [voiceState]);

  // ── stopListening ─────────────────────────────────────────────────────────
  const stopListening = useCallback((): string => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceState('idle');
    const result = (finalTranscriptRef.current || transcript).trim();
    setTranscript('');
    finalTranscriptRef.current = '';
    return result;
  }, [transcript]);

  // ── speak — Google Cloud TTS with browser fallback ───────────────────────
  const speak = useCallback(async (text: string, options?: { languageCode?: string; voiceName?: string }) => {
    if (!text?.trim()) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();

    setVoiceState('speaking');
    setError(null);

    const cleanText = text.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 800);

    const playGoogleAudio = async (): Promise<void> => {
      const response = await authFetch('/api/voice/speak', {
        method: 'POST',
        body: JSON.stringify({ text: cleanText, voiceName: options?.voiceName, languageCode: options?.languageCode }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error || `TTS failed (${response.status})`
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('audio')) {
        throw new Error('TTS returned an invalid audio response.');
      }

      const audioBlob = await response.blob();
      if (audioBlob.size < 100) {
        throw new Error('TTS returned empty audio.');
      }

      const blobUrl = URL.createObjectURL(audioBlob);
      audioBlobUrlRef.current = blobUrl;

      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(blobUrl);
          audioBlobUrlRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          audioBlobUrlRef.current = null;
          reject(new Error('Audio playback failed.'));
        };
        audio.play().catch(reject);
      });
    };

    try {
      await playGoogleAudio();
      setVoiceState('idle');
    } catch (googleErr) {
      console.warn('Google TTS unavailable, using browser voice:', googleErr);
      try {
        await speakWithBrowser(cleanText);
        setVoiceState('idle');
      } catch (browserErr) {
        const message =
          browserErr instanceof Error
            ? browserErr.message
            : googleErr instanceof Error
              ? googleErr.message
              : 'Text-to-speech failed';
        setError(message);
        setVoiceState('idle');
      }
    }
  }, []);

  // ── cancelSpeech ──────────────────────────────────────────────────────────
  const cancelSpeech = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setVoiceState('idle');
  }, []);

  return {
    voiceState,
    isListening:  voiceState === 'listening',
    isSpeaking:   voiceState === 'speaking',
    transcript,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    isSupported: { stt: isSttSupported(), tts: isTtsSupported() },
    error,
    clearError,
  };
};
