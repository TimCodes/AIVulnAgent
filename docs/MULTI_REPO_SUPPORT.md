# Multi-Repository Support

## Overview

The AIVulnAgent now supports handling vulnerabilities from multiple repositories. Each vulnerability carries its own repository context, and remediation actions (PR creation, tag workflows) are automatically applied to the correct repository.

## Key Features

1. **Repository Metadata in Vulnerabilities**: Each vulnerability now includes `repoOwner`, `repoName`, `repoUrl`, and optionally `defaultBranch`
2. **Dynamic Repository Targeting**: GitHub tools accept repository parameters instead of using hardcoded values
3. **Backward Compatibility**: Default repository values from environment variables are used as fallback
4. **Multi-Repo Ingestion**: Different scan results can be ingested for different repositories

## API Changes

### POST /api/vulnerabilities/scan

The scan endpoint now **requires** a `repository` field:

```json
{
  "source": "xray|dependabot|sarif|direct",
  "repository": {
    "owner": "TimCodes",
    "repo": "AIVulnAgent",
    "url": "https://github.com/TimCodes/AIVulnAgent"  // optional
  },
  "data": { /* scan results */ }
}
```

**Error Response** when repository is missing:
```json
{
  "error": "Missing 'repository' field. Must include { owner, repo }"
}
```

## Usage Examples

### Single Repository (Backward Compatible)

```bash
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "dependabot",
    "repository": {
      "owner": "TimCodes",
      "repo": "AIVulnAgent"
    },
    "data": { /* scan results */ }
  }'
```

### Multiple Repositories

```bash
# Ingest from Repository A
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "xray",
    "repository": { "owner": "TimCodes", "repo": "RepoA" },
    "data": { /* scan results */ }
  }'

# Ingest from Repository B
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "trivy",
    "repository": { "owner": "AnotherOrg", "repo": "RepoB" },
    "data": { /* scan results */ }
  }'

# Remediate both - PRs go to correct repos
GET /api/remediate/{vulnA_id}/stream  # Creates PR in TimCodes/RepoA
GET /api/remediate/{vulnB_id}/stream  # Creates PR in AnotherOrg/RepoB
```

## Type Definitions

### Vulnerability Interface (Updated)

```typescript
export interface Vulnerability {
  id: string;
  cveId: string;
  packageName: string;
  currentVersion: string;
  fixedVersion?: string;
  severity: Severity;
  description: string;
  source: string;
  imageName?: string;
  filePath?: string;
  createdAt: string;
  
  // NEW: Repository context for multi-repo support
  repoOwner: string;      // GitHub repository owner (user/org)
  repoName: string;       // GitHub repository name
  repoUrl?: string;       // Optional: Full GitHub URL for reference
  defaultBranch?: string; // Optional: Target branch (defaults to repo's default)
}
```

## Environment Variables

The following environment variables are now **optional** and serve as defaults:

```bash
# Optional: Default repository for backward compatibility
GITHUB_OWNER=TimCodes
GITHUB_REPO=AIVulnAgent

# Still required for authentication
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

## Migration Guide

### For Existing Vulnerabilities

Vulnerabilities in the system without `repoOwner`/`repoName` will be automatically backfilled with values from `GITHUB_OWNER` and `GITHUB_REPO` environment variables when retrieved via the API.

### For API Clients

Update your API calls to include the `repository` field:

**Before:**
```javascript
fetch('/api/vulnerabilities/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'xray',
    data: scanResults
  })
})
```

**After:**
```javascript
fetch('/api/vulnerabilities/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'xray',
    repository: {
      owner: 'TimCodes',
      repo: 'AIVulnAgent'
    },
    data: scanResults
  })
})
```

## UI Changes

The frontend now displays repository information in:

1. **Vulnerability List** - Shows `Repo: owner/name` for each vulnerability
2. **Remediation View** - Displays repository context in the header

## Implementation Details

### Parser Changes

All parsers now accept a `repoContext` parameter:

```typescript
parseXrayScanResult(scanResult, repoContext)
parseDependabotScanResult(scanResult, repoContext)
parseSarifScanResult(sarifLog, repoContext)
```

### GitHub Tools Changes

GitHub tool functions now accept repository parameters:

```typescript
createPullRequest({ ..., repoOwner, repoName })
createApprovalTagWorkflow({ ..., repoOwner, repoName })
triggerBuildAndScan({ ..., repoOwner, repoName })
readIssues({ ..., repoOwner?, repoName? })
```

### Agent Node Changes

Agent nodes extract repository context from the vulnerability:

```typescript
await createPullRequest({
  // ... other params
  repoOwner: vuln.repoOwner,
  repoName: vuln.repoName,
})
```

## Security Considerations

1. **Token Management**: Currently uses a single GitHub token for all repositories. Future enhancement: per-repo token management
2. **Access Control**: Ensure the GitHub token has appropriate permissions for all target repositories
3. **Validation**: Repository ownership and existence are validated during API calls

## Future Enhancements

- [ ] Per-repository GitHub token management
- [ ] Repository access validation
- [ ] Bulk operations across multiple repositories
- [ ] Repository grouping and filtering in UI
- [ ] Audit logging for cross-repository actions
