// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Утилитлар
// Globals: $, fmt, fmtPx, pct, clamp, nowMs, log, copyLog
// ═══════════════════════════════════════════════════════════════════

// ─── UTILS ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 3) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(d);
const fmtPx = (n) => fmt(n, 3);
const pct = (n, d = 1) => (n === null || isNaN(n)) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(d) + '%';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nowMs = () => Date.now();

function log(typ, msg, extra = '') {
  const ts = new Date().toLocaleTimeString('uz-UZ', {hour12:false});
  ST.logs.push({ts, typ, msg, extra});
  if (ST.logs.length > LOG_MAX) ST.logs.shift();
  const el = $('logPane');
  if (el) {
    const colors = {SIG:'#10b981', ERR:'#ef4444', WS:'#22d3ee', INFO:'#7a8da6', FILT:'#a78bfa', TG:'#22d3ee', EXIT:'#f59e0b', WARN:'#f59e0b', ADAPT:'#ec4899'};
    el.innerHTML += `<div><span class="ts">[${ts}]</span> <span class="typ" style="color:${colors[typ]||'#7a8da6'}">[${typ}]</span> ${msg}${extra ? ' <span style="color:#4a5a72">'+extra+'</span>' : ''}</div>`;
    el.scrollTop = el.scrollHeight;
    const lc = $('logCount'); if (lc) lc.textContent = ST.logs.length;
  }
}

function copyLog() {
  const txt = ST.logs.map(l => `[${l.ts}][${l.typ}] ${l.msg} ${l.extra}`).join('\n');
  navigator.clipboard?.writeText(txt);
  log('INFO', '📋 Лог нусхаланди');
}
