import { CFG } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v9 — ICT BLOCK TYPES (ICT Bible + LumiTraders PDF'дан)
// Globals: detectBreakerBlocks, detectRejectionBlocks, scoreICTBlocks
// ═══════════════════════════════════════════════════════════════════
// BREAKER BLOCK:
//   Bullish Breaker = failed swing high (lower high) + then break above it
//     - Order: HH → LH → HH (break) → retest LH → continuation up
//     - The "failed LH" becomes support
//   Bearish Breaker = failed swing low (higher low) + then break below it
//     - The "failed HL" becomes resistance
//
// REJECTION BLOCK:
//   Long wick that rejected price beyond a key level
//   Wick body's length determines strength
//
// MITIGATION BLOCK (simplified):
//   Failed SSL/BSL collection at a level - signal of imbalance
// ═══════════════════════════════════════════════════════════════════

// ─── BREAKER BLOCK DETECTION ────────────────────────────────────────
function detectBreakerBlocks(candles, atrNow) {
  const out = { bullishBreakers: [], bearishBreakers: [], activeBull: null, activeBear: null };
  if (!candles || candles.length < 30) return out;

  const len = 3;
  const lookback = Math.min(candles.length, 60);
  const cur = candles[candles.length - 1].c;

  // Build pivots
  const swingHighs = [], swingLows = [];
  for (let i = candles.length - lookback + len; i < candles.length - len; i++) {
    const c = candles[i];
    let isH = true, isL = true;
    for (let j = i - len; j <= i + len; j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isH = false;
      if (candles[j].l <= c.l) isL = false;
    }
    if (isH) swingHighs.push({ idx: i, price: c.h, candle: c });
    if (isL) swingLows.push({ idx: i, price: c.l, candle: c });
  }
  if (swingHighs.length < 3 || swingLows.length < 3) return out;

  // ─── Bullish Breaker ──
  // Need: HH (H1) → LH (H2, lower than H1) → break above H1
  // Then H2 acts as support
  for (let i = swingHighs.length - 3; i >= 0; i--) {
    const h1 = swingHighs[i];
    if (i + 1 >= swingHighs.length) continue;
    const h2 = swingHighs[i + 1];
    if (h2.price >= h1.price * 0.999) continue;  // not a lower high
    // Did price break above h1 after h2?
    const afterH2 = candles.slice(h2.idx + 1);
    const breakAbove = afterH2.find(c => c.h > h1.price * 1.0005);
    if (!breakAbove) continue;
    // h2 is now a bullish breaker
    const top = h2.candle.h;
    const bot = Math.min(h2.candle.o, h2.candle.c);
    if (cur > top * 1.005 || cur < bot * 0.995) {
      // Already past breaker — check if mitigated
      const mitigated = afterH2.some(c => c.l <= bot - atrNow * 0.1);
      if (!mitigated) {
        out.bullishBreakers.push({ top, bot, mid: (top + bot) / 2, idx: h2.idx, age: candles.length - h2.idx });
      }
    }
  }

  // ─── Bearish Breaker ──
  // Need: LL (L1) → HL (L2, higher than L1) → break below L1
  for (let i = swingLows.length - 3; i >= 0; i--) {
    const l1 = swingLows[i];
    if (i + 1 >= swingLows.length) continue;
    const l2 = swingLows[i + 1];
    if (l2.price <= l1.price * 1.001) continue;
    const afterL2 = candles.slice(l2.idx + 1);
    const breakBelow = afterL2.find(c => c.l < l1.price * 0.9995);
    if (!breakBelow) continue;
    const top = Math.max(l2.candle.o, l2.candle.c);
    const bot = l2.candle.l;
    if (cur < bot * 0.995 || cur > top * 1.005) {
      const mitigated = afterL2.some(c => c.h >= top + atrNow * 0.1);
      if (!mitigated) {
        out.bearishBreakers.push({ top, bot, mid: (top + bot) / 2, idx: l2.idx, age: candles.length - l2.idx });
      }
    }
  }

  // Active = closest to current price in trade direction
  const bullCands = out.bullishBreakers.filter(b => b.top < cur).sort((a, b) => b.top - a.top);
  const bearCands = out.bearishBreakers.filter(b => b.bot > cur).sort((a, b) => a.bot - b.bot);
  out.activeBull = bullCands[0] || null;
  out.activeBear = bearCands[0] || null;
  return out;
}

// ─── REJECTION BLOCK DETECTION ──────────────────────────────────────
// Long wick (3x+ body) that rejected a level
function detectRejectionBlocks(candles, atrNow) {
  const out = { bullishRejections: [], bearishRejections: [] };
  if (!candles || candles.length < 10) return out;
  const lookback = Math.min(candles.length, 40);
  const start = candles.length - lookback;
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    const body = Math.abs(c.c - c.o);
    if (body < 1e-6) continue;
    const upperW = c.h - Math.max(c.o, c.c);
    const lowerW = Math.min(c.o, c.c) - c.l;

    // Bullish rejection: long lower wick (>3x body) — rejected support
    if (lowerW > body * 2.5 && lowerW > atrNow * 0.5) {
      out.bullishRejections.push({
        top: Math.min(c.o, c.c),
        bot: c.l,
        mid: (Math.min(c.o, c.c) + c.l) / 2,
        idx: i, age: candles.length - 1 - i,
        wickSize: lowerW,
      });
    }
    // Bearish rejection: long upper wick (>3x body) — rejected resistance
    if (upperW > body * 2.5 && upperW > atrNow * 0.5) {
      out.bearishRejections.push({
        top: c.h,
        bot: Math.max(c.o, c.c),
        mid: (c.h + Math.max(c.o, c.c)) / 2,
        idx: i, age: candles.length - 1 - i,
        wickSize: upperW,
      });
    }
  }
  return out;
}

// ─── ICT BLOCKS SCORE ───────────────────────────────────────────────
function scoreICTBlocks(side, candles, atrNow) {
  const out = { score: 0, breakers: null, rejections: null, why: '' };
  if (!CFG.ictBlocksEnabled) return out;

  const breakers = detectBreakerBlocks(candles, atrNow);
  out.breakers = breakers;
  const rejections = detectRejectionBlocks(candles, atrNow);
  out.rejections = rejections;

  const isLong = side === 'L';
  const cur = candles[candles.length - 1].c;
  const tol = atrNow * 0.5;

  let score = 0;
  const labels = [];

  // 1) Active breaker in trade direction → +6
  const activeBreaker = isLong ? breakers.activeBull : breakers.activeBear;
  if (activeBreaker) {
    const inZone = isLong
      ? (cur >= activeBreaker.bot - tol && cur <= activeBreaker.top + tol)
      : (cur >= activeBreaker.bot - tol && cur <= activeBreaker.top + tol);
    if (inZone) {
      score += 6;
      labels.push(`Breaker·${isLong ? 'bull' : 'bear'}`);
    }
  }

  // 2) Recent rejection block (age < 5) at current price → +4
  const recentRej = isLong ? rejections.bullishRejections : rejections.bearishRejections;
  const matched = recentRej.find(r => r.age <= 5 && Math.abs(cur - r.mid) <= tol);
  if (matched) {
    score += 4;
    labels.push('Rejection');
  }

  out.score = Math.min(CFG.wICTBlocks || 8, score);
  out.why = labels.join(' · ');
  return out;
}

export { detectBreakerBlocks, detectRejectionBlocks, scoreICTBlocks };
