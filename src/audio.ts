import { state } from './state';
import type { DrumType, NoteHandle } from './types';

export function ensureAudioContext(): void {
  if (!state.audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    state.audioCtx = new AudioCtx();

    // Master compressor to keep multi-track mix clean and punchy
    const compressor = state.audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;

    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.value = state.masterVol;

    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 128;

    compressor.connect(state.masterGain);
    state.masterGain.connect(state.analyser);
    state.analyser.connect(state.audioCtx.destination);
    state.compressorNode = compressor;
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}

/**
 * Trigger any of the 11 instruments on a given AudioContext (realtime or offline).
 * If `duration` is provided, schedules note-off automatically.
 * Otherwise returns a `stop()` function for live key release.
 */
export function triggerSynthNote(
  ctx: BaseAudioContext,
  destNode: AudioNode,
  instId: string,
  midi: number,
  startTime: number,
  duration: number | null = null,
  velocity = 0.85
): NoteHandle {
  const freq = midiToFreq(midi);
  const t0 = Math.max(startTime, ctx.currentTime);
  const vel = Math.max(0.05, Math.min(1.0, velocity));

  const noteOut = ctx.createGain();
  noteOut.connect(destNode);

  const activeNodes: AudioScheduledSourceNode[] = [];
  let releaseTime = 0.25;

  switch (instId) {
    case 'piano': {
      // Grand Piano: Rich fundamental + 2nd/3rd harmonics + bright hammer transient
      releaseTime = 0.45;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(12000, freq * 9), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.2), t0 + 1.4);
      filter.connect(noteOut);

      const partials: { ratio: number; type: OscillatorType; gain: number }[] = [
        { ratio: 1, type: 'triangle', gain: 0.55 },
        { ratio: 2, type: 'sine', gain: 0.25 },
        { ratio: 3, type: 'sine', gain: 0.12 },
        { ratio: 4, type: 'triangle', gain: 0.06 }
      ];
      partials.forEach(p => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = p.type;
        osc.frequency.setValueAtTime(freq * p.ratio, t0);
        g.gain.setValueAtTime(p.gain * vel * 0.45, t0);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + 2.6 / Math.sqrt(p.ratio));
        osc.connect(g);
        g.connect(filter);
        osc.start(t0);
        activeNodes.push(osc);
      });

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(1.0, t0 + 0.008);
      break;
    }

    case 'epiano': {
      // Electric Piano (FM Tine + Warm Sine Body)
      releaseTime = 0.4;
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, t0);

      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq * 7, t0); // Bell harmonic
      modGain.gain.setValueAtTime(freq * 1.4 * vel, t0);
      modGain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.35);

      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(freq, t0);
      bodyGain.gain.setValueAtTime(0.22 * vel, t0);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(noteOut);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(noteOut);

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.45 * vel, t0 + 0.012);
      noteOut.gain.exponentialRampToValueAtTime(0.18 * vel, t0 + 0.8);

      carrier.start(t0);
      mod.start(t0);
      bodyOsc.start(t0);
      activeNodes.push(carrier, mod, bodyOsc);
      break;
    }

    case 'synthlead': {
      // Analog Detuned Sawtooth Lead with resonant filter envelope
      releaseTime = 0.22;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 4.5;
      filter.frequency.setValueAtTime(freq * 1.5, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.min(9000, freq * 7), t0 + 0.08);
      filter.frequency.exponentialRampToValueAtTime(freq * 3.2, t0 + 0.45);
      filter.connect(noteOut);

      [-9, 9].forEach(detune => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        osc.detune.setValueAtTime(detune, t0);
        osc.connect(filter);
        osc.start(t0);
        activeNodes.push(osc);
      });

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.26 * vel, t0 + 0.02);
      break;
    }

    case 'warmpad': {
      // Lush Ambient Pad with slow attack & chorus detune
      releaseTime = 0.75;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t0);
      filter.frequency.linearRampToValueAtTime(2400, t0 + 1.2);
      filter.connect(noteOut);

      [-14, 0, 14].forEach((det, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 1 ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        osc.detune.setValueAtTime(det, t0);
        osc.connect(filter);
        osc.start(t0);
        activeNodes.push(osc);
      });

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.22 * vel, t0 + 0.28);
      break;
    }

    case 'synthbass': {
      // Punchy Sub + Saw Synth Bass
      releaseTime = 0.14;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5.0;
      filter.frequency.setValueAtTime(freq * 6.5, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(110, freq * 1.6), t0 + 0.22);
      filter.connect(noteOut);

      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(freq, t0);

      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(freq, t0);

      const subGain = ctx.createGain();
      subGain.gain.value = 0.65;

      saw.connect(filter);
      sub.connect(subGain);
      subGain.connect(noteOut);

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.42 * vel, t0 + 0.01);

      saw.start(t0);
      sub.start(t0);
      activeNodes.push(saw, sub);
      break;
    }

    case 'organ': {
      // Hammond Drawbar Additive Organ
      releaseTime = 0.12;
      const drawbars = [
        { ratio: 0.5, gain: 0.35 },
        { ratio: 1.0, gain: 0.50 },
        { ratio: 1.5, gain: 0.30 },
        { ratio: 2.0, gain: 0.35 },
        { ratio: 3.0, gain: 0.20 },
        { ratio: 4.0, gain: 0.18 }
      ];
      drawbars.forEach(d => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * d.ratio, t0);
        g.gain.value = d.gain * 0.22 * vel;
        osc.connect(g);
        g.connect(noteOut);
        osc.start(t0);
        activeNodes.push(osc);
      });

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.85, t0 + 0.015);
      break;
    }

    case 'marimba': {
      // Wooden Mallet / Marimba (Fundamental + 4th harmonic transient)
      releaseTime = 0.25;
      const body = ctx.createOscillator();
      body.type = 'sine';
      body.frequency.setValueAtTime(freq, t0);

      const overtone = ctx.createOscillator();
      const overGain = ctx.createGain();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 4, t0);
      overGain.gain.setValueAtTime(0.35 * vel, t0);
      overGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.09);

      body.connect(noteOut);
      overtone.connect(overGain);
      overGain.connect(noteOut);

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.55 * vel, t0 + 0.005);
      noteOut.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);

      body.start(t0);
      overtone.start(t0);
      activeNodes.push(body, overtone);
      break;
    }

    case 'pluck': {
      // Plucked Harp / Synth Pluck
      releaseTime = 0.3;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 3.0;
      filter.frequency.setValueAtTime(Math.min(10000, freq * 10), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(250, freq * 1.2), t0 + 0.38);
      filter.connect(noteOut);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, t0);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, t0);

      osc1.connect(filter);
      osc2.connect(filter);

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.38 * vel, t0 + 0.006);
      noteOut.gain.exponentialRampToValueAtTime(0.002, t0 + 0.9);

      osc1.start(t0);
      osc2.start(t0);
      activeNodes.push(osc1, osc2);
      break;
    }

    case 'chiptune': {
      // 8-bit Retro Square Wave
      releaseTime = 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t0);
      osc.connect(noteOut);

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.22 * vel, t0 + 0.005);

      osc.start(t0);
      activeNodes.push(osc);
      break;
    }

    case 'brass': {
      // Synth Brass Ensemble with characteristic filter swell
      releaseTime = 0.25;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2.8;
      filter.frequency.setValueAtTime(freq * 1.2, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.min(8000, freq * 6.5), t0 + 0.14);
      filter.connect(noteOut);

      [-7, 0, 7].forEach(det => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        osc.detune.setValueAtTime(det, t0);
        osc.connect(filter);
        osc.start(t0);
        activeNodes.push(osc);
      });

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.24 * vel, t0 + 0.07);
      break;
    }

    case 'strings':
    default: {
      // Lush Strings Ensemble
      releaseTime = 0.55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, t0);
      filter.connect(noteOut);

      [-12, -4, 4, 12].forEach(det => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        osc.detune.setValueAtTime(det, t0);
        osc.connect(filter);
        osc.start(t0);
        activeNodes.push(osc);
      });

      noteOut.gain.setValueAtTime(0.001, t0);
      noteOut.gain.linearRampToValueAtTime(0.20 * vel, t0 + 0.22);
      break;
    }
  }

  const stopAt = (when: number): void => {
    const stopT = Math.max(when, ctx.currentTime);
    try {
      noteOut.gain.cancelScheduledValues(stopT);
      noteOut.gain.setValueAtTime(Math.max(0.001, noteOut.gain.value || 0.2), stopT);
      noteOut.gain.exponentialRampToValueAtTime(0.0001, stopT + releaseTime);
      activeNodes.forEach(node => {
        try { node.stop(stopT + releaseTime + 0.03); } catch (_) {}
      });
    } catch (_) {}
  };

  if (duration !== null) stopAt(t0 + duration);

  return { stop: () => stopAt(ctx.currentTime) };
}

/**
 * Synthesized Drum Kit (Kick, Snare, Closed Hi-Hat, Open Hi-Hat, Clap)
 */
export function triggerDrumHit(ctx: BaseAudioContext, destNode: AudioNode, drumType: DrumType, startTime: number, velocity = 0.9): void {
  const t0 = Math.max(startTime, ctx.currentTime);
  const vel = Math.max(0.05, Math.min(1.0, velocity));

  if (drumType === 'kick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, t0);
    osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
    osc.frequency.exponentialRampToValueAtTime(32, t0 + 0.35);

    gain.gain.setValueAtTime(0.95 * vel, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);

    osc.connect(gain);
    gain.connect(destNode);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  } else if (drumType === 'snare' || drumType === 'clap') {
    // Noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = drumType === 'clap' ? 'bandpass' : 'highpass';
    filter.frequency.value = drumType === 'clap' ? 1200 : 800;
    filter.Q.value = drumType === 'clap' ? 1.8 : 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55 * vel, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + (drumType === 'clap' ? 0.22 : 0.18));

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(destNode);
    noise.start(t0);

    if (drumType === 'snare') {
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(185, t0);
      body.frequency.exponentialRampToValueAtTime(75, t0 + 0.1);
      bodyGain.gain.setValueAtTime(0.45 * vel, t0);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      body.connect(bodyGain);
      bodyGain.connect(destNode);
      body.start(t0);
      body.stop(t0 + 0.14);
    }
  } else if (drumType === 'hat' || drumType === 'openhat') {
    const dur = drumType === 'openhat' ? 0.24 : 0.06;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28 * vel, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destNode);
    noise.start(t0);
  }
}
