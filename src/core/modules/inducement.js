import { CFG } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v10 — INDUCEMENT + ALGO CANDLE
// (ICT_INSTITUTIONAL_SMC_TRADING_DAVID_WOODS.pdf + ICT__SMC_trading_book__Eng_.pdf'дан)
// Globals: detectAlgoCandle, detectInducement, scoreInducement
// ═══════════════════════════════════════════════════════════════════
// ALGO CANDLE (Vector Candle):
//   - Strong engulfing candle that creates FVG immediately after
//   - "Absorbs liquidity" (grabs stop-loss area) then creates inefficiency
//   - Strong algo candle: body ≥ 2x ATR + creates FVG + breaks a recent swing
//   - "VERY STRONG ALGO CANDLE = grabs liquidity + breaks strong high/low
//      + has inducement OR creates FVG"
//
// INDUCEMENT (IDM):
//   - Short-term liquidity collected by smart money BEFORE going to real zone
//   - Typically: a small swing low/high INSIDE a larger retracement
//   - Price grabs the inducement first, then continues to OB / real zone
//   - "Strong rejection block = has inducement + forms on session H/L"
// ═══════════════════════════════════════════════════════════════════

// ─── DETECT ALGO CANDLE ─────────────────────────────────────────────
// Strong engulfing that creates FVG + grabs liquidity (breaks recent swing)
function detectAlgoCandle(candles, atrNow) {
  const out = { detected: null };
  if (!candles || candles.length < 10) return out;
  const N = candles.length;
  // Check last 3 candles for algo candle pattern
  for (let i = N - 3; i < N - 1; i++) {
    if (i < 2) continue;
    const c = candles[i];
    const prev = candles[i - 1];
    const next = candles[i + 1];
    const body = Math.abs(c.c - c.o);
    // Filter 1: body >= 2 × ATR
    if (body < atrNow * 1.8) continue;
    const isBullCandle = c.c > c.o;
    // Filter 2: engulfs previous candle
    const engulfs = isBullCandle
      ? (c.c >= Math.max(prev.o, prev.c) && c.o <= Math.min(prev.o, prev.c))
      : (c.o >= Math.max(prev.o, prev.c) && c.c <= Math.min(prev.o, prev.c));
    if (!engulfs) continue;
    // Filter 3: creates FVG immediately after (gap between c[i-1].h/l and c[i+1].l/h)
    const prevWindow = candles[i - 1];
    const fvgBull = isBullCandle && (next.l > prevWindow.h);
    const fvgBear = !isBullCandle && (next.h < prevWindow.l);
    if (!fvgBull && !fvgBear) continue;
    // Filter 4: grabs liquidity — breaks a recent swing within 10 candles back
    const back10 = candles.slice(Math.max(0, i - 10), i);
    const swingHigh = Math.max(...back10.map(cc => cc.h));
    const swingLow = Math.min(...back10.map(cc => cc.l));
    const grabsLiq = isBullCandle ? (c.l < swingLow * 0.9999) : (c.h > swingHigh * 1.0001);
    out.detected = {
      type: isBullCandle ? 'ALGO_BULL' : 'ALGO_BEAR',
      dir: isBullCandle ? 1 : -1,
      idx: i,
      bodySize: body / atrNow,
      hasFVG: true,
      grabsLiq,
      candle: c,
      why: `Algo${grabsLiq ? '+liqGrab' : ''}+FVG`,
    };
    break;
  }
  return out;
}

// ─── DETECT INDUCEMENT ──────────────────────────────────────────────
// Short-term liquidity (mini swing) inside a larger retracement zone
// Logic:
//   1. Find recent strong impulse (3+ ATR move)
//   2. During retracement, look for a small swing high/low (inducement)
//   3. If price has swept that inducement → setup is ready
function detectInducement(candles, atrNow) {
  const out = { detected: null };
  if (!candles || candles.length < 15) return out;
  const N = candles.length;
  const recent = candles.slice(-15);
  const cur = candles[N - 1].c;
  // Find impulse: largest 3-candle move in last 10 bars
  let bestImpulse = null;
  for (let i = N - 12; i < N - 3; i++) {
    if (i < 0) continue;
    const startC = candles[i];
    const endC = candles[i + 3];
    const move = endC.c - startC.o;
    if (Math.abs(move) >= atrNow * 3) {
      if (!bestImpulse || Math.abs(move) > Math.abs(bestImpulse.move)) {
        bestImpulse = { startIdx: i, endIdx: i + 3, move, dir: move > 0 ? 1 : -1 };
      }
    }
  }
  if (!bestImpulse) return out;
  // Look for inducement (mini-swing) between impulse end and current
  const postImpulse = candles.slice(bestImpulse.endIdx, N);
  if (postImpulse.length < 3) return out;
  if (bestImpulse.dir === 1) {
    // Upswing — inducement = mini lower swing inside retracement (price made HL then LL inside it)
    let miniLow = postImpulse[0].l, miniLowIdx = 0;
    for (let j = 0; j < postImpulse.length - 1; j++) {
      if (postImpulse[j].l < miniLow) {
        miniLow = postImpulse[j].l;
        miniLowIdx = j;
      }
    }
    // Has price subsequently swept that miniLow?
    const afterMini = postImpulse.slice(miniLowIdx + 1);
    const sweptMini = afterMini.some(c => c.l < miniLow);
    if (sweptMini && cur > miniLow + atrNow * 0.2) {
      out.detected = {
        type: 'IDM_BULL', dir: 1,
        idmLevel: miniLow,
        why: `IDM swept ${miniLow.toFixed(1)} → bullish setup ready`,
      };
    }
  } else {
    // Downswing — inducement = mini higher swing
    let miniHigh = postImpulse[0].h, miniHighIdx = 0;
    for (let j = 0; j < postImpulse.length - 1; j++) {
      if (postImpulse[j].h > miniHigh) {
        miniHigh = postImpulse[j].h;
        miniHighIdx = j;
      }
    }
    const afterMini = postImpulse.slice(miniHighIdx + 1);
    const sweptMini = afterMini.some(c => c.h > miniHigh);
    if (sweptMini && cur < miniHigh - atrNow * 0.2) {
      out.detected = {
        type: 'IDM_BEAR', dir: -1,
        idmLevel: miniHigh,
        why: `IDM swept ${miniHigh.toFixed(1)} → bearish setup ready`,
      };
    }
  }
  return out;
}

// ─── INDUCEMENT + ALGO CANDLE SCORE ─────────────────────────────────
function scoreInducement(side, candles, atrNow) {
  const out = { score: 0, algoCandle: null, inducement: null, why: '' };
  if (!CFG.inducementEnabled) return out;
  const algoCandle = detectAlgoCandle(candles, atrNow);
  const inducement = detectInducement(candles, atrNow);
  out.algoCandle = algoCandle.detected;
  out.inducement = inducement.detected;
  const sigDir = side === 'L' ? 1 : -1;
  let score = 0;
  const labels = [];
  if (algoCandle.detected && algoCandle.detected.dir === sigDir) {
    // Algo candle = +5, +liqGrab = +2 more
    score += 5 + (algoCandle.detected.grabsLiq ? 2 : 0);
    labels.push(`Algo${algoCandle.detected.grabsLiq ? '+liq' : ''}`);
  }
  if (inducement.detected && inducement.detected.dir === sigDir) {
    score += 4;
    labels.push('IDM✓');
  }
  out.score = Math.min(CFG.wInducement || 8, score);
  out.why = labels.join(' · ');
  return out;
}

export { detectAlgoCandle, detectInducement, scoreInducement };
