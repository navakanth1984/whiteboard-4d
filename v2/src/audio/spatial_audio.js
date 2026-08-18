// v2/src/audio/spatial_audio.js — 3D Positional Audio Spatializer with Web Audio API Panner3D
import * as THREE from 'three';
import { getSceneState } from '../core/scene.js';

let audioListener = null;
let positionalSources = new Map();
let isAudioContextActive = false;

/**
 * Initializes the 3D Web Audio Spatializer and attaches listener to the camera
 */
export function initSpatialAudioSystem() {
  const { camera } = getSceneState();
  if (!camera) return;

  try {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);

    // AudioContext unlock on first user gesture
    const unlockAudio = () => {
      if (audioListener.context && audioListener.context.state === 'suspended') {
        audioListener.context.resume().then(() => {
          isAudioContextActive = true;
        });
      } else {
        isAudioContextActive = true;
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  } catch (e) {
    console.warn('Web Audio Spatializer initialization warning:', e);
  }
}

/**
 * Attaches a 3D Positional Audio source to an object in the spatial scene graph
 * @param {THREE.Object3D} targetMesh The 3D mesh anchor
 * @param {HTMLMediaElement|string} mediaElementOrUrl Audio element or URL
 * @param {object} options Distance and rolloff options
 */
export function attachPositionalAudio(targetMesh, mediaElementOrUrl, options = {}) {
  if (!audioListener || !targetMesh) return null;

  try {
    const sound = new THREE.PositionalAudio(audioListener);
    const refDistance = options.refDistance || 8;
    const maxDistance = options.maxDistance || 60;
    const rolloff = options.rolloffFactor || 1.5;

    sound.setRefDistance(refDistance);
    sound.setMaxDistance(maxDistance);
    sound.setRolloffFactor(rolloff);
    sound.setDistanceModel('inverse');

    // Directional Cone (Sound projects outwards from card face)
    sound.setDirectionalCone(180, 230, 0.1);

    if (typeof mediaElementOrUrl === 'string') {
      const audioLoader = new THREE.AudioLoader();
      audioLoader.load(mediaElementOrUrl, (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(options.loop !== false);
        sound.setVolume(options.volume || 0.8);
      });
    } else if (mediaElementOrUrl instanceof HTMLMediaElement) {
      sound.setMediaElementSource(mediaElementOrUrl);
    }

    targetMesh.add(sound);
    positionalSources.set(targetMesh.id, sound);
    return sound;
  } catch (e) {
    console.warn('Could not attach positional audio source:', e);
    return null;
  }
}

export function getAudioListener() {
  return audioListener;
}

export function getPositionalSourcesCount() {
  return positionalSources.size;
}

export function checkAudioContextStatus() {
  return audioListener?.context?.state || 'inactive';
}

export function playSpatialSynthTone(pos = null, freq = 440, dur = 0.2) {
  if (!audioListener || !audioListener.context) return;
  try {
    const ctx = audioListener.context;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (err) {}
}

