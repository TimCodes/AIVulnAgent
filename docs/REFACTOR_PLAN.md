# Refactor Plan: Rename + Tools File

## Summary of Changes

### 1. Rename `graph.ts` → `agentMap.ts`
- Rename file
- Rename exported function `buildRemediationGraph` → `buildRemediationAgentMap`
- Update import in `routes/index.ts`

### 2. Rename `nodes.ts` → `agentNodes.ts`
- Rename file
- Update import in `agentMap.ts` (formerly graph.ts)

### 3. Delete `services/github.ts` (absorbed into tools)

### 4. Create new `tools/githubTools.ts`
LangGraph-compatible tool definitions that the agent nodes call. Four distinct tools:

| Tool | Description |
|------|-------------|
| `triggerBuildAndScan` | Dispatches a GitHub Actions workflow that builds and scans an image. Accepts `imageName` as input. |
| `createPullRequest` | Creates a branch, commits files, opens a PR. Same core logic as before but wrapped as a tool. |
| `readIssues` | Reads open GitHub issues (optionally filtered by labels like `vulnerability` or a CVE search term). Returns issue titles, bodies, and labels. |
| `createApprovalTagWorkflow` | Creates an annotated tag + dispatches a workflow that requires manual user approval before it proceeds. This is the "custom API" tool. |

### 5. Update `agentNodes.ts`
- Change imports from `services/github.js` → `tools/githubTools.js`
- `createPRNode` calls `createPullRequest` tool
- `createTagWorkflowNode` calls `createApprovalTagWorkflow` tool

### 6. Files touched (in order)

```
DELETE   src/backend/services/github.ts
CREATE   src/backend/tools/githubTools.ts       ← 4 tools
CREATE   src/backend/agents/agentNodes.ts       ← renamed + updated imports
CREATE   src/backend/agents/agentMap.ts          ← renamed + updated imports
UPDATE   src/backend/routes/index.ts             ← import path change
```
