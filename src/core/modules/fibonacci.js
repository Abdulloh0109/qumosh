import { CFG } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v10 — FULL FIBONACCI SYSTEM
// (FibonacciRetracementTradingStrategies.pdf + FIBONACCI_RETRACEMENT_GUIDE.pdf'dan)
// Globals: detectFibLevels, scoreFibonacci
// ═══════════════════════════════════════════════════════════════════
// Retracement levels (asosiy entry zones):
//   23.6%, 38.2%, 50.0%, 61.8%, 78.6%
// Extension levels (TP targets):
//   127.2%, 161.8%, 261.8% (Golden Ratio = 1.618)
//
// Mavjud OTE filter faqat 62-79% — to'liq Fibonacci system esa:
//   - Aniq retracement zonalarini topadi
//   - TP'lar uchun extension levels
//   - Bir nechta swing'lar combination
// ═══════════════════════════════════════════════════════════════════

// ─── BUILD FIB LEVELS FROM SWING ──────────────────────────────────
function _calcFibLevels(swingLow, swingHigh, isUpswing) {
  const range = swingHigh - swingLow;
  if (range <= 0) return null;
  // Retracement levels (from end of move back toward start)
  const retracementBase = isUpswing ? swingHigh : swingLow;
  const retracementDir = isUpswing ? -1 : 1;
  const retracements = [0.236, 0.382, 0.5, 0.618, 0.786].map(r => ({
    pct: r * 100,
    price: retracementBase + retracementDir * range * r,
  }));
  // Extensions (beyond end of move)
  const extensionBase = isUpswing ? swingLow : swingHigh;
  const extensionDir = isUpswing ? 1 : -1;
  const extensions = [1.272, 1.618, 2.618].map(r => ({
    pct: r * 100,
    price: extensionBase + extensionDir * range * r,
  }));
  return { retracements, extensions, range, swingLow, swingHigh, isUpswing };
}

// ─── DETECT FIB LEVELS FROM RECENT SWING ────────────────────────────
function detectFibLevels(candles, atrNow) {
  const out = { fib: null, activeZone: null, nearestExt: null };
  if (!candles || candles.length < 20) return out;
  const len = 3;
  const lookback = Math.min(candles.length, 80);
  const start = candles.length - lookback;
  const highs = [], lows = [];
  for (let i = start + len; i < candles.length - len; i++) {
    const c = candles[i];
    let isH = true, isL = true;
    for (let j = i - len; j <= i + len; j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isH = false;
      if (candles[j].l <= c.l) isL = false;
    }
    if (isH) highs.push({ idx: i, price: c.h });
    if (isL) lows.push({ idx: i, price: c.l });
  }
  if (highs.length === 0 || lows.length === 0) return out;
  // Most recent swing
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  const isUpswing = lastHigh.idx > lastLow.idx;
  const swingLow = isUpswing ? lastLow.price : lastHigh.price;
  const swingHigh = isUpswing ? lastHigh.price : lastLow.price;
  // Only valid if swing range >= 3 ATR (otherwise noise)
  if (Math.abs(swingHigh - swingLow) < atrNow * 3) return out;
  out.fib = _calcFibLevels(
    isUpswing ? lastLow.price : lastHigh.price,
    isUpswing ? lastHigh.price : lastLow.price,
    isUpswing
  );
  if (!out.fib) return out;
  // Which retracement zone is the price currently in?
  const cur = candles[candles.length - 1].c;
  const tol = atrNow * 0.4;
  for (const r of out.fib.retracements) {
    if (Math.abs(cur - r.price) <= tol) {
      out.activeZone = r;
      break;
    }
  }
  // Nearest extension for TP target
  const exts = out.fib.extensions;
  const aboveExts = exts.filter(e => isUpswing ? e.price > cur : e.price < cur);
  out.nearestExt = aboveExts[0] || null;
  return out;
}

// ─── FIB SCORE ──────────────────────────────────────────────────────
function scoreFibonacci(side, candles, atrNow) {
  const out = { score: 0, fib: null, activeZone: null, nearestExt: null, why: '' };
  if (!CFG.fibonacciEnabled) return out;
  const fibData = detectFibLevels(candles, atrNow);
  out.fib = fibData.fib;
  out.activeZone = fibData.activeZone;
  out.nearestExt = fibData.nearestExt;
  if (!fibData.fib || !fibData.activeZone) return out;
  const isLong = side === 'L';
  const isUpswing = fibData.fib.isUpswing;

  // LONG signals: best at 50%, 61.8%, 78.6% retracement of an UPSWING (buying pullback)
  // SHORT signals: best at 50%, 61.8%, 78.6% retracement of a DOWNSWING
  if ((isLong && isUpswing) || (!isLong && !isUpswing)) {
    const pct = fibData.activeZone.pct;
    // Golden zone (50-78.6%) = highest probability
    if (pct >= 50 && pct <= 78.6) {
      out.score = 8;
      out.why = `Fib ${pct.toFixed(1)}% (golden)`;
    } else if (pct >= 38.2) {
      out.score = 5;
      out.why = `Fib ${pct.toFixed(1)}%`;
    } else {
      out.score = 3;
      out.why = `Fib ${pct.toFixed(1)}% (shallow)`;
    }
  }
  out.score = Math.min(CFG.wFibonacci || 10, out.score);
  return out;
}

export { detectFibLevels, scoreFibonacci };
