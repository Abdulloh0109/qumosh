// Typed facade over the preserved JS trading core. React code imports the
// config/state/snapshot from here so the JS↔TS boundary lives in one place.
import { CFG, ST } from '../core/state.js';
import { getSnapshot } from '../core/engine.js';
import type { Cfg, AppState, Snapshot } from '../types/app';

/** Global tuning config singleton (mutable). */
export const cfg = CFG as unknown as Cfg;

/** Runtime state-machine singleton (mutable). */
export const st = ST as unknown as AppState;

/** Latest per-tick snapshot the engine published (empty object before warmup). */
export function snapshot(): Snapshot {
  return (getSnapshot() ?? {}) as Snapshot;
}
