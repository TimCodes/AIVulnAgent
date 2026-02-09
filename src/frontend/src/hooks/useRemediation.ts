import { useState, useCallback, useRef } from "react";
import { streamRemediation } from "../lib/api";
import type { StepLogEntry, RemediationState } from "../types";

interface UseRemediationReturn {
  steps: StepLogEntry[];
  state: Partial<RemediationState>;
  isRunning: boolean;
  isDone: boolean;
  error: string | null;
  startRemediation: (vulnId: string) => void;
  reset: () => void;
}

export function useRemediation(): UseRemediationReturn {
  const [steps, setSteps] = useState<StepLogEntry[]>([]);
  const [state, setState] = useState<Partial<RemediationState>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startRemediation = useCallback((vulnId: string) => {
    // Clean up any existing stream
    cleanupRef.current?.();

    setSteps([]);
    setState({});
    setIsRunning(true);
    setIsDone(false);
    setError(null);

    const cleanup = streamRemediation(vulnId, {
      onStep: (entry) => setSteps((prev) => [...prev, entry]),
      onState: (partial) => setState((prev) => ({ ...prev, ...partial })),
      onDone: () => {
        setIsRunning(false);
        setIsDone(true);
      },
      onError: (msg) => {
        setIsRunning(false);
        setError(msg);
      },
    });

    cleanupRef.current = cleanup;
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setSteps([]);
    setState({});
    setIsRunning(false);
    setIsDone(false);
    setError(null);
  }, []);

  return { steps, state, isRunning, isDone, error, startRemediation, reset };
}
