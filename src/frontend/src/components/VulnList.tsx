import { Shield, AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { Vulnerability, Severity } from "../types";

const SEVERITY_CONFIG: Record<
  Severity,
  { color: string; bg: string; icon: typeof Shield }
> = {
  critical: { color: "text-red-700", bg: "bg-red-50 border-red-200", icon: Shield },
  high: { color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
  medium: { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: AlertCircle },
  low: { color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Info },
};

interface VulnListProps {
  vulnerabilities: Vulnerability[];
  selectedId: string | null;
  onSelect: (vuln: Vulnerability) => void;
}

export function VulnList({ vulnerabilities, selectedId, onSelect }: VulnListProps) {
  if (vulnerabilities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No vulnerabilities ingested yet.</p>
        <p className="text-sm mt-1">Use the form above to add one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {vulnerabilities.map((vuln) => {
        const config = SEVERITY_CONFIG[vuln.severity];
        const Icon = config.icon;
        const isSelected = vuln.id === selectedId;

        return (
          <button
            key={vuln.id}
            onClick={() => onSelect(vuln)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              isSelected
                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                : `${config.bg} hover:shadow-sm`
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="font-mono text-sm font-semibold">{vuln.cveId}</span>
              </div>
              <span
                className={`text-xs font-medium uppercase px-2 py-0.5 rounded ${config.color} ${config.bg}`}
              >
                {vuln.severity}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-1">
              {vuln.packageName} {vuln.currentVersion}
              {vuln.fixedVersion ? ` → ${vuln.fixedVersion}` : ""}
            </p>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {vuln.description}
            </p>
            <div className="flex gap-3 mt-2 text-xs text-gray-400">
              {vuln.imageName && <span>Image: {vuln.imageName}</span>}
              {vuln.filePath && <span>File: {vuln.filePath}</span>}
              <span>Source: {vuln.source}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
