// ═══════════════════════════════════════════════════════════════════
// QUMASH — Utilities (formatting, clamp, logging)
//
// Ported from js/02-utils.js. The pure formatters are byte-identical; only
// `log()` changed: instead of appending to a #logPane DOM node it pushes to
// ST.logs (unchanged) and emits the 'log' bus topic so the React Log panel
// re-renders. The DOM-only `$` helper was dropped (no module needs it now).
// ═══════════════════════════════════════════════════════════════════
import { ST, LOG_MAX } from './state.js';
import { emit } from '../store/uiBus.js';

export const fmt = (n, d = 3) =>
  n === null || n === undefined || isNaN(n) ? '—' : Number(n).toFixed(d);
export const fmtPx = (n) => fmt(n, 3);
export const pct = (n, d = 1) =>
  n === null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(d) + '%';
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const nowMs = () => Date.now();

export function log(typ, msg, extra = '') {
  const ts = new Date().toLocaleTimeString('uz-UZ', { hour12: false });
  ST.logs.push({ ts, typ, msg, extra });
  if (ST.logs.length > LOG_MAX) ST.logs.shift();
  emit('log');
}

export function copyLog() {
  const txt = ST.logs.map((l) => `[${l.ts}][${l.typ}] ${l.msg} ${l.extra}`).join('\n');
  navigator.clipboard?.writeText(txt);
  log('INFO', '📋 Log nusxalandi');
}
