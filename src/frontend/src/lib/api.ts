import type { Vulnerability, SSEEvent, StepLogEntry, RemediationState } from "../types";

const BASE = "/api";

export async function fetchVulnerabilities(): Promise<Vulnerability[]> {
  const res = await fetch(`${BASE}/vulnerabilities`);
  if (!res.ok) throw new Error("Failed to fetch vulnerabilities");
  return res.json();
}

export async function createVulnerability(
  vuln: Omit<Vulnerability, "id" | "createdAt">
): Promise<Vulnerability> {
  const res = await fetch(`${BASE}/vulnerabilities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vuln),
  });
  if (!res.ok) throw new Error("Failed to create vulnerability");
  return res.json();
}

/**
 * Connects to the SSE stream for a remediation run and calls back on events.
 */
export function streamRemediation(
  vulnId: string,
  callbacks: {
    onStep: (entry: StepLogEntry) => void;
    onState: (state: Partial<RemediationState>) => void;
    onDone: () => void;
    onError: (message: string) => void;
  }
): () => void {
  const eventSource = new EventSource(`${BASE}/remediate/${vulnId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const parsed: SSEEvent = JSON.parse(event.data);
      switch (parsed.type) {
        case "step":
          callbacks.onStep(parsed.data as StepLogEntry);
          break;
        case "state":
          callbacks.onState(parsed.data as Partial<RemediationState>);
          break;
        case "done":
          callbacks.onDone();
          eventSource.close();
          break;
        case "error":
          callbacks.onError((parsed.data as { message: string }).message);
          eventSource.close();
          break;
      }
    } catch {
      // Ignore malformed events
    }
  };

  eventSource.onerror = () => {
    callbacks.onError("Connection lost");
    eventSource.close();
  };

  // Return a cleanup function
  return () => eventSource.close();
}
