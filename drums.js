import * as Tone from 'tone';

// Function to play the bass drum loop
export function playBassDrumLoop(volume = 0) {
  const bassDrum = new Tone.Player('kick1.wav').toDestination();
  bassDrum.autostart = true;

  bassDrum.volume.value = volume; // Adjust the volume level here

  bassDrum.load().then(() => {
    console.log('Audio file loaded successfully');
  }).catch((error) => {
    console.error('Error loading audio file:', error);
  });
}
// Function to play the snare drum loop
export function playSnareDrumLoop(volume = 0) {
    const snareDrum = new Tone.Player('snare1.wav').toDestination();
    snareDrum.autostart = true;
  
    snareDrum.volume.value = volume; // Adjust the volume level here

    snareDrum.load().then(() => {
      console.log('Audio file loaded successfully');
    }).catch((error) => {
      console.error('Error loading audio file:', error);
    });
  }
  
// Function to play the hi-hat drum loop
export function playHatLoop(volume = -8) {
    const hiHat = new Tone.Player('hat1.wav').toDestination();
    hiHat.autostart = true;

    hiHat.volume.value = volume; // Adjust the volume level here

    hiHat.load().then(() => {
      console.log('Audio file loaded successfully');
    }).catch((error) => {
      console.error('Error loading audio file:', error);
    });
  }
// Function to play the cymbal drum loop
export function playCymbalLoop(volume = -8) {
    const cymbal = new Tone.Player('cymbal1.wav').toDestination();
    cymbal.autostart = true;

    cymbal.volume.value = volume; // Adjust the volume level here

    cymbal.load().then(() => {
      console.log('Audio file loaded successfully');
    }).catch((error) => {
      console.error('Error loading audio file:', error);
    });
  }

// Function to play the conga1 drum loop
export function playConga1Loop(volume = -8) {
    const conga1 = new Tone.Player('conga1.wav').toDestination();
    conga1.autostart = true;

    conga1.volume.value = volume; // Adjust the volume level here

    conga1.load().then(() => {
      console.log('Audio file loaded successfully');
    }).catch((error) => {
      console.error('Error loading audio file:', error);
    });
  }
// Function to play the conga2 drum loop
export function playConga2Loop(volume = -8) {
    const conga2 = new Tone.Player('conga2.wav').toDestination();
    conga2.autostart = true;

    conga2.volume.value = volume; // Adjust the volume level here

    conga2.load().then(() => {
      console.log('Audio file loaded successfully');
    }).catch((error) => {
      console.error('Error loading audio file:', error);
    });
  }

// Function to change button color when pressed
export function changeButtonColor(buttonId) {
  const button = document.getElementById(buttonId);

  button.classList.add('pressed');
  setTimeout(() => {
    button.classList.remove('pressed');
  }, 100);
}
// Event listener to handle keydown events
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('keydown', (event) => {
      switch (event.key.toUpperCase()) {
        case 'V':
          playSnareDrumLoop();
          changeButtonColor('snareButton');
          break;
        case 'C':
          playBassDrumLoop();
          changeButtonColor('bassButton');
          break;
        case 'K':
          playHatLoop();
          changeButtonColor('hatButton');
          break;
        case 'J':
          playCymbalLoop();
          changeButtonColor('cymbalButton');
        case 'W':
          playConga1Loop();
          changeButtonColor('conga1Button');
          break;
        case 'E':
          playConga2Loop();
          changeButtonColor('conga2Button');
          break;
        default:
          break;
      }
    });
  });