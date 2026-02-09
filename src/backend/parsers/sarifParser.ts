import { v4 as uuidv4 } from "uuid";
import type { Vulnerability, Severity } from "../types/index.js";
import type { SarifLog, SarifResult } from "./sarifTypes.js";

/**
 * Maps SARIF level to our normalized severity levels
 */
function normalizeSarifLevel(level?: string, properties?: Record<string, any>): Severity {
  // First check if severity is in properties
  if (properties?.severity) {
    const severity = properties.severity.toLowerCase();
    if (severity === "critical") return "critical";
    if (severity === "high") return "high";
    if (severity === "medium" || severity === "moderate") return "medium";
    if (severity === "low") return "low";
  }

  // Fall back to SARIF level mapping
  if (!level) return "medium";
  const lower = level.toLowerCase();
  if (lower === "error") return "high";
  if (lower === "warning") return "medium";
  if (lower === "note") return "low";
  return "low";
}

/**
 * Extracts CVE ID from SARIF result
 */
function extractCveId(result: SarifResult): string {
  // Check ruleId for CVE pattern
  if (result.ruleId && /CVE-\d{4}-\d+/.test(result.ruleId)) {
    const match = result.ruleId.match(/CVE-\d{4}-\d+/);
    if (match) return match[0];
  }

  // Check properties for CVE
  if (result.properties?.cve) {
    if (typeof result.properties.cve === 'string') {
      return result.properties.cve;
    }
    if (Array.isArray(result.properties.cve) && result.properties.cve.length > 0) {
      return result.properties.cve[0];
    }
  }

  // Check properties for CVEs array
  if (result.properties?.cves && Array.isArray(result.properties.cves) && result.properties.cves.length > 0) {
    return result.properties.cves[0];
  }

  // Use ruleId as fallback
  return result.ruleId || `SARIF-${uuidv4().substring(0, 8)}`;
}

/**
 * Extracts package name from SARIF result
 */
function extractPackageName(result: SarifResult): string {
  if (result.properties?.packageName) {
    return result.properties.packageName;
  }
  if (result.properties?.package) {
    return result.properties.package;
  }
  if (result.properties?.component) {
    return result.properties.component;
  }
  
  // Try to extract from locations
  if (result.locations && result.locations.length > 0) {
    const location = result.locations[0];
    const uri = location.physicalLocation?.artifactLocation?.uri;
    if (uri) {
      // Extract filename or last part of path
      const parts = uri.split('/');
      return parts[parts.length - 1] || uri;
    }
  }
  
  return "unknown";
}

/**
 * Extracts file path from SARIF result locations
 */
function extractFilePath(result: SarifResult): string | undefined {
  if (result.locations && result.locations.length > 0) {
    const location = result.locations[0];
    return location.physicalLocation?.artifactLocation?.uri;
  }
  return undefined;
}

/**
 * Parses a single SARIF result into our normalized Vulnerability format
 */
function parseSarifResult(result: SarifResult, toolName: string): Vulnerability {
  const cveId = extractCveId(result);
  const packageName = extractPackageName(result);
  const filePath = extractFilePath(result);
  
  // Extract version information from properties
  const currentVersion = result.properties?.currentVersion || 
                        result.properties?.version || 
                        result.properties?.installedVersion ||
                        "unknown";
  
  const fixedVersion = result.properties?.fixedVersion || 
                      result.properties?.patchedVersion ||
                      result.properties?.recommendedVersion;
  
  // Extract description
  const description = result.message?.text || 
                     result.message?.markdown ||
                     result.properties?.description ||
                     "No description available";
  
  // Determine if this is a container vulnerability
  const isContainer = result.properties?.type === "container" ||
                     result.properties?.ecosystem === "docker" ||
                     result.properties?.ecosystem === "container" ||
                     packageName.includes("docker://") ||
                     (filePath && filePath.toLowerCase().includes("dockerfile"));
  
  const imageName = isContainer ? 
    (result.properties?.imageName || packageName.replace("docker://", "")) : 
    undefined;
  
  return {
    id: uuidv4(),
    cveId,
    packageName: packageName.replace("docker://", ""),
    currentVersion,
    fixedVersion,
    severity: normalizeSarifLevel(result.level, result.properties),
    description,
    source: `sarif:${toolName}`,
    imageName: isContainer ? imageName : undefined,
    filePath: !isContainer ? filePath : undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Parses SARIF scan results into normalized Vulnerability objects
 */
export function parseSarifScanResult(sarifLog: SarifLog): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  for (const run of sarifLog.runs) {
    const toolName = run.tool.driver.name || "unknown";
    
    if (run.results) {
      for (const result of run.results) {
        // Only process results that are actual vulnerabilities (error/warning level)
        if (result.level === "none") continue;
        
        try {
          vulnerabilities.push(parseSarifResult(result, toolName));
        } catch (err) {
          console.warn(`[SARIF Parser] Failed to parse result:`, err);
          // Continue processing other results
        }
      }
    }
  }
  
  return vulnerabilities;
}
