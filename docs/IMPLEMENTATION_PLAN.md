# Vulnerability Remediation Agent — Implementation Plan

## Overview

An AI-powered vulnerability remediation system that automates the triage, research, and fix process for container image and code vulnerabilities. Built with **Node.js/TypeScript**, **LangGraph.js**, **Azure OpenAI**, **Azure AI Search**, and a **React** frontend.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    React Frontend                         │
│  Dashboard → Vuln List → Triage View → Fix Status        │
└────────────────────────┬─────────────────────────────────┘
                         │ REST + SSE (streaming)
┌────────────────────────▼─────────────────────────────────┐
│                  Node.js / Express API                     │
│  Routes: /vulnerabilities, /remediation, /stream           │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│              LangGraph.js State Machine                    │
│                                                           │
│  ┌─────────────┐    ┌──────────────────┐                  │
│  │  CLASSIFY    │───▶│  CONTAINER or    │                  │
│  │  Vuln Type   │    │  CODE?           │                  │
│  └─────────────┘    └────────┬─────────┘                  │
│                              │                             │
│              ┌───────────────┼───────────────┐             │
│              ▼                               ▼             │
│  ┌──────────────────┐            ┌──────────────────┐     │
│  │ CONTAINER PATH    │            │ CODE PATH         │     │
│  │                   │            │                   │     │
│  │ 1. Try Rebuild    │            │ 1. Search RAG     │     │
│  │    └─ Fixed? Done │            │ 2. Research Fix   │     │
│  │ 2. Search RAG     │            │ 3. Generate PR    │     │
│  │ 3. Research Fix   │            │ 4. Store in RAG   │     │
│  │ 4. Create Tag     │            │                   │     │
│  │    Workflow (needs │            └──────────────────┘     │
│  │    approval)      │                                     │
│  │ 5. Store in RAG   │                                     │
│  └──────────────────┘                                     │
└───────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Azure OpenAI │ │ Azure AI     │ │ GitHub API   │
│ (GPT-4o)     │ │ Search (RAG) │ │ (PRs + Tags) │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Decision Flow (Simplified)

```
Vulnerability Ingested
        │
        ▼
  ┌─────────────┐
  │ Is it a      │
  │ CONTAINER or │───── Container ──┐
  │ CODE issue?  │                  │
  └──────┬──────┘                  │
         │ Code                    ▼
         │                ┌────────────────┐
         │                │ Rebuild Image   │
         │                │ (no code change)│
         │                └───────┬────────┘
         │                        │
         │                  Fixed? ──── Yes ──▶ DONE
         │                        │
         │                        No
         │                        │
         ▼                        ▼
  ┌──────────────┐      ┌──────────────┐
  │ Search RAG   │      │ Search RAG   │
  │ for known fix│      │ for known fix│
  └──────┬───────┘      └──────┬───────┘
         │                     │
    Found? ── Yes ─▶ Apply     Found? ── Yes ─▶ Apply
         │                     │
         No                    No
         │                     │
         ▼                     ▼
  ┌──────────────┐      ┌──────────────┐
  │ Research &   │      │ Research &   │
  │ Generate Fix │      │ Generate Fix │
  └──────┬───────┘      └──────┬───────┘
         │                     │
         ▼                     ▼
  ┌──────────────┐      ┌──────────────────┐
  │ Create PR    │      │ Create GitHub Tag │
  │ with fix     │      │ Workflow (needs   │
  │              │      │ user approval)    │
  └──────┬───────┘      └──────┬───────────┘
         │                     │
         ▼                     ▼
  ┌──────────────────────────────────┐
  │ Store fix in RAG for future use  │
  └──────────────────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                      |
|--------------|---------------------------------|
| Frontend     | React 18 + TypeScript + Vite    |
| Backend      | Node.js + Express + TypeScript  |
| AI Workflow  | LangGraph.js                    |
| LLM          | Azure OpenAI (GPT-4o)           |
| RAG Store    | Azure AI Search                 |
| Source Ctrl  | GitHub API (Octokit)            |
| Styling      | Tailwind CSS                    |

---

## LangGraph State Machine Nodes

| Node                  | Purpose                                                |
|-----------------------|--------------------------------------------------------|
| `classifyVuln`        | Determine if vulnerability is container or code issue  |
| `tryRebuild`          | Simulate/check if rebuilding the image resolves it     |
| `searchRAG`           | Query Azure AI Search for previously stored fixes      |
| `researchFix`         | Use Azure OpenAI to research and generate a fix        |
| `createPR`            | Create a GitHub Pull Request with the code fix         |
| `createTagWorkflow`   | Create a GitHub tag that requires user approval         |
| `storeInRAG`          | Index the working fix into Azure AI Search             |

---

## Implementation Phases

### Phase 1: Core Infrastructure
- Project scaffolding (Node.js + React + TypeScript)
- Azure OpenAI client setup
- Azure AI Search client setup
- GitHub API client setup
- LangGraph state machine skeleton

### Phase 2: Agent Logic
- Classification node (container vs code)
- Rebuild check node
- RAG search node
- Fix research node
- PR creation node
- Tag workflow creation node
- RAG storage node

### Phase 3: API Layer
- Express routes for vulnerability CRUD
- SSE endpoint for streaming agent progress
- Webhook endpoint for vulnerability ingestion

### Phase 4: Frontend
- Dashboard with vulnerability list
- Remediation detail view with live progress
- Approval workflow UI for tag creation

---

## File Structure

```
vuln-remediation/
├── src/
│   ├── backend/
│   │   ├── config/
│   │   │   └── env.ts                 # Environment configuration
│   │   ├── types/
│   │   │   └── index.ts               # Shared types
│   │   ├── services/
│   │   │   ├── azureOpenAI.ts          # Azure OpenAI client
│   │   │   ├── azureSearch.ts          # Azure AI Search client
│   │   │   └── github.ts              # GitHub API client
│   │   ├── agents/
│   │   │   ├── state.ts               # LangGraph state definition
│   │   │   ├── nodes.ts               # All graph nodes
│   │   │   └── graph.ts               # Graph assembly + compilation
│   │   ├── routes/
│   │   │   └── index.ts               # Express routes
│   │   └── server.ts                  # Express server entry
│   └── frontend/
│       └── src/
│           ├── components/
│           │   ├── VulnList.tsx
│           │   ├── RemediationView.tsx
│           │   ├── ProgressTimeline.tsx
│           │   └── ApprovalDialog.tsx
│           ├── hooks/
│           │   └── useRemediation.ts
│           ├── types/
│           │   └── index.ts
│           ├── lib/
│           │   └── api.ts
│           ├── App.tsx
│           └── main.tsx
├── package.json
├── tsconfig.json
└── docs/
    └── IMPLEMENTATION_PLAN.md
```
