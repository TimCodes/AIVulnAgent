# Quick Reference: Manual Validation

## Setup (One-time)
```bash
cp .env.example .env
# Edit .env with your Azure OpenAI credentials
```

## Basic Commands

### Test All Agents
```bash
npm run validate:all
```

### Test Individual Agents
```bash
# Classification
npm run validate classifyVuln

# Container path
npm run validate tryRebuild

# RAG operations
npm run validate searchRAG
npm run validate storeInRAG

# Fix research
npm run validate researchFix

# GitHub operations (dry run by default)
npm run validate createPR
npm run validate createTagWorkflow

# Verification
npm run validate verifyRebuildResult
```

### Real GitHub Operations (Not Dry Run)
```bash
npm run validate createPR -- --no-dry-run
npm run validate createTagWorkflow -- --no-dry-run
```

### Help
```bash
npm run validate help
```

## The 8 Agents

| Agent | Purpose | Required Config |
|-------|---------|----------------|
| classifyVuln | Classify vulnerability type | Azure OpenAI |
| tryRebuild | Check if rebuild fixes issue | Azure OpenAI |
| searchRAG | Search for known fixes | Azure Search |
| researchFix | Generate new fix | Azure OpenAI |
| createPR | Create pull request | GitHub Token |
| createTagWorkflow | Create tag & workflow | GitHub Token |
| verifyRebuildResult | Verify fix worked | - |
| storeInRAG | Store fix for reuse | Azure Search |

## Required Environment Variables

### Minimum (for basic testing)
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`

### For RAG tests
- `AZURE_SEARCH_ENDPOINT`
- `AZURE_SEARCH_API_KEY`

### For GitHub tests
- `GITHUB_TOKEN`
- `GITHUB_OWNER` (optional)
- `GITHUB_REPO` (optional)

## Sample Output
```
=== Testing classifyVuln Agent ===
Input vulnerability: {
  cveId: 'CVE-2024-29041',
  packageName: 'express',
  source: 'snyk'
}
Classification result: {
  category: 'code',
  reason: 'Application dependency',
  status: 'classifying'
}
✅ Test completed successfully
```

## Programmatic Usage
```typescript
import { testClassifyVuln, sampleCodeVuln } from './src/backend/manualValidation.js';

await testClassifyVuln(sampleCodeVuln);
```

## More Information
- Full documentation: [docs/MANUAL_VALIDATION.md](docs/MANUAL_VALIDATION.md)
- Code examples: [examples/manualValidation-example.ts](examples/manualValidation-example.ts)
- Implementation details: [MANUAL_VALIDATION_SUMMARY.md](MANUAL_VALIDATION_SUMMARY.md)
