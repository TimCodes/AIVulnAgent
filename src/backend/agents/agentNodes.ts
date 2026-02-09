import { v4 as uuidv4 } from "uuid";
import { getLLM } from "../services/azureOpenAI.js";
import { searchFixes, storeFix } from "../services/azureSearch.js";
import {
  createPullRequest,
  createApprovalTagWorkflow,
} from "../tools/githubTools.js";
import type { RemediationStateType } from "./state.js";
import type { StepLogEntry, StoredFix } from "../types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logEntry(
  node: string,
  message: string,
  status: StepLogEntry["status"] = "completed"
): StepLogEntry {
  return { timestamp: new Date().toISOString(), node, message, status };
}

// ---------------------------------------------------------------------------
// Node: classifyVuln
// ---------------------------------------------------------------------------

/**
 * Determines whether the vulnerability affects the container image
 * (base image, OS package, image config) or the application code
 * (source dependency, code pattern).
 */
export async function classifyVuln(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const llm = getLLM();
  const vuln = state.vulnerability;

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a vulnerability triage specialist. Given a vulnerability, classify it as either "container" or "code".

CONTAINER issues include:
- OS-level packages (apt, yum, apk) in the base image
- System libraries (openssl, glibc, zlib, etc.)
- Image configuration issues
- Packages that come from the base image, not from application dependency files

CODE issues include:
- Application dependencies (npm, pip, maven, nuget, go modules, etc.)
- Source code patterns (SQL injection, XSS, etc.)
- Configuration files in the application repo
- Anything managed by package.json, requirements.txt, pom.xml, go.mod, etc.

Respond ONLY with JSON: { "category": "container" | "code", "reason": "brief explanation" }`,
    },
    {
      role: "user",
      content: `CVE: ${vuln.cveId}
Package: ${vuln.packageName}
Current version: ${vuln.currentVersion}
Fixed version: ${vuln.fixedVersion ?? "unknown"}
Severity: ${vuln.severity}
Description: ${vuln.description}
Source scanner: ${vuln.source}
Image: ${vuln.imageName ?? "N/A"}
File path: ${vuln.filePath ?? "N/A"}`,
    },
  ]);

  const text = typeof response.content === "string" ? response.content : "";
  let category: "container" | "code" = "code";
  let reason = "";

  try {
    const parsed = JSON.parse(text);
    category = parsed.category === "container" ? "container" : "code";
    reason = parsed.reason ?? "";
  } catch {
    // Fallback heuristics
    const isOsPkg =
      vuln.source === "trivy" &&
      !vuln.filePath &&
      !!vuln.imageName &&
      !/node_modules|site-packages|vendor/.test(vuln.filePath ?? "");
    category = isOsPkg ? "container" : "code";
    reason = `Fallback heuristic: ${isOsPkg ? "OS-level package in image" : "application dependency"}`;
  }

  return {
    category,
    classificationReason: reason,
    status: "classifying",
    stepLog: [logEntry("classifyVuln", `Classified as ${category}: ${reason}`)],
  };
}

// ---------------------------------------------------------------------------
// Node: tryRebuild
// ---------------------------------------------------------------------------

/**
 * For container vulnerabilities, checks whether simply rebuilding the image
 * (pulling latest base image) would resolve the vulnerability.
 */
export async function tryRebuild(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const llm = getLLM();
  const vuln = state.vulnerability;

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a container security expert. Determine if rebuilding a Docker image (pulling the latest base image tag without code changes) would fix this vulnerability.

Rebuilding WILL fix if:
- The fixed version is available in the latest base image
- The vulnerability is in an OS package that gets updated with base image refreshes
- The base image maintainers have already patched this

Rebuilding will NOT fix if:
- The package needs a version pin or explicit upgrade in the Dockerfile
- The vulnerability is in a custom-installed package
- A specific Dockerfile change is needed (e.g., adding a RUN apt-get upgrade for a specific package)

Respond ONLY with JSON: { "rebuildWouldFix": true | false, "reason": "brief explanation" }`,
    },
    {
      role: "user",
      content: `CVE: ${vuln.cveId}
Package: ${vuln.packageName}
Current version: ${vuln.currentVersion}
Fixed version: ${vuln.fixedVersion ?? "unknown"}
Image: ${vuln.imageName ?? "unknown"}
Description: ${vuln.description}`,
    },
  ]);

  const text = typeof response.content === "string" ? response.content : "";
  let rebuildWouldFix = false;
  let reason = "";

  try {
    const parsed = JSON.parse(text);
    rebuildWouldFix = parsed.rebuildWouldFix === true;
    reason = parsed.reason ?? "";
  } catch {
    rebuildWouldFix = false;
    reason = "Could not determine — proceeding with research.";
  }

  return {
    rebuildWouldFix,
    rebuildCheckReason: reason,
    status: "rebuilding",
    stepLog: [
      logEntry(
        "tryRebuild",
        rebuildWouldFix
          ? `Rebuild would fix: ${reason}`
          : `Rebuild insufficient: ${reason}`
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Node: searchRAG
// ---------------------------------------------------------------------------

/**
 * Searches Azure AI Search for previously stored fixes for this CVE/package.
 */
export async function searchRAG(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const vuln = state.vulnerability;

  let ragResults: StoredFix[] = [];
  let ragFixApplicable = false;

  try {
    ragResults = await searchFixes(vuln.cveId, vuln.packageName);
    ragFixApplicable = ragResults.length > 0;
  } catch (err) {
    console.warn("[searchRAG] Azure Search query failed:", err);
  }

  return {
    ragResults,
    ragFixApplicable,
    status: "searching_rag",
    stepLog: [
      logEntry(
        "searchRAG",
        ragFixApplicable
          ? `Found ${ragResults.length} known fix(es) in RAG database.`
          : "No known fixes found in RAG database."
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Node: researchFix
// ---------------------------------------------------------------------------

/**
 * Uses the LLM to research and propose a fix for the vulnerability.
 * Produces either a code patch (for code vulns) or Dockerfile changes
 * (for container vulns).
 */
export async function researchFix(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const llm = getLLM();
  const vuln = state.vulnerability;
  const isContainer = state.category === "container";

  // Include RAG context if we have partial matches
  const ragContext =
    state.ragResults.length > 0
      ? `\nPreviously known fixes for similar issues:\n${state.ragResults
          .map((r) => `- ${r.cveId} (${r.packageName}): ${r.fixDescription}`)
          .join("\n")}`
      : "";

  const response = await llm.invoke([
    {
      role: "system",
      content: `You are a security remediation expert. Given a vulnerability, produce a concrete fix.
${ragContext}

${
  isContainer
    ? `This is a CONTAINER vulnerability. Provide:
1. A description of the fix
2. Step-by-step instructions
3. The exact Dockerfile changes needed (as a diff or snippet)

Respond as JSON:
{
  "fixDescription": "...",
  "fixSteps": "step 1\\nstep 2\\n...",
  "dockerfileChanges": "FROM node:20-alpine\\nRUN apk upgrade --no-cache\\n..."
}`
    : `This is a CODE vulnerability. Provide:
1. A description of the fix
2. Step-by-step instructions
3. The patch content (file path and changes)

Respond as JSON:
{
  "fixDescription": "...",
  "fixSteps": "step 1\\nstep 2\\n...",
  "patchContent": "--- a/package.json\\n+++ b/package.json\\n@@ ...\\n-\\"pkg\\": \\"1.0.0\\"\\n+\\"pkg\\": \\"1.0.1\\""
}`
}`,
    },
    {
      role: "user",
      content: `CVE: ${vuln.cveId}
Package: ${vuln.packageName}
Current version: ${vuln.currentVersion}
Fixed version: ${vuln.fixedVersion ?? "unknown"}
Severity: ${vuln.severity}
Description: ${vuln.description}
Image: ${vuln.imageName ?? "N/A"}
File path: ${vuln.filePath ?? "N/A"}`,
    },
  ]);

  const text = typeof response.content === "string" ? response.content : "";
  let proposedFix = "";
  let fixSteps = "";
  let patchContent = "";
  let dockerfileChanges = "";

  try {
    const parsed = JSON.parse(text);
    proposedFix = parsed.fixDescription ?? "";
    fixSteps = parsed.fixSteps ?? "";
    patchContent = parsed.patchContent ?? "";
    dockerfileChanges = parsed.dockerfileChanges ?? "";
  } catch {
    proposedFix = text;
    fixSteps = "Manual review needed — LLM response was not structured.";
  }

  return {
    proposedFix,
    fixSteps,
    patchContent,
    dockerfileChanges,
    status: "researching",
    stepLog: [logEntry("researchFix", `Fix researched: ${proposedFix.slice(0, 120)}...`)],
  };
}

// ---------------------------------------------------------------------------
// Node: createPRNode
// ---------------------------------------------------------------------------

/**
 * Creates a GitHub Pull Request with the code fix.
 * Uses the createPullRequest tool from githubTools.
 */
export async function createPRNode(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const vuln = state.vulnerability;
  const branchName = `fix/${vuln.cveId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;

  const files: Array<{ path: string; content: string }> = [];

  if (state.patchContent) {
    const filePath = vuln.filePath ?? "package.json";
    files.push({ path: filePath, content: state.patchContent });
  }

  if (files.length === 0) {
    return {
      status: "failed",
      error: "No patch content generated — cannot create PR.",
      stepLog: [logEntry("createPR", "No patch content to commit.", "failed")],
    };
  }

  try {
    const { prUrl } = await createPullRequest({
      cveId: vuln.cveId,
      branchName,
      title: `fix: remediate ${vuln.cveId} in ${vuln.packageName}`,
      body: `## Vulnerability Remediation

**CVE:** ${vuln.cveId}
**Package:** ${vuln.packageName} ${vuln.currentVersion} → ${vuln.fixedVersion ?? "patched"}
**Severity:** ${vuln.severity}

### Fix Description
${state.proposedFix}

### Steps
${state.fixSteps}

---
*Auto-generated by Vulnerability Remediation Agent*`,
      files,
    });

    return {
      prUrl,
      status: "creating_pr",
      stepLog: [logEntry("createPR", `PR created: ${prUrl}`)],
    };
  } catch (err: any) {
    return {
      status: "failed",
      error: `Failed to create PR: ${err.message}`,
      stepLog: [logEntry("createPR", `PR creation failed: ${err.message}`, "failed")],
    };
  }
}

// ---------------------------------------------------------------------------
// Node: createTagWorkflowNode
// ---------------------------------------------------------------------------

/**
 * Creates a GitHub tag and triggers a rebuild workflow that requires
 * manual user approval. Uses the createApprovalTagWorkflow tool.
 */
export async function createTagWorkflowNode(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const vuln = state.vulnerability;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const tagName = `rebuild/${vuln.cveId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${timestamp}`;

  try {
    const result = await createApprovalTagWorkflow({
      tagName,
      cveId: vuln.cveId,
      message: `Container rebuild for ${vuln.cveId}\n\n${state.proposedFix}`,
      imageName: vuln.imageName,
    });

    return {
      tagName: result.tagName,
      workflowRunUrl: result.workflowRunUrl,
      status: "awaiting_approval",
      stepLog: [
        logEntry(
          "createTagWorkflow",
          `Tag "${result.tagName}" created. Workflow triggered — awaiting user approval at ${result.workflowRunUrl}`
        ),
      ],
    };
  } catch (err: any) {
    return {
      status: "failed",
      error: `Failed to create tag/workflow: ${err.message}`,
      stepLog: [
        logEntry("createTagWorkflow", `Tag creation failed: ${err.message}`, "failed"),
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Node: storeInRAG
// ---------------------------------------------------------------------------

/**
 * Stores the successful fix in Azure AI Search for future lookups.
 */
export async function storeInRAG(
  state: RemediationStateType
): Promise<Partial<RemediationStateType>> {
  const vuln = state.vulnerability;

  const fix: StoredFix = {
    id: uuidv4(),
    cveId: vuln.cveId,
    category: state.category ?? "code",
    packageName: vuln.packageName,
    fixDescription: state.proposedFix,
    fixSteps: state.fixSteps,
    patchContent: state.patchContent || undefined,
    dockerfileChanges: state.dockerfileChanges || undefined,
    prUrl: state.prUrl || undefined,
    tagName: state.tagName || undefined,
    resolvedAt: new Date().toISOString(),
  };

  try {
    await storeFix(fix);
    return {
      status: "resolved",
      stepLog: [logEntry("storeInRAG", `Fix stored in RAG database for future reuse.`)],
    };
  } catch (err: any) {
    console.warn("[storeInRAG] Failed to store fix:", err);
    return {
      status: "resolved",
      stepLog: [
        logEntry("storeInRAG", `Fix applied but RAG storage failed: ${err.message}`, "failed"),
      ],
    };
  }
}
