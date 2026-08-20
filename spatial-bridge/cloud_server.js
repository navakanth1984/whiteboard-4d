// spatial-bridge/cloud_server.js
// Cloud Run entry point for bleuboard-spatial-bridge service.
// Mounts both Gemini proxy + Dialogflow CX webhook on a single container.
//
// Route layout:
//   POST /gemini/interpret     → Gemini 2.0 Flash text → spatial action JSON
//   POST /gemini/live-audio    → Gemini Live Audio blob → spatial action JSON
//   POST /dialogflow/          → Dialogflow CX fulfillment webhook
//   GET  /health               → combined health check
//
// Project: nthdim-academy-v2 | Region: us-central1
// Credits: GenAI App Builder (₹94,804) + Dialogflow CX Trial (₹56,729)

'use strict';

const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '512kb' }));


// ── Multi-backend Gemini client (Secret Manager API Key or Vertex AI ADC) ──
const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleGenAI } = require('@google/genai');

const PROJECT = process.env.GCP_PROJECT || 'nthdim-academy-v2';
const REGION  = process.env.REGION      || 'us-central1';
const MODEL   = 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are the spatial intelligence layer for BleuuBoard — a 4D creative
whiteboard with a Three.js scene graph. Translate the user's natural language utterance into a
precise JSON action for the whiteboard engine.

AVAILABLE ACTIONS: move, rotate, scale, create, delete, select, link, navigate, search,
annotate, color, holodeck

RESPONSE FORMAT — always return valid JSON only, no markdown:
{
  "action": "<action>",
  "target": "<object name, type, or 'camera'>",
  "params": { <action-specific parameters> },
  "confidence": <0.0-1.0>,
  "utterance_understood": "<your interpretation>"
}

SCENE CONTEXT is provided as a JSON snapshot. Use it to resolve pronouns.`;

let _genAI = null;
let _vertexModel = null;

async function geminiInterpret(utterance, sceneContext) {
  const sceneSnippet = sceneContext ? JSON.stringify(sceneContext).slice(0, 4000) : '{}';
  const prompt = `SCENE STATE:\n${sceneSnippet}\n\nUSER UTTERANCE:\n"${utterance}"\n\nRespond with JSON only.`;

  // Path A: Google GenAI SDK using Secret Manager API Key (Fastest & most flexible)
  if (API_KEY) {
    if (!_genAI) _genAI = new GoogleGenAI({ apiKey: API_KEY });
    const response = await _genAI.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });
    return response.text || '{}';
  }

  // Path B: Vertex AI ADC
  if (!_vertexModel) {
    const vAI = new VertexAI({ project: PROJECT, location: REGION });
    _vertexModel = vAI.getGenerativeModel({ model: MODEL });
  }
  const result = await _vertexModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' }
  });
  return result.response.candidates[0]?.content?.parts[0]?.text || '{}';
}


// POST /gemini/interpret
app.post('/gemini/interpret', async (req, res) => {
  const { utterance, sceneContext } = req.body;
  if (!utterance) return res.status(400).json({ error: 'utterance required' });
  try {
    const raw = await geminiInterpret(utterance, sceneContext);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { action: 'unknown', raw }; }
    res.json({ ...parsed, raw });
  } catch (err) {
    console.error('[gemini/interpret]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /gemini/live-audio
app.post('/gemini/live-audio', async (req, res) => {
  const { audioB64, mimeType = 'audio/webm', sceneContext } = req.body;
  if (!audioB64) return res.status(400).json({ error: 'audioB64 required' });
  try {
    const sceneSnippet = sceneContext ? JSON.stringify(sceneContext).slice(0, 2000) : '{}';
    let raw = '{}';

    if (API_KEY) {
      if (!_genAI) _genAI = new GoogleGenAI({ apiKey: API_KEY });
      const response = await _genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: audioB64 } },
              { text: `SCENE STATE:\n${sceneSnippet}\n\nTranscribe and return spatial action JSON.` }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });
      raw = response.text || '{}';
    } else {
      if (!_vertexModel) {
        const vAI = new VertexAI({ project: PROJECT, location: REGION });
        _vertexModel = vAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      }
      const result = await _vertexModel.generateContent({
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: audioB64 } },
          { text: `SCENE STATE:\n${sceneSnippet}\n\nTranscribe and return spatial action JSON.` }
        ]}],
        systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' }
      });
      raw = result.response.candidates[0]?.content?.parts[0]?.text || '{}';
    }

    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { action: 'unknown', raw }; }
    res.json({ ...parsed, raw });
  } catch (err) {
    console.error('[gemini/live-audio]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Dialogflow CX fulfillment (inline) ──────────────────────────────────────
const INTENT_MAP = {
  'spatial.navigate.flyto':  p => ({ action: 'navigate', target: p['object-name'] || 'center', params: { duration: 1.2 } }),
  'spatial.navigate.reset':  () => ({ action: 'navigate', target: 'camera', params: { preset: 'default' } }),
  'spatial.object.move':     p => ({ action: 'move', target: p['object-name'] || 'selected', params: { direction: p.direction, amount: +p.amount || 1 } }),
  'spatial.object.rotate':   p => ({ action: 'rotate', target: p['object-name'] || 'selected', params: { axis: p.axis || 'y', degrees: +p.degrees || 90 } }),
  'spatial.object.scale':    p => ({ action: 'scale', target: p['object-name'] || 'selected', params: { factor: +p['scale-factor'] || 1.5 } }),
  'spatial.object.delete':   p => ({ action: 'delete', target: p['object-name'] || 'selected', params: {} }),
  'spatial.object.color':    p => ({ action: 'color', target: p['object-name'] || 'selected', params: { color: p.color || '#00f0ff' } }),
  'spatial.create.cube':     p => ({ action: 'create', target: 'cube', params: { color: p.color || '#38bdf8' } }),
  'spatial.create.text':     p => ({ action: 'create', target: 'text', params: { content: p['text-content'] || 'New text' } }),
  'spatial.create.board':    () => ({ action: 'create', target: 'board', params: { preset: 'cyber' } }),
  'spatial.holodeck.switch': p => ({ action: 'holodeck', target: 'skybox', params: { preset: p['environment-name'] || 'space' } }),
  'spatial.search.object':   p => ({ action: 'search', target: 'scene', params: { query: p['search-query'] } })
};

function confirmText(a) {
  const t = a.target, p = a.params;
  switch (a.action) {
    case 'move':     return `Moving ${t} ${p.direction || ''}.`;
    case 'rotate':   return `Rotating ${t} by ${p.degrees}°.`;
    case 'scale':    return `Scaling ${t} by ${p.factor}×.`;
    case 'create':   return `Creating a new ${t}.`;
    case 'delete':   return `Deleting ${t}.`;
    case 'navigate': return `Flying to ${t}.`;
    case 'color':    return `Changing ${t} color to ${p.color}.`;
    case 'holodeck': return `Switching to ${p.preset} environment.`;
    case 'search':   return `Searching for "${p.query}".`;
    default: return 'Done.';
  }
}

app.post('/dialogflow/', (req, res) => {
  const intent  = req.body?.intentInfo?.displayName || '';
  const params  = req.body?.sessionInfo?.parameters || {};
  const handler = INTENT_MAP[intent];
  const action  = handler ? handler(params) : null;

  res.json({
    fulfillmentResponse: {
      messages: [{ text: { text: [action ? confirmText(action) : "I'm not sure what to do in the whiteboard."] } }]
    },
    sessionInfo: { parameters: action ? { bleuboard_action: JSON.stringify(action) } : {} },
    payload: action ? { bleuboard: action } : {}
  });
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status: 'ok', project: PROJECT, region: REGION, model: MODEL,
  endpoints: ['/gemini/interpret', '/gemini/live-audio', '/dialogflow/']
}));

app.get('/', (_, res) => res.json({ name: 'bleuboard-spatial-bridge', version: '2.0.0', project: PROJECT }));

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[bleuboard-spatial-bridge] :${PORT} | project=${PROJECT} | model=${MODEL}`);
});
