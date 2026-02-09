import type { RebuildScanResult } from "../types/index.js";

interface PendingRebuild {
  vulnId: string;
  cveId: string;
  repoOwner: string;
  repoName: string;
  tagName: string;
  createdAt: string;
  resolve: (result: RebuildScanResult) => void;
  reject: (error: Error) => void;
  promise: Promise<RebuildScanResult>;
  timeoutId: NodeJS.Timeout;
}

const pending = new Map<string, PendingRebuild>();

const REBUILD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Registers a pending rebuild. Returns a promise that resolves when
 * the webhook callback arrives, or rejects on timeout.
 */
export function registerPendingRebuild(params: {
  vulnId: string;
  cveId: string;
  repoOwner: string;
  repoName: string;
  tagName: string;
}): Promise<RebuildScanResult> {
  // Clean up any existing entry for this vulnId
  if (pending.has(params.vulnId)) {
    const existing = pending.get(params.vulnId)!;
    clearTimeout(existing.timeoutId);
    existing.reject(new Error("Superseded by new rebuild"));
    pending.delete(params.vulnId);
  }

  let resolve!: (result: RebuildScanResult) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<RebuildScanResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const timeoutId = setTimeout(() => {
    if (pending.has(params.vulnId)) {
      pending.delete(params.vulnId);
      reject(new Error(`Rebuild timed out after ${REBUILD_TIMEOUT_MS / 1000}s for ${params.cveId}`));
    }
  }, REBUILD_TIMEOUT_MS);

  pending.set(params.vulnId, {
    ...params,
    createdAt: new Date().toISOString(),
    resolve,
    reject,
    promise,
    timeoutId,
  });

  return promise;
}

/**
 * Called by the webhook handler when a rebuild workflow completes.
 * Resolves the pending promise so the agent graph can continue.
 */
export function resolvePendingRebuild(vulnId: string, result: RebuildScanResult): boolean {
  const entry = pending.get(vulnId);
  if (!entry) return false;

  clearTimeout(entry.timeoutId);
  entry.resolve(result);
  pending.delete(vulnId);
  return true;
}

/**
 * Returns info about all pending rebuilds (for diagnostics / UI).
 */
export function listPendingRebuilds() {
  return Array.from(pending.values()).map(({ vulnId, cveId, repoOwner, repoName, tagName, createdAt }) => ({
    vulnId, cveId, repoOwner, repoName, tagName, createdAt,
  }));
}
