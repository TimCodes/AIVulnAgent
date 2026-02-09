import { v4 as uuidv4 } from "uuid";
import type { Vulnerability, Severity } from "../types/index.js";
import type { DependabotVulnerability, DependabotScanResult } from "./types.js";

/**
 * Maps Dependabot severity levels to our normalized severity levels
 */
function normalizeDependabotSeverity(severity?: string): Severity {
  if (!severity) return "low";
  const lower = severity.toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "medium" || lower === "moderate") return "medium";
  return "low";
}

/**
 * Parses a single Dependabot vulnerability into our normalized Vulnerability format
 */
function parseDependabotVulnerability(depVuln: DependabotVulnerability): Vulnerability {
  // Extract package information
  const packageName =
    depVuln.security_vulnerability?.package?.name ||
    depVuln.dependency?.package?.name ||
    "unknown";
  
  // Extract CVE ID
  const cveId =
    depVuln.security_advisory?.cve_id ||
    depVuln.security_advisory?.ghsa_id ||
    `DEPENDABOT-${depVuln.number || uuidv4()}`;
  
  // Extract severity
  const severity = normalizeDependabotSeverity(
    depVuln.security_vulnerability?.severity ||
    depVuln.security_advisory?.severity
  );
  
  // Extract description
  const description =
    depVuln.security_advisory?.description ||
    depVuln.security_advisory?.summary ||
    "No description available";
  
  // Extract version information
  const vulnerableRange = depVuln.security_vulnerability?.vulnerable_version_range;
  const currentVersion = vulnerableRange || "unknown";
  const fixedVersion = depVuln.security_vulnerability?.first_patched_version?.identifier;
  
  // Extract file path (manifest path)
  const filePath = depVuln.dependency?.manifest_path;
  
  // Determine if this is a container vulnerability based on ecosystem
  const ecosystem = depVuln.dependency?.package?.ecosystem?.toLowerCase() || "";
  const isContainer = ecosystem === "docker" || ecosystem === "container";
  
  return {
    id: uuidv4(),
    cveId,
    packageName,
    currentVersion,
    fixedVersion,
    severity,
    description,
    source: "dependabot",
    imageName: isContainer ? packageName : undefined,
    filePath: !isContainer ? filePath : undefined,
    createdAt: depVuln.created_at || new Date().toISOString(),
  };
}

/**
 * Parses Dependabot scan results into normalized Vulnerability objects
 */
export function parseDependabotScanResult(scanResult: DependabotScanResult): Vulnerability[] {
  if (!scanResult.alerts || scanResult.alerts.length === 0) {
    return [];
  }
  
  return scanResult.alerts
    .filter(alert => alert.state !== "dismissed" && alert.state !== "fixed")
    .map(parseDependabotVulnerability);
}
