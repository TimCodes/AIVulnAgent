import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, X } from "lucide-react";
import { VulnList } from "./components/VulnList";
import { RemediationView } from "./components/RemediationView";
import { useRemediation } from "./hooks/useRemediation";
import { fetchVulnerabilities, createVulnerability } from "./lib/api";
import type { Vulnerability, Severity } from "./types";

const SAMPLE_VULNS: Array<Omit<Vulnerability, "id" | "createdAt">> = [
  {
    cveId: "CVE-2024-21626",
    packageName: "runc",
    currentVersion: "1.1.10",
    fixedVersion: "1.1.12",
    severity: "critical",
    description:
      "runc container breakout through leaked file descriptor, allowing host filesystem access.",
    source: "trivy",
    imageName: "myapp:latest",
  },
  {
    cveId: "CVE-2024-29041",
    packageName: "express",
    currentVersion: "4.18.2",
    fixedVersion: "4.19.2",
    severity: "high",
    description:
      "Open redirect vulnerability in express when using untrusted user input in res.redirect().",
    source: "snyk",
    filePath: "package.json",
  },
];

function App() {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const [showForm, setShowForm] = useState(false);
  const remediation = useRemediation();

  useEffect(() => {
    fetchVulnerabilities().then(setVulns).catch(() => {});
  }, []);

  const handleSelect = useCallback(
    (vuln: Vulnerability) => {
      setSelected(vuln);
      remediation.reset();
    },
    [remediation]
  );

  const handleStartRemediation = useCallback(() => {
    if (selected) remediation.startRemediation(selected.id);
  }, [selected, remediation]);

  const handleAddSample = useCallback(
    async (sample: (typeof SAMPLE_VULNS)[number]) => {
      try {
        const created = await createVulnerability(sample);
        setVulns((prev) => [...prev, created]);
      } catch { /* demo */ }
    },
    []
  );

  const handleAddCustom = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const vuln = {
      cveId: d.get("cveId") as string,
      packageName: d.get("packageName") as string,
      currentVersion: d.get("currentVersion") as string,
      fixedVersion: (d.get("fixedVersion") as string) || undefined,
      severity: d.get("severity") as Severity,
      description: d.get("description") as string,
      source: d.get("source") as string,
      imageName: (d.get("imageName") as string) || undefined,
      filePath: (d.get("filePath") as string) || undefined,
    };
    try {
      const created = await createVulnerability(vuln);
      setVulns((prev) => [...prev, created]);
      setShowForm(false);
    } catch { /* fail */ }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Shield className="w-7 h-7 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">
            Vulnerability Remediation Agent
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left panel — vulnerability list */}
          <div className="col-span-5 space-y-4">
            {/* Actions bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300
                           rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? "Cancel" : "Add Vulnerability"}
              </button>
              {SAMPLE_VULNS.map((s) => (
                <button
                  key={s.cveId}
                  onClick={() => handleAddSample(s)}
                  className="px-2 py-1.5 text-xs bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  + {s.cveId.split("-").slice(-1)[0]}
                </button>
              ))}
            </div>

            {/* Add form */}
            {showForm && (
              <form
                onSubmit={handleAddCustom}
                className="bg-white p-4 rounded-lg border border-gray-200 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <input name="cveId" placeholder="CVE-2024-XXXXX" required
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <input name="packageName" placeholder="Package name" required
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <input name="currentVersion" placeholder="Current version" required
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <input name="fixedVersion" placeholder="Fixed version (optional)"
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <select name="severity" required
                    className="px-3 py-2 border rounded-lg text-sm">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium" selected>Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <input name="source" placeholder="Scanner (trivy, snyk...)" required
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <input name="imageName" placeholder="Image name (optional)"
                    className="px-3 py-2 border rounded-lg text-sm" />
                  <input name="filePath" placeholder="File path (optional)"
                    className="px-3 py-2 border rounded-lg text-sm" />
                </div>
                <textarea name="description" placeholder="Description" required rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
                <button type="submit"
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                             hover:bg-indigo-700 transition-colors">
                  Add Vulnerability
                </button>
              </form>
            )}

            {/* List */}
            <VulnList
              vulnerabilities={vulns}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          </div>

          {/* Right panel — remediation */}
          <div className="col-span-7">
            <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-[400px]">
              {selected ? (
                <RemediationView
                  vulnerability={selected}
                  steps={remediation.steps}
                  state={remediation.state}
                  isRunning={remediation.isRunning}
                  isDone={remediation.isDone}
                  error={remediation.error}
                  onStart={handleStartRemediation}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                  <Shield className="w-16 h-16 mb-4 text-gray-200" />
                  <p className="text-lg">Select a vulnerability to begin remediation</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
