/**
 * Type definitions for various vulnerability scan result formats
 */

/** JFrog Xray vulnerability scan result format */
export interface XrayVulnerability {
  issue_id: string;
  summary: string;
  severity: string;
  cves?: Array<{
    cve: string;
    cvss_v3_score?: string;
    cvss_v3_vector?: string;
  }>;
  components?: {
    [componentId: string]: {
      package_type?: string;
      fixed_versions?: string[];
      infected_versions?: string[];
      impact_paths?: Array<Array<{
        component_id: string;
        full_path: string;
      }>>;
    };
  };
  provider?: string;
  description?: string;
}

export interface XrayScanResult {
  vulnerabilities: XrayVulnerability[];
}

/** GitHub Dependabot alert format */
export interface DependabotVulnerability {
  number?: number;
  state?: string;
  dependency?: {
    package?: {
      ecosystem?: string;
      name?: string;
    };
    manifest_path?: string;
  };
  security_advisory?: {
    ghsa_id?: string;
    cve_id?: string;
    summary?: string;
    description?: string;
    severity?: string;
    identifiers?: Array<{
      type: string;
      value: string;
    }>;
    cvss?: {
      score?: number;
      vector_string?: string;
    };
  };
  security_vulnerability?: {
    package?: {
      ecosystem?: string;
      name?: string;
    };
    severity?: string;
    vulnerable_version_range?: string;
    first_patched_version?: {
      identifier?: string;
    };
  };
  url?: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  dismissed_at?: string;
  dismissed_by?: any;
  dismissed_reason?: string;
  dismissed_comment?: string;
  fixed_at?: string;
}

export interface DependabotScanResult {
  alerts?: DependabotVulnerability[];
}
