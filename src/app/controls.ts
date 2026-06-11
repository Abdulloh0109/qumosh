// Imperative controls bridging React events to the trading core. Ported from
// js/11-boot.js: timeframe switching, connect/disconnect, snapshot export/import,
// and the periodic refresh / news auto-refresh timers — with DOM wiring removed.
import { cfg, st } from '../store/engine';
import { log } from '../core/utils.js';
import { wsConnect, wsSend, requestAllHistory, disconnect } from '../services/feed.js';
import { resetChartForTF, DRAW } from '../services/chart.js';
import { loadAdaptiveWeights } from '../core/filters.js';
import { buildCalendar, CAL } from '../core/calendar.js';
import { tgSend } from '../services/telegram.js';
import { runSignalEvaluation } from '../core/engine.js';
import { setView, refreshNewsUI } from '../store/uiState.js';
import { applySettings, type Settings } from './settings';

export function tfLabel(g: number): string {
  if (g >= 86400) return 'D' + g / 86400;
  if (g >= 3600) return 'H' + g / 3600;
  return 'M' + g / 60;
}

/** Auto-pick a sensible HTF multiplier for a given timeframe. */
export function autoHtfMult(tfSec: number): number {
  if (tfSec <= 60) return 15; // M1 → M15
  if (tfSec <= 300) return 12; // M5 → H1
  if (tfSec <= 900) return 4; // M15 → H1
  if (tfSec <= 1800) return 2; // M30 → H1
  return 4; // H1 → H4
}

/** Switch active timeframe live without closing an open trade (ported changeTF). */
export function changeTF(newGran: number): void {
  if (newGran === cfg.granularity) return;
  if (!st.connected) {
    log('WARN', '⚠️ Аввал уланиш керак');
    return;
  }
  const hadActiveTrade = st.condition !== 0;
  if (hadActiveTrade) {
    log(
      'INFO',
      `📊 ТФ ${tfLabel(cfg.granularity)} → ${tfLabel(newGran)} (битим очиқ — давом этади)`,
    );
  }
  const oldGran = cfg.granularity;
  cfg.granularity = newGran;
  cfg.htfMult = autoHtfMult(newGran);

  // Reset only candle data — keep trade state (condition/snap/slLine/barsSinceEntry)
  st.candles = [];
  st.candlesHTF = [];
  st.feeds = {};
  st.warmedUp = false;
  st.lastPrice = null;
  st.prevClose = null;

  if (st.ws && st.ws.readyState === 1) {
    try {
      Object.values(st.subIds).forEach((id) => wsSend({ forget: id }));
      Object.values(st.feedSubs).forEach((id) => wsSend({ forget: id }));
    } catch {
      /* noop */
    }
    st.subIds = {};
    st.feedSubs = {};
    requestAllHistory();
  }

  resetChartForTF();
  log(
    'INFO',
    `🔄 ТФ ўзгарди: ${tfLabel(oldGran)} → ${tfLabel(newGran)}`,
    `HTF=${cfg.htfMult}x авто`,
  );

  try {
    const s = JSON.parse(localStorage.getItem('qumash_v5_cfg') || '{}');
    s.tf = newGran;
    localStorage.setItem('qumash_v5_cfg', JSON.stringify(s));
  } catch {
    /* noop */
  }
}

let periodicTimer: ReturnType<typeof setInterval> | null = null;

/** Apply settings, connect to Deriv, switch to the dashboard, start the refresh loop. */
export function connect(settings: Settings): void {
  applySettings(settings);
  loadAdaptiveWeights();
  setView('dashboard');
  log(
    'INFO',
    '🚀 QUMASH v7 REVERSAL HUNTER ишга тушди',
    `TF=${tfLabel(cfg.granularity)} HTF=${cfg.htfMult}x T1≥${cfg.tier1} T2≥${cfg.tier2}`,
  );
  log(
    'INFO',
    `News:${cfg.newsBlock ? 'AUTO' : 'OFF'} Adapt:${cfg.adaptiveEnabled ? 'ON' : 'OFF'} MinR:R 1:${cfg.minRR}`,
  );
  if (cfg.tgEnabled) {
    tgSend(
      `✅ <b>QUMASH v7 REVERSAL HUNTER</b> ишга тушди\n📊 XAUUSD ${tfLabel(cfg.granularity)}\n🎯 T1≥${cfg.tier1} T2≥${cfg.tier2} (R:R мин 1:${cfg.minRR})\n🤖 Сигнал кутилмоқда...`,
    );
  }
  try {
    localStorage.setItem('qumash_auto_reconnect', '1');
  } catch {
    /* noop */
  }
  wsConnect();

  if (periodicTimer) clearInterval(periodicTimer);
  periodicTimer = setInterval(() => {
    if (st.warmedUp) {
      runSignalEvaluation(false);
      refreshNewsUI();
    }
  }, 5000);
}

export { disconnect };

/** True if the user was connected on a previous page load (auto-reconnect intent). */
export function shouldAutoReconnect(): boolean {
  try {
    return localStorage.getItem('qumash_auto_reconnect') === '1';
  } catch {
    return false;
  }
}

/**
 * Poll the calendar for missing "actual" values during a news window.
 * Ported from the boot.js IIFE. Returns a cleanup function.
 */
export function startNewsAutoRefresh(): () => void {
  const id = setInterval(() => {
    if (cfg.newsMode !== 'auto') return;
    if (!CAL || !CAL.events) return;
    const now = Date.now();
    let needsRefresh = false;
    for (const ev of CAL.events as any[]) {
      if (!ev?.date || ev.impact !== 'high' || ev.currency !== 'USD') continue;
      const sinceMs = now - ev.date.getTime();
      if (sinceMs > -5 * 60 * 1000 && sinceMs < 45 * 60 * 1000 && !ev.actual) {
        needsRefresh = true;
        break;
      }
    }
    if (needsRefresh) {
      buildCalendar()
        .then(() => {
          refreshNewsUI();
          log('NEWS', '📅 Calendar янгиланди (actual ушлaш)');
        })
        .catch(() => {});
    }
  }, 60000);
  return () => clearInterval(id);
}

// ─── SNAPSHOT EXPORT / IMPORT (data portability) — ported from boot.js ──
export function exportData(): void {
  const snap = {
    version: 'qumash_v5_pro',
    timestamp: new Date().toISOString(),
    adaptWeights: st.adaptWeights,
    adaptHistory: st.adaptHistory,
    history: st.history,
    pastImpacts: CAL.past,
    drawShapes: DRAW?.shapes || [],
    customEvents: JSON.parse(localStorage.getItem('qumash_custom_events') || '[]'),
    cfg: JSON.parse(localStorage.getItem('qumash_v5_cfg') || '{}'),
    stats: {
      total: st.total,
      tpWins: st.tpWins,
      beHits: st.beHits,
      slLosses: st.slLosses,
      rSum: st.rSum,
      rWinSum: st.rWinSum,
      rLossSum: st.rLossSum,
      rWinCount: st.rWinCount,
      rLossCount: st.rLossCount,
      todayR: st.todayR,
      maxR: st.maxR,
      minR: st.minR,
    },
  };
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.download = `qumash-snapshot-${ts}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  alert('💾 Снапшот юклаб олинди.\n\nФайлни data/ папкасига кучиринг (керак бўлса).');
}

export function importData(file: File): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const snap = JSON.parse(String(e.target?.result));
      if (snap.version !== 'qumash_v5_pro') {
        if (!confirm('Бу файл версияси номаълум. Импорт қилаверайми?')) return;
      }
      if (snap.adaptWeights) {
        Object.assign(st.adaptWeights, snap.adaptWeights);
        try {
          localStorage.setItem('qumash_v5_adapt', JSON.stringify(st.adaptWeights));
        } catch {
          /* noop */
        }
      }
      if (Array.isArray(snap.adaptHistory)) st.adaptHistory = snap.adaptHistory;
      if (Array.isArray(snap.history)) st.history = snap.history;
      if (Array.isArray(snap.pastImpacts)) {
        CAL.past = snap.pastImpacts;
        try {
          localStorage.setItem('qumash_past_impacts', JSON.stringify(CAL.past));
        } catch {
          /* noop */
        }
      }
      if (Array.isArray(snap.drawShapes)) {
        DRAW.shapes = snap.drawShapes;
        try {
          localStorage.setItem('qumash_v5_shapes', JSON.stringify(DRAW.shapes));
        } catch {
          /* noop */
        }
      }
      if (Array.isArray(snap.customEvents)) {
        try {
          localStorage.setItem('qumash_custom_events', JSON.stringify(snap.customEvents));
        } catch {
          /* noop */
        }
      }
      if (snap.cfg && typeof snap.cfg === 'object') {
        try {
          localStorage.setItem('qumash_v5_cfg', JSON.stringify(snap.cfg));
        } catch {
          /* noop */
        }
      }
      if (snap.stats) {
        Object.assign(st, snap.stats);
      }
      alert('✅ Импорт муваффақиятли. Тизимни қайта ишга туширсангиз ўзгаришлар тўлиқ ишлайди.');
      log(
        'INFO',
        '📥 Импорт',
        `weights:${Object.keys(snap.adaptWeights || {}).length}, history:${(snap.history || []).length}`,
      );
    } catch (err) {
      alert('❌ Импорт хатоси: ' + (err as Error).message);
    }
  };
  reader.readAsText(file);
}
