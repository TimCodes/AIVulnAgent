# Agent Flow with Webhook Verification

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Vulnerability Ingested                        │
│                    (with optional repoOwner/repoName)               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │  Classify   │
                          │    Vuln     │
                          └──────┬──────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌──────▼──────┐
              │ Container │           │    Code     │
              └─────┬─────┘           └──────┬──────┘
                    │                        │
              ┌─────▼──────┐                 │
              │ Try Rebuild│                 │
              └─────┬──────┘                 │
                    │                        │
         ┌──────────┴─────────┐              │
         │                    │              │
    ┌────▼────┐         ┌────▼────┐    ┌────▼────┐
    │ Rebuild │         │ Search  │    │ Search  │
    │  Fixes? │         │   RAG   │    │   RAG   │
    │   YES   │         │   (No)  │    │         │
    └────┬────┘         └────┬────┘    └────┬────┘
         │                   │              │
         │                   │         ┌────┴────┐
         │                   │         │  Found? │
         │                   │         └────┬────┘
         │                   │              │
         │                   │         ┌────┴────┐
         │                   │         │   YES   │  NO
         │                   │         └────┬────┴────┐
         │                   │              │         │
         │              ┌────▼────┐    ┌────▼────┐  ┌▼─────────┐
         │              │Research │    │Create PR│  │Research  │
         │              │   Fix   │    └────┬────┘  │   Fix    │
         │              └────┬────┘         │       └────┬─────┘
         │                   │              │            │
         └───────────────────┼──────────────┘            │
                            │                            │
                            │◄───────────────────────────┘
                            │
                     ┌──────▼──────┐
                     │   Create    │
                     │     Tag     │
                     │  Workflow   │
                     └──────┬──────┘
                            │
                    ┌───────┴────────┐
                    │ 1. Create Tag  │
                    │ 2. Dispatch WF │
                    │ 3. Register    │
                    │    Pending     │
                    │ 4. AWAIT       │
                    │    Webhook     │
                    └───────┬────────┘
                            │
                            │ (Agent Blocks Here)
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         │         ┌────────▼────────┐         │
         │         │  GitHub Repo    │         │
         │         │    Workflow     │         │
         │         └────────┬────────┘         │
         │                  │                  │
         │         ┌────────▼────────┐         │
         │         │ 1. Approve Gate │         │
         │         │ 2. Build Image  │         │
         │         │ 3. Scan (Trivy) │         │
         │         │ 4. POST Webhook │         │
         │         └────────┬────────┘         │
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Webhook      │
                    │   Received     │
                    │                │
                    │ POST /api/     │
                    │ webhook/       │
                    │ rebuild-       │
                    │ complete       │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │ Resolve Pending│
                    │    Promise     │
                    └───────┬────────┘
                            │
                    (Agent Resumes)
                            │
                     ┌──────▼──────┐
                     │   Verify    │
                     │   Rebuild   │
                     │   Result    │
                     └──────┬──────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         ┌────▼────┐                ┌────▼────┐
         │ CVE NOT │                │CVE STILL│
         │ PRESENT │                │ PRESENT │
         │         │                │         │
         │SUCCESS! │                │ FAILED  │
         └────┬────┘                └────┬────┘
              │                          │
         ┌────▼────┐                     │
         │ Store   │                     │
         │ in RAG  │                     │
         └────┬────┘                     │
              │                          │
         ┌────▼────┐              ┌──────▼──────┐
         │   END   │              │     END     │
         │(resolved)│              │  (failed)   │
         └─────────┘              └─────────────┘
```

## Key Features

### 1. Multi-Repo Support
- Vulnerabilities can specify `repoOwner` and `repoName`
- GitHub tools use these values or fall back to environment defaults
- Enables a single agent instance to manage vulnerabilities across multiple repositories

### 2. Webhook-Based Verification
- Agent registers a pending rebuild and blocks execution
- Workflow runs asynchronously on the target repository
- Workflow POSTs scan results back to agent
- Agent resumes and verifies the fix

### 3. Automatic Fix Verification
- Checks if build succeeded
- Verifies target CVE is absent from scan results
- Transitions to "resolved" only if CVE is truly fixed
- Transitions to "failed" if CVE persists

## New States

- `awaiting_rebuild` - Tag created, waiting for webhook
- `verifying_rebuild` - Webhook received, checking results
- `resolved` - Fix verified, CVE no longer present
- `failed` - Build failed OR CVE still present

## Timeout Handling

- 30-minute timeout prevents indefinite blocking
- Timeout transitions to `failed` state with error message
- Promise automatically cleaned up on timeout
