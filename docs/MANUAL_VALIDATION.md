# Manual Validation Guide

This guide explains how to manually test and validate each agent in the vulnerability remediation workflow.

## Overview

The manual validation module provides individual test methods for each of the 8 agents in the remediation workflow:

1. **classifyVuln** - Classifies vulnerabilities as either container or code issues
2. **tryRebuild** - Checks if rebuilding the container would fix the vulnerability
3. **searchRAG** - Searches for previously stored fixes in the RAG database
4. **researchFix** - Uses LLM to research and propose a fix
5. **createPR** - Creates a GitHub Pull Request with the fix
6. **createTagWorkflow** - Creates a GitHub tag and triggers rebuild workflow
7. **verifyRebuildResult** - Verifies if the rebuild fixed the vulnerability
8. **storeInRAG** - Stores the successful fix in the RAG database

## Quick Start

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your environment:
   ```bash
   cp .env.example .env
   # Edit .env with your Azure OpenAI and GitHub credentials
   ```

### Running Tests

#### Test All Agents

```bash
npx tsx src/backend/runManualValidation.ts all
```

#### Test Individual Agents

```bash
# Test classification agent
npx tsx src/backend/runManualValidation.ts classifyVuln

# Test rebuild check agent
npx tsx src/backend/runManualValidation.ts tryRebuild

# Test RAG search agent
npx tsx src/backend/runManualValidation.ts searchRAG

# Test fix research agent
npx tsx src/backend/runManualValidation.ts researchFix

# Test PR creation agent (dry run)
npx tsx src/backend/runManualValidation.ts createPR

# Test tag/workflow creation agent (dry run)
npx tsx src/backend/runManualValidation.ts createTagWorkflow

# Test rebuild verification agent
npx tsx src/backend/runManualValidation.ts verifyRebuildResult

# Test RAG storage agent
npx tsx src/backend/runManualValidation.ts storeInRAG
```

### Dry Run vs Real Execution

By default, tests that would create GitHub resources (PR, tags, workflows) run in **dry run mode**, which means they simulate the operation without actually creating anything.

To execute real GitHub operations:

```bash
# Create a real pull request
npx tsx src/backend/runManualValidation.ts createPR --no-dry-run

# Create a real tag and workflow
npx tsx src/backend/runManualValidation.ts createTagWorkflow --no-dry-run
```

⚠️ **Warning**: Using `--no-dry-run` will create real GitHub resources. Make sure your GitHub credentials are properly configured.

## Using as a Module

You can also import and use the validation functions in your own code:

```typescript
import {
  testClassifyVuln,
  testTryRebuild,
  testSearchRAG,
  testResearchFix,
  sampleCodeVuln,
  sampleContainerVuln,
} from './manualValidation.js';

// Test with default sample data
const result = await testClassifyVuln();

// Test with custom vulnerability
const customVuln = {
  id: "custom-001",
  cveId: "CVE-2024-12345",
  packageName: "lodash",
  currentVersion: "4.17.20",
  fixedVersion: "4.17.21",
  severity: "high",
  description: "Prototype pollution vulnerability",
  source: "snyk",
  filePath: "package.json",
  createdAt: new Date().toISOString(),
  repoOwner: "myorg",
  repoName: "myrepo",
};

const customResult = await testClassifyVuln(customVuln);
```

## Sample Test Data

The module includes pre-configured sample vulnerabilities:

### Code Vulnerability (npm package)
- CVE: CVE-2024-29041
- Package: express
- Type: Open redirect vulnerability
- Severity: high

### Container Vulnerability (OS package)
- CVE: CVE-2023-4911
- Package: glibc
- Type: Buffer overflow
- Severity: critical

You can use these samples or create your own custom vulnerabilities for testing.

## Understanding Test Output

Each test will output:

1. **Input data** - The vulnerability being tested
2. **Agent processing** - What the agent is doing
3. **Results** - The outcome from the agent
4. **Step log** - Detailed execution log

Example output:

```
=== Testing classifyVuln Agent ===
Input vulnerability: {
  cveId: 'CVE-2024-29041',
  packageName: 'express',
  source: 'snyk',
  filePath: 'package.json'
}
Classification result: {
  category: 'code',
  reason: 'This is an application dependency managed by package.json',
  status: 'classifying'
}
Step log: [
  {
    timestamp: '2024-02-09T21:10:00.000Z',
    node: 'classifyVuln',
    message: 'Classified as code: This is an application dependency...',
    status: 'completed'
  }
]
```

## Testing Workflow

### Recommended Testing Sequence

1. **Start with classification** - Test `classifyVuln` to ensure vulnerabilities are correctly categorized
2. **Test the appropriate path**:
   - For code vulnerabilities: `searchRAG` → `researchFix` → `createPR` → `storeInRAG`
   - For container vulnerabilities: `tryRebuild` → `searchRAG` → `researchFix` → `createTagWorkflow` → `verifyRebuildResult` → `storeInRAG`
3. **Validate each step** - Review the output to ensure agents are working correctly

### Custom Test Scenarios

You can create custom test scenarios by importing the module:

```typescript
import { runCustomScenario, sampleCodeVuln } from './manualValidation.js';

await runCustomScenario({
  agents: ['classifyVuln', 'searchRAG', 'researchFix'],
  vulnerability: sampleCodeVuln,
  dryRun: true,
});
```

## Troubleshooting

### Azure OpenAI Not Configured

If you see warnings about missing Azure OpenAI configuration:

1. Copy `.env.example` to `.env`
2. Fill in your Azure OpenAI credentials:
   ```
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_DEPLOYMENT=your-deployment-name
   ```

### GitHub Credentials Not Configured

For tests that interact with GitHub (createPR, createTagWorkflow):

1. Add your GitHub token to `.env`:
   ```
   GITHUB_TOKEN=your-github-token
   GITHUB_OWNER=your-org-or-username
   GITHUB_REPO=your-repo-name
   ```

2. Ensure your token has the `repo` scope

### Azure Search Not Configured

For RAG-related tests (searchRAG, storeInRAG):

1. Add your Azure AI Search credentials to `.env`:
   ```
   AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
   AZURE_SEARCH_API_KEY=your-search-api-key
   AZURE_SEARCH_INDEX=your-index-name
   ```

## Integration with CI/CD

You can integrate these tests into your CI/CD pipeline:

```yaml
# .github/workflows/test-agents.yml
name: Test Agents

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - name: Test all agents
        run: npx tsx src/backend/runManualValidation.ts all
        env:
          AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
          AZURE_OPENAI_API_KEY: ${{ secrets.AZURE_OPENAI_API_KEY }}
          AZURE_OPENAI_DEPLOYMENT: ${{ secrets.AZURE_OPENAI_DEPLOYMENT }}
```

## Advanced Usage

### Testing with Mock Data

You can create mock implementations to test without external dependencies:

```typescript
import { createBaseState } from './manualValidation.js';
import { classifyVuln } from './agents/agentNodes.js';

// Create a test state
const mockVuln = { /* your vulnerability */ };
const state = createBaseState(mockVuln);

// Test the agent directly
const result = await classifyVuln(state);
```

### Debugging Agent Behavior

To debug specific agent behavior:

1. Add breakpoints in the agent node files (`src/backend/agents/agentNodes.ts`)
2. Run tests with the debugger:
   ```bash
   node --inspect-brk node_modules/.bin/tsx src/backend/runManualValidation.ts classifyVuln
   ```

## Contributing

When adding new agents to the workflow:

1. Add the agent function to `agentNodes.ts`
2. Create a test method in `manualValidation.ts`
3. Add a command handler in `runManualValidation.ts`
4. Update this README with the new agent

## Support

For issues or questions:

1. Check the main README.md for general setup instructions
2. Review the agent code in `src/backend/agents/`
3. Open an issue in the GitHub repository
