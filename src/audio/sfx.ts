/**
 * Retro sound effects synthesised with WebAudio: no audio files to load or license.
 * The AudioContext starts on the first click/keypress (browsers require a gesture).
 */

export type SoundName =
  | 'hit' | 'miss' | 'hurt' | 'block' | 'eat' | 'pickup' | 'mine' | 'chop' | 'fish' | 'cook' | 'burn'
  | 'smith' | 'prayerOn' | 'prayerOff' | 'levelup' | 'death' | 'stairs' | 'magic' | 'arrow' | 'buy' | 'bury';

const MUTE_KEY = 'roguescape.muted';

class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // No storage: default to sound on.
    }
  }

  /** Call from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      // WebAudio unavailable: stay silent.
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Not persisted; fine.
    }
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(gain).connect(this.master!);
    src.start(t);
  }

  play(name: SoundName): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'hit': this.noise(0.08, 0.5, 'lowpass', 1200); this.tone(140, 0.08, 'square', 0.15, 70); break;
      case 'miss': this.noise(0.06, 0.15, 'highpass', 2000); break;
      case 'hurt': this.tone(220, 0.14, 'sawtooth', 0.2, 100); this.noise(0.06, 0.3, 'lowpass', 800); break;
      case 'block': this.tone(900, 0.08, 'triangle', 0.25); this.tone(1350, 0.06, 'triangle', 0.15, undefined, 0.02); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(0.04, 0.3, 'bandpass', 900, i * 0.09); break;
      case 'pickup': this.tone(660, 0.07, 'square', 0.12, 990); break;
      case 'mine': this.tone(1800, 0.07, 'triangle', 0.25); this.noise(0.03, 0.3, 'highpass', 3000); break;
      case 'chop': this.noise(0.07, 0.45, 'lowpass', 600); this.tone(180, 0.05, 'square', 0.12); break;
      case 'fish': this.noise(0.25, 0.3, 'bandpass', 1500); break;
      case 'cook': this.noise(0.3, 0.12, 'highpass', 4000); break;
      case 'burn': this.noise(0.3, 0.15, 'highpass', 3000); this.tone(160, 0.2, 'sawtooth', 0.1, 80); break;
      case 'smith': this.tone(1400, 0.25, 'triangle', 0.25); this.tone(2100, 0.18, 'sine', 0.1); break;
      case 'prayerOn': this.tone(440, 0.15, 'sine', 0.25, 880); break;
      case 'prayerOff': this.tone(880, 0.15, 'sine', 0.2, 440); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.15, undefined, i * 0.1)); break;
      case 'death': this.tone(300, 0.9, 'sawtooth', 0.25, 50); break;
      case 'stairs': this.noise(0.35, 0.25, 'lowpass', 500); this.tone(300, 0.35, 'sine', 0.15, 120); break;
      case 'magic': this.tone(600, 0.25, 'sine', 0.2, 1400); this.tone(900, 0.2, 'triangle', 0.08, 1800, 0.05); break;
      case 'arrow': this.noise(0.08, 0.3, 'highpass', 3500); this.tone(500, 0.06, 'triangle', 0.08, 300); break;
      case 'buy': this.tone(988, 0.08, 'square', 0.15); this.tone(1319, 0.2, 'square', 0.15, undefined, 0.08); break;
      case 'bury': this.noise(0.18, 0.35, 'lowpass', 400); break;
    }
  }
}

export const sfx = new Sfx();
