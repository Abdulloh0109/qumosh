// Boundary types for the preserved vanilla-JS trading core.
//
// The core (engine, filters, 14 PDF modules) is intentionally kept as untyped
// JS for behavioral parity, so the objects it exposes (config, runtime state,
// per-tick snapshot) are modelled loosely here. New React code is strictly
// typed; only these boundary objects are open records.

/** The global tuning config (was `CFG`). */
export type Cfg = Record<string, any>;

/** The mutable runtime state machine (was `ST`). */
export type AppState = Record<string, any>;

/** The per-evaluation view-model the engine publishes (was `_lastSnapshot`). */
export type Snapshot = Record<string, any>;

/** A single OHLC candle as produced by the feed. */
export interface Candle {
  epoch: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** A closed/open trade row in the history table (`ST.history[]`). */
export interface TradeRow {
  ts: string;
  side: 'L' | 'S';
  score: string;
  tier: string;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  exit: 'live' | 'tp' | 'sl' | 'be';
  r: number;
  regime?: string;
  structEvent?: string;
  [k: string]: any;
}

/** A log line (`ST.logs[]`). */
export interface LogLine {
  ts: string;
  typ: string;
  msg: string;
  extra?: string;
}

/** Imperative header/connection/chart UI state (store/uiState.js `liveState`). */
export interface LiveState {
  view: 'settings' | 'dashboard';
  connected: boolean;
  connText: string;
  livePrice: string;
  liveChg: string;
  liveChgDir: 'up' | 'dn' | 'flat';
  chartOHLC: null | { o: string; h: string; l: string; c: string; dStr: string; dDir: 'up' | 'dn' };
  backtestProgress: number;
}
