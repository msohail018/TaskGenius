import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { XMarkIcon, MicrophoneIcon, StopCircleIcon } from '@heroicons/react/24/outline';

const PHASE = { LISTENING: 'listening', PROCESSING: 'processing', ERROR: 'error' };

const VoiceTask = ({ onClose, onTaskCreated }) => {
  const [phase, setPhase]           = useState(PHASE.LISTENING);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');

  // Refs — safe to read inside recognition callbacks
  const transcriptRef  = useRef('');
  const phaseRef       = useRef(PHASE.LISTENING);
  const autoRestartRef = useRef(true);   // keep restarting until user clicks Done
  const recognitionRef = useRef(null);

  const setPhaseSync = (p) => { phaseRef.current = p; setPhase(p); };

  // ── Send captured text to Magic Mode backend ──
  const processVoiceTask = async (text) => {
    setPhaseSync(PHASE.PROCESSING);
    try {
      const res = await api.post('/tasks', { mode: 'magic', text });
      onTaskCreated(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'AI failed to create the task. Please try again.';
      setPhaseSync(PHASE.ERROR);
      setErrorMsg(msg);
    }
  };

  // ── Create, configure and start a brand-new recognition object ──
  const createAndStart = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setPhaseSync(PHASE.ERROR);
      setErrorMsg('Voice recognition is not supported. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    // Always create a FRESH instance — you cannot restart a stopped one
    const recognition           = new SpeechRecognition();
    recognition.continuous      = false;   // fire onend after one phrase
    recognition.interimResults  = true;
    recognition.lang            = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      const display = final || interim;
      if (display) setTranscript(display);
      if (final.trim()) transcriptRef.current = final.trim();
    };

    recognition.onend = () => {
      // ── If we're no longer in LISTENING, don't do anything ──
      if (phaseRef.current !== PHASE.LISTENING) return;

      if (transcriptRef.current.trim()) {
        // We have text — process it
        autoRestartRef.current = false;
        processVoiceTask(transcriptRef.current.trim());
      } else if (autoRestartRef.current) {
        // No text yet & user hasn't clicked Done — silently restart
        setTimeout(() => {
          if (phaseRef.current === PHASE.LISTENING && autoRestartRef.current) {
            createAndStart();
          }
        }, 150);
      } else {
        // User clicked Done but nothing was captured
        setPhaseSync(PHASE.ERROR);
        setErrorMsg('No speech was captured. Please speak clearly and try again.');
      }
    };

    recognition.onerror = (event) => {
      if (phaseRef.current !== PHASE.LISTENING) return;

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        autoRestartRef.current = false;
        setPhaseSync(PHASE.ERROR);
        setErrorMsg(
          'Microphone access was denied. Click the 🔒 in the browser address bar, ' +
          'allow Microphone, reload the page, then try again.'
        );
      } else if (event.error === 'audio-capture') {
        autoRestartRef.current = false;
        setPhaseSync(PHASE.ERROR);
        setErrorMsg('No microphone detected. Please connect a microphone and try again.');
      } else if (event.error === 'network') {
        autoRestartRef.current = false;
        setPhaseSync(PHASE.ERROR);
        setErrorMsg('Network error during voice recognition. Check your connection and try again.');
      } else if (event.error === 'no-speech' || event.error === 'aborted') {
        // Expected — onend will handle the auto-restart or Done processing
      } else {
        // Unknown error — restart unless it keeps failing
        console.warn('SpeechRecognition error:', event.error);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      // InvalidStateError: already started — ignore, onend will restart
      console.warn('recognition.start() threw:', e.message);
    }
  };

  // ── Auto-start on mount ──
  useEffect(() => {
    createAndStart();
    return () => {
      autoRestartRef.current = false;
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  // ── "Done Speaking" clicked — stop auto-restart, stop recognition and process ──
  const handleDone = () => {
    autoRestartRef.current = false;
    const hasSpeech = transcriptRef.current.trim();
    try { recognitionRef.current?.stop(); } catch (_) {}
    // If we already have text, process immediately without waiting for onend
    if (hasSpeech) {
      processVoiceTask(hasSpeech);
    }
    // Otherwise let onend fire — it will show the error
  };

  // ── Retry — full reset ──
  const handleRetry = () => {
    transcriptRef.current = '';
    autoRestartRef.current = true;
    setTranscript('');
    setErrorMsg('');
    setPhaseSync(PHASE.LISTENING);
    // Small delay to let Chrome fully release the mic before starting again
    setTimeout(() => createAndStart(), 200);
  };

  // ── Cancel ──
  const handleCancel = () => {
    autoRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    onClose();
  };

  // ─────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Voice task creation"
    >
      <button onClick={handleCancel} aria-label="Cancel"
        className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
        <XMarkIcon className="h-6 w-6" />
      </button>

      <div className="flex flex-col items-center gap-8 px-6 text-center max-w-sm w-full">

        {/* LISTENING */}
        {phase === PHASE.LISTENING && (
          <>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-32 h-32 rounded-full bg-violet-500/30 animate-sonar-1" />
              <div className="absolute w-32 h-32 rounded-full bg-violet-500/20 animate-sonar-2" />
              <div className="absolute w-32 h-32 rounded-full bg-violet-500/10 animate-sonar-3" />
              <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-900/60">
                <MicrophoneIcon className="h-10 w-10 text-white" />
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold text-white">Listening...</p>
              <p className="text-sm text-white/50 mt-1">
                Speak your task, then click <strong className="text-white/80">Done Speaking</strong>
              </p>
            </div>

            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 min-h-[64px] flex items-center justify-center">
              {transcript
                ? <p className="text-white font-medium text-base leading-relaxed italic">"{transcript}"</p>
                : <p className="text-white/30 text-sm italic">Your words will appear here...</p>
              }
            </div>

            <div className="flex gap-3 w-full">
              <button onClick={handleDone}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-white text-gray-900 font-bold text-sm shadow-lg hover:bg-gray-100 transition-all active:scale-95">
                <StopCircleIcon className="h-5 w-5 text-violet-600" />
                Done Speaking
              </button>
              <button onClick={handleCancel}
                className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* PROCESSING */}
        {phase === PHASE.PROCESSING && (
          <>
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full animate-spin-gradient"
                style={{ background: 'conic-gradient(from 0deg, #7c3aed, #4f46e5, #06b6d4, #7c3aed)', padding: '3px', borderRadius: '50%' }} />
              <div className="relative z-10 w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center">
                <MicrophoneIcon className="h-8 w-8 text-violet-400" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">Processing...</p>
              <p className="text-sm text-white/50 mt-1">AI is creating your task</p>
            </div>
            {transcript && (
              <div className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4">
                <p className="text-white/80 text-sm italic">"{transcript}"</p>
              </div>
            )}
          </>
        )}

        {/* ERROR */}
        {phase === PHASE.ERROR && (
          <>
            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
            <div>
              <p className="text-xl font-bold text-white">Something went wrong</p>
              <p className="text-sm text-red-300 mt-3 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={handleRetry}
                className="flex-1 py-3 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-all active:scale-95">
                🎙 Try Again
              </button>
              <button onClick={handleCancel}
                className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceTask;
