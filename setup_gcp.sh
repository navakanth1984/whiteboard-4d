#!/bin/bash
# setup_gcp.sh — BleuuBoard v2 GCP Bootstrap
# Usage: bash setup_gcp.sh <PROJECT_ID>
# Consumes: GenAI App Builder credit + Dialogflow CX Trial credit
# Credits file: whiteboard-4d/Credits – navakanth.csv
#
# Standing rule: run this ONCE per GCP project. Idempotent — safe to re-run.

set -euo pipefail

PROJECT_ID="${1:-nthdim-academy-v2}"   # default from .env VERTEX_PROJECT_ID
REGION="${2:-us-central1}"            # default from .env VERTEX_LOCATION

# Override any conflicting env-level project setting (CLOUDSDK_CORE_PROJECT)
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"

SA_NAME="bleuboard-agent"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🚀  Bootstrapping BleuuBoard v2 GCP resources"
echo "   Project : $PROJECT_ID"
echo "   Region  : $REGION"
echo ""

# ── 1. Set project ──────────────────────────────────────────────────────────
gcloud config set project "$PROJECT_ID"
echo "✅  Project set"

# ── 2. Enable APIs (GenAI credit SKUs + Dialogflow CX credit SKUs) ──────────
echo "⏳  Enabling APIs..."
gcloud services enable \
  aiplatform.googleapis.com \
  discoveryengine.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  dialogflow.googleapis.com \
  speech.googleapis.com \
  iam.googleapis.com \
  secretmanager.googleapis.com
echo "✅  APIs enabled"

# ── 3. Service account for Cloud Run + Agent Engine ─────────────────────────
echo "⏳  Creating service account..."
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="BleuuBoard Agent Service Account" \
  --quiet 2>/dev/null || echo "   (service account already exists, skipping)"

# Roles needed:
#   - Vertex AI User (Gemini API + Agent Engine)
#   - Discovery Engine Viewer (Vertex AI Search RAG)
#   - Dialogflow API Client (CX sessions)
#   - Cloud Run Invoker (inter-service)
for ROLE in \
  roles/aiplatform.user \
  roles/discoveryengine.viewer \
  roles/dialogflow.client \
  roles/run.invoker; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done
echo "✅  IAM roles assigned"

# ── 4. Store Gemini API key in Secret Manager ────────────────────────────────
echo ""
echo "📋  Next step (manual): add your Gemini API key to Secret Manager:"
echo "   echo -n 'YOUR_API_KEY' | gcloud secrets create bleuboard-gemini-key \\"
echo "     --replication-policy=automatic --data-file=-"
echo ""
echo "   Then grant access:"
echo "   gcloud secrets add-iam-policy-binding bleuboard-gemini-key \\"
echo "     --member='serviceAccount:${SA_EMAIL}' \\"
echo "     --role='roles/secretmanager.secretAccessor'"

# ── 5. Create Vertex AI Search Datastore ────────────────────────────────────
echo "⏳  Creating Vertex AI Search datastore for session RAG..."
gcloud alpha discovery-engine datastores create \
  --location="global" \
  --display-name="bleuboard-session-store" \
  --solution-type="SOLUTION_TYPE_SEARCH" \
  --content-config="NO_CONTENT" \
  --project="$PROJECT_ID" \
  2>/dev/null || echo "   (datastore may already exist or CLI alpha command unavailable — create manually in console)"
echo "✅  Datastore step complete"

# ── 6. Deploy Cloud Run services (placeholder — actual deploy in CI) ─────────
echo ""
echo "📋  Cloud Run services to deploy (run from whiteboard-4d/spatial-bridge/):"
echo "   # Gemini proxy:"
echo "   gcloud run deploy bleuboard-gemini-proxy \\"
echo "     --source=. --region=$REGION \\"
echo "     --service-account=$SA_EMAIL \\"
echo "     --set-env-vars=GCP_PROJECT=$PROJECT_ID,REGION=$REGION \\"
echo "     --allow-unauthenticated"
echo ""
echo "   # Dialogflow CX webhook:"
echo "   gcloud run deploy bleuboard-dialogflow-webhook \\"
echo "     --source=. --region=$REGION \\"
echo "     --service-account=$SA_EMAIL \\"
echo "     --set-env-vars=GCP_PROJECT=$PROJECT_ID,REGION=$REGION \\"
echo "     --allow-unauthenticated"
echo ""

# ── 7. Summary ───────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "✅  Bootstrap complete for project: $PROJECT_ID"
echo ""
echo "   Credits consuming:"
echo "   • GenAI App Builder (₹94,804 remaining, expires 2027-04-26)"
echo "     → Vertex AI Gemini API, Agent Engine, Discovery Engine"
echo "   • Dialogflow CX Trial (₹56,729 remaining, expires 2027-05-22)"
echo "     → CX text/audio sessions, query operations"
echo ""
echo "   Verify credit consumption:"
echo "   GCP Console → Billing → Credits → Reports"
echo "════════════════════════════════════════════════════════════"
