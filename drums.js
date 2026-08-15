// drums.js
// Six one-shot samples, loaded once and retriggered. The single source of
// truth for which key plays which drum -- main.js builds the pads from it.

import * as Tone from 'tone';
import kick1 from './kick1.wav';
import snare1 from './snare1.wav';
import hat1 from './hat1.wav';
import cymbal1 from './cymbal1.wav';
import conga1 from './conga1.wav';
import conga2 from './conga2.wav';

export const DRUMS = [
  { id: 'kick', key: 'c', label: 'Kick', url: kick1, volume: -1 },
  { id: 'snare', key: 'v', label: 'Snare', url: snare1, volume: -3 },
  { id: 'hat', key: 'k', label: 'Hi-Hat', url: hat1, volume: -10 },
  { id: 'cymbal', key: 'j', label: 'Cymbal', url: cymbal1, volume: -13 },
  { id: 'conga1', key: 'w', label: 'Conga 1', url: conga1, volume: -7 },
  { id: 'conga2', key: 'e', label: 'Conga 2', url: conga2, volume: -7 },
];

let players = null;
let loaded = false;

// Two hits scheduled at the exact same AudioContext time make Tone throw, so
// each drum keeps its own strictly increasing cursor.
const lastHit = new Map();

export function isLoaded() {
  return loaded;
}

/**
 * Load every sample once and route them into the shared master node.
 *
 * @param {import('tone').ToneAudioNode} destination
 * @returns {Promise<void>} resolves when all samples are decoded
 */
export function loadDrums(destination) {
  if (players) return Tone.loaded();

  const urls = Object.fromEntries(DRUMS.map((d) => [d.id, d.url]));
  players = new Tone.Players({ urls }).connect(destination);

  for (const drum of DRUMS) {
    players.player(drum.id).volume.value = drum.volume;
  }

  return Tone.loaded().then(() => {
    loaded = true;
  });
}

/**
 * Trigger a drum by id. Safe to call before the samples finish loading and
 * safe to call faster than the sample length.
 *
 * @param {string} id one of the DRUMS ids
 * @returns {boolean} whether a sound was actually triggered
 */
export function playDrum(id) {
  if (!loaded || !players || !players.has(id)) return false;

  const now = Tone.now();
  const time = Math.max(now, (lastHit.get(id) ?? 0) + 0.02);
  lastHit.set(id, time);

  players.player(id).start(time);
  return true;
}

/** Look up a drum by its keyboard key, or undefined. */
export function drumForKey(key) {
  return DRUMS.find((d) => d.key === key);
}
