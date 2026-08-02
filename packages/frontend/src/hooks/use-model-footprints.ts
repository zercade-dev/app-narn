/**
 * Hook that measures and persists the runtime VRAM footprint of local (Ollama)
 * models for one module.
 *
 * Footprint is environment-specific and expensive to obtain (each probe loads
 * the model into VRAM, reads `/api/ps`, then unloads it), so it is NOT part of
 * model discovery: it is null until the user explicitly runs an inspection.
 * `inspect()` walks the local models one at a time — sequential by design so
 * only one model is ever resident — and persists each result to localStorage
 * (`footprints:<moduleId>`) as it lands, so a partial or cancelled sweep keeps
 * what it measured. Each model is probed at its configured context length.
 */
import { useCallback, useRef, useState } from 'react';
import type { ModelInfo, OllamaFootprint } from '@zercade-dev/narn-shared';
import { apiRequest } from './use-api';
import { readJson, writeJson } from '../lib/local-storage.js';
import { errorMessage } from '../lib/utils.js';

export interface FootprintEntry {
  /** Total memory the loaded model occupies (RAM + VRAM), in bytes. */
  sizeBytes?: number;
  /** Portion resident in VRAM, in bytes. */
  sizeVramBytes?: number;
  /** Context length the model was loaded with for the measurement. */
  contextLength?: number;
  /** Set when the probe failed (e.g. the model could not load at that context). */
  error?: string;
  /** ISO timestamp of the measurement. */
  at: string;
}

export type FootprintMap = Record<string, FootprintEntry>;

export interface UseModelFootprintsResult {
  footprints: FootprintMap;
  /** Id of the model currently being probed, or null when idle. */
  inspecting: string | null;
  /** Sweep progress while inspecting, else null. */
  progress: { done: number; total: number } | null;
  /** Probe the given models' footprints sequentially (local models only). */
  inspect: (models: readonly ModelInfo[]) => void;
  /** Stop the in-progress sweep after the current model. */
  cancel: () => void;
}

/** A model load can take a while on a cold cache — allow generous time per probe. */
const PROBE_TIMEOUT_MS = 120_000;

function cacheKey(moduleId: string): string {
  return `footprints:${moduleId}`;
}

function loadCache(moduleId: string): FootprintMap {
  const parsed = readJson<unknown>(cacheKey(moduleId), {});
  return parsed && typeof parsed === 'object' ? (parsed as FootprintMap) : {};
}

export function useModelFootprints(moduleId: string): UseModelFootprintsResult {
  const [footprints, setFootprints] = useState<FootprintMap>(() => loadCache(moduleId));
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const persist = useCallback(
    (map: FootprintMap) => {
      writeJson(cacheKey(moduleId), map);
    },
    [moduleId],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const inspect = useCallback(
    (models: readonly ModelInfo[]) => {
      if (runningRef.current) return; // a sweep is already in progress
      // Only local models report a disk size; cloud models can't be probed.
      const targets = models.filter((m) => m.sizeBytes !== undefined);
      if (targets.length === 0) return;

      cancelRef.current = false;
      runningRef.current = true;
      void (async () => {
        // Start from the freshest persisted map so concurrent tabs don't clobber.
        let acc: FootprintMap = { ...loadCache(moduleId) };
        setProgress({ done: 0, total: targets.length });
        for (let i = 0; i < targets.length; i++) {
          if (cancelRef.current) break;
          const model = targets[i];
          setInspecting(model.id);
          let entry: FootprintEntry;
          try {
            const fp = await apiRequest<OllamaFootprint>(`/modules/${moduleId}/footprint`, {
              method: 'POST',
              body: JSON.stringify({ modelId: model.id, numCtx: model.contextLength }),
              timeout: PROBE_TIMEOUT_MS,
            });
            entry = {
              ...(fp.sizeBytes !== undefined ? { sizeBytes: fp.sizeBytes } : {}),
              ...(fp.sizeVramBytes !== undefined ? { sizeVramBytes: fp.sizeVramBytes } : {}),
              ...(fp.contextLength !== undefined ? { contextLength: fp.contextLength } : {}),
              ...(fp.error ? { error: fp.error } : {}),
              at: new Date().toISOString(),
            };
          } catch (err) {
            entry = {
              error: errorMessage(err, 'probe failed'),
              at: new Date().toISOString(),
            };
          }
          acc = { ...acc, [model.id]: entry };
          setFootprints(acc);
          persist(acc);
          setProgress({ done: i + 1, total: targets.length });
        }
        setInspecting(null);
        setProgress(null);
        runningRef.current = false;
      })();
    },
    [moduleId, persist],
  );

  return { footprints, inspecting, progress, inspect, cancel };
}
