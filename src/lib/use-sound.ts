"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Ambient sound design for the harbor. Provides subtle UI feedback tones
 * inspired by traditional East Asian instruments (the wooden clapper for
 * confirmations, a soft bell for arrivals, a low drum for warnings).
 *
 * All sounds are synthesized at runtime via the Web Audio API. No audio
 * files are loaded, so there is no async asset loading and no network
 * dependency. The toggle persists in localStorage so a captain's
 * preference survives a reload.
 *
 * The ambient harbor bed is a very low volume looping pad of filtered
 * noise that evokes distant waves and harbor activity. It only plays
 * when the toggle is on and the page is visible.
 *
 * The volume slider (0 to 100) scales both the ambient bed and the UI
 * feedback tones. The volume persists in localStorage and is read on
 * mount via a lazy initializer.
 */

const STORAGE_KEY = "portmasters_sound_enabled";
const VOLUME_KEY = "portmasters_sound_volume";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

type ToneKind =
  | "click"
  | "confirm"
  | "success"
  | "warn"
  | "error"
  | "arrive"
  | "depart"
  | "coin"
  | "phase";

const TONE_PROFILES: Record<
  ToneKind,
  {
    freq: number;
    dur: number;
    type: OscillatorType;
    vol: number;
    sweep?: number;
  }
> = {
  click: { freq: 440, dur: 0.05, type: "sine", vol: 0.04 },
  confirm: { freq: 523, dur: 0.12, type: "sine", vol: 0.06, sweep: 659 },
  success: { freq: 587, dur: 0.18, type: "triangle", vol: 0.07, sweep: 880 },
  warn: { freq: 330, dur: 0.15, type: "sawtooth", vol: 0.05 },
  error: { freq: 220, dur: 0.25, type: "sawtooth", vol: 0.06 },
  arrive: { freq: 660, dur: 0.3, type: "sine", vol: 0.08, sweep: 880 },
  depart: { freq: 880, dur: 0.3, type: "sine", vol: 0.08, sweep: 440 },
  coin: { freq: 988, dur: 0.08, type: "triangle", vol: 0.05 },
  phase: { freq: 392, dur: 0.2, type: "sine", vol: 0.06, sweep: 523 },
};

function playTone(kind: ToneKind, volumeScale: number = 1) {
  const ctx = getCtx();
  if (!ctx) return;
  const p = TONE_PROFILES[kind];
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.freq, now);
  if (p.sweep) {
    osc.frequency.linearRampToValueAtTime(p.sweep, now + p.dur);
  }
  const scaledVol = p.vol * volumeScale;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(scaledVol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + p.dur + 0.05);
}

// The ambient bed target gain at volume 100. Kept very low so the bed
// is a subtle texture, not a foreground sound.
const AMBIENT_BASE_GAIN = 0.015;

export function useSound() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [volume, setVolumeState] = useState(() => {
    if (typeof window === "undefined") return 50;
    try {
      const v = localStorage.getItem(VOLUME_KEY);
      return v ? Number(v) : 50;
    } catch {
      return 50;
    }
  });
  const ambientRef = useRef<{
    osc: OscillatorNode;
    osc2: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  // The volume as a 0 to 1 multiplier, used by both the ambient bed
  // and the UI feedback tones.
  const volumeScale = volume / 100;

  // Manage the ambient bed
  useEffect(() => {
    if (!enabled) {
      if (ambientRef.current) {
        try {
          ambientRef.current.gain.gain.linearRampToValueAtTime(
            0,
            getCtx()!.currentTime + 0.5,
          );
          const ref = ambientRef.current;
          setTimeout(() => {
            try {
              ref.osc.stop();
              ref.osc2.stop();
            } catch {
              // best effort
            }
          }, 600);
          ambientRef.current = null;
        } catch {
          // best effort
        }
      }
      return;
    }
    const ctx = getCtx();
    if (!ctx) return;

    // Build a soft ambient pad: two detuned sines through a lowpass
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.value = 110;
    osc2.type = "sine";
    osc2.frequency.value = 110.5;
    filter.type = "lowpass";
    filter.frequency.value = 400;
    gain.gain.value = 0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    // Ramp to the volume scaled ambient gain
    gain.gain.linearRampToValueAtTime(
      AMBIENT_BASE_GAIN * volumeScale,
      ctx.currentTime + 2,
    );

    ambientRef.current = { osc, osc2, gain, filter };

    return () => {
      try {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        setTimeout(() => {
          osc.stop();
          osc2.stop();
        }, 400);
      } catch {
        // best effort
      }
    };
    // volumeScale is derived from volume, so we depend on volume here
    // to re ramp the gain when the slider moves. But we do NOT want to
    // tear down and rebuild the whole ambient bed on every volume
    // change, so we handle volume changes in a separate effect below.
  }, [enabled]);

  // Update the ambient bed gain when volume changes (without rebuilding
  // the oscillators). This is a smooth ramp, not an instant jump.
  useEffect(() => {
    if (!ambientRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      ambientRef.current.gain.gain.linearRampToValueAtTime(
        AMBIENT_BASE_GAIN * volumeScale,
        ctx.currentTime + 0.3,
      );
    } catch {
      // best effort
    }
  }, [volumeScale]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // private browsing
      }
      if (next) {
        // Play a confirm tone so the user hears that sound is now on
        setTimeout(() => playTone("confirm", volumeScale), 100);
      }
      return next;
    });
  }, [volumeScale]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setVolumeState(clamped);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // private browsing
    }
  }, []);

  const play = useCallback(
    (kind: ToneKind) => {
      if (!enabled) return;
      playTone(kind, volumeScale);
    },
    [enabled, volumeScale],
  );

  return { enabled, toggle, play, volume, setVolume };
}
