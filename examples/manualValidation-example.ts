#!/usr/bin/env tsx

/**
 * Example: Using Manual Validation Module
 * 
 * This example demonstrates how to use the manual validation module
 * to test individual agents programmatically.
 */

import "dotenv/config";
import {
  testClassifyVuln,
  testSearchRAG,
  sampleCodeVuln,
  sampleContainerVuln,
  createBaseState,
} from "../src/backend/manualValidation.js";
import type { Vulnerability } from "../src/backend/types/index.js";

async function exampleBasicUsage() {
  console.log("\n=== Example 1: Basic Usage ===\n");
  
  // Test classification with the provided sample
  await testClassifyVuln(sampleCodeVuln);
  
  // Test with container sample
  await testClassifyVuln(sampleContainerVuln);
}

async function exampleCustomVulnerability() {
  console.log("\n=== Example 2: Custom Vulnerability ===\n");
  
  // Create a custom vulnerability
  const customVuln: Vulnerability = {
    id: "example-001",
    cveId: "CVE-2024-99999",
    packageName: "lodash",
    currentVersion: "4.17.20",
    fixedVersion: "4.17.21",
    severity: "high",
    description: "Prototype pollution in lodash",
    source: "snyk",
    filePath: "package.json",
    createdAt: new Date().toISOString(),
    repoOwner: "example-org",
    repoName: "example-repo",
  };
  
  // Test with custom vulnerability
  await testClassifyVuln(customVuln);
}

async function exampleSearchingRAG() {
  console.log("\n=== Example 3: Searching RAG Database ===\n");
  
  // Search for known fixes
  const result = await testSearchRAG(sampleCodeVuln);
  
  if (result.ragFixApplicable) {
    console.log("\n✅ Found known fix in RAG database");
    console.log("Fixes found:", result.ragResults?.length);
  } else {
    console.log("\n❌ No known fix found in RAG database");
    console.log("Will need to research a new fix");
  }
}

async function exampleDirectStateManipulation() {
  console.log("\n=== Example 4: Direct State Manipulation ===\n");
  
  // Import agents directly
  const { classifyVuln } = await import("../src/backend/agents/agentNodes.js");
  
  // Create base state
  const state = createBaseState(sampleCodeVuln);
  
  // Manually set some state properties
  state.status = "pending";
  
  // Run the agent
  const result = await classifyVuln(state);
  
  console.log("Classification:", result.category);
  console.log("Reason:", result.classificationReason);
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║          Manual Validation Examples                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  try {
    // Run examples
    await exampleBasicUsage();
    await exampleCustomVulnerability();
    await exampleSearchingRAG();
    await exampleDirectStateManipulation();
    
    console.log("\n✅ All examples completed successfully\n");
  } catch (error) {
    console.error("\n❌ Example failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
