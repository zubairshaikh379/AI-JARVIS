import { useState, useEffect, useCallback } from 'react';

interface VoiceOption {
  voice: SpeechSynthesisVoice;
  label: string;
  lang: string;
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [supported] = useState(typeof window !== 'undefined' && 'speechSynthesis' in window);

  useEffect(() => {
    if (!supported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Auto-select best voice
      if (!selectedVoice && availableVoices.length > 0) {
        const preferred =
          availableVoices.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ||
          availableVoices.find((v) => v.name.includes('Samantha')) || // MacOS
          availableVoices.find((v) => v.name.includes('Microsoft Zira')) || // Windows
          availableVoices.find((v) => v.lang.startsWith('en')) ||
          availableVoices[0];
        setSelectedVoice(preferred);

        // Save to localStorage
        if (preferred) {
          localStorage.setItem('jarvis_voice', preferred.name);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Load saved voice preference
    const savedVoiceName = localStorage.getItem('jarvis_voice');
    if (savedVoiceName) {
      const savedVoice = voices.find(v => v.name === savedVoiceName);
      if (savedVoice) setSelectedVoice(savedVoice);
    }

    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [supported, selectedVoice, voices]);

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number; volume?: number }) => {
    if (!supported || !text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = options?.rate ?? 1.05;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported, selectedVoice]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const changeVoice = useCallback((voiceName: string) => {
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      setSelectedVoice(voice);
      localStorage.setItem('jarvis_voice', voiceName);
    }
  }, [voices]);

  return { speak, cancel, speaking, supported, voices, selectedVoice, changeVoice };
}

export function useSpeechRecognition({ onResult, lang = 'en-US' }: { onResult?: (text: string, isFinal: boolean) => void; lang?: string } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useState<any>(null)[0];
  const onResultRef = useState(onResult)[0];

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => prev + final);
        onResultRef.current?.(final, true);
      } else if (interim) {
        onResultRef.current?.(interim, false);
      }
    };

    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [lang, onResultRef, recognitionRef]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript('');
    setError(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // already started
    }
  }, [recognitionRef]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // already stopped
    }
    setIsListening(false);
  }, [recognitionRef]);

  const reset = useCallback(() => setTranscript(''), []);

  return { isListening, transcript, error, start, stop, reset, supported: !error };
}
