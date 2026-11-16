// WebAudio sound — one job: every sound in the game, synthesized live, no audio
// files. Created lazily on the first user gesture so browsers allow it; all
// calls are safe before that (they no-op).

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      context = new AudioCtx();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ freq = 440, end = null, type = 'sine', dur = 0.15, vol = 0.5, delay = 0, slide = null }) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    else if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.4, delay = 0, low = 400 }) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + delay;
    const len = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    pulse() {
      tone({ freq: 660, end: 990, type: 'sine', dur: 0.22, vol: 0.45 });
      tone({ freq: 1320, end: 880, type: 'triangle', dur: 0.18, vol: 0.18, delay: 0.02 });
    },
    banish(kind) {
      const base = kind === 'brute' ? 160 : kind === 'spitter' ? 300 : 220;
      tone({ freq: base, slide: base * 2.4, type: 'sawtooth', dur: 0.16, vol: 0.22 });
      noise({ dur: 0.12, vol: 0.25, low: 900 });
    },
    hit() {
      tone({ freq: 140, slide: 55, type: 'square', dur: 0.28, vol: 0.5 });
      noise({ dur: 0.25, vol: 0.4, low: 500 });
    },
    ember() {
      tone({ freq: 880, end: 1318, type: 'sine', dur: 0.12, vol: 0.3 });
      tone({ freq: 1318, end: 1760, type: 'sine', dur: 0.1, vol: 0.2, delay: 0.07 });
    },
    pickup() {
      tone({ freq: 523, type: 'triangle', dur: 0.1, vol: 0.35 });
      tone({ freq: 784, type: 'triangle', dur: 0.14, vol: 0.35, delay: 0.08 });
      tone({ freq: 1046, type: 'triangle', dur: 0.18, vol: 0.3, delay: 0.16 });
    },
    horn() {
      tone({ freq: 196, type: 'sawtooth', dur: 0.7, vol: 0.28 });
      tone({ freq: 294, type: 'sawtooth', dur: 0.7, vol: 0.22, delay: 0.05 });
      tone({ freq: 392, type: 'triangle', dur: 0.8, vol: 0.2, delay: 0.1 });
    },
    bossRoar() {
      tone({ freq: 90, slide: 45, type: 'sawtooth', dur: 0.9, vol: 0.5 });
      noise({ dur: 0.7, vol: 0.3, low: 300 });
    },
    gameOver() {
      tone({ freq: 392, type: 'triangle', dur: 0.35, vol: 0.35 });
      tone({ freq: 311, type: 'triangle', dur: 0.35, vol: 0.35, delay: 0.3 });
      tone({ freq: 233, type: 'triangle', dur: 0.7, vol: 0.35, delay: 0.6 });
    },
    waveClear() {
      tone({ freq: 523, type: 'sine', dur: 0.12, vol: 0.3 });
      tone({ freq: 659, type: 'sine', dur: 0.12, vol: 0.3, delay: 0.1 });
      tone({ freq: 784, type: 'sine', dur: 0.25, vol: 0.3, delay: 0.2 });
    },
    // Revamp sounds (§5): upgrade pick (three rising notes), beacon lit
    // (bell + hum), shell crack (sharp crack + noise), warden rage
    // (harsh fall + noise). Same tone/noise pattern as the old sounds.
    upgradePick() {
      tone({ freq: 523, type: 'sine', dur: 0.12, vol: 0.35 });
      tone({ freq: 659, type: 'sine', dur: 0.12, vol: 0.35, delay: 0.09 });
      tone({ freq: 784, type: 'sine', dur: 0.25, vol: 0.35, delay: 0.18 });
    },
    beaconLit() {
      tone({ freq: 1046, type: 'sine', dur: 0.5, vol: 0.35 });
      tone({ freq: 784, type: 'sine', dur: 0.7, vol: 0.2, delay: 0.05 });
      tone({ freq: 1568, type: 'sine', dur: 0.6, vol: 0.25, delay: 0.12 });
    },
    shellCrack() {
      tone({ freq: 1200, end: 300, type: 'square', dur: 0.1, vol: 0.3 });
      noise({ dur: 0.15, vol: 0.35, low: 1800 });
    },
    wardenRage() {
      tone({ freq: 220, slide: 55, type: 'sawtooth', dur: 0.6, vol: 0.5 });
      noise({ dur: 0.5, vol: 0.35, low: 400 });
    },
  };
}
