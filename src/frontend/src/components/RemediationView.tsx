import { Play, ExternalLink, GitPullRequest, Tag, Database, Box, Code } from "lucide-react";
import type { Vulnerability, RemediationState, StepLogEntry } from "../types";
import { ProgressTimeline } from "./ProgressTimeline";

interface RemediationViewProps {
  vulnerability: Vulnerability;
  steps: StepLogEntry[];
  state: Partial<RemediationState>;
  isRunning: boolean;
  isDone: boolean;
  error: string | null;
  onStart: () => void;
}

export function RemediationView({
  vulnerability,
  steps,
  state,
  isRunning,
  isDone,
  error,
  onStart,
}: RemediationViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{vulnerability.cveId}</h2>
          <p className="text-sm text-gray-500">
            {vulnerability.packageName} {vulnerability.currentVersion}
          </p>
        </div>
        <button
          onClick={onStart}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg
                     hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors text-sm font-medium"
        >
          <Play className="w-4 h-4" />
          {isRunning ? "Running…" : "Start Remediation"}
        </button>
      </div>

      {/* Classification badge */}
      {state.category && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
          {state.category === "container" ? (
            <Box className="w-5 h-5 text-cyan-600" />
          ) : (
            <Code className="w-5 h-5 text-purple-600" />
          )}
          <span className="text-sm font-medium">
            Classified as{" "}
            <span className="font-semibold uppercase">{state.category}</span> issue
          </span>
          {state.rebuildWouldFix === true && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              Rebuild fixes this
            </span>
          )}
        </div>
      )}

      {/* Progress timeline */}
      <ProgressTimeline steps={steps} />

      {/* Outcomes */}
      {(state.prUrl || state.tagName || state.proposedFix) && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Outcomes
          </h3>

          {state.proposedFix && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Fix Description</p>
              <p className="text-sm text-gray-600">{state.proposedFix}</p>
            </div>
          )}

          {state.prUrl && (
            <a
              href={state.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-green-50 border border-green-200
                         rounded-lg hover:bg-green-100 transition-colors"
            >
              <GitPullRequest className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Pull Request Created
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-green-500 ml-auto" />
            </a>
          )}

          {state.tagName && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Tag Created: {state.tagName}
                </span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Awaiting user approval in GitHub Actions to trigger rebuild.
              </p>
              {state.workflowRunUrl && (
                <a
                  href={state.workflowRunUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-700 underline mt-1"
                >
                  View Workflow <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {isDone && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-700">
                Fix stored in RAG database for future reuse.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">Error</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
