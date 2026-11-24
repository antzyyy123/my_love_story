/**
 * Synthesized Web Audio Music-Box / Bell Engine for "Your Laugh"
 * 100% hard-coded synthesis (zero audio files).
 * - Lazy AudioContext creation on first user gesture
 * - C Major Pentatonic over 2+ octaves (12 notes)
 * - Sine fundamental + quiet octave-up triangle + faint detuned partial
 * - 5ms attack, 1.2s exponential decay, master gain (0.25), compressor & feedback delay reverb
 * - Max 12-voice polyphony with oldest-voice recycling & per-note throttle
 */

export const PENTATONIC_FREQS = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0,  // G4
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66, // D6
] as const;

interface ActiveVoice {
  stopAt: number;
  stopNow: () => void;
}

export class BellAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private voices: ActiveVoice[] = [];
  private lastNoteTimes: number[] = Array(12).fill(0);
  private muted = false;
  private closed = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.25, now, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.closed || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        const ctx = new AudioCtx();
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0.0001 : 0.25;

        // Gentle compressor to prevent clipping during fast glissandos & laugh arpeggios
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 18;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.16;

        // Warm feedback-delay reverb (lightweight, zero external IR files)
        const delay = ctx.createDelay(0.6);
        delay.delayTime.value = 0.23;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.28;
        const damp = ctx.createBiquadFilter();
        damp.type = "lowpass";
        damp.frequency.value = 2600;
        const wet = ctx.createGain();
        wet.gain.value = 0.28;

        master.connect(comp);
        comp.connect(ctx.destination);

        master.connect(delay);
        delay.connect(damp);
        damp.connect(feedback);
        feedback.connect(delay);
        damp.connect(wet);
        wet.connect(comp);

        this.ctx = ctx;
        this.masterGain = master;
      } catch {
        return null;
      }
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Triggers one music-box/bell chime for flower index 0..11.
   * `velocity` in [0.35..1.0] scales volume softly.
   */
  public playNote(flowerIdx: number, velocity = 0.8, bypassThrottle = false) {
    if (this.muted || this.closed) return;
    const idx = Math.max(0, Math.min(PENTATONIC_FREQS.length - 1, flowerIdx));
    const nowMs = performance.now();
    if (!bypassThrottle && nowMs - this.lastNoteTimes[idx] < 85) return;
    this.lastNoteTimes[idx] = nowMs;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // Prune expired voices and enforce max 12-voice polyphony by recycling the oldest
    this.voices = this.voices.filter((v) => v.stopAt > now);
    if (this.voices.length >= 12) {
      const oldest = this.voices.shift();
      oldest?.stopNow();
    }

    const baseFreq = PENTATONIC_FREQS[idx];
    const detuneCents = (Math.random() - 0.5) * 8;
    const amp = Math.max(0.18, Math.min(1, velocity)) * 0.48;
    const decaySec = 1.22;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(amp, now + 0.005); // crisp 5ms music-box attack
    env.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);
    env.connect(this.masterGain);

    // Fundamental sine
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.detune.setValueAtTime(detuneCents, now);
    osc1.connect(env);

    // Quiet triangle an octave above
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 2, now);
    osc2.detune.setValueAtTime(detuneCents * 1.2, now);
    const g2 = ctx.createGain();
    g2.gain.value = 0.22;
    osc2.connect(g2);
    g2.connect(env);

    // Faint detuned bell partial
    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(baseFreq * 3.008, now);
    const g3 = ctx.createGain();
    g3.gain.value = 0.08;
    osc3.connect(g3);
    g3.connect(env);

    const stopAt = now + decaySec + 0.04;
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(stopAt);
    osc2.stop(stopAt);
    osc3.stop(stopAt);

    const voice: ActiveVoice = {
      stopAt,
      stopNow: () => {
        try {
          const t = ctx.currentTime;
          env.gain.cancelScheduledValues(t);
          env.gain.setTargetAtTime(0.0001, t, 0.015);
          osc1.stop(t + 0.05);
          osc2.stop(t + 0.05);
          osc3.stop(t + 0.05);
        } catch {
          // Already stopped
        }
      },
    };
    this.voices.push(voice);
  }

  public dispose() {
    this.closed = true;
    this.voices.forEach((v) => v.stopNow());
    this.voices = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
