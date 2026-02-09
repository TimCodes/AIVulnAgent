import { CheckCircle, XCircle, Loader2, SkipForward } from "lucide-react";
import type { StepLogEntry } from "../types";

const NODE_LABELS: Record<string, string> = {
  classifyVuln: "Classify Vulnerability",
  tryRebuild: "Check Image Rebuild",
  searchRAG: "Search Known Fixes",
  researchFix: "Research Fix",
  createPR: "Create Pull Request",
  createTagWorkflow: "Create Tag Workflow",
  storeInRAG: "Store Fix in RAG",
};

function StatusIcon({ status }: { status: StepLogEntry["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    case "running":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "skipped":
      return <SkipForward className="w-5 h-5 text-gray-400" />;
  }
}

interface ProgressTimelineProps {
  steps: StepLogEntry[];
}

export function ProgressTimeline({ steps }: ProgressTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Progress
      </h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-2.5 top-3 bottom-3 w-px bg-gray-200" />

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="relative flex items-start gap-3 pl-8">
              <div className="absolute left-0 top-0.5">
                <StatusIcon status={step.status} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {NODE_LABELS[step.node] ?? step.node}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{step.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(step.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
