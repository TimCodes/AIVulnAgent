# Vulnerability Remediation Agent

An AI-powered system that automates vulnerability triage, fix research, and remediation using LangGraph.js, Azure OpenAI, and Azure AI Search.

## How It Works

```
Vulnerability Ingested
        │
        ▼
   Is it CONTAINER or CODE?
        │
   ┌────┴────┐
   │         │
Container   Code
   │         │
   ▼         │
Rebuild      │
fixes it?    │
   │         │
  Yes → DONE │
   │         │
   No        │
   │         │
   ▼         ▼
Search RAG for known fix
   │
 Found? → Apply it
   │
   No
   │
   ▼
Research & generate fix
   │
   ├── Code → Create PR
   └── Container → Create tag workflow (needs approval)
   │
   ▼
Store fix in RAG database
```

**Key outputs:**
- **Code vulnerabilities** → A GitHub Pull Request with the fix
- **Container vulnerabilities** → A GitHub tag that triggers a rebuild workflow requiring manual approval
- **All fixes** → Stored in Azure AI Search (RAG) for future reuse

## Prerequisites

- Node.js 20+
- Azure OpenAI resource with a GPT-4o deployment
- Azure AI Search resource
- GitHub personal access token with `repo` scope

## Setup

```bash
# 1. Install dependencies
npm install
cd src/frontend && npm install && cd ../..

# 2. Configure environment
cp .env.example .env
# Edit .env with your Azure and GitHub credentials

# 3. Run in development
npm run dev
```

The backend runs on `http://localhost:3001` and the frontend on `http://localhost:5173`.

## API

### Ingest Vulnerabilities

The system supports ingesting vulnerabilities from multiple sources including JFrog Xray, GitHub Dependabot, and direct format.

#### Normalized Scan Endpoint (Recommended)

```bash
# Ingest Xray scan results
curl -X POST http://localhost:3001/api/vulnerabilities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "source": "xray",
    "data": {
      "vulnerabilities": [
        {
          "issue_id": "XRAY-123456",
          "summary": "Remote Code Execution vulnerability in log4j-core",
          "severity": "Critical",
          "cves": [{"cve": "CVE-2021-44228"}],
          "components": {
            "org.apache.logging.log4j:log4j-core:2.14.1": {
              "fixed_versions": ["2.17.1"]
            }
          },
          "description": "Log4j RCE vulnerability"
        }
      ]
    }
  }'

# Ingest Dependabot alerts
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
            "severity": "high",
            "description": "Open redirect vulnerability"
          },
          "security_vulnerability": {
            "first_patched_version": {"identifier": "4.19.2"}
          }
        }
      ]
    }
  }'
```

#### Direct Vulnerability Endpoint (Legacy)

```bash
# Ingest a single vulnerability directly
curl -X POST http://localhost:3001/api/vulnerabilities \
  -H "Content-Type: application/json" \
  -d '{
    "cveId": "CVE-2024-29041",
    "packageName": "express",
    "currentVersion": "4.18.2",
    "fixedVersion": "4.19.2",
    "severity": "high",
    "description": "Open redirect vulnerability",
    "source": "snyk",
    "filePath": "package.json"
  }'
```

### Remediation

```bash
# Start remediation (streaming)
curl http://localhost:3001/api/remediate/{id}/stream

# Start remediation (non-streaming)
curl -X POST http://localhost:3001/api/remediate/{id}
```

See `examples/scan-endpoint-usage.js` for more detailed examples.

## Architecture

| Component | Technology |
|-----------|-----------|
| Workflow engine | LangGraph.js |
| LLM | Azure OpenAI (GPT-4o) |
| RAG database | Azure AI Search |
| Source control | GitHub API (Octokit) |
| Backend | Node.js + Express + TypeScript |
| Frontend | React + Tailwind CSS |

## GitHub Workflow

The `rebuild-image.yml` workflow is triggered when container vulnerabilities need a Dockerfile change. It uses GitHub Environments with required reviewers so a human must approve before the image is rebuilt.

To set this up:
1. Go to your repo → Settings → Environments
2. Create a `production` environment
3. Add required reviewers
