// spatial-bridge/dialogflow_webhook.js
// BleuuBoard v2 — Dialogflow CX Fulfillment Webhook
// Credit consumed: Dialogflow CX Trial (₹56,729 remaining)
//   SKUs: Text session A1CC-751A-CDCC, Audio session 9496-0679-69BE,
//          Short text 71CF-6BFE-C14D, Short audio B9BF-5811-ABEE,
//          Text query op 2DA2-9861-0744, Audio interactions DE04-26D4-763B
//
// Dialogflow CX calls this webhook with a WebhookRequest JSON payload.
// This service reads session parameters, maps them to BleuuBoard spatial actions,
// and returns a WebhookResponse the CX agent speaks back.
//
// Pattern adapted from:
//   GoogleCloudPlatform/contact-center-ai-samples (Dialogflow CX Webhook Python)
//   sources/contact-center-ai-samples/dialogflow-cx/

'use strict';

const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '512kb' }));
// Dialogflow CX calls from Google infra — no CORS restriction needed on this endpoint
app.use(cors());

// ── Intent → BleuuBoard action mapping ──────────────────────────────────────
// These intent display names are configured in the CX agent flow.
const INTENT_HANDLERS = {

  // Navigation intents
  'spatial.navigate.flyto': (params) => ({
    action: 'navigate',
    target: params['object-name'] || 'center',
    params: { duration: 1.2 }
  }),
  'spatial.navigate.reset': () => ({
    action: 'navigate',
    target: 'camera',
    params: { preset: 'default' }
  }),

  // Object manipulation
  'spatial.object.move': (params) => ({
    action: 'move',
    target: params['object-name'] || 'selected',
    params: {
      direction: params['direction'],
      amount: parseFloat(params['amount'] || '1')
    }
  }),
  'spatial.object.rotate': (params) => ({
    action: 'rotate',
    target: params['object-name'] || 'selected',
    params: {
      axis: params['axis'] || 'y',
      degrees: parseFloat(params['degrees'] || '90')
    }
  }),
  'spatial.object.scale': (params) => ({
    action: 'scale',
    target: params['object-name'] || 'selected',
    params: { factor: parseFloat(params['scale-factor'] || '1.5') }
  }),
  'spatial.object.delete': (params) => ({
    action: 'delete',
    target: params['object-name'] || 'selected',
    params: {}
  }),
  'spatial.object.color': (params) => ({
    action: 'color',
    target: params['object-name'] || 'selected',
    params: { color: params['color'] || '#00f0ff' }
  }),

  // Creation
  'spatial.create.cube': (params) => ({
    action: 'create',
    target: 'cube',
    params: { color: params['color'] || '#38bdf8', size: 1 }
  }),
  'spatial.create.text': (params) => ({
    action: 'create',
    target: 'text',
    params: { content: params['text-content'] || 'New text' }
  }),
  'spatial.create.board': () => ({
    action: 'create',
    target: 'board',
    params: { preset: 'cyber' }
  }),

  // Environment
  'spatial.holodeck.switch': (params) => ({
    action: 'holodeck',
    target: 'skybox',
    params: { preset: params['environment-name'] || 'space' }
  }),

  // Search / query
  'spatial.search.object': (params) => ({
    action: 'search',
    target: 'scene',
    params: { query: params['search-query'] }
  }),

  // Default fallback
  'Default Fallback Intent': () => null
};

// ── POST / (Dialogflow CX webhook entry point) ───────────────────────────────
app.post('/', (req, res) => {
  const body = req.body;
  const intentName = body?.intentInfo?.displayName || '';
  const sessionParams = body?.sessionInfo?.parameters || {};
  const sessionId = body?.sessionInfo?.session || '';
  const tag = body?.fulfillmentInfo?.tag || '';

  console.log(`[cx_webhook] session=${sessionId} intent="${intentName}" tag="${tag}"`);

  // Map intent → spatial action
  const handler = INTENT_HANDLERS[intentName] || INTENT_HANDLERS['Default Fallback Intent'];
  const spatialAction = handler ? handler(sessionParams) : null;

  // Build CX WebhookResponse
  let fulfillmentText = '';
  const sessionParameterUpdates = {};

  if (spatialAction) {
    fulfillmentText = buildConfirmationText(spatialAction);
    // Pass the spatial action back as a session parameter so the CX agent
    // can relay it to the BleuuBoard frontend via the Messenger custom payload.
    sessionParameterUpdates['bleuboard_action'] = JSON.stringify(spatialAction);
  } else {
    fulfillmentText = "I'm not sure what you'd like to do in the whiteboard. Try saying something like: 'move the cube left' or 'create a text block'.";
  }

  const response = {
    fulfillmentResponse: {
      messages: [{ text: { text: [fulfillmentText] } }]
    },
    sessionInfo: {
      parameters: sessionParameterUpdates
    },
    // Custom payload relayed to Dialogflow Messenger → picked up by copilot.js
    payload: spatialAction ? { bleuboard: spatialAction } : {}
  };

  res.json(response);
});

// ── Helper: build a natural confirmation string ──────────────────────────────
function buildConfirmationText(action) {
  switch (action.action) {
    case 'move':    return `Moving ${action.target} ${action.params.direction || ''}.`;
    case 'rotate':  return `Rotating ${action.target} by ${action.params.degrees}°.`;
    case 'scale':   return `Scaling ${action.target} by ${action.params.factor}×.`;
    case 'create':  return `Creating a new ${action.target}.`;
    case 'delete':  return `Deleting ${action.target}.`;
    case 'navigate':return `Flying to ${action.target}.`;
    case 'color':   return `Changing ${action.target}'s color to ${action.params.color}.`;
    case 'holodeck':return `Switching environment to ${action.params.preset}.`;
    case 'search':  return `Searching for "${action.params.query}".`;
    default:        return 'Done.';
  }
}

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'dialogflow-webhook' }));

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`[cx_webhook] listening on :${PORT}`));

module.exports = app;
