import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import './BrandSplash.css';

const sajiloDentalMark = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;
const soundPreference = 'sajilo.startup-sound';
type StartupStage = 'checking' | 'workspace' | 'sign-in' | 'unavailable';
const stageLabels: Record<StartupStage, string> = {
  checking: 'Checking your saved session…',
  workspace: 'Session restored. Opening your workspace…',
  'sign-in': 'Ready to sign in',
  unavailable: 'Opening session recovery…',
};

/** Session authority and the five-second minimum stay in IdentityGate. */
export function BrandSplash({ stage = 'checking' }: { stage?: StartupStage }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem(soundPreference) !== 'off'; } catch { return true; }
  });
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!soundEnabled) return;
    // Original quiet glass-like voicing over a warm low root; no network dependency.
    let disposed = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const context = new AudioContext();
          audio.current = context;
          await context.resume();
          if (disposed) { if (context.state !== 'closed') await context.close(); return; }
          const now = context.currentTime + .03;
          const master = context.createGain();
          master.gain.value = .15;
          master.connect(context.destination);
          [[261.63, 0], [392, .16], [523.25, .32], [659.25, .48]].forEach(([frequency, delay]) => {
            const note = context.createOscillator(), envelope = context.createGain();
            note.type = 'sine';
            note.frequency.value = frequency;
            envelope.gain.setValueAtTime(0, now + delay);
            envelope.gain.linearRampToValueAtTime(.28, now + delay + .035);
            envelope.gain.exponentialRampToValueAtTime(.0001, now + delay + 1.25);
            note.connect(envelope); envelope.connect(master);
            note.start(now + delay); note.stop(now + delay + 1.3);
            if (delay === .48) note.onended = () => {
              if (context.state !== 'closed') void context.close().catch(() => {});
              if (audio.current === context) audio.current = null;
            };
          });
        } catch {
          // An unavailable audio device must never prevent session recovery.
          if (audio.current && audio.current.state !== 'closed') void audio.current.close().catch(() => {});
          audio.current = null;
        }
      })();
    }, 300);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      const context = audio.current;
      audio.current = null;
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    };
  }, [soundEnabled]);

  function toggleSound() {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    try { localStorage.setItem(soundPreference, enabled ? 'on' : 'off'); } catch { /* Session-only preference. */ }
  }

  const complete = stage !== 'checking';
  return (
    <main className="brand-splash sajilo-startup-surface" aria-label="Starting Sajilo Dental">
      <div className="brand-splash__ambient" aria-hidden="true" />
      <div className="brand-splash__flow brand-splash__flow--near" aria-hidden="true" />
      <div className="brand-splash__flow brand-splash__flow--far" aria-hidden="true" />
      <div className="brand-splash__lockup">
        <img className="brand-splash__mark" src={sajiloDentalMark} alt="" />
        <h1 className="brand-splash__name">Sajilo <span>Dental</span></h1>
        <p className="brand-splash__tagline">Less admin. <span>More room to grow.</span></p>
        <div className="brand-splash__startup">
          <div className="brand-splash__progress" role="progressbar" aria-label="Startup session check"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={complete ? 100 : undefined}
            aria-valuetext={stageLabels[stage]} data-complete={complete}>
            <div className="brand-splash__progress-fill" />
          </div>
          <p className="brand-splash__status" role="status">{stageLabels[stage]}</p>
        </div>
      </div>
      <button className="brand-splash__sound" type="button" onClick={toggleSound}
        aria-label={soundEnabled ? 'Mute startup sound' : 'Enable startup sound'} aria-pressed={soundEnabled}>
        {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
        <span>Sound {soundEnabled ? 'on' : 'off'}</span>
      </button>
    </main>
  );
}
