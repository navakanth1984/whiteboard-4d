# BleuuBoard v2 — Google Cloud Asset Registry

> Living document. Update after every Cloud Run deploy, Datastore creation, or CX agent provisioning.
> Source of truth for all GCP credit-consuming resources.

---

## Credits on File

| Credit | ID | Remaining | Currency | Expires | Scope |
|---|---|---|---|---|---|
| **GenAI App Builder** | `494be35b...413c5f` | ₹94,804.47 (99.99%) | INR | 2027-04-26 | Vertex AI, Agent Builder, Gemini APIs |
| **Dialogflow CX Trial** | `dialogflow_cx_credit_v2-015936-156B27-56F23F` | ₹56,729.35 (99.99%) | INR | 2027-05-22 | CX Text/Audio sessions, query ops |

> **File:** `whiteboard-4d/Credits – navakanth.csv` — original export from GCP Billing.

### Dialogflow CX Credit — Exact SKUs Covered

| SKU Name | Service | SKU ID |
|---|---|---|
| Text session | `services/FBC0-AA4A-C89A` | `A1CC-751A-CDCC` |
| Audio session | `services/FBC0-AA4A-C89A` | `9496-0679-69BE` |
| Short text session | `services/FBC0-AA4A-C89A` | `71CF-6BFE-C14D` |
| Short audio session | `services/FBC0-AA4A-C89A` | `B9BF-5811-ABEE` |
| Text query operation | `services/FBC0-AA4A-C89A` | `2DA2-9861-0744` |
| Audio interactions | `services/FBC0-AA4A-C89A` | `DE04-26D4-763B` |

---

## GCP Project

| Field | Value |
|---|---|
| **Project ID** | `nthdim-academy-v2` |
| **Region** | `us-central1` |
| **Vertex AI Location** | `us-central1` |
| **Gemini API Key** | in `.env` → `GEMINI_API_KEY` (used by Cloud Run proxy) |
| Bootstrap script | `bash whiteboard-4d/setup_gcp.sh nthdim-academy-v2` |

---

## Cloned Reference Repos

| Repo | Local Path | Key Directories Used |
|---|---|---|
| `GoogleCloudPlatform/generative-ai` | `sources/google-generative-ai/` | `gemini/agent-engine/`, `gemini/agents/`, `gemini/sample-apps/` |
| `google/adk-samples` | `sources/adk-samples/` | Pre-built ADK agents for Agent Engine deploy |
| `GoogleCloudPlatform/contact-center-ai-samples` | `sources/contact-center-ai-samples/` | Dialogflow CX webhook (Python + Node.js) |
| `eddievanbogaert/gcp-agentdemo` | `sources/gcp-agentdemo/` | `setup_gcp.sh` bootstrap, ADK starter |

---

## Cloud Run Services

| Service Name | URL | Purpose | Status |
|---|---|---|---|
| `bleuboard-gemini-proxy` | *(deploy pending)* | Gemini 2.0 Flash NL→spatial action API | Not deployed |
| `bleuboard-dialogflow-webhook` | *(deploy pending)* | Dialogflow CX fulfillment webhook | Not deployed |

---

## Vertex AI Resources

| Resource | ID | Purpose | Status |
|---|---|---|---|
| Agent Engine | *(create pending)* | Managed runtime for copilot agent | Not created |
| Vertex AI Search Datastore | *(create pending)* | RAG over BleuuBoard session objects | Not created |

---

## Dialogflow CX Resources

| Resource | ID | Purpose | Status |
|---|---|---|---|
| CX Agent | *(create pending)* | NL intent classification for 3D spatial commands | Not created |
| Webhook | *(deploy pending)* | Fulfillment → BleuuBoard scene graph | Not created |

---

## Credit Consumption Strategy

**GenAI App Builder credit** → consumed by:
- Vertex AI Gemini 2.0 Flash API calls (copilot voice commands)
- Agent Engine hosting (managed agent runtime)
- Vertex AI Search (session RAG)

**Dialogflow CX credit** → consumed by:
- CX text sessions (typed commands in copilot UI)
- CX audio sessions (voice-to-CX pipeline)
- Short text sessions (quick spatial intents)

**Verify in:** GCP Console → Billing → Credits → Reports, filter by SKU.

---

## Usage Estimation (rough)

| Operation | Cost | Credits cover |
|---|---|---|
| Gemini 2.0 Flash (1M tokens input) | ~₹64 | ~1,481 M tokens on GenAI credit |
| CX text session | ~₹0.006 | ~9.4M sessions on CX credit |
| Agent Engine (per hour) | ~₹16 | ~5,925 hours on GenAI credit |

Both credits are effectively unlimited for a development/demo project at this scale.
