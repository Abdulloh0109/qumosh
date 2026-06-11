// ═══════════════════════════════════════════════════════════════════
// QUMASH — Candlestick chart service (lightweight-charts)
//
// Ported from js/05-chart.js. The chart/series creation, price-line, marker
// and OHLC logic is preserved 1:1. Differences from the original:
//   • lightweight-charts is imported from npm instead of a global <script>.
//   • The container/wrap elements are registered by the React <ChartPanel>
//     via attachChart() instead of being looked up by DOM id.
//   • The OHLC readout updates the store (setChartOHLC) instead of #chartO…
//   • The interactive drawing canvas — already disabled in the original
//     ("Drawing canvas REMOVED", drawCanvas=null, no handlers wired) — is gone.
//     DRAW.shapes is kept only for export/import snapshot compatibility.
// ═══════════════════════════════════════════════════════════════════
import { createChart } from 'lightweight-charts';
import { CFG, ST } from '../core/state.js';
import { log } from '../core/utils.js';
import { setChartOHLC } from '../store/uiState.js';

let chart = null;
let candleSeries = null;
let containerEl = null;
let wrapEl = null;

/** Drawing-shape store — retained for snapshot export/import parity only. */
const DRAW = { shapes: [] };

/**
 * Register the DOM nodes owned by the React <ChartPanel>.
 * @param {{container: HTMLElement|null, wrap: HTMLElement|null}} nodes
 */
function attachChart({ container, wrap }) {
  containerEl = container ?? null;
  wrapEl = wrap ?? null;
}

/** Tear down the chart when <ChartPanel> unmounts. */
function detachChart() {
  if (chart) {
    try {
      chart.remove();
    } catch (_) {
      /* noop */
    }
  }
  chart = null;
  candleSeries = null;
  containerEl = null;
  wrapEl = null;
}

function initChart() {
  if (chart) return;
  const container = containerEl;
  if (!container) return;
  try {
    chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255,255,255,0.1)',
        // Show X-axis labels in user's LOCAL time (not UTC)
        tickMarkFormatter: (time, tickMarkType) => {
          const d = new Date(time * 1000);
          if (tickMarkType === 0) return String(d.getFullYear());
          if (tickMarkType === 1) {
            const months = [
              'yanv',
              'fev',
              'mar',
              'apr',
              'may',
              'iyun',
              'iyul',
              'avg',
              'sen',
              'okt',
              'noya',
              'dek',
            ];
            return months[d.getMonth()];
          }
          if (tickMarkType === 2) return String(d.getDate());
          // Hour/minute (LOCAL time)
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        },
      },
      // Crosshair tooltip — also LOCAL time
      localization: {
        timeFormatter: (time) => {
          const d = new Date(time * 1000);
          const months = [
            'yanv',
            'fev',
            'mar',
            'apr',
            'may',
            'iyun',
            'iyul',
            'avg',
            'sen',
            'okt',
            'noya',
            'dek',
          ];
          const day = String(d.getDate()).padStart(2, '0');
          const mon = months[d.getMonth()];
          const yr = String(d.getFullYear()).slice(2);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${day} ${mon} '${yr}  ${hh}:${mm}`;
        },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(86,188,224,0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#56bce0',
        },
        horzLine: {
          color: 'rgba(86,188,224,0.4)',
          width: 1,
          style: 2,
          labelBackgroundColor: '#56bce0',
        },
      },
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: '#3ad29a',
      downColor: '#f06a72',
      borderUpColor: '#3ad29a',
      borderDownColor: '#f06a72',
      wickUpColor: '#3ad29a',
      wickDownColor: '#f06a72',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });
    loadShapes();
    log('INFO', '📈 Grafik ishga tushdi');
  } catch (e) {
    log('WARN', `⚠️ Grafik feyl: ${e.message?.slice(0, 60)}`);
  }
}

function seedChartData() {
  if (!candleSeries || !ST.candles.length) return;
  const data = ST.candles.map((c) => ({
    time: c.epoch,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
  }));
  const seen = new Set();
  const clean = data
    .filter((d) => {
      if (seen.has(d.time)) return false;
      seen.add(d.time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
  candleSeries.setData(clean);
  chart.timeScale().fitContent();
  updateChartOHLC();
  // Restore signal markers + active trade lines
  refreshChartMarkers();
  if (ST.condition !== 0) setActiveTradeLines();
}

function pushChartUpdate(c) {
  if (!candleSeries) return;
  try {
    candleSeries.update({ time: c.epoch, open: c.o, high: c.h, low: c.l, close: c.c });
  } catch (_) {
    /* duplicate/out-of-order tick — ignore */
  }
  updateChartOHLC();
}

function resetChartForTF() {
  if (!chart || !candleSeries) return;
  candleSeries.setData([]);
}

// ─── SIGNAL VISUALIZATION ON CHART ───────────────────────────────────
let activePriceLines = [];

function clearActivePriceLines() {
  if (!candleSeries) return;
  for (const line of activePriceLines) {
    try {
      candleSeries.removePriceLine(line);
    } catch (_) {
      /* noop */
    }
  }
  activePriceLines = [];
}

function setActiveTradeLines() {
  clearActivePriceLines();
  if (!ST.snap || !candleSeries) return;
  const s = ST.snap;
  const isLong = s.isLong;
  const sideTxt = isLong ? 'BUY' : 'SELL';
  const cond = Math.abs(ST.condition);

  // LineStyle: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted

  // Entry — solid orange, prominent
  activePriceLines.push(
    candleSeries.createPriceLine({
      price: s.entry,
      color: '#e0a23b',
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: `◆ ${sideTxt} ${s.tier}`,
    }),
  );

  // SL — red dashed (or dotted+yellow if BE)
  const slIsBE = ST.tradeReachedTP1 && Math.abs(s.entry - ST.slLine) < s.entry * 0.001;
  activePriceLines.push(
    candleSeries.createPriceLine({
      price: ST.slLine,
      color: slIsBE ? '#d6ad5c' : '#f06a72',
      lineWidth: 2,
      lineStyle: slIsBE ? 1 : 2,
      axisLabelVisible: true,
      title: slIsBE ? '🛡 BE' : '✗ SL',
    }),
  );

  // TP1 — green dashed (thinner if hit)
  activePriceLines.push(
    candleSeries.createPriceLine({
      price: s.tp1,
      color: '#3ad29a',
      lineWidth: cond >= 1.1 ? 1 : 2,
      lineStyle: cond >= 1.1 ? 4 : 2,
      axisLabelVisible: true,
      title: cond >= 1.1 ? '✓ TP1' : '🎯 TP1',
    }),
  );
  // TP2 — green dashed (thinner if hit)
  activePriceLines.push(
    candleSeries.createPriceLine({
      price: s.tp2,
      color: '#3ad29a',
      lineWidth: cond >= 1.2 ? 1 : 2,
      lineStyle: cond >= 1.2 ? 4 : 2,
      axisLabelVisible: true,
      title: cond >= 1.2 ? '✓ TP2' : '🎯 TP2',
    }),
  );
  // TP3 — green dashed (always emphasized)
  activePriceLines.push(
    candleSeries.createPriceLine({
      price: s.tp3,
      color: '#3ad29a',
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: '🏆 TP3',
    }),
  );
}

function refreshChartMarkers() {
  if (!candleSeries) return;
  // Only show signals from the CURRENT TF (don't bleed across TFs)
  const items = ST.history
    .filter((h) => !h.tf || h.tf === CFG.granularity) // legacy entries (no tf) shown by default
    .slice(0, 30)
    .reverse();
  const markers = [];
  for (const h of items) {
    if (!h.epoch) continue;
    const isLong = h.side === 'L';
    markers.push({
      time: h.epoch,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? '#3ad29a' : '#f06a72',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: `${isLong ? 'BUY' : 'SELL'} ${h.tier}`,
    });
    if (h.exit !== 'live' && h.exitEpoch) {
      let color = '#94a3b8',
        text = '?';
      if (h.exit === 'tp') {
        color = '#3ad29a';
        text = '✓';
      } else if (h.exit === 'sl') {
        color = '#f06a72';
        text = '✗';
      } else if (h.exit === 'be') {
        color = '#d6ad5c';
        text = '=';
      }
      markers.push({
        time: h.exitEpoch,
        position: isLong ? 'aboveBar' : 'belowBar',
        color,
        shape: 'circle',
        text,
      });
    }
  }
  // Sort by time ASC (Lightweight Charts requires this)
  markers.sort((a, b) => a.time - b.time);
  // Dedupe (rare but safe — same time = merge text)
  const uniq = [];
  let lastKey = null;
  for (const m of markers) {
    const k = m.time + '_' + m.position;
    if (k !== lastKey) {
      uniq.push(m);
      lastKey = k;
    }
  }
  try {
    candleSeries.setMarkers(uniq);
  } catch (e) {
    log('WARN', 'Marker xato: ' + e.message?.slice(0, 30));
  }
}

function updateChartOHLC() {
  if (!ST.candles.length) return;
  const c = ST.candles[ST.candles.length - 1];
  const prev = ST.candles[ST.candles.length - 2];
  const ohlc = {
    o: c.o.toFixed(3),
    h: c.h.toFixed(3),
    l: c.l.toFixed(3),
    c: c.c.toFixed(3),
    dStr: '—',
    dDir: 'up',
  };
  if (prev) {
    const d = c.c - prev.c;
    const dpct = (d / prev.c) * 100;
    ohlc.dDir = d >= 0 ? 'up' : 'dn';
    ohlc.dStr =
      (d >= 0 ? '+' : '') + d.toFixed(3) + ' (' + (d >= 0 ? '+' : '') + dpct.toFixed(2) + '%)';
  }
  setChartOHLC(ohlc);
}

// ─── FULLSCREEN ──────────────────────────────────────────────────────
async function toggleFullscreen() {
  const wrap = wrapEl;
  if (!wrap) return;
  if (document.fullscreenElement === wrap) {
    try {
      await document.exitFullscreen();
    } catch (_) {
      /* noop */
    }
    return;
  }
  if (wrap.classList.contains('fs-fallback')) {
    wrap.classList.remove('fs-fallback');
    return;
  }
  // Try native fullscreen first
  try {
    await wrap.requestFullscreen();
  } catch (_) {
    // Fallback: CSS fullscreen
    wrap.classList.add('fs-fallback');
    log('INFO', '⛶ Toʻliq ekran (fallback) — ESC uchun qayta bosing');
    const escHandler = (ev) => {
      if (ev.key === 'Escape') {
        wrap.classList.remove('fs-fallback');
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
}

// ─── SHAPE PERSISTENCE (snapshot export/import compatibility) ─────────
function saveShapes() {
  try {
    localStorage.setItem('qumash_v5_shapes', JSON.stringify(DRAW.shapes));
  } catch (_) {
    /* noop */
  }
}
function loadShapes() {
  try {
    const s = JSON.parse(localStorage.getItem('qumash_v5_shapes') || '[]');
    if (Array.isArray(s)) DRAW.shapes = s;
  } catch (_) {
    DRAW.shapes = [];
  }
}

export {
  DRAW,
  attachChart,
  detachChart,
  initChart,
  seedChartData,
  pushChartUpdate,
  resetChartForTF,
  clearActivePriceLines,
  setActiveTradeLines,
  refreshChartMarkers,
  updateChartOHLC,
  toggleFullscreen,
  saveShapes,
  loadShapes,
};
