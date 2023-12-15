

import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as Tone from 'tone';
import { playBassDrumLoop, playSnareDrumLoop, playHatLoop, changeButtonColor } from './drums'; // Import drum-related functions


let toneSynth;
let sphereState = {}; // To maintain state for each sphere
let activeVoices = {}; // To manage active voices for polyphony

// Function to create the Tone.js synth
function createSynth() {
  return new Tone.Synth().toDestination();
}

// Function to initialize audio context and start the virtual world
function initializeAudioAndStartWorld() {
  Tone.start().then(() => {
    toneSynth = createSynth(); // Assign the created synth to toneSynth
    startVirtualWorld(); // Start the 3D virtual world after audio context is initialized
  }).catch((err) => {
    console.error('Tone.js context error:', err);
  });
}

function startVirtualWorld() {
  // Setup
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 50);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  //Set the clear color (bg color) of the renderer to white
  renderer.setClearColor(0xD5F5E3); // 0xffffff is hte hexadecimal color code for white

  // Add Ambient Light
  const ambientLight = new THREE.AmbientLight(0x58D68D , 1); // soft white light
  scene.add(ambientLight);

  // Add Directional Light
  const directionalLight = new THREE.DirectionalLight(0x58D68D , 0.8); //1 is the full intensity
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Draggable Spheres and Rotating Boxes
  const draggableSpheres = [];
  const rotatingBoxes = [];

  function createBoundingBox() {
    const boxSize = 4.2; // Define the size of each individual box

    const numBoxesX = 20; // Number of boxes along X-axis
    const numBoxesY = 10; // Number of boxes along Y-axis
    const numBoxesZ = 10; // Number of boxes along Z-axis

    const aspectRatio = window.innerWidth / window.innerHeight;

    // Calculate the aspect ratio-adjusted number of boxes along X-axis
    const adjustedNumBoxesX = Math.floor(numBoxesY * aspectRatio);

    const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x145A32, wireframe: true, wireframeLinewidth: 1 });

    const boxGrid = new THREE.Group(); // Group to hold the grid of boxes

    // Calculate total width and height based on adjusted number of boxes
    const totalWidth = boxSize * adjustedNumBoxesX;
    const totalHeight = boxSize * numBoxesY;
    const totalDepth = boxSize * numBoxesZ;

    // Position the grid at the center of the screen
    const xOffset = -totalWidth / 2;
    const yOffset = -totalHeight / 2;
    const zOffset = -totalDepth / 2;

    for (let i = 0; i < adjustedNumBoxesX; i++) {
      for (let j = 0; j < numBoxesY; j++) {
        for (let k = 0; k < numBoxesZ; k++) {
          const smallBox = new THREE.Mesh(boxGeometry, boxMaterial);
          const x = i * boxSize + xOffset;
          const y = j * boxSize + yOffset;
          const z = k * boxSize + zOffset;

          smallBox.position.set(x, y, z);
          boxGrid.add(smallBox);
        }
      }
    }

    scene.add(boxGrid);
  }

  function addDraggableSphere() {
    const geometry = new THREE.SphereGeometry(1, 32, 32);

    // Generate pastel-like color by randomizing RGB values between certain ranges
    const pastelColor = new THREE.Color(
      Math.random() * 0.5 + 0.5,  // R component between 0.5 and 1
      Math.random() * 0.5 + 0.5,  // G component between 0.5 and 1
      Math.random() * 0.5 + 0.5   // B component between 0.5 and 1
    );  

    const material = new THREE.MeshStandardMaterial({ color: pastelColor });
    const sphere = new THREE.Mesh(geometry, material);

    const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(30));

    sphere.position.set(x, y, z);
    scene.add(sphere);
    draggableSpheres.push(sphere);

  }

  // Function to create rotating boxes
  function createRotatingBoxes() {
    const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xff5733 });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);

    const radius = 30; // Radius of the circular path
    const theta = Math.random() * Math.PI * 2; // Random angle for initial positioning
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const z = 0; // Keep z-axis at 0 for a 2D circular orbit

    box.position.set(x, y, z);
    scene.add(box);
    rotatingBoxes.push(box);

    return box;
  }

  // Add # of draggable spheres
  Array(100).fill().forEach(addDraggableSphere);

  //Create a bounding box around the spheres
  createBoundingBox();

  // // Create rotating boxes
  // for (let i = 0; i < 7; i++) {
  //   createRotatingBoxes();
  // }

  // Mouse interaction for dragging spheres
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedSphere = null;
  let initialScale = 1;
  const minScale = 0.5; // Set minimum scale value for the spheres

  // Function to handle mouse click events
  function onMouseClick(event) {
    // Calculate mouse coordinates in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(draggableSpheres);

    // Check if any sphere is clicked
    if (intersects.length > 0) {
      const clickedSphere = intersects[0].object;

      // Trigger the sound when a sphere is clicked
      if (Tone.context.state === 'running') {
        if (toneSynth) {
          toneSynth.triggerAttackRelease(Math.abs(mouse.x * 900), '1n');
        } else {
          console.error('Tone.js synth not yet initialized.');
        }
      } else {
        console.error('Tone.js context not started yet.');
      }
    }
  }

  // Event listener for mouse click
  window.addEventListener('click', onMouseClick, false);
  // Listen for mouse clicks on the document and play a note when dragging a sphere
  let isDragging = false;

  document.addEventListener('mousedown', (event) => {
    if (isDragging && toneSynth) {
      toneSynth.triggerAttackRelease(Math.abs(mouse.x * 900), '1n'); // Plays a middle C note for an eighth note duration
    }
  });

//   // Event listener for sphere click and synth control during dragging
// draggableSpheres.forEach(sphere => {
//   sphere.addEventListener('click', (event) => {
//     event.stopPropagation();

//     if (Tone.context.state === 'running') {
//       if (!toneSynth) {
//         createSynth();
//         toneSynth.start();
//       }

//       const sphereId = sphere.uuid;

//       if (!sphereState[sphereId] || sphereState[sphereId] === 'released') {
//         const freq = Math.abs(mouse.x * 1000);
//         const volume = Math.abs(mouse.y);

//         // Trigger a new voice
//         const newVoice = toneSynth.triggerAttack(freq, '+0', volume);
//         activeVoices.push({ id: sphereId, voice: newVoice });

//         sphereState[sphereId] = 'triggered';
//       } else if (sphereState[sphereId] === 'triggered') {
//         // Release all voices associated with this sphere
//         activeVoices
//           .filter((voiceObj) => voiceObj.id === sphereId)
//           .forEach((voiceObj) => toneSynth.triggerRelease(voiceObj.voice));
      
//         // Remove released voices from the activeVoices array
//         activeVoices = activeVoices.filter((voiceObj) => voiceObj.id !== sphereId);
      
//         sphereState[sphereId] = 'released';
//       }
//     } else {
//       console.error('Tone.js context not started yet.');
//     }
//   });
//   // Event listener to control synth parameters while dragging
//   sphere.addEventListener('mousemove', (event) => {
//     if (selectedSphere === sphere) {
//       // Calculate movement offsets
//       const dx = event.clientX - initialPosition.x;
//       const dy = event.clientY - initialPosition.y;
//       const dz = sphere.position.z - initialPosition.z;

//       // Calculate frequency and amplitude based on movement
//       const frequencyOffset = dx * 0.1; // Adjust the frequency scaling factor
//       const amplitudeOffset = dz * 0.01; // Adjust the amplitude scaling factor

//       // Update synth parameters (frequency and amplitude)
//       if (toneSynth) {
//         const newFrequency = Tone.Frequency('C4').transpose(frequencyOffset);
//         toneSynth.frequency.rampTo(newFrequency, 0.1); // Smoothly change the frequency
//         toneSynth.volume.rampTo(-Math.abs(amplitudeOffset), 0.1); // Smoothly change the amplitude

//         // Trigger a voice for the dragged sphere if dragging is in progress
//         if (isDragging) {
//           toneSynth.triggerAttackRelease(Math.abs(mouse.x * 900), '1n');
//         }
//       } else {
//         console.error('Tone.js synth not yet initialized.');
//       }
//     }
//   });
// });

    
        // Event listener for sphere click and synth control during dragging
    draggableSpheres.forEach(sphere => {
      sphere.addEventListener('click', (event) => {
        event.stopPropagation();

        if (Tone.context.state === 'running') {
          if (!toneSynth) {
            createSynth();
            toneSynth.start();
          }

          const sphereId = sphere.uuid;

          // Trigger a new voice for each click
          const freq = Math.abs(mouse.x * 1000);
          const volume = Math.abs(mouse.y);
          const newVoice = toneSynth.triggerAttack(freq, '+0', volume);
          activeVoices.push({ id: sphereId, voice: newVoice });

          sphereState[sphereId] = 'triggered';
        } else {
          console.error('Tone.js context not started yet.');
        }
      });

      // Event listener to control synth parameters while dragging
      sphere.addEventListener('mousemove', (event) => {
        if (selectedSphere === sphere) {
          // Calculate movement offsets
          const dx = event.clientX - initialPosition.x;
          const dy = event.clientY - initialPosition.y;
          const dz = sphere.position.z - initialPosition.z;

          // Calculate frequency and amplitude based on movement
          const frequencyOffset = dx * 0.1; // Adjust the frequency scaling factor
          const amplitudeOffset = dz * 0.01; // Adjust the amplitude scaling factor

          // Update synth parameters (frequency and amplitude)
          if (toneSynth) {
            const newFrequency = Tone.Frequency('C4').transpose(frequencyOffset);
            toneSynth.frequency.rampTo(newFrequency, 0.1); // Smoothly change the frequency
            toneSynth.volume.rampTo(-Math.abs(amplitudeOffset), 0.1); // Smoothly change the amplitude

            // Trigger a voice for the dragged sphere if dragging is in progress
            if (isDragging) {
              toneSynth.triggerAttackRelease(Math.abs(mouse.x * 900), '1n');
            }
          } else {
            console.error('Tone.js synth not yet initialized.');
          }
        }
      });
    });


    function onMouseMove(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
      if (selectedSphere) {
        document.addEventListener('keydown', (event) => {
          if (event.code === 'ArrowUp' && selectedSphere) {
            const newScale = selectedSphere.scale.x * 1.2; // Increase the sphere's scale by 20%
            selectedSphere.scale.set(newScale, newScale, newScale);
          } else if (event.code === 'ArrowDown' && selectedSphere) {
            selectedSphere.position.z -= 5; // Move the specific sphere backward along the Z-axis
          }
        });
      }
    }
    
    function onMouseDown() {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(draggableSpheres);
    
      if (intersects.length > 0) {
        selectedSphere = intersects[0].object;
        initialScale = selectedSphere.scale.x;
        console.log('Sphere selected');
    
        // Logic to move the selected sphere backward along the Z-axis using the shift key
        selectedSphere.addEventListener('click', (event) => {
          if (event.shiftKey) {
            selectedSphere.position.z -= 5; // Move the specific sphere backward along the Z-axis
          }
        });
      }
    }
    
    function onMouseUp() {
      selectedSphere = null;
    }
    
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mouseup', onMouseUp, false);

  // Increase the camera's field of view to counteract the apparent zoom level change
  camera.fov = 60; // Adjust the field of view to your preferred value (e.g., 60 degrees)
  camera.updateProjectionMatrix(); // Update the camera's projection matrix

  // Function to create rotating box synths
  function createSynths() {
    const synths = rotatingBoxes.map(() => new Tone.Synth().toDestination());
    return synths;
  }

  const synths = createSynths();

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);

    // Rotate the rotating boxes
    rotatingBoxes.forEach((box, index) => {
      box.rotation.x += 0.01;
      box.rotation.y += 0.01;
      box.rotation.z += 0.01;

      // Update the position for an orbit effect
      const radius = 30; // Radius of the circular path
      const speed = 0.0005 * (index + 2); // Adjust the speed for each box

      const theta = speed * performance.now(); // Update theta over time
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta) * Math.sin(theta); // Use sine for y to create all-direction orbit
      const z = radius * Math.sin(theta) * Math.cos(theta); // Use cosine for z to create all-direction orbit

      box.position.set(x, y, z);

    });

    draggableSpheres.forEach(sphere => {
      if (sphere === selectedSphere) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(sphere);

        if (intersects.length > 0) {
          const intersection = intersects[0].point;
          sphere.position.copy(intersection);

          // Clamp the sphere's scale ot prevent from becoming too big or too  small
          const newScale = initialScale * (1 + intersection.length() * 0.0000000001); // Adjust this scaling factor
          sphere.scale.set(Math.max(minScale, newScale), Math.max(minScale, newScale), Math.max(minScale, newScale));
        }
      }
    });

    if (selectedSphere){
      selectedSphere.scale.set(initialScale, initialScale, initialScale);
    }

    renderer.render(scene, camera);
  }

  animate();
}

// Event listener to initialize the virtual world after the DOM content is loaded
window.addEventListener('DOMContentLoaded', () => {
  // Event listener to initialize the virtual world on button click
  document.getElementById('startButton').addEventListener('click', () => {
    // Call the function to initialize the audio and start the virtual world
    initializeAudioAndStartWorld();
  });
});


