// sound.js

import * as Tone from 'tone';

export function createAudioSources(draggableSpheres) {
  const synths = [];

  draggableSpheres.forEach((sphere) => {
    const synth = new Tone.AMSynth().toDestination();
    synths.push({ sphere,  synth });
  });

  return synths;
}

export function playAudioOnSphereClick(sphere, synth) {
  sphere.addEventListener('click', () => {
    // Example: Triggering the synth with different parameters on sphere click
    synth.triggerAttackRelease('C4', '8n');
  });
}

// export function 