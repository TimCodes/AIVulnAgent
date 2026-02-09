export type VulnCategory = "container" | "code";
export type Severity = "critical" | "high" | "medium" | "low";
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
  | "failed";

export interface Vulnerability {
  id: string;
  cveId: string;
  packageName: string;
  currentVersion: string;
  fixedVersion?: string;
  severity: Severity;
  description: string;
  source: string;
  imageName?: string;
  filePath?: string;
  createdAt: string;
  
  // Repository context for multi-repo support
  repoOwner: string;      // GitHub repository owner (user/org)
  repoName: string;       // GitHub repository name
  repoUrl?: string;       // Optional: Full GitHub URL for reference
  defaultBranch?: string; // Optional: Target branch (defaults to repo's default)
}

export interface StepLogEntry {
  timestamp: string;
  node: string;
  message: string;
  status: "running" | "completed" | "failed" | "skipped";
}

export interface RemediationState {
  vulnerability: Vulnerability;
  category: VulnCategory | null;
  classificationReason: string;
  rebuildWouldFix: boolean | null;
  rebuildCheckReason: string;
  ragFixApplicable: boolean;
  proposedFix: string;
  fixSteps: string;
  patchContent: string;
  dockerfileChanges: string;
  prUrl: string;
  tagName: string;
  workflowRunUrl: string;
  status: RemediationStatus;
  stepLog: StepLogEntry[];
  error: string;
}

export interface SSEEvent {
  type: "step" | "state" | "done" | "error";
  data: StepLogEntry | Partial<RemediationState> | { message: string };
}
