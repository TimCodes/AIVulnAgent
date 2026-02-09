#!/usr/bin/env tsx

/**
 * Manual Validation Test Runner
 * 
 * This script allows you to manually test and validate each agent individually.
 * 
 * Setup:
 *   Copy .env.example to .env and configure your credentials before running tests.
 * 
 * Usage:
 *   # Run all tests
 *   npx tsx src/backend/runManualValidation.ts all
 * 
 *   # Run specific agent test
 *   npx tsx src/backend/runManualValidation.ts classifyVuln
 *   npx tsx src/backend/runManualValidation.ts tryRebuild
 *   npx tsx src/backend/runManualValidation.ts searchRAG
 *   npx tsx src/backend/runManualValidation.ts researchFix
 *   npx tsx src/backend/runManualValidation.ts createPR
 *   npx tsx src/backend/runManualValidation.ts createTagWorkflow
 *   npx tsx src/backend/runManualValidation.ts verifyRebuildResult
 *   npx tsx src/backend/runManualValidation.ts storeInRAG
 * 
 *   # Run with real GitHub operations (not dry run)
 *   npx tsx src/backend/runManualValidation.ts createPR --no-dry-run
 */

import "dotenv/config";
import {
  testClassifyVuln,
  testTryRebuild,
  testSearchRAG,
  testResearchFix,
  testCreatePR,
  testCreateTagWorkflow,
  testVerifyRebuildResult,
  testStoreInRAG,
  runAllAgentTests,
  sampleCodeVuln,
  sampleContainerVuln,
} from "./manualValidation.js";

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || "help";
const isDryRun = !args.includes("--no-dry-run");

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     Manual Validation Test Runner for Agent Workflow      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Check if .env file is configured
  if (!process.env.AZURE_OPENAI_ENDPOINT) {
    console.error("❌ Error: AZURE_OPENAI_ENDPOINT not found in environment variables");
    console.error("\n📋 Setup Instructions:");
    console.error("1. Copy .env.example to .env");
    console.error("2. Configure your Azure OpenAI credentials");
    console.error("3. Optionally configure Azure Search and GitHub credentials\n");
    console.error("For more details, see docs/MANUAL_VALIDATION.md\n");
    process.exit(1);
  }

  if (!process.env.AZURE_SEARCH_API_KEY) {
    console.warn("⚠️  Warning: AZURE_SEARCH_API_KEY not configured");
    console.warn("⚠️  RAG-related tests (searchRAG, storeInRAG) may fail\n");
  }

  if (!process.env.GITHUB_TOKEN) {
    console.warn("⚠️  Warning: GITHUB_TOKEN not configured");
    console.warn("⚠️  GitHub-related tests (createPR, createTagWorkflow) will only run in dry-run mode\n");
  }

  try {
    switch (command.toLowerCase()) {
      case "all":
        await runAllAgentTests(isDryRun);
        break;

      case "classifyvuln":
      case "classify":
        console.log("Testing with CODE vulnerability:");
        await testClassifyVuln(sampleCodeVuln);
        console.log("\nTesting with CONTAINER vulnerability:");
        await testClassifyVuln(sampleContainerVuln);
        break;

      case "tryrebuild":
      case "rebuild":
        await testTryRebuild();
        break;

      case "searchrag":
      case "rag":
      case "search":
        await testSearchRAG();
        break;

      case "researchfix":
      case "research":
        console.log("Testing fix research for CODE vulnerability:");
        await testResearchFix(sampleCodeVuln, "code");
        console.log("\nTesting fix research for CONTAINER vulnerability:");
        await testResearchFix(sampleContainerVuln, "container");
        break;

      case "createpr":
      case "pr":
        await testCreatePR(undefined, isDryRun);
        if (isDryRun) {
          console.log("\nℹ️  To create a real PR, run with --no-dry-run flag");
        }
        break;

      case "createtagworkflow":
      case "tag":
      case "workflow":
        await testCreateTagWorkflow(undefined, isDryRun);
        if (isDryRun) {
          console.log("\nℹ️  To create a real tag/workflow, run with --no-dry-run flag");
        }
        break;

      case "verifyrebuildresult":
      case "verify":
        await testVerifyRebuildResult();
        break;

      case "storeinrag":
      case "store":
        await testStoreInRAG();
        break;

      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}\n`);
        printHelp();
        process.exit(1);
    }

    console.log("\n✅ Test completed successfully\n");
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  }
}

function printHelp() {
  console.log("Usage: npx tsx src/backend/runManualValidation.ts <command> [options]\n");
  console.log("Commands:");
  console.log("  all                  Run all agent tests");
  console.log("  classifyVuln         Test vulnerability classification agent");
  console.log("  tryRebuild           Test container rebuild check agent");
  console.log("  searchRAG            Test RAG database search agent");
  console.log("  researchFix          Test fix research agent");
  console.log("  createPR             Test pull request creation agent");
  console.log("  createTagWorkflow    Test tag/workflow creation agent");
  console.log("  verifyRebuildResult  Test rebuild verification agent");
  console.log("  storeInRAG           Test RAG storage agent");
  console.log("  help                 Show this help message\n");
  console.log("Options:");
  console.log("  --no-dry-run         Execute real GitHub operations (default is dry run)\n");
  console.log("Examples:");
  console.log("  npx tsx src/backend/runManualValidation.ts all");
  console.log("  npx tsx src/backend/runManualValidation.ts classifyVuln");
  console.log("  npx tsx src/backend/runManualValidation.ts createPR --no-dry-run\n");
}

// Run main function
main();
