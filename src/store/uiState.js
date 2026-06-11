// ═══════════════════════════════════════════════════════════════════
// UI "sinks" — the React-era replacements for the original DOM-writing
// helpers (setConnUI, updateLivePriceUI, refreshDashboardUI, refreshNewsUI).
//
// The trading core/services import these names exactly as before; here they
// mutate a plain `liveState` singleton and emit a bus topic instead of
// touching the DOM. React renders `liveState` + the core singletons reactively.
// ═══════════════════════════════════════════════════════════════════
import { ST } from '../core/state.js';
import { fmtPx, pct } from '../core/utils.js';
import { emit } from './uiBus.js';

/**
 * Imperative, non-snapshot UI state that React reads (header price, connection
 * pill, chart OHLC readout, and which top-level view is shown).
 */
export const liveState = {
  /** @type {'settings'|'dashboard'} */
  view: 'settings',
  connected: false,
  connText: 'Уланмаган',
  livePrice: '—',
  liveChg: '—',
  /** @type {'up'|'dn'|'flat'} */
  liveChgDir: 'flat',
  /** @type {null | {o:string,h:string,l:string,c:string,dStr:string,dDir:'up'|'dn'}} */
  chartOHLC: null,
  /** Backtest progress percentage (0–100). */
  backtestProgress: 0,
};

/** Backtest progress bar (was backtest.updateBacktestProgress writing to #btProgress). */
export function setBacktestProgress(pctValue) {
  liveState.backtestProgress = pctValue;
  emit('backtest');
}

/** @param {'settings'|'dashboard'} view */
export function setView(view) {
  liveState.view = view;
  emit('view');
}

/** Connection pill state. Mirror of the original feed.setConnUI(). */
export function setConnUI(on) {
  liveState.connected = on;
  liveState.connText = on ? 'УЛАНГАН' : 'Узилган';
  emit('conn');
}

/** Live price + % change in the header. Mirror of the original feed.updateLivePriceUI(). */
export function updateLivePriceUI() {
  liveState.livePrice = fmtPx(ST.lastPrice);
  if (ST.prevClose && ST.lastPrice) {
    const ch = ((ST.lastPrice - ST.prevClose) / ST.prevClose) * 100;
    liveState.liveChg = pct(ch, 2);
    liveState.liveChgDir = ch >= 0.001 ? 'up' : ch <= -0.001 ? 'dn' : 'flat';
  }
  emit('price');
}

/** Chart OHLC readout (was chart.updateChartOHLC writing to #chartO/#chartH/...). */
export function setChartOHLC(ohlc) {
  liveState.chartOHLC = ohlc;
  emit('chart');
}

/** Full dashboard refresh — was 10-ui.refreshDashboardUI(); now just a re-render signal. */
export function refreshDashboardUI() {
  emit('snapshot');
}

/** News panels refresh — was 10-ui.refreshNewsUI(); now just a re-render signal. */
export function refreshNewsUI() {
  emit('news');
}
