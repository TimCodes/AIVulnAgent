import { v4 as uuidv4 } from "uuid";
import type { Vulnerability, Severity } from "../types/index.js";
import type { XrayVulnerability, XrayScanResult } from "./types.js";

/**
 * Maps Xray severity levels to our normalized severity levels
 */
function normalizeXraySeverity(severity: string): Severity {
  const lower = severity.toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "medium") return "medium";
  return "low";
}

/**
 * Parses a single Xray vulnerability into our normalized Vulnerability format
 */
function parseXrayVulnerability(xrayVuln: XrayVulnerability): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  // Extract CVE ID (use first CVE if available, otherwise use issue_id)
  const cveId = xrayVuln.cves?.[0]?.cve || xrayVuln.issue_id;
  
  // Extract description (prefer description over summary)
  const description = xrayVuln.description || xrayVuln.summary;
  
  // Process each affected component
  if (xrayVuln.components) {
    for (const [componentId, component] of Object.entries(xrayVuln.components)) {
      // Parse component name and version from component ID
      // Format: "org.apache.logging.log4j:log4j-core:2.14.1"
      const parts = componentId.split(":");
      const packageName = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : componentId;
      const currentVersion = parts.length >= 3 ? parts[2] : "unknown";
      
      // Get fixed version (use first fixed version if available)
      const fixedVersion = component.fixed_versions?.[0];
      
      // Determine if this is a container or code vulnerability based on impact paths
      let isContainer = false;
      let imageName: string | undefined;
      let filePath: string | undefined;
      
      if (component.impact_paths && component.impact_paths.length > 0) {
        const firstPath = component.impact_paths[0];
        if (firstPath.length > 0) {
          const rootComponent = firstPath[0];
          // Check if root component is a Docker image
          if (rootComponent.component_id.startsWith("docker://")) {
            isContainer = true;
            imageName = rootComponent.component_id.replace("docker://", "");
          } else {
            // For code vulnerabilities, use the full path as file path
            filePath = firstPath[firstPath.length - 1]?.full_path;
          }
        }
      }
      
      vulnerabilities.push({
        id: uuidv4(),
        cveId,
        packageName,
        currentVersion,
        fixedVersion,
        severity: normalizeXraySeverity(xrayVuln.severity),
        description,
        source: "xray",
        imageName: isContainer ? imageName : undefined,
        filePath: !isContainer ? filePath : undefined,
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    // If no components specified, create a generic vulnerability entry
    vulnerabilities.push({
      id: uuidv4(),
      cveId,
      packageName: "unknown",
      currentVersion: "unknown",
      fixedVersion: undefined,
      severity: normalizeXraySeverity(xrayVuln.severity),
      description,
      source: "xray",
      createdAt: new Date().toISOString(),
    });
  }
  
  return vulnerabilities;
}

/**
 * Parses Xray scan results into normalized Vulnerability objects
 */
export function parseXrayScanResult(scanResult: XrayScanResult): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  for (const xrayVuln of scanResult.vulnerabilities) {
    vulnerabilities.push(...parseXrayVulnerability(xrayVuln));
  }
  
  return vulnerabilities;
}
