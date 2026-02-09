#!/usr/bin/env node

/**
 * Example usage of the normalized vulnerability scan endpoint
 * 
 * This script demonstrates how to send scan results from Xray and Dependabot
 * to the /api/vulnerabilities/scan endpoint.
 */

// Example 1: Xray scan result (from the problem statement)
const xrayScanExample = {
  source: "xray",
  data: {
    vulnerabilities: [
      {
        issue_id: "XRAY-123456",
        summary: "Remote Code Execution vulnerability in log4j-core",
        severity: "Critical",
        cves: [
          {
            cve: "CVE-2021-44228",
            cvss_v3_score: "10.0",
            cvss_v3_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H"
          }
        ],
        components: {
          "org.apache.logging.log4j:log4j-core:2.14.1": {
            package_type: "Maven",
            fixed_versions: ["2.17.1"],
            infected_versions: ["( , 2.17.1)"],
            impact_paths: [
              [
                {
                  component_id: "docker://my-app:latest",
                  full_path: "my-repo/my-app/latest"
                },
                {
                  component_id: "org.apache.logging.log4j:log4j-core:2.14.1",
                  full_path: "my-app.jar/WEB-INF/lib/log4j-core-2.14.1.jar"
                }
              ]
            ]
          }
        },
        provider: "JFrog",
        description: "Apache Log4j2 JNDI features do not protect against attacker controlled LDAP and other JNDI related endpoints."
      }
    ]
  }
};

// Example 2: Dependabot alert
const dependabotScanExample = {
  source: "dependabot",
  data: {
    alerts: [
      {
        number: 1,
        state: "open",
        dependency: {
          package: {
            ecosystem: "npm",
            name: "express"
          },
          manifest_path: "package.json"
        },
        security_advisory: {
          ghsa_id: "GHSA-xxxx-yyyy-zzzz",
          cve_id: "CVE-2024-29041",
          summary: "Open redirect vulnerability in Express",
          description: "Express is vulnerable to open redirect attacks",
          severity: "high"
        },
        security_vulnerability: {
          package: {
            ecosystem: "npm",
            name: "express"
          },
          severity: "high",
          vulnerable_version_range: "< 4.19.2",
          first_patched_version: {
            identifier: "4.19.2"
          }
        },
        created_at: "2024-01-15T10:00:00Z"
      }
    ]
  }
};

// Example 3: Direct format (backward compatible)
const directFormatExample = {
  source: "direct",
  data: {
    cveId: "CVE-2024-12345",
    packageName: "lodash",
    currentVersion: "4.17.20",
    fixedVersion: "4.17.21",
    severity: "high",
    description: "Prototype pollution vulnerability",
    source: "snyk",
    filePath: "package.json"
  }
};

console.log("=== Xray Scan Example ===");
console.log("POST /api/vulnerabilities/scan");
console.log(JSON.stringify(xrayScanExample, null, 2));
console.log("\n");

console.log("=== Dependabot Scan Example ===");
console.log("POST /api/vulnerabilities/scan");
console.log(JSON.stringify(dependabotScanExample, null, 2));
console.log("\n");

console.log("=== Direct Format Example (backward compatible) ===");
console.log("POST /api/vulnerabilities/scan");
console.log(JSON.stringify(directFormatExample, null, 2));
console.log("\n");

console.log("=== cURL Examples ===\n");

console.log("# Xray scan result:");
console.log(`curl -X POST http://localhost:3001/api/vulnerabilities/scan \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(xrayScanExample)}'
`);

console.log("\n# Dependabot scan result:");
console.log(`curl -X POST http://localhost:3001/api/vulnerabilities/scan \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(dependabotScanExample)}'
`);

console.log("\n# Direct format:");
console.log(`curl -X POST http://localhost:3001/api/vulnerabilities/scan \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(directFormatExample)}'
`);
