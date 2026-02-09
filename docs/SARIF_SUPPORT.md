# SARIF Format Support

## Overview

SARIF (Static Analysis Results Interchange Format) is an industry-standard JSON format for reporting static analysis and security scan results. This system now supports both **ingesting** SARIF format scan results and **exporting** vulnerabilities to SARIF format.

## SARIF Specification

This implementation supports SARIF v2.1.0 specification:
- Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
- Schema: https://json.schemastore.org/sarif-2.1.0.json

## Ingesting SARIF Scan Results

### Endpoint

```
POST /api/vulnerabilities/scan
```

### Request Format

```json
{
  "source": "sarif",
  "data": {
    "version": "2.1.0",
    "runs": [...]
  }
}
```

### Example: Ingest SARIF Report

```bash
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "sarif",
    "data": {
      "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
      "version": "2.1.0",
      "runs": [{
        "tool": {
          "driver": {
            "name": "Trivy",
            "version": "0.48.0"
          }
        },
        "results": [
          {
            "ruleId": "CVE-2021-44228",
            "level": "error",
            "message": {
              "text": "Apache Log4j2 JNDI features do not protect against attacker controlled LDAP"
            },
            "locations": [{
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "app/lib/log4j-core-2.14.1.jar"
                }
              }
            }],
            "properties": {
              "packageName": "org.apache.logging.log4j:log4j-core",
              "currentVersion": "2.14.1",
              "fixedVersion": "2.17.1",
              "severity": "critical",
              "cve": "CVE-2021-44228"
            }
          }
        ]
      }]
    }
  }'
```

### SARIF Parser Features

The SARIF parser automatically:

1. **Extracts CVE IDs** from:
   - `ruleId` field (if it matches CVE pattern)
   - `properties.cve` or `properties.cves`
   - Falls back to `ruleId` or generates a unique ID

2. **Maps SARIF levels to severity**:
   - `error` → `high` severity
   - `warning` → `medium` severity
   - `note` → `low` severity
   - Can override with `properties.severity`

3. **Extracts package information** from:
   - `properties.packageName`
   - `properties.package`
   - `properties.component`
   - Falls back to artifact location

4. **Detects vulnerability type**:
   - Container vulnerabilities: `properties.type === "container"` or Dockerfile in path
   - Code vulnerabilities: everything else with file location

5. **Extracts version information** from:
   - `properties.currentVersion` / `properties.installedVersion`
   - `properties.fixedVersion` / `properties.patchedVersion`

### Supported SARIF Properties

The parser recognizes these custom properties:

```typescript
{
  "properties": {
    "severity": "critical|high|medium|low",  // Overrides level mapping
    "packageName": "package-name",            // Package identifier
    "currentVersion": "1.0.0",               // Installed version
    "fixedVersion": "1.0.1",                 // Fixed version
    "type": "container|code",                // Vulnerability type
    "imageName": "docker-image:tag",         // For container vulns
    "cve": "CVE-2024-12345",                 // CVE identifier
    "cves": ["CVE-1", "CVE-2"]               // Multiple CVEs
  }
}
```

## Exporting to SARIF Format

### Export All Vulnerabilities

```
GET /api/vulnerabilities/export/sarif
```

Returns all vulnerabilities as a SARIF v2.1.0 document.

**Example:**
```bash
curl http://localhost:3001/api/vulnerabilities/export/sarif > vulnerabilities.sarif
```

### Export Specific Vulnerabilities

```
POST /api/vulnerabilities/export/sarif
```

**Request:**
```json
{
  "ids": ["vuln-id-1", "vuln-id-2", "vuln-id-3"]
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/vulnerabilities/export/sarif \
  -H "Content-Type: application/json" \
  -d '{"ids": ["abc-123", "def-456"]}' \
  > selected-vulnerabilities.sarif
```

### SARIF Export Format

The exported SARIF document includes:

```json
{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "AIVulnAgent",
          "version": "1.0.0",
          "informationUri": "https://github.com/TimCodes/AIVulnAgent",
          "rules": [
            {
              "id": "CVE-2024-12345",
              "name": "lodash",
              "shortDescription": {
                "text": "HIGH: lodash"
              },
              "fullDescription": {
                "text": "Prototype pollution vulnerability"
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "CVE-2024-12345",
          "level": "error",
          "message": {
            "text": "Prototype pollution vulnerability"
          },
          "locations": [{
            "physicalLocation": {
              "artifactLocation": {
                "uri": "package.json"
              }
            }
          }],
          "properties": {
            "severity": "high",
            "packageName": "lodash",
            "currentVersion": "4.17.20",
            "fixedVersion": "4.17.21",
            "source": "snyk",
            "type": "code"
          }
        }
      ],
      "properties": {
        "source": "snyk",
        "scanTime": "2024-01-01T00:00:00.000Z"
      }
    }
  ]
}
```

### Severity Mapping (Export)

When exporting, our severity levels map to SARIF levels:

| Our Severity | SARIF Level |
|--------------|-------------|
| critical     | error       |
| high         | error       |
| medium       | warning     |
| low          | note        |

The original severity is preserved in `properties.severity`.

## Integration Examples

### GitHub Advanced Security

Upload SARIF to GitHub:

```bash
# Generate SARIF
curl http://localhost:3001/api/vulnerabilities/export/sarif > results.sarif

# Upload to GitHub
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/OWNER/REPO/code-scanning/sarifs \
  -f commit_sha="$(git rev-parse HEAD)" \
  -f ref="refs/heads/main" \
  -f sarif=@results.sarif
```

### Trivy Scanner

Ingest Trivy SARIF output:

```bash
# Run Trivy and generate SARIF
trivy image --format sarif --output trivy.sarif myimage:latest

# Ingest into system
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"sarif\", \"data\": $(cat trivy.sarif)}"
```

### Snyk Scanner

Ingest Snyk SARIF output:

```bash
# Run Snyk and export SARIF
snyk test --sarif-file-output=snyk.sarif

# Ingest into system
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d "{\"source\": \"sarif\", \"data\": $(cat snyk.sarif)}"
```

### SonarQube

Many modern security tools support SARIF:
- SonarQube
- Contrast Security
- Checkmarx
- Semgrep
- CodeQL

All can generate SARIF output that can be ingested using the same endpoint.

## Benefits of SARIF Support

1. **Standardization**: Use the same format across multiple security tools
2. **Interoperability**: Easily integrate with GitHub Advanced Security, Azure DevOps, etc.
3. **Tool Agnostic**: Accept results from any SARIF-compliant scanner
4. **Rich Metadata**: SARIF supports detailed location information, code flows, and fixes
5. **Industry Adoption**: SARIF is supported by most modern security scanning tools

## Limitations

- Currently supports SARIF v2.1.0
- Advanced features like `codeFlows` and `threadFlows` are not fully utilized in parsing
- Graph visualization is not yet implemented
- Fixes in SARIF format are not automatically applied (only extracted)

## Next Steps

After ingesting SARIF scan results, you can:

1. **View all vulnerabilities:**
   ```bash
   curl http://localhost:3001/api/vulnerabilities
   ```

2. **Start remediation:**
   ```bash
   curl -X POST http://localhost:3001/api/remediate/{vulnerability-id}
   ```

3. **Export to SARIF for other tools:**
   ```bash
   curl http://localhost:3001/api/vulnerabilities/export/sarif
   ```

## References

- [OASIS SARIF Specification](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)
- [SARIF Tutorials by Microsoft](https://github.com/microsoft/sarif-tutorials)
- [GitHub Code Scanning SARIF Support](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)
