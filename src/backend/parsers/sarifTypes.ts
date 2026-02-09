/**
 * SARIF (Static Analysis Results Interchange Format) v2.1.0 type definitions
 * Based on: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

export interface SarifLog {
  $schema?: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: SarifTool;
  results?: SarifResult[];
  artifacts?: SarifArtifact[];
  invocations?: SarifInvocation[];
  properties?: Record<string, any>;
}

export interface SarifTool {
  driver: SarifToolComponent;
}

export interface SarifToolComponent {
  name: string;
  version?: string;
  informationUri?: string;
  rules?: SarifRule[];
}

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: SarifMessage;
  fullDescription?: SarifMessage;
  help?: SarifMessage;
  properties?: Record<string, any>;
}

export interface SarifResult {
  ruleId?: string;
  ruleIndex?: number;
  level?: "none" | "note" | "warning" | "error";
  message: SarifMessage;
  locations?: SarifLocation[];
  fixes?: SarifFix[];
  properties?: Record<string, any>;
}

export interface SarifMessage {
  text?: string;
  markdown?: string;
}

export interface SarifLocation {
  physicalLocation?: SarifPhysicalLocation;
  logicalLocations?: SarifLogicalLocation[];
}

export interface SarifPhysicalLocation {
  artifactLocation?: SarifArtifactLocation;
  region?: SarifRegion;
}

export interface SarifArtifactLocation {
  uri?: string;
  uriBaseId?: string;
}

export interface SarifRegion {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: SarifArtifactContent;
}

export interface SarifArtifactContent {
  text?: string;
}

export interface SarifLogicalLocation {
  name?: string;
  kind?: string;
  fullyQualifiedName?: string;
}

export interface SarifArtifact {
  location?: SarifArtifactLocation;
  length?: number;
  properties?: Record<string, any>;
}

export interface SarifInvocation {
  executionSuccessful?: boolean;
  startTimeUtc?: string;
  endTimeUtc?: string;
  properties?: Record<string, any>;
}

export interface SarifFix {
  description?: SarifMessage;
  artifactChanges?: SarifArtifactChange[];
}

export interface SarifArtifactChange {
  artifactLocation: SarifArtifactLocation;
  replacements: SarifReplacement[];
}

export interface SarifReplacement {
  deletedRegion: SarifRegion;
  insertedContent?: SarifArtifactContent;
}
