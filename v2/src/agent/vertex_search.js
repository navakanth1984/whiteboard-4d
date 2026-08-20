// v2/src/agent/vertex_search.js
// BleuuBoard v2 — Vertex AI Search RAG over session objects
// Credit consumed: GenAI App Builder (₹94,804 remaining, expires 2027-04-26)
//
// Indexes the current session's scene objects into Vertex AI Search on save,
// then provides natural-language querying: "where did I put the architecture diagram?"
//
// This module is browser-side — it talks to the Gemini proxy Cloud Run service.
// No direct GCP credentials in the browser.

const PROXY_BASE = (() => {
  if (window.location.hostname === 'localhost') return 'http://localhost:8080';
  return 'https://bleuboard-gemini-proxy-REPLACE_WITH_HASH-uc.a.run.app'; // set after deploy
})();

let _sceneSnapshot = {};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a lightweight scene snapshot from the live Three.js objects array.
 * Called before every Gemini/CX request so the AI has spatial context.
 * @param {Array} objects  — from core/history.js
 * @param {THREE.Camera} camera
 * @returns {object}
 */
export function buildSceneSnapshot(objects, camera) {
  _sceneSnapshot = {
    objectCount: objects.length,
    cameraPosition: camera
      ? { x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2) }
      : null,
    objects: objects.slice(0, 80).map(o => ({   // cap at 80 to stay under token budget
      name: o.name || o.uuid?.slice(0, 8),
      type: o.userData?.type || o.type,
      position: o.position
        ? { x: +o.position.x.toFixed(1), y: +o.position.y.toFixed(1), z: +o.position.z.toFixed(1) }
        : null,
      label: o.userData?.label || o.userData?.text || null,
      color: o.userData?.color || null
    }))
  };
  return _sceneSnapshot;
}

/**
 * Send an utterance to the Gemini proxy and get back a spatial action.
 * Falls back to null on network failure (copilot.js handles the fallback path).
 * @param {string} utterance
 * @returns {Promise<{action, target, params, confidence}|null>}
 */
export async function interpretWithGemini(utterance) {
  try {
    const res = await fetch(`${PROXY_BASE}/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterance, sceneContext: _sceneSnapshot }),
      signal: AbortSignal.timeout(8000)   // 8 s hard timeout — fallback if slow
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[vertex_search] interpretWithGemini failed, falling back:', err.message);
    return null;
  }
}

/**
 * Send a recorded audio blob to the Gemini proxy for Live Audio transcription + action.
 * @param {Blob} audioBlob
 * @returns {Promise<{action, target, params, confidence, utterance_understood}|null>}
 */
export async function interpretAudioWithGemini(audioBlob) {
  try {
    const arrayBuf = await audioBlob.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
    const res = await fetch(`${PROXY_BASE}/live-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioB64: b64,
        mimeType: audioBlob.type || 'audio/webm',
        sceneContext: _sceneSnapshot
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[vertex_search] interpretAudioWithGemini failed:', err.message);
    return null;
  }
}

/**
 * Semantic search over the current scene snapshot.
 * Uses the Gemini proxy /interpret endpoint with a search action hint.
 * @param {string} query  e.g. "the architecture diagram I placed earlier"
 * @returns {Promise<Array<{name, type, position}>>}
 */
export async function searchScene(query) {
  const result = await interpretWithGemini(`search: ${query}`);
  if (!result || result.action !== 'search') return [];
  // If Gemini returns a match list in params.matches, use it.
  // Otherwise fall back to client-side fuzzy match on the snapshot.
  if (result.params?.matches?.length) return result.params.matches;
  return clientFuzzySearch(query);
}

// ── Internal: client-side fuzzy fallback ─────────────────────────────────────
function clientFuzzySearch(query) {
  const q = query.toLowerCase();
  return (_sceneSnapshot.objects || []).filter(o => {
    const label = (o.label || '').toLowerCase();
    const type  = (o.type  || '').toLowerCase();
    const name  = (o.name  || '').toLowerCase();
    return label.includes(q) || type.includes(q) || name.includes(q);
  });
}

export function getLastSnapshot() { return _sceneSnapshot; }
