import { Annotation } from "@langchain/langgraph";
import type {
  VulnCategory,
  RemediationStatus,
  Vulnerability,
  StoredFix,
  StepLogEntry,
} from "../types/index.js";

/**
 * LangGraph state annotation for the vulnerability remediation agent.
 *
 * Each field uses a reducer — `stepLog` appends entries while all others
 * overwrite with the latest value.
 */
export const RemediationStateAnnotation = Annotation.Root({
  // --- Input ---
  vulnerability: Annotation<Vulnerability>({
    reducer: (_, next) => next,
    default: () => ({
      id: "",
      cveId: "",
      packageName: "",
      currentVersion: "",
      severity: "medium" as const,
      description: "",
      source: "",
      createdAt: new Date().toISOString(),
    }),
  }),

  // --- Classification ---
  category: Annotation<VulnCategory | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  classificationReason: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // --- Container Path ---
  rebuildWouldFix: Annotation<boolean | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  rebuildCheckReason: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // --- RAG Search ---
  ragResults: Annotation<StoredFix[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  ragFixApplicable: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // --- Fix Research ---
  proposedFix: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  fixSteps: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  patchContent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  dockerfileChanges: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // --- Outputs ---
  prUrl: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  tagName: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  workflowRunUrl: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // --- Rebuild Verification ---
  rebuildVerified: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  rebuildSuccessful: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  rebuildScanResult: Annotation<import("../types/index.js").RebuildScanResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // --- Tracking ---
  status: Annotation<RemediationStatus>({
    reducer: (_, next) => next,
    default: () => "pending" as RemediationStatus,
  }),
  stepLog: Annotation<StepLogEntry[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  error: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
});

export type RemediationStateType = typeof RemediationStateAnnotation.State;
