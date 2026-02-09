# Webhook-Based Rebuild Verification Loop Implementation

## Overview

This implementation adds a complete webhook-based rebuild verification loop with multi-repository support to the AIVulnAgent. The agent can now:

1. Support vulnerabilities from multiple repositories (multi-repo)
2. Trigger rebuilds and await their completion via webhook callbacks
3. Automatically verify that CVEs are fixed by inspecting Trivy scan results
4. Transition to "resolved" or "failed" based on verification results

## Key Changes

### 1. Multi-Repository Support

**Files Modified:**
- `src/backend/types/index.ts`
- `src/frontend/src/types/index.ts`

**Changes:**
- Added `repoOwner?: string` and `repoName?: string` to `Vulnerability` interface
- Added new remediation statuses: `"awaiting_rebuild"` and `"verifying_rebuild"`
- Added `RebuildScanResult` interface for webhook payload

### 2. Dynamic GitHub Tool Parameters

**Files Modified:**
- `src/backend/tools/githubTools.ts`

**Changes:**
- All GitHub functions now accept optional `repoOwner` and `repoName` parameters
- Functions fall back to environment-configured defaults when not provided
- `createApprovalTagWorkflow` now accepts `vulnId` and `callbackUrl` parameters
- Workflow dispatch includes new inputs: `vuln_id`, `callback_url`, `image_name`

### 3. Pending Rebuild Tracking Service

**New File:**
- `src/backend/services/pendingRebuilds.ts`

**Features:**
- In-memory map tracking pending rebuild promises
- 30-minute timeout for rebuild completion
- Promise-based API that blocks agent execution until webhook arrives
- Diagnostic endpoint to list pending rebuilds

### 4. Agent State Extensions

**Files Modified:**
- `src/backend/agents/state.ts`

**New Fields:**
- `rebuildVerified: boolean` - Whether verification ran
- `rebuildSuccessful: boolean` - Whether the fix worked
- `rebuildScanResult: RebuildScanResult | null` - Webhook payload data

### 5. Agent Node Updates

**Files Modified:**
- `src/backend/agents/agentNodes.ts`
- `src/backend/agents/agentMap.ts`

**Changes:**
- `createTagWorkflowNode`:
  - Registers pending rebuild
  - Awaits webhook callback (blocks graph execution)
  - Returns scan results in state
- New `verifyRebuildResult` node:
  - Checks build success
  - Verifies CVE is absent from scan results
  - Sets `rebuildSuccessful` based on verification

**Graph Flow Update:**
```
createTagWorkflow → verifyRebuildResult → (successful) → storeInRAG → END
                                        → (failed) → END
```

### 6. Webhook API Endpoints

**Files Modified:**
- `src/backend/routes/index.ts`

**New Endpoints:**
- `POST /api/webhook/rebuild-complete` - Receives scan results from workflow
- `GET /api/rebuilds/pending` - Lists all pending rebuilds (diagnostics)

### 7. GitHub Actions Workflow

**Files Modified:**
- `.github/workflows/rebuild-image.yml`

**New Features:**
- Accepts `vuln_id` and `callback_url` inputs
- Adds `scan` job that:
  - Runs Trivy scan on rebuilt image
  - Parses JSON results
  - POSTs payload to agent webhook
  - Includes retry logic for reliability

### 8. Configuration

**Files Modified:**
- `src/backend/config/env.ts`
- `.env.example`

**New Settings:**
- `WEBHOOK_BASE_URL` - Agent's base URL for webhook callbacks (default: `http://localhost:3001`)

## Usage Example

### 1. Ingest a Vulnerability with Repo Info

```typescript
const vuln: Vulnerability = {
  id: "vuln-123",
  cveId: "CVE-2024-1234",
  packageName: "openssl",
  currentVersion: "1.1.1",
  fixedVersion: "1.1.1w",
  severity: "high",
  description: "Buffer overflow in OpenSSL",
  source: "trivy",
  imageName: "myapp:latest",
  createdAt: new Date().toISOString(),
  repoOwner: "myorg",      // NEW
  repoName: "myapp-repo"   // NEW
};
```

### 2. Agent Flow

1. **Classification** → Container vulnerability
2. **tryRebuild** → Determines rebuild would fix
3. **createTagWorkflow** → 
   - Creates Git tag
   - Dispatches workflow with callback URL
   - Registers pending rebuild
   - **Awaits webhook** (blocks)
4. **Workflow Execution** (in target repo):
   - Requires approval
   - Builds image
   - Runs Trivy scan
   - POSTs results to agent
5. **verifyRebuildResult** (resumes after webhook):
   - Checks build success
   - Verifies CVE is gone
   - Sets status to "resolved" or "failed"
6. **storeInRAG** (if successful) → END

### 3. Webhook Payload Format

```json
{
  "vulnId": "vuln-123",
  "cveId": "CVE-2024-1234",
  "repoOwner": "myorg",
  "repoName": "myapp-repo",
  "imageName": "registry.example.com/myapp",
  "tag": "rebuild/cve-2024-1234-2024-02-09T12-00-00",
  "workflowRunId": 123456,
  "scanResults": {
    "vulnerabilities": [
      {
        "cveId": "CVE-2024-9999",
        "packageName": "curl",
        "severity": "medium",
        "fixedVersion": "7.88.0"
      }
    ],
    "totalCount": 1,
    "scanTool": "trivy"
  },
  "buildSuccess": true,
  "timestamp": "2024-02-09T12:05:00Z"
}
```

## Testing

A simple test was created to verify the pending rebuild service:

```bash
# Test successful workflow
node test-webhook.mjs

# Expected output:
# Testing pending rebuilds service...
# 1. Registering pending rebuild...
#    ✓ Pending rebuild registered
# 2. Simulating webhook callback...
#    ✓ Resolved: true
# 3. Waiting for promise to resolve...
#    ✓ Promise resolved with scan result
#    - CVE: CVE-2024-1234
#    - Build Success: true
#    - Vulnerabilities: 0
# ✅ All tests passed!
```

## Security Considerations

1. **Timeout Protection**: 30-minute timeout prevents indefinite blocking
2. **Webhook Validation**: Validates required fields (vulnId, cveId)
3. **Promise Cleanup**: Automatically cleans up on timeout or superseded rebuilds
4. **Error Handling**: Graceful degradation if webhook never arrives

## Deployment Notes

1. Set `WEBHOOK_BASE_URL` to your agent's public URL
2. Ensure the workflow has access to container registry secrets
3. Configure GitHub Environment "production" with required approvers
4. Set repository variables: `REGISTRY`, `IMAGE_NAME`
5. Ensure agent can receive POST requests from GitHub Actions runners

## Future Enhancements

1. Add webhook authentication/signing
2. Support multiple concurrent rebuilds per repo
3. Add UI for viewing pending rebuilds
4. Store rebuild history in database
5. Add metrics/telemetry for rebuild success rates
