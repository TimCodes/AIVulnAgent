/** The type of vulnerability — either affecting the container image or application code. */
export type VulnCategory = "container" | "code";

/** Severity levels following CVSS conventions. */
export type Severity = "critical" | "high" | "medium" | "low";

/** Tracks the current phase of remediation. */
export type RemediationStatus =
  | "pending"
  | "classifying"
  | "rebuilding"
  | "searching_rag"
  | "researching"
  | "creating_pr"
  | "creating_tag_workflow"
  | "storing_fix"
  | "resolved"
  | "awaiting_approval"
  | "awaiting_rebuild"
  | "verifying_rebuild"
  | "failed";

/** A vulnerability as ingested from a scanner (Trivy, Grype, etc.). */
export interface Vulnerability {
  id: string;
  cveId: string;
  packageName: string;
  currentVersion: string;
  fixedVersion?: string;
  severity: Severity;
  description: string;
  source: string; // e.g. "trivy", "grype", "snyk"
  imageName?: string; // present for container vulns
  filePath?: string; // present for code vulns
  createdAt: string;
  repoOwner?: string; // GitHub owner of the repo this vuln belongs to
  repoName?: string; // GitHub repo name this vuln belongs to
}

/** A fix that has been discovered and stored in the RAG database. */
export interface StoredFix {
  id: string;
  cveId: string;
  category: VulnCategory;
  packageName: string;
  fixDescription: string;
  fixSteps: string;
  patchContent?: string;
  dockerfileChanges?: string;
  prUrl?: string;
  tagName?: string;
  resolvedAt: string;
}

/** Payload sent by the rebuild workflow webhook */
export interface RebuildScanResult {
  vulnId: string;
  cveId: string;
  repoOwner: string;
  repoName: string;
  imageName: string;
  tag: string;
  workflowRunId: number;
  scanResults: {
    vulnerabilities: Array<{
      cveId: string;
      packageName: string;
      severity: string;
      fixedVersion?: string;
    }>;
    totalCount: number;
    scanTool: string;
  };
  buildSuccess: boolean;
  timestamp: string;
}

/** The state that flows through the LangGraph remediation agent. */
export interface RemediationState {
  // Input
  vulnerability: Vulnerability;

  // Classification
  category: VulnCategory | null;
  classificationReason: string;

  // Container path
  rebuildWouldFix: boolean | null;
  rebuildCheckReason: string;

  // RAG search
  ragResults: StoredFix[];
  ragFixApplicable: boolean;

  // Fix research
  proposedFix: string;
  fixSteps: string;
  patchContent: string;
  dockerfileChanges: string;

  // Outputs
  prUrl: string;
  tagName: string;
  workflowRunUrl: string;

  // Tracking
  status: RemediationStatus;
  stepLog: StepLogEntry[];
  error: string;
}

/** A single entry in the step-by-step log for UI display. */
export interface StepLogEntry {
  timestamp: string;
  node: string;
  message: string;
  status: "running" | "completed" | "failed" | "skipped";
}

/** Server-sent event payload for streaming progress to the frontend. */
export interface SSEEvent {
  type: "step" | "state" | "done" | "error";
  data: StepLogEntry | Partial<RemediationState> | { message: string };
}
