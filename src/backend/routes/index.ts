import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { buildRemediationAgentMap } from "../agents/agentMap.js";
import type { Vulnerability, SSEEvent } from "../types/index.js";
import {
  parseXrayScanResult,
  parseDependabotScanResult,
  type XrayScanResult,
  type DependabotScanResult,
} from "../parsers/index.js";

const router = Router();

// In-memory store for demo purposes — replace with a real DB in production
const vulnerabilities = new Map<string, Vulnerability>();
const remediationResults = new Map<string, any>();

// -------------------------------------------------------------------------
// POST /api/vulnerabilities — Ingest a new vulnerability
// -------------------------------------------------------------------------
router.post("/api/vulnerabilities", (req: Request, res: Response) => {
  const vuln: Vulnerability = {
    ...req.body,
    id: req.body.id ?? uuidv4(),
    createdAt: req.body.createdAt ?? new Date().toISOString(),
  };

  vulnerabilities.set(vuln.id, vuln);
  res.status(201).json(vuln);
});

// -------------------------------------------------------------------------
// GET /api/vulnerabilities — List all vulnerabilities
// -------------------------------------------------------------------------
router.get("/api/vulnerabilities", (_req: Request, res: Response) => {
  res.json(Array.from(vulnerabilities.values()));
});

// -------------------------------------------------------------------------
// GET /api/vulnerabilities/:id — Get a single vulnerability
// -------------------------------------------------------------------------
router.get("/api/vulnerabilities/:id", (req: Request, res: Response) => {
  const vuln = vulnerabilities.get(req.params.id);
  if (!vuln) return res.status(404).json({ error: "Not found" });
  res.json(vuln);
});

// -------------------------------------------------------------------------
// POST /api/vulnerabilities/scan — Ingest scan results (normalized endpoint)
// Accepts scan results from Xray, Dependabot, or direct vulnerability format
// -------------------------------------------------------------------------
router.post("/api/vulnerabilities/scan", (req: Request, res: Response) => {
  try {
    const { source, data } = req.body;

    if (!source) {
      return res.status(400).json({ error: "Missing 'source' field. Must be one of: xray, dependabot, direct" });
    }

    if (!data) {
      return res.status(400).json({ error: "Missing 'data' field" });
    }

    let parsedVulnerabilities: Vulnerability[] = [];

    switch (source.toLowerCase()) {
      case "xray":
        parsedVulnerabilities = parseXrayScanResult(data as XrayScanResult);
        break;
      
      case "dependabot":
        parsedVulnerabilities = parseDependabotScanResult(data as DependabotScanResult);
        break;
      
      case "direct":
        // Direct format - data should be a single vulnerability or array of vulnerabilities
        const vulnArray = Array.isArray(data) ? data : [data];
        parsedVulnerabilities = vulnArray.map((vuln: any) => ({
          ...vuln,
          id: vuln.id ?? uuidv4(),
          createdAt: vuln.createdAt ?? new Date().toISOString(),
        }));
        break;
      
      default:
        return res.status(400).json({ 
          error: `Unsupported source: ${source}. Must be one of: xray, dependabot, direct` 
        });
    }

    // Store all parsed vulnerabilities
    const storedVulnerabilities: Vulnerability[] = [];
    for (const vuln of parsedVulnerabilities) {
      vulnerabilities.set(vuln.id, vuln);
      storedVulnerabilities.push(vuln);
    }

    res.status(201).json({
      message: `Successfully ingested ${storedVulnerabilities.length} ${storedVulnerabilities.length === 1 ? 'vulnerability' : 'vulnerabilities'}`,
      count: storedVulnerabilities.length,
      vulnerabilities: storedVulnerabilities,
    });
  } catch (err: any) {
    res.status(500).json({ 
      error: "Failed to parse scan results", 
      details: err.message 
    });
  }
});

// -------------------------------------------------------------------------
// POST /api/remediate/:id — Kick off remediation (SSE streaming)
// -------------------------------------------------------------------------
router.get("/api/remediate/:id/stream", async (req: Request, res: Response) => {
  const vuln = vulnerabilities.get(req.params.id);
  if (!vuln) {
    res.status(404).json({ error: "Vulnerability not found" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: SSEEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const graph = buildRemediationAgentMap();

    // Stream the graph execution
    const stream = await graph.stream(
      { vulnerability: vuln },
      { streamMode: "updates" }
    );

    for await (const update of stream) {
      // Each update is { nodeName: nodeOutput }
      for (const [nodeName, nodeOutput] of Object.entries(update)) {
        const output = nodeOutput as any;

        // Send step log entries as they happen
        if (output.stepLog) {
          for (const entry of output.stepLog) {
            sendEvent({ type: "step", data: entry });
          }
        }

        // Send state updates
        sendEvent({
          type: "state",
          data: {
            status: output.status,
            category: output.category,
            rebuildWouldFix: output.rebuildWouldFix,
            ragFixApplicable: output.ragFixApplicable,
            proposedFix: output.proposedFix,
            prUrl: output.prUrl,
            tagName: output.tagName,
            workflowRunUrl: output.workflowRunUrl,
            error: output.error,
          },
        });
      }
    }

    // Get final state
    const finalState = await graph.invoke({ vulnerability: vuln });
    remediationResults.set(vuln.id, finalState);

    sendEvent({ type: "done", data: { message: "Remediation complete" } });
  } catch (err: any) {
    sendEvent({
      type: "error",
      data: { message: err.message ?? "Unknown error" },
    });
  } finally {
    res.end();
  }
});

// -------------------------------------------------------------------------
// POST /api/remediate/:id — Non-streaming remediation
// -------------------------------------------------------------------------
router.post("/api/remediate/:id", async (req: Request, res: Response) => {
  const vuln = vulnerabilities.get(req.params.id);
  if (!vuln) {
    res.status(404).json({ error: "Vulnerability not found" });
    return;
  }

  try {
    const graph = buildRemediationAgentMap();
    const result = await graph.invoke({ vulnerability: vuln });
    remediationResults.set(vuln.id, result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------------
// GET /api/remediation/:id — Get remediation result
// -------------------------------------------------------------------------
router.get("/api/remediation/:id", (req: Request, res: Response) => {
  const result = remediationResults.get(req.params.id);
  if (!result) return res.status(404).json({ error: "No remediation found" });
  res.json(result);
});

export default router;
