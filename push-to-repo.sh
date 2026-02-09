#!/bin/bash
# ============================================================
# push-to-repo.sh
# Run this from inside the AIVulnAgent directory to push
# all files to https://github.com/TimCodes/AIVulnAgent.git
# ============================================================

set -e

REPO_URL="https://github.com/TimCodes/AIVulnAgent.git"

echo "🛡️  AIVulnAgent — Push to GitHub"
echo ""

# Check if we're in a git repo already
if [ -d ".git" ]; then
  echo "Git repo already initialized."
else
  echo "Initializing git repo..."
  git init
  git checkout -b main
fi

# Stage everything
git add -A

# Commit
git commit -m "feat: vulnerability remediation agent with LangGraph.js

- LangGraph state machine (agentMap.ts) with conditional routing
- Agent nodes: classify, tryRebuild, searchRAG, researchFix, createPR, createTagWorkflow, storeInRAG
- GitHub tools: triggerBuildAndScan, createPullRequest, readIssues, createApprovalTagWorkflow
- Azure OpenAI integration for LLM-powered classification and fix research
- Azure AI Search (RAG) for storing and retrieving known fixes
- Express API with SSE streaming for real-time progress
- React frontend with vulnerability dashboard and remediation view
- GitHub Actions workflow (rebuild-image.yml) with environment approval gate"

# Add remote if not already set
if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' already set."
else
  git remote add origin "$REPO_URL"
fi

# Push
echo ""
echo "Pushing to $REPO_URL ..."
git push -u origin main --force

echo ""
echo "✅ Done! Check: $REPO_URL"
