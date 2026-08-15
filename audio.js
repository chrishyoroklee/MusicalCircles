// audio.js
// Master signal chain, the polyphonic voice pool used by the spheres, and the
// mapping from a sphere's place in the world to a note.

import * as Tone from 'tone';
import { loadDrums } from './drums.js';

// Major pentatonic. Every sphere lands on one of these, so there is no way to
// play a wrong note no matter where things get dragged.
const SCALE_DEGREES = [0, 2, 4, 7, 9];
const ROOT_MIDI = 36; // C2
const OCTAVE_COUNT = 5;

export const DEGREE_COUNT = SCALE_DEGREES.length * OCTAVE_COUNT;

// ---------------------------------------------------------------------------
// Note length. These four numbers are the whole story, tune them together:
//   how long the key is "held"      -> NOTE_HOLD_BASE + size * NOTE_HOLD_PER_SIZE
//   how loud it stays while held    -> NOTE_ENVELOPE.sustain
//   how long it fades after release -> NOTE_ENVELOPE.release
// Total audible ring is roughly hold + release, plus the reverb tail.
// ---------------------------------------------------------------------------

const NOTE_ENVELOPE = {
  attack: 0.012,
  decay: 0.8,
  sustain: 0.5, // held level, as a fraction of peak
  release: 3.4,
};

const NOTE_HOLD_BASE = 1.3;
const NOTE_HOLD_PER_SIZE = 1.5;

/** Seconds a sphere of the given scale factor is held before releasing. */
export function noteDuration(size) {
  return NOTE_HOLD_BASE + size * NOTE_HOLD_PER_SIZE;
}

// Longer notes overlap far more, so the pool needs more voices before it starts
// stealing from itself mid-phrase.
const VOICE_COUNT = 28;

let master = null;
let reverb = null;
let voices = [];
let nextVoice = 0;
let ready = false;
let drumsReady = null;

export function isReady() {
  return ready;
}

export function getMaster() {
  return master;
}

/** Resolves once every drum sample is decoded and playable. */
export function whenDrumsReady() {
  return drumsReady ?? Promise.resolve();
}

/**
 * Must be called from a user gesture. Resumes the AudioContext, builds the
 * signal chain and kicks off drum sample loading.
 *
 * @returns {Promise<void>} resolves once the synth is playable; drum samples
 *   keep loading in the background and report separately.
 */
export async function startAudio() {
  if (ready) return;
  await Tone.start();

  master = new Tone.Limiter(-2).toDestination();

  reverb = new Tone.Reverb({ decay: 4, preDelay: 0.02, wet: 1 }).connect(master);

  const reverbSend = new Tone.Gain(0.32).connect(reverb);
  const tone = new Tone.Filter({ type: 'lowpass', frequency: 6500, Q: 0.4 });
  // Trimmed for the longer envelope: notes now overlap several deep, so the
  // per-voice level has to come down to leave the limiter some headroom.
  const synthBus = new Tone.Gain(0.38);

  synthBus.connect(tone);
  tone.connect(master);
  tone.connect(reverbSend);

  voices = Array.from({ length: VOICE_COUNT }, () => {
    const panner = new Tone.Panner(0).connect(synthBus);
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: NOTE_ENVELOPE,
    }).connect(panner);
    return { synth, panner };
  });

  ready = true;

  // Drums share the master limiter so nothing clips when a chord and a kick
  // land on the same frame. Samples keep loading after this resolves.
  drumsReady = loadDrums(master);
}

/** Semitone-accurate frequency for a scale degree index (0 = lowest). */
export function degreeToFrequency(degree) {
  const clamped = Math.min(DEGREE_COUNT - 1, Math.max(0, Math.round(degree)));
  const octave = Math.floor(clamped / SCALE_DEGREES.length);
  const step = SCALE_DEGREES[clamped % SCALE_DEGREES.length];
  return Tone.Frequency(ROOT_MIDI + octave * 12 + step, 'midi').toFrequency();
}

/**
 * Play one note through the round-robin voice pool.
 *
 * @param {object} options
 * @param {number} options.degree   scale degree index, 0..DEGREE_COUNT-1
 * @param {number} [options.pan]    -1 (left) to 1 (right)
 * @param {number} [options.velocity] 0..1
 * @param {number} [options.duration] seconds the note is held before releasing
 */
export function playNote({ degree, pan = 0, velocity = 0.7, duration = noteDuration(1) }) {
  if (!ready) return;

  const voice = voices[nextVoice];
  nextVoice = (nextVoice + 1) % voices.length;

  voice.panner.pan.value = Math.min(1, Math.max(-1, pan));
  voice.synth.triggerAttackRelease(
    degreeToFrequency(degree),
    duration,
    Tone.now(),
    Math.min(1, Math.max(0.05, velocity)),
  );
}
