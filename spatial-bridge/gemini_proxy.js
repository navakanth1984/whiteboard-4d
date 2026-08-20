// spatial-bridge/gemini_proxy.js
// BleuuBoard v2 — Gemini 2.0 Flash spatial command interpreter
// Credit consumed: GenAI App Builder (₹94,804 remaining)
// Deploy: Cloud Run service 'bleuboard-gemini-proxy'
//
// Request:  POST /interpret  { utterance: string, sceneContext: SceneSnapshot }
// Response: { action, target, params, confidence, raw }

'use strict';

const express = require('express');
const cors = require('cors');
const { VertexAI } = require('@google-cloud/aiplatform');

const app = express();
app.use(express.json({ limit: '512kb' }));
app.use(cors({
  origin: [
    'https://bleuboard.vercel.app',
    'https://bleuboard-dev.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ]
}));

const PROJECT   = process.env.GCP_PROJECT || '';
const REGION    = process.env.REGION || 'us-central1';
const MODEL     = 'gemini-2.0-flash-001'; // Consumes GenAI App Builder credit

// ── System prompt for spatial command grounding ──────────────────────────────
const SYSTEM_PROMPT = `You are the spatial intelligence layer for BleuuBoard — a 4D creative
whiteboard with a Three.js scene graph. Your job is to translate a user's natural language
utterance into a precise JSON action for the whiteboard engine.

AVAILABLE ACTIONS:
  move       — translate an object in 3D space
  rotate     — rotate an object (degrees, axis)
  scale      — resize an object (uniform or per-axis)
  create     — spawn a new object (type, position, text)
  delete     — remove an object
  select     — select an object by name or type
  link       — draw a flow link between two objects
  navigate   — fly the camera to a position or object
  search     — semantic search over the scene (returns matching objects)
  annotate   — add a text annotation to an object
  color      — change an object's material color
  holodeck   — switch the skybox/environment preset

RESPONSE FORMAT — always return valid JSON, no markdown:
{
  "action": "<one of the actions above>",
  "target": "<object name, type, or 'camera'>",
  "params": { <action-specific parameters> },
  "confidence": <0.0-1.0>,
  "utterance_understood": "<your interpretation in plain English>"
}

SCENE CONTEXT will be provided as a JSON snapshot of current objects and camera state.
Use it to resolve pronouns ("it", "that cube", "the one near the board").
If the utterance is ambiguous, pick the most spatially reasonable interpretation and
set confidence < 0.7.`;

// ── Vertex AI client ─────────────────────────────────────────────────────────
let vertexAI = null;
let model = null;

function getModel() {
  if (model) return model;
  vertexAI = new VertexAI({ project: PROJECT, location: REGION });
  model = vertexAI.getGenerativeModel({ model: MODEL });
  return model;
}

// ── POST /interpret ──────────────────────────────────────────────────────────
app.post('/interpret', async (req, res) => {
  const { utterance, sceneContext } = req.body;
  if (!utterance || typeof utterance !== 'string') {
    return res.status(400).json({ error: 'utterance is required' });
  }

  try {
    const m = getModel();
    const sceneSnippet = sceneContext
      ? JSON.stringify(sceneContext).slice(0, 4000) // guard token budget
      : '{}';

    const prompt = `SCENE STATE:\n${sceneSnippet}\n\nUSER UTTERANCE:\n"${utterance}"\n\nRespond with JSON only.`;

    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.2,        // low temp = deterministic spatial actions
        maxOutputTokens: 512,
        responseMimeType: 'application/json'
      }
    });

    const raw = result.response.candidates[0]?.content?.parts[0]?.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { action: 'unknown', raw, confidence: 0 };
    }

    res.json({ ...parsed, raw });
  } catch (err) {
    console.error('[gemini_proxy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /live-audio  (Gemini Live Audio streaming endpoint) ─────────────────
// Accepts base64-encoded audio chunk, returns transcript + action in one call.
// Client in copilot.js accumulates chunks and calls this per utterance end.
app.post('/live-audio', async (req, res) => {
  const { audioB64, mimeType = 'audio/webm', sceneContext } = req.body;
  if (!audioB64) return res.status(400).json({ error: 'audioB64 required' });

  try {
    const m = getModel();
    const sceneSnippet = sceneContext
      ? JSON.stringify(sceneContext).slice(0, 2000)
      : '{}';

    const result = await m.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: audioB64 } },
          { text: `SCENE STATE:\n${sceneSnippet}\n\nTranscribe the audio and then return the spatial action JSON.` }
        ]
      }],
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json'
      }
    });

    const raw = result.response.candidates[0]?.content?.parts[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { action: 'unknown', raw }; }
    res.json({ ...parsed, raw });
  } catch (err) {
    console.error('[live-audio] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', model: MODEL, project: PROJECT }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[gemini_proxy] listening on :${PORT}`));

module.exports = app;
