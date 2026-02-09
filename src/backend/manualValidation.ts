/**
 * Manual Validation Module for Agent Testing
 * 
 * This module provides individual methods for testing and validating each agent
 * in the vulnerability remediation workflow. Each method can be tested independently
 * to verify agent behavior without running the full workflow.
 * 
 * Usage:
 *   import { testClassifyVuln, testTryRebuild, ... } from './manualValidation.js';
 *   
 *   // Test individual agent
 *   await testClassifyVuln();
 *   
 *   // Or run all tests
 *   await runAllAgentTests();
 */

import {
  classifyVuln,
  tryRebuild,
  searchRAG,
  researchFix,
  createPRNode,
  createTagWorkflowNode,
  verifyRebuildResult,
  storeInRAG,
} from "./agents/agentNodes.js";
import type { RemediationStateType } from "./agents/state.js";
import type { Vulnerability, StoredFix, RebuildScanResult } from "./types/index.js";

// ---------------------------------------------------------------------------
// Sample Test Data
// ---------------------------------------------------------------------------

/**
 * Sample vulnerability for CODE-type testing (npm package)
 */
export const sampleCodeVuln: Vulnerability = {
  id: "test-vuln-code-001",
  cveId: "CVE-2024-29041",
  packageName: "express",
  currentVersion: "4.18.2",
  fixedVersion: "4.19.2",
  severity: "high",
  description: "Open redirect vulnerability in Express.js allows attackers to redirect users to malicious sites",
  source: "snyk",
  filePath: "package.json",
  createdAt: new Date().toISOString(),
  repoOwner: "test-org",
  repoName: "test-repo",
  repoUrl: "https://github.com/test-org/test-repo",
  defaultBranch: "main",
};

/**
 * Sample vulnerability for CONTAINER-type testing (OS package)
 */
export const sampleContainerVuln: Vulnerability = {
  id: "test-vuln-container-001",
  cveId: "CVE-2023-4911",
  packageName: "glibc",
  currentVersion: "2.34-0ubuntu3",
  fixedVersion: "2.34-0ubuntu3.2",
  severity: "critical",
  description: "Buffer overflow in GNU C Library (glibc) allows local privilege escalation",
  source: "trivy",
  imageName: "ubuntu:22.04",
  createdAt: new Date().toISOString(),
  repoOwner: "test-org",
  repoName: "test-repo",
  repoUrl: "https://github.com/test-org/test-repo",
  defaultBranch: "main",
};

/**
 * Sample RAG fix result
 */
export const sampleRAGFix: StoredFix = {
  id: "fix-001",
  cveId: "CVE-2024-29041",
  category: "code",
  packageName: "express",
  fixDescription: "Upgrade express to version 4.19.2 to fix open redirect vulnerability",
  fixSteps: "1. Update package.json\n2. Run npm install\n3. Test application",
  patchContent: `--- a/package.json
+++ b/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "express": "4.18.2"
+    "express": "4.19.2"
   }
`,
  resolvedAt: new Date().toISOString(),
};

/**
 * Sample rebuild scan result
 */
export const sampleRebuildScanResult: RebuildScanResult = {
  vulnId: "test-vuln-container-001",
  cveId: "CVE-2023-4911",
  repoOwner: "test-org",
  repoName: "test-repo",
  imageName: "ubuntu:22.04",
  tag: "rebuild-cve-2023-4911-2024-02-09",
  workflowRunId: 12345,
  scanResults: {
    vulnerabilities: [
      {
        cveId: "CVE-2024-9999",
        packageName: "openssl",
        severity: "medium",
        fixedVersion: "1.1.1w",
      },
    ],
    totalCount: 1,
    scanTool: "trivy",
  },
  buildSuccess: true,
  timestamp: new Date().toISOString(),
};

/**
 * Create a base state for testing
 */
function createBaseState(vuln: Vulnerability): RemediationStateType {
  return {
    vulnerability: vuln,
    category: null,
    classificationReason: "",
    rebuildWouldFix: null,
    rebuildCheckReason: "",
    ragResults: [],
    ragFixApplicable: false,
    proposedFix: "",
    fixSteps: "",
    patchContent: "",
    dockerfileChanges: "",
    prUrl: "",
    tagName: "",
    workflowRunUrl: "",
    rebuildVerified: false,
    rebuildSuccessful: false,
    rebuildScanResult: null,
    status: "pending",
    stepLog: [],
    error: "",
  };
}

// ---------------------------------------------------------------------------
// Individual Agent Test Methods
// ---------------------------------------------------------------------------

/**
 * Test the classifyVuln agent
 * 
 * This agent determines whether a vulnerability is a container or code issue.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @returns The updated state after classification
 */
export async function testClassifyVuln(vuln?: Vulnerability): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing classifyVuln Agent ===");
  const testVuln = vuln || sampleCodeVuln;
  const state = createBaseState(testVuln);
  
  console.log("Input vulnerability:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    source: testVuln.source,
    imageName: testVuln.imageName,
    filePath: testVuln.filePath,
  });
  
  const result = await classifyVuln(state);
  
  console.log("Classification result:", {
    category: result.category,
    reason: result.classificationReason,
    status: result.status,
  });
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the tryRebuild agent
 * 
 * This agent checks if rebuilding the container image would fix the vulnerability.
 * Only applicable for container vulnerabilities.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @returns The updated state after rebuild check
 */
export async function testTryRebuild(vuln?: Vulnerability): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing tryRebuild Agent ===");
  const testVuln = vuln || sampleContainerVuln;
  const state = createBaseState(testVuln);
  state.category = "container";
  
  console.log("Input vulnerability:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    imageName: testVuln.imageName,
  });
  
  const result = await tryRebuild(state);
  
  console.log("Rebuild check result:", {
    rebuildWouldFix: result.rebuildWouldFix,
    reason: result.rebuildCheckReason,
    status: result.status,
  });
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the searchRAG agent
 * 
 * This agent searches the RAG database for previously stored fixes.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @returns The updated state after RAG search
 */
export async function testSearchRAG(vuln?: Vulnerability): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing searchRAG Agent ===");
  const testVuln = vuln || sampleCodeVuln;
  const state = createBaseState(testVuln);
  
  console.log("Searching RAG for:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
  });
  
  const result = await searchRAG(state);
  
  console.log("RAG search result:", {
    ragFixApplicable: result.ragFixApplicable,
    resultsFound: result.ragResults?.length || 0,
    status: result.status,
  });
  
  if (result.ragResults && result.ragResults.length > 0) {
    console.log("Found fixes:", result.ragResults.map(f => ({
      cveId: f.cveId,
      packageName: f.packageName,
      description: f.fixDescription,
    })));
  }
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the researchFix agent
 * 
 * This agent uses the LLM to research and propose a fix for the vulnerability.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @param category Optional category override ('code' or 'container')
 * @returns The updated state after fix research
 */
export async function testResearchFix(
  vuln?: Vulnerability,
  category: "code" | "container" = "code"
): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing researchFix Agent ===");
  const testVuln = vuln || (category === "code" ? sampleCodeVuln : sampleContainerVuln);
  const state = createBaseState(testVuln);
  state.category = category;
  
  console.log("Researching fix for:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    category: category,
  });
  
  const result = await researchFix(state);
  
  console.log("Research result:", {
    proposedFix: result.proposedFix?.slice(0, 100) + "...",
    hasPatchContent: !!result.patchContent,
    hasDockerfileChanges: !!result.dockerfileChanges,
    status: result.status,
  });
  
  if (result.fixSteps) {
    console.log("Fix steps:", result.fixSteps);
  }
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the createPR agent
 * 
 * This agent creates a GitHub Pull Request with the code fix.
 * Note: This will attempt to create a real PR if GitHub credentials are configured.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @param dryRun If true, only simulates PR creation without actually creating it
 * @returns The updated state after PR creation
 */
export async function testCreatePR(
  vuln?: Vulnerability,
  dryRun: boolean = true
): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing createPR Agent ===");
  const testVuln = vuln || sampleCodeVuln;
  const state = createBaseState(testVuln);
  state.category = "code";
  state.proposedFix = "Upgrade package to fixed version";
  state.fixSteps = "1. Update package.json\n2. Run npm install";
  state.patchContent = sampleRAGFix.patchContent || "";
  
  console.log("Creating PR for:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    repoOwner: testVuln.repoOwner,
    repoName: testVuln.repoName,
    dryRun: dryRun,
  });
  
  if (dryRun) {
    console.log("DRY RUN MODE - PR will not actually be created");
    console.log("To create a real PR, call with dryRun=false and ensure GitHub credentials are set");
    return {
      prUrl: "https://github.com/test-org/test-repo/pull/1 (simulated)",
      status: "creating_pr",
      stepLog: [{
        timestamp: new Date().toISOString(),
        node: "createPR",
        message: "DRY RUN: PR would be created",
        status: "completed",
      }],
    };
  }
  
  const result = await createPRNode(state);
  
  console.log("PR creation result:", {
    prUrl: result.prUrl,
    status: result.status,
    error: result.error,
  });
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the createTagWorkflow agent
 * 
 * This agent creates a GitHub tag and triggers a rebuild workflow.
 * Note: This will attempt to create a real tag if GitHub credentials are configured.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @param dryRun If true, only simulates tag creation without actually creating it
 * @returns The updated state after tag/workflow creation
 */
export async function testCreateTagWorkflow(
  vuln?: Vulnerability,
  dryRun: boolean = true
): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing createTagWorkflow Agent ===");
  const testVuln = vuln || sampleContainerVuln;
  const state = createBaseState(testVuln);
  state.category = "container";
  state.proposedFix = "Rebuild container image with updated base image";
  state.dockerfileChanges = "FROM ubuntu:22.04\nRUN apt-get update && apt-get upgrade -y";
  
  console.log("Creating tag/workflow for:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    imageName: testVuln.imageName,
    repoOwner: testVuln.repoOwner,
    repoName: testVuln.repoName,
    dryRun: dryRun,
  });
  
  if (dryRun) {
    console.log("DRY RUN MODE - Tag and workflow will not actually be created");
    console.log("To create a real tag/workflow, call with dryRun=false and ensure GitHub credentials are set");
    return {
      tagName: "rebuild/cve-2023-4911-2024-02-09 (simulated)",
      workflowRunUrl: "https://github.com/test-org/test-repo/actions/runs/12345 (simulated)",
      status: "creating_tag_workflow",
      stepLog: [{
        timestamp: new Date().toISOString(),
        node: "createTagWorkflow",
        message: "DRY RUN: Tag and workflow would be created",
        status: "completed",
      }],
    };
  }
  
  const result = await createTagWorkflowNode(state);
  
  console.log("Tag/workflow creation result:", {
    tagName: result.tagName,
    workflowRunUrl: result.workflowRunUrl,
    status: result.status,
    error: result.error,
  });
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the verifyRebuildResult agent
 * 
 * This agent verifies whether the rebuild actually fixed the CVE.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @param scanResult Optional custom scan result to test with
 * @returns The updated state after verification
 */
export async function testVerifyRebuildResult(
  vuln?: Vulnerability,
  scanResult?: RebuildScanResult
): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing verifyRebuildResult Agent ===");
  const testVuln = vuln || sampleContainerVuln;
  const testScanResult = scanResult || sampleRebuildScanResult;
  
  const state = createBaseState(testVuln);
  state.category = "container";
  state.rebuildScanResult = testScanResult;
  
  console.log("Verifying rebuild for:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    buildSuccess: testScanResult.buildSuccess,
    remainingVulns: testScanResult.scanResults.totalCount,
  });
  
  const result = await verifyRebuildResult(state);
  
  console.log("Verification result:", {
    rebuildVerified: result.rebuildVerified,
    rebuildSuccessful: result.rebuildSuccessful,
    status: result.status,
    error: result.error,
  });
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

/**
 * Test the storeInRAG agent
 * 
 * This agent stores the successful fix in Azure AI Search.
 * 
 * @param vuln Optional custom vulnerability to test with
 * @returns The updated state after storage
 */
export async function testStoreInRAG(vuln?: Vulnerability): Promise<Partial<RemediationStateType>> {
  console.log("\n=== Testing storeInRAG Agent ===");
  const testVuln = vuln || sampleCodeVuln;
  const state = createBaseState(testVuln);
  state.category = "code";
  state.proposedFix = sampleRAGFix.fixDescription;
  state.fixSteps = sampleRAGFix.fixSteps;
  state.patchContent = sampleRAGFix.patchContent || "";
  state.prUrl = "https://github.com/test-org/test-repo/pull/1";
  
  console.log("Storing fix in RAG for:", {
    cveId: testVuln.cveId,
    packageName: testVuln.packageName,
    category: state.category,
  });
  
  const result = await storeInRAG(state);
  
  console.log("Storage result:", {
    status: result.status,
  });
  
  if (result.stepLog) {
    console.log("Step log:", result.stepLog);
  }
  
  return result;
}

// ---------------------------------------------------------------------------
// Utility Methods
// ---------------------------------------------------------------------------

/**
 * Run all agent tests sequentially
 * 
 * This method runs each agent test in order, useful for comprehensive validation.
 * 
 * @param dryRun If true, skips tests that would create real GitHub resources
 */
export async function runAllAgentTests(dryRun: boolean = true): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║       Running All Agent Tests - Manual Validation         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  try {
    // Test 1: Classify vulnerability
    await testClassifyVuln();
    
    // Test 2: Try rebuild (container path)
    await testTryRebuild();
    
    // Test 3: Search RAG database
    await testSearchRAG();
    
    // Test 4: Research fix (code)
    await testResearchFix(sampleCodeVuln, "code");
    
    // Test 5: Research fix (container)
    await testResearchFix(sampleContainerVuln, "container");
    
    // Test 6: Create PR (with dry run)
    await testCreatePR(undefined, dryRun);
    
    // Test 7: Create tag workflow (with dry run)
    await testCreateTagWorkflow(undefined, dryRun);
    
    // Test 8: Verify rebuild result
    await testVerifyRebuildResult();
    
    // Test 9: Store in RAG
    await testStoreInRAG();
    
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║           All Agent Tests Completed Successfully          ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n❌ Agent test failed:", error);
    throw error;
  }
}

/**
 * Run a custom test scenario
 * 
 * @param scenario Object defining which agents to test and with what data
 */
export async function runCustomScenario(scenario: {
  agents: Array<keyof typeof agentTestMap>;
  vulnerability?: Vulnerability;
  dryRun?: boolean;
}): Promise<void> {
  console.log("\n=== Running Custom Test Scenario ===");
  console.log("Agents to test:", scenario.agents);
  
  for (const agentName of scenario.agents) {
    const testFn = agentTestMap[agentName];
    if (testFn) {
      await testFn(scenario.vulnerability);
    } else {
      console.warn(`Unknown agent: ${agentName}`);
    }
  }
}

// Map of agent names to their test functions
const agentTestMap = {
  classifyVuln: testClassifyVuln,
  tryRebuild: testTryRebuild,
  searchRAG: testSearchRAG,
  researchFix: testResearchFix,
  createPR: (vuln?: Vulnerability) => testCreatePR(vuln, true),
  createTagWorkflow: (vuln?: Vulnerability) => testCreateTagWorkflow(vuln, true),
  verifyRebuildResult: testVerifyRebuildResult,
  storeInRAG: testStoreInRAG,
};

// ---------------------------------------------------------------------------
// Export all test methods and sample data
// ---------------------------------------------------------------------------

export default {
  // Individual test methods
  testClassifyVuln,
  testTryRebuild,
  testSearchRAG,
  testResearchFix,
  testCreatePR,
  testCreateTagWorkflow,
  testVerifyRebuildResult,
  testStoreInRAG,
  
  // Utility methods
  runAllAgentTests,
  runCustomScenario,
  
  // Sample data
  sampleCodeVuln,
  sampleContainerVuln,
  sampleRAGFix,
  sampleRebuildScanResult,
  createBaseState,
};
