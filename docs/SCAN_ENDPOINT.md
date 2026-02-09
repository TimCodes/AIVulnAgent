# Normalized Vulnerability Scan Endpoint

## Overview

The `/api/vulnerabilities/scan` endpoint provides a unified interface for ingesting vulnerability scan results from multiple sources including:

- **JFrog Xray** - Container and artifact vulnerability scanning
- **GitHub Dependabot** - Dependency vulnerability alerts
- **Direct format** - Direct vulnerability submission (backward compatible)

## Endpoint

```
POST /api/vulnerabilities/scan
```

## Request Format

The endpoint accepts a JSON payload with two required fields:

```json
{
  "source": "xray|dependabot|direct",
  "data": { /* source-specific scan data */ }
}
```

### Fields

- **source** (required): The scan result format. Must be one of:
  - `"xray"` - JFrog Xray scan results
  - `"dependabot"` - GitHub Dependabot alerts
  - `"direct"` - Direct vulnerability format

- **data** (required): The scan result data in the source's native format

## Supported Formats

### 1. JFrog Xray (`source: "xray"`)

Xray scan results are typically retrieved via the Xray API or JFrog CLI. The normalized endpoint accepts the standard Xray vulnerability JSON format.

**Data Structure:**
```json
{
  "vulnerabilities": [
    {
      "issue_id": "XRAY-123456",
      "summary": "Vulnerability summary",
      "severity": "Critical|High|Medium|Low",
      "cves": [
        {
          "cve": "CVE-YYYY-NNNNN",
          "cvss_v3_score": "10.0",
          "cvss_v3_vector": "CVSS:3.1/..."
        }
      ],
      "components": {
        "package:name:version": {
          "package_type": "Maven|npm|etc",
          "fixed_versions": ["fixed.version"],
          "impact_paths": [
            [
              {
                "component_id": "docker://image:tag",
                "full_path": "path/to/component"
              }
            ]
          ]
        }
      },
      "description": "Detailed vulnerability description"
    }
  ]
}
```

**Key Features:**
- Automatically extracts CVE IDs from the `cves` array
- Parses component information to identify affected packages and versions
- Detects container vs. code vulnerabilities based on impact paths
- Maps Xray severity levels to normalized levels (critical, high, medium, low)

**Example:**
```bash
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "xray",
    "data": {
      "vulnerabilities": [
        {
          "issue_id": "XRAY-123456",
          "summary": "Remote Code Execution in log4j",
          "severity": "Critical",
          "cves": [{"cve": "CVE-2021-44228"}],
          "components": {
            "org.apache.logging.log4j:log4j-core:2.14.1": {
              "fixed_versions": ["2.17.1"]
            }
          }
        }
      ]
    }
  }'
```

### 2. GitHub Dependabot (`source: "dependabot"`)

Dependabot alerts can be retrieved via the GitHub API or webhooks. The endpoint accepts the standard Dependabot alert format.

**Data Structure:**
```json
{
  "alerts": [
    {
      "number": 1,
      "state": "open|dismissed|fixed",
      "dependency": {
        "package": {
          "ecosystem": "npm|maven|pip|etc",
          "name": "package-name"
        },
        "manifest_path": "path/to/manifest"
      },
      "security_advisory": {
        "ghsa_id": "GHSA-xxxx-yyyy-zzzz",
        "cve_id": "CVE-YYYY-NNNNN",
        "summary": "Vulnerability summary",
        "description": "Detailed description",
        "severity": "critical|high|medium|low"
      },
      "security_vulnerability": {
        "vulnerable_version_range": "< fixed.version",
        "first_patched_version": {
          "identifier": "fixed.version"
        }
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Key Features:**
- Extracts CVE or GHSA identifiers
- Automatically filters out dismissed and fixed alerts
- Detects container vulnerabilities based on ecosystem
- Uses manifest path as file path for code vulnerabilities

**Example:**
```bash
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "dependabot",
    "data": {
      "alerts": [
        {
          "dependency": {
            "package": {"name": "express"},
            "manifest_path": "package.json"
          },
          "security_advisory": {
            "cve_id": "CVE-2024-29041",
            "severity": "high"
          },
          "security_vulnerability": {
            "first_patched_version": {"identifier": "4.19.2"}
          }
        }
      ]
    }
  }'
```

### 3. Direct Format (`source: "direct"`)

The direct format allows submitting vulnerabilities in the system's native format. This is backward compatible with the original `/api/vulnerabilities` endpoint.

**Data Structure:**
```json
{
  "cveId": "CVE-YYYY-NNNNN",
  "packageName": "package-name",
  "currentVersion": "current.version",
  "fixedVersion": "fixed.version",
  "severity": "critical|high|medium|low",
  "description": "Vulnerability description",
  "source": "scanner-name",
  "filePath": "path/to/file",  // for code vulnerabilities
  "imageName": "image:tag"     // for container vulnerabilities
}
```

**Data can be:**
- A single vulnerability object
- An array of vulnerability objects

**Example (single vulnerability):**
```bash
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "direct",
    "data": {
      "cveId": "CVE-2024-12345",
      "packageName": "lodash",
      "currentVersion": "4.17.20",
      "fixedVersion": "4.17.21",
      "severity": "high",
      "description": "Prototype pollution",
      "source": "snyk",
      "filePath": "package.json"
    }
  }'
```

**Example (multiple vulnerabilities):**
```bash
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "direct",
    "data": [
      {"cveId": "CVE-2024-001", ...},
      {"cveId": "CVE-2024-002", ...}
    ]
  }'
```

## Response Format

### Success Response (201 Created)

```json
{
  "message": "Successfully ingested N vulnerability/vulnerabilities",
  "count": 3,
  "vulnerabilities": [
    {
      "id": "generated-uuid",
      "cveId": "CVE-2024-12345",
      "packageName": "package-name",
      "currentVersion": "1.0.0",
      "fixedVersion": "1.0.1",
      "severity": "high",
      "description": "Vulnerability description",
      "source": "xray",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Error Responses

**400 Bad Request - Missing source:**
```json
{
  "error": "Missing 'source' field. Must be one of: xray, dependabot, direct"
}
```

**400 Bad Request - Invalid source:**
```json
{
  "error": "Unsupported source: invalid. Must be one of: xray, dependabot, direct"
}
```

**500 Internal Server Error - Parse failure:**
```json
{
  "error": "Failed to parse scan results",
  "details": "Error message"
}
```

## Integration Examples

### Integrating with JFrog CLI

```bash
# Run Xray scan and export results
jf scan /path/to/artifact --format=json > scan-results.json

# Post to the endpoint
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"xray\", \"data\": $(cat scan-results.json)}"
```

### Integrating with GitHub Dependabot API

```bash
# Fetch Dependabot alerts
curl https://api.github.com/repos/OWNER/REPO/dependabot/alerts \
  -H "Authorization: token $GITHUB_TOKEN" > alerts.json

# Post to the endpoint
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"dependabot\", \"data\": {\"alerts\": $(cat alerts.json)}}"
```

## Next Steps

After ingesting vulnerabilities, you can:

1. **View all vulnerabilities:**
   ```bash
   curl http://localhost:3001/api/vulnerabilities
   ```

2. **Start remediation for a specific vulnerability:**
   ```bash
   curl -X POST http://localhost:3001/api/remediate/{vulnerability-id}
   ```

3. **Stream remediation progress:**
   ```bash
   curl http://localhost:3001/api/remediate/{vulnerability-id}/stream
   ```

## Backward Compatibility

The original `/api/vulnerabilities` endpoint remains available for direct submission of single vulnerabilities. However, we recommend using `/api/vulnerabilities/scan` with `source: "direct"` for new integrations as it provides:

- Better error handling
- Batch submission support
- Consistent response format
- Source tracking
