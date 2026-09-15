import { Settings, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useSpeechSynthesis } from '../hooks/useSpeech';

interface VoiceSettingsProps {
  onClose?: () => void;
}

export function VoiceSettings({ onClose }: VoiceSettingsProps) {
  const { voices, selectedVoice, changeVoice, speak } = useSpeechSynthesis();
  const [rate, setRate] = useState(Number(localStorage.getItem('jarvis_rate') || '1.05'));
  const [pitch, setPitch] = useState(Number(localStorage.getItem('jarvis_pitch') || '1.0'));
  const [volume, setVolume] = useState(Number(localStorage.getItem('jarvis_volume') || '1.0'));

  function handleVoiceChange(voiceName: string) {
    changeVoice(voiceName);
  }

  function handleRateChange(newRate: number) {
    setRate(newRate);
    localStorage.setItem('jarvis_rate', String(newRate));
  }

  function handlePitchChange(newPitch: number) {
    setPitch(newPitch);
    localStorage.setItem('jarvis_pitch', String(newPitch));
  }

  function handleVolumeChange(newVolume: number) {
    setVolume(newVolume);
    localStorage.setItem('jarvis_volume', String(newVolume));
  }

  function testVoice() {
    speak("Hello, I'm JARVIS. This is how I sound with the current settings.", { rate, pitch, volume });
  }

  const categorizedVoices = voices.reduce((acc, voice) => {
    const lang = voice.lang.split('-')[0];
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(voice);
    return acc;
  }, {} as Record<string, typeof voices>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-cyan-400" />
          Voice Settings
        </h3>
      </div>

      {/* Voice Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Voice</label>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Object.entries(categorizedVoices).map(([lang, voiceList]) => (
            <div key={lang}>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 mt-3 first:mt-0">{lang}</p>
              {voiceList.map((voice) => (
                <button
                  key={voice.name}
                  onClick={() => handleVoiceChange(voice.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedVoice?.name === voice.name
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{voice.name}</span>
                    {voice.localService && (
                      <span className="text-xs text-green-400">(Local)</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Rate */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Speed: {rate.toFixed(2)}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={rate}
          onChange={(e) => handleRateChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Slower</span>
          <span>Faster</span>
        </div>
      </div>

      {/* Pitch */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Pitch: {pitch.toFixed(2)}
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={pitch}
          onChange={(e) => handlePitchChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Lower</span>
          <span>Higher</span>
        </div>
      </div>

      {/* Volume */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Volume: {Math.round(volume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Quiet</span>
          <span>Loud</span>
        </div>
      </div>

      {/* Test Button */}
      <button
        onClick={testVoice}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
      >
        Test Voice
      </button>
    </div>
  );
}
