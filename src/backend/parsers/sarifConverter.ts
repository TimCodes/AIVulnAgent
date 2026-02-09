import type { Vulnerability, Severity } from "../types/index.js";
import type { SarifLog, SarifRun, SarifResult, SarifRule } from "./sarifTypes.js";

/**
 * Maps our severity levels to SARIF level
 */
function severityToSarifLevel(severity: Severity): "error" | "warning" | "note" {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
    default:
      return "note";
  }
}

/**
 * Converts a single Vulnerability to a SARIF result
 */
function vulnerabilityToSarifResult(vuln: Vulnerability): SarifResult {
  const result: SarifResult = {
    ruleId: vuln.cveId,
    level: severityToSarifLevel(vuln.severity),
    message: {
      text: vuln.description,
    },
    properties: {
      severity: vuln.severity,
      packageName: vuln.packageName,
      currentVersion: vuln.currentVersion,
      source: vuln.source,
      createdAt: vuln.createdAt,
    },
  };

  // Add fixed version if available
  if (vuln.fixedVersion) {
    result.properties!.fixedVersion = vuln.fixedVersion;
  }

  // Add location information
  if (vuln.filePath) {
    result.locations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: vuln.filePath,
          },
        },
      },
    ];
    result.properties!.type = "code";
  } else if (vuln.imageName) {
    result.properties!.type = "container";
    result.properties!.imageName = vuln.imageName;
  }

  return result;
}

/**
 * Creates a SARIF rule from a vulnerability
 */
function vulnerabilityToSarifRule(vuln: Vulnerability): SarifRule {
  return {
    id: vuln.cveId,
    name: vuln.packageName,
    shortDescription: {
      text: `${vuln.severity.toUpperCase()}: ${vuln.packageName}`,
    },
    fullDescription: {
      text: vuln.description,
    },
    properties: {
      severity: vuln.severity,
      tags: [vuln.severity, vuln.source],
    },
  };
}

/**
 * Converts an array of Vulnerabilities to SARIF format
 */
export function vulnerabilitiesToSarif(
  vulnerabilities: Vulnerability[],
  toolName: string = "AIVulnAgent"
): SarifLog {
  // Group vulnerabilities by source to create separate runs if needed
  const groupedBySource = vulnerabilities.reduce((acc, vuln) => {
    const source = vuln.source || "unknown";
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(vuln);
    return acc;
  }, {} as Record<string, Vulnerability[]>);

  const runs: SarifRun[] = [];

  for (const [source, vulns] of Object.entries(groupedBySource)) {
    // Create unique rules from vulnerabilities
    const rulesMap = new Map<string, SarifRule>();
    const results: SarifResult[] = [];

    for (const vuln of vulns) {
      // Add rule if not already present
      if (!rulesMap.has(vuln.cveId)) {
        rulesMap.set(vuln.cveId, vulnerabilityToSarifRule(vuln));
      }
      
      // Add result
      results.push(vulnerabilityToSarifResult(vuln));
    }

    runs.push({
      tool: {
        driver: {
          name: toolName,
          version: "1.0.0",
          informationUri: "https://github.com/TimCodes/AIVulnAgent",
          rules: Array.from(rulesMap.values()),
        },
      },
      results,
      properties: {
        source,
        scanTime: new Date().toISOString(),
      },
    });
  }

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs,
  };
}
