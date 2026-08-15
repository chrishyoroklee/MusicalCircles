// main.js
// The 3D musical world: a lattice of pastel spheres you can click, drag and
// resize, where a sphere's position in space decides what it sounds like.
//
//   height (Y) -> pitch, low at the floor, high at the ceiling
//   width  (X) -> stereo position
//   depth  (Z) -> loudness, nearer is louder
//   size       -> octave and note length, bigger is lower and longer

import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { startAudio, playNote, noteDuration, whenDrumsReady, DEGREE_COUNT } from './audio.js';
import { DRUMS, playDrum, drumForKey } from './drums.js';

const WORLD = new THREE.Vector3(30, 18, 18); // half-extents of the play space
const SPHERE_COUNT = 100;
const MIN_SIZE = 0.5;
const MAX_SIZE = 2.4;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const intro = document.getElementById('intro');
const hud = document.getElementById('hud');
const startButton = document.getElementById('startButton');
const introStatus = document.getElementById('introStatus');
const padRow = document.getElementById('drumPads');
const padsById = new Map();

let worldStarted = false;

buildDrumPads();
startButton.addEventListener('click', enterWorld);
document
  .getElementById('helpToggle')
  .addEventListener('click', () => hud.classList.toggle('is-compact'));

async function enterWorld() {
  if (worldStarted) return;
  worldStarted = true;
  startButton.disabled = true;
  introStatus.textContent = 'Warming up the audio engine...';

  try {
    await startAudio();
  } catch (err) {
    console.error('Could not start audio:', err);
    introStatus.textContent = 'Audio could not start. Try reloading the page.';
    startButton.disabled = false;
    worldStarted = false;
    return;
  }

  intro.classList.add('is-hidden');
  hud.classList.remove('is-hidden');
  // On a phone the instructions would cover a third of the world, so start
  // them collapsed behind the "?" button.
  hud.classList.toggle('is-compact', window.innerWidth < 760);
  startVirtualWorld();

  whenDrumsReady().then(() => {
    padRow.classList.remove('is-loading');
  });
}

// ---------------------------------------------------------------------------
// Drum pads (built from the DRUMS table so keys and labels never drift apart)
// ---------------------------------------------------------------------------

function buildDrumPads() {
  for (const drum of DRUMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pad';
    button.dataset.drum = drum.id;
    button.innerHTML =
      `<span class="pad-key">${drum.key.toUpperCase()}</span>` +
      `<span class="pad-label">${drum.label}</span>`;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      hitDrum(drum.id);
    });
    padRow.appendChild(button);
    padsById.set(drum.id, button);
  }
}

function hitDrum(id) {
  if (!playDrum(id)) return;
  const pad = padsById.get(id);
  if (!pad) return;
  pad.classList.remove('is-hit');
  void pad.offsetWidth; // restart the CSS animation on rapid repeats
  pad.classList.add('is-hit');
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

function startVirtualWorld() {
  const canvas = document.getElementById('bg');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd5f5e3);
  scene.fog = new THREE.Fog(0xd5f5e3, 70, 165);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

  /**
   * How far back the camera has to sit for the play space to fit. Tall narrow
   * windows are capped rather than fully fitted: pulling all the way back on a
   * phone would shrink the spheres past the point of being tappable, so a
   * little horizontal crop is the better trade -- the world is orbitable.
   */
  function fitDistance() {
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const forHeight = (WORLD.y * 1.65) / halfFov;
    const forWidth = (WORLD.x * 1.15) / (halfFov * camera.aspect);
    return Math.min(Math.max(forHeight, forWidth), forHeight * 1.7);
  }

  camera.position.set(0, 4, fitDistance());

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 18;
  controls.maxDistance = 170;
  controls.rotateSpeed = 0.5;

  scene.add(new THREE.AmbientLight(0xeafaf1, 0.95));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2e8b57, 0.6));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(18, 26, 30);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9ff0c4, 0.55);
  fillLight.position.set(-24, -12, -20);
  scene.add(fillLight);

  const lattice = buildLattice();
  scene.add(lattice);

  const spheres = [];
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 16);
  for (let i = 0; i < SPHERE_COUNT; i++) {
    spheres.push(createSphere(scene, sphereGeometry, i));
  }

  // -- pointer state ---------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const dragOffset = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();

  let pointerInside = false;
  let pointerMoved = false;
  let selected = null;
  let hovered = null;

  function updatePointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointerInside = true;
    pointerMoved = true;
  }

  function pickSphere() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(spheres, false);
    return hits.length > 0 ? hits[0] : null;
  }

  // Capture phase: OrbitControls is attached to the same element, so we have to
  // switch it off before its own pointerdown handler runs, or grabbing a sphere
  // would also spin the camera.
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      updatePointer(event);
      const hit = pickSphere();
      if (!hit) return;

      controls.enabled = false;
      selected = hit.object;
      canvas.setPointerCapture(event.pointerId);

      camera.getWorldDirection(cameraDirection);
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, selected.userData.home);
      dragOffset.copy(selected.userData.home).sub(hit.point);

      trigger(selected);
    },
    { capture: true },
  );

  canvas.addEventListener('pointermove', (event) => {
    updatePointer(event);
    if (!selected) return;

    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;

    const home = selected.userData.home;
    const before = selected.userData.degree;

    home.set(
      clamp(hitPoint.x + dragOffset.x, -WORLD.x, WORLD.x),
      clamp(hitPoint.y + dragOffset.y, -WORLD.y, WORLD.y),
      clamp(hitPoint.z + dragOffset.z, -WORLD.z, WORLD.z),
    );

    // Retrigger only when the sphere crosses into a new note, which turns a
    // drag into a playable glissando instead of a wall of noise.
    if (degreeFor(selected) !== before) trigger(selected, 0.08);
    else applyColor(selected);
  });

  function releasePointer(event) {
    if (selected && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    selected = null;
    controls.enabled = true;
  }

  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
  });

  // -- keyboard --------------------------------------------------------------

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const target = selected ?? hovered;
      if (!target) return;
      event.preventDefault();
      resize(target, event.key === 'ArrowUp' ? 1.18 : 1 / 1.18);
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'h') {
      hud.classList.toggle('is-compact');
      return;
    }

    const drum = drumForKey(key);
    if (drum) {
      event.preventDefault();
      hitDrum(drum.id);
      padsById.get(drum.id)?.classList.add('is-held');
    }
  });

  window.addEventListener('keyup', (event) => {
    const drum = drumForKey(event.key.toLowerCase());
    if (drum) padsById.get(drum.id)?.classList.remove('is-held');
  });

  window.addEventListener('blur', () => {
    for (const pad of padsById.values()) pad.classList.remove('is-held');
  });

  window.addEventListener('resize', () => {
    const previousFit = fitDistance();

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Keep the world framed on narrow or short windows while preserving
    // however far the user has chosen to zoom in or out.
    const offset = camera.position.clone().sub(controls.target);
    camera.position
      .copy(controls.target)
      .add(offset.multiplyScalar(fitDistance() / previousFit));
  });

  // -- render loop -----------------------------------------------------------

  const clock = new THREE.Clock();

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.getElapsedTime();

    if (!selected && pointerInside) {
      const hit = pickSphere();
      const next = hit ? hit.object : null;

      // A still cursor never loses its target. Spheres drift, so re-picking
      // blindly every frame would drop the hover mid-gesture; only an actual
      // pointer move is allowed to clear it.
      if (next !== null || pointerMoved) {
        if (next !== hovered) {
          hovered = next;
          canvas.style.cursor = hovered ? 'grab' : 'default';
        }
      }
      pointerMoved = false;
    } else if (selected) {
      canvas.style.cursor = 'grabbing';
    }

    const decay = Math.exp(-dt * 4.5);

    for (const sphere of spheres) {
      const data = sphere.userData;
      data.pulse *= decay;

      const focused = sphere === hovered || sphere === selected;

      // A sphere eases to a standstill while you point at it. Without this the
      // idle bob drifts the silhouette out from under a stationary cursor and
      // hover flickers on and off at the edges.
      data.calm += ((focused ? 0 : 1) - data.calm) * Math.min(1, dt * 8);

      sphere.position.set(
        data.home.x + Math.cos(t * 0.4 + data.phase) * 0.22 * data.calm,
        data.home.y + Math.sin(t * 0.6 + data.phase) * 0.32 * data.calm,
        data.home.z,
      );

      const highlight = focused ? 0.22 : 0;
      const s = data.size * (1 + data.pulse * 0.35);
      sphere.scale.setScalar(s);
      sphere.material.emissiveIntensity = highlight + data.pulse * 0.85;
    }

    lattice.rotation.y = Math.sin(t * 0.04) * 0.06;
    lattice.rotation.x = Math.cos(t * 0.03) * 0.04;

    // Fog follows the camera so it always reads as depth within the world
    // instead of washing everything out once you zoom out on a small screen.
    const distance = camera.position.distanceTo(controls.target);
    scene.fog.near = distance + WORLD.z * 0.3;
    scene.fog.far = distance + WORLD.z * 3.5;

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

// ---------------------------------------------------------------------------
// Sound mapping: where a sphere is decides what it sounds like
// ---------------------------------------------------------------------------

function degreeFor(sphere) {
  const { home, size } = sphere.userData;
  const height = (home.y + WORLD.y) / (2 * WORLD.y); // 0 floor .. 1 ceiling
  const octaveShift = (size - 1) * 6; // bigger spheres sit lower
  return Math.round(clamp(height * (DEGREE_COUNT - 1) - octaveShift, 0, DEGREE_COUNT - 1));
}

function trigger(sphere, velocityBoost = 0) {
  const { home, size } = sphere.userData;
  const degree = degreeFor(sphere);

  const depth = (home.z + WORLD.z) / (2 * WORLD.z); // 0 far .. 1 near
  playNote({
    degree,
    pan: clamp(home.x / WORLD.x, -1, 1) * 0.85,
    velocity: 0.32 + depth * 0.5 + velocityBoost,
    duration: noteDuration(size),
  });

  sphere.userData.pulse = 1;
  applyColor(sphere);
}

function resize(sphere, factor) {
  sphere.userData.size = clamp(sphere.userData.size * factor, MIN_SIZE, MAX_SIZE);
  trigger(sphere);
}

/**
 * Colour tracks pitch, so the scene doubles as a score you can read.
 * The ramp deliberately runs blue -> violet -> pink -> red -> gold, going the
 * long way round the wheel to skip green: green spheres would vanish against
 * the mint background.
 */
function applyColor(sphere) {
  const degree = degreeFor(sphere);
  sphere.userData.degree = degree;
  const hue = (0.62 + (degree / (DEGREE_COUNT - 1)) * 0.5) % 1;
  sphere.material.color.setHSL(hue, 0.66, 0.68);
  sphere.material.emissive.setHSL(hue, 0.75, 0.5);
}

// ---------------------------------------------------------------------------
// Scene building blocks
// ---------------------------------------------------------------------------

function createSphere(scene, geometry, index) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: 0.42,
    metalness: 0.04,
  });

  const sphere = new THREE.Mesh(geometry, material);
  sphere.userData = {
    home: new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(WORLD.x * 1.8),
      THREE.MathUtils.randFloatSpread(WORLD.y * 1.8),
      THREE.MathUtils.randFloatSpread(WORLD.z * 1.8),
    ),
    size: THREE.MathUtils.randFloat(0.85, 1.7),
    phase: (index / SPHERE_COUNT) * Math.PI * 2,
    pulse: 0,
    calm: 1, // 1 = drifting freely, 0 = held still under the cursor
    degree: 0,
  };

  applyColor(sphere);
  sphere.position.copy(sphere.userData.home);
  sphere.scale.setScalar(sphere.userData.size);
  scene.add(sphere);
  return sphere;
}

/**
 * The wireframe cage around the play space. The original built ~1700 separate
 * wireframe box meshes; this is the same look as one LineSegments draw call.
 */
function buildLattice() {
  const divisions = { x: 8, y: 5, z: 5 };
  const points = [];

  const coords = (axis) =>
    Array.from(
      { length: divisions[axis] + 1 },
      (_, i) => -WORLD[axis] + (i / divisions[axis]) * WORLD[axis] * 2,
    );

  const xs = coords('x');
  const ys = coords('y');
  const zs = coords('z');

  for (const y of ys) for (const z of zs) points.push(-WORLD.x, y, z, WORLD.x, y, z);
  for (const x of xs) for (const z of zs) points.push(x, -WORLD.y, z, x, WORLD.y, z);
  for (const x of xs) for (const y of ys) points.push(x, y, -WORLD.z, x, y, WORLD.z);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0x145a32,
    transparent: true,
    opacity: 0.18,
  });

  return new THREE.LineSegments(geometry, material);
}
