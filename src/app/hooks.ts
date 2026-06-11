// React hooks bridging the preserved JS core to the component tree.
// Each hook subscribes to the relevant UI-bus topic(s) so the component
// re-renders when the engine publishes, then returns the live data.
import { useTopic } from '../store/useTopic';
import { cfg, st, snapshot } from '../store/engine';
import { live } from '../store/live';
import type { Snapshot, LogLine } from '../types/app';

/** Latest engine snapshot; re-renders on every evaluation tick. */
export function useSnapshot(): Snapshot {
  useTopic('snapshot');
  return snapshot();
}

/** Header/connection/chart live state; re-renders on price/conn/chart updates. */
export function useLive() {
  useTopic('price');
  useTopic('conn');
  useTopic('chart');
  return live;
}

/** Current top-level view ('settings' | 'dashboard'). */
export function useView() {
  useTopic('view');
  return live.view;
}

/** Log lines; re-renders when a new line is appended. */
export function useLogs(): LogLine[] {
  useTopic('log');
  return st.logs as LogLine[];
}

/** Backtest progress percentage; re-renders during a run. */
export function useBacktestProgress(): number {
  useTopic('backtest');
  return live.backtestProgress;
}

export { cfg, st, snapshot };
