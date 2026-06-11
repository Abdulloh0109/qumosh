import { CFG } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v9 — ICT KEY LEVELS + JUDAS SWING (ICT Bible PDF'дан)
// Globals: detectKeyLevels, detectJudasSwing, scoreKeyLevels
// ═══════════════════════════════════════════════════════════════════
// PDH = Previous Day High, PDL = Previous Day Low
// PWH = Previous Week High, PWL = Previous Week Low
// PMH = Previous Month High, PML = Previous Month Low
//
// Midnight Open (NY EST midnight = UTC 05:00) — kunlik bias filter
// Above midnight open → bullish bias, below → bearish bias
//
// JUDAS SWING (ICT концепция):
//   Engineered false move that runs stops then reverses
//   Targets: PDH/PDL, PWH/PWL, Asian range, prior session stops
//   Forms typically in London session (manipulation phase of AMD)
// ═══════════════════════════════════════════════════════════════════

// ─── BUILD KEY HTF LEVELS ───────────────────────────────────────────
// Returns {pdh, pdl, pwh, pwl, pmh, pml, midnightOpen, asianHigh, asianLow}
function detectKeyLevels(candles, currentTime) {
  const out = {
    pdh: null, pdl: null, pwh: null, pwl: null, pmh: null, pml: null,
    midnightOpen: null, asianHigh: null, asianLow: null,
    nearestAbove: null, nearestBelow: null,
  };
  if (!candles || candles.length < 100) return out;
  const now = currentTime || (candles[candles.length - 1].epoch * 1000);
  const cur = candles[candles.length - 1].c;
  const today = new Date(now);

  // ─── Previous Day (yesterday UTC) ──
  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const prevDayStart = dayStart - 24 * 3600 * 1000;
  const prevDayCandles = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= prevDayStart && t < dayStart;
  });
  if (prevDayCandles.length >= 5) {
    out.pdh = Math.max(...prevDayCandles.map(c => c.h));
    out.pdl = Math.min(...prevDayCandles.map(c => c.l));
  }

  // ─── Previous Week (last Mon-Fri / 7 days back) ──
  const dow = today.getUTCDay();
  const daysToMon = (dow === 0 ? 6 : dow - 1);  // days back to this Monday
  const thisWeekStart = dayStart - daysToMon * 24 * 3600 * 1000;
  const prevWeekStart = thisWeekStart - 7 * 24 * 3600 * 1000;
  const prevWeekCandles = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= prevWeekStart && t < thisWeekStart;
  });
  if (prevWeekCandles.length >= 20) {
    out.pwh = Math.max(...prevWeekCandles.map(c => c.h));
    out.pwl = Math.min(...prevWeekCandles.map(c => c.l));
  }

  // ─── Previous Month ──
  const thisMonthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const prevMonthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1);
  const prevMonthCandles = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= prevMonthStart && t < thisMonthStart;
  });
  if (prevMonthCandles.length >= 50) {
    out.pmh = Math.max(...prevMonthCandles.map(c => c.h));
    out.pml = Math.min(...prevMonthCandles.map(c => c.l));
  }

  // ─── Midnight Open (NY midnight EST = UTC 05:00) ──
  // For today: find the first candle at or after 05:00 UTC today
  const midnightUTC = dayStart + 5 * 3600 * 1000;
  const midnightCandle = candles.find(c => c.epoch * 1000 >= midnightUTC);
  if (midnightCandle && (midnightCandle.epoch * 1000 - midnightUTC) < 30 * 60 * 1000) {
    out.midnightOpen = midnightCandle.o;
  }

  // ─── Asian Range (00:00-07:00 UTC today) ──
  const asianEnd = dayStart + 7 * 3600 * 1000;
  const asianCandles = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= dayStart && t < asianEnd;
  });
  if (asianCandles.length >= 3) {
    out.asianHigh = Math.max(...asianCandles.map(c => c.h));
    out.asianLow = Math.min(...asianCandles.map(c => c.l));
  }

  // ─── Find nearest levels relative to current price ──
  const allLevels = [
    { name: 'PDH', price: out.pdh },
    { name: 'PDL', price: out.pdl },
    { name: 'PWH', price: out.pwh },
    { name: 'PWL', price: out.pwl },
    { name: 'PMH', price: out.pmh },
    { name: 'PML', price: out.pml },
    { name: 'Asian H', price: out.asianHigh },
    { name: 'Asian L', price: out.asianLow },
  ].filter(l => l.price != null);

  const above = allLevels.filter(l => l.price > cur).sort((a, b) => a.price - b.price);
  const below = allLevels.filter(l => l.price < cur).sort((a, b) => b.price - a.price);
  out.nearestAbove = above[0] || null;
  out.nearestBelow = below[0] || null;
  return out;
}

// ─── DETECT JUDAS SWING ────────────────────────────────────────────
// Returns {detected, dir, sweptLevel, midnightBias, why}
// Logic:
//   1. Identify daily bias (above/below midnight open)
//   2. Look for FALSE move OPPOSITE to bias that swept a key level (Asian/PDH/PDL)
//   3. Then look for return back to bias direction
function detectJudasSwing(candles, levels, atrNow) {
  const out = { detected: false, dir: 0, sweptLevel: null, midnightBias: 0, why: 'no' };
  if (!candles || candles.length < 20 || !levels.midnightOpen) return out;

  const cur = candles[candles.length - 1].c;
  const last5 = candles.slice(-8);
  const midOpen = levels.midnightOpen;

  // Daily bias
  out.midnightBias = cur > midOpen ? 1 : -1;

  // Look at last 8 candles: did price sweep a level OPPOSITE to current bias?
  // Example: bullish bias (price > midnight), but recent candles swept below Asian Low or PDL
  const recentHigh = Math.max(...last5.map(c => c.h));
  const recentLow = Math.min(...last5.map(c => c.l));

  // Bullish Judas: current bias bullish, price recently swept a low level then recovered
  if (out.midnightBias === 1) {
    const swept = [];
    if (levels.asianLow && recentLow < levels.asianLow && cur > levels.asianLow + atrNow * 0.1) {
      swept.push({ name: 'Asian L', price: levels.asianLow });
    }
    if (levels.pdl && recentLow < levels.pdl && cur > levels.pdl + atrNow * 0.1) {
      swept.push({ name: 'PDL', price: levels.pdl });
    }
    if (swept.length > 0) {
      out.detected = true;
      out.dir = 1;
      out.sweptLevel = swept[0];
      out.why = `Judas↑ swept ${swept.map(s => s.name).join('+')} → return to bias`;
      return out;
    }
  }

  // Bearish Judas: current bias bearish, price swept a high level then dropped
  if (out.midnightBias === -1) {
    const swept = [];
    if (levels.asianHigh && recentHigh > levels.asianHigh && cur < levels.asianHigh - atrNow * 0.1) {
      swept.push({ name: 'Asian H', price: levels.asianHigh });
    }
    if (levels.pdh && recentHigh > levels.pdh && cur < levels.pdh - atrNow * 0.1) {
      swept.push({ name: 'PDH', price: levels.pdh });
    }
    if (swept.length > 0) {
      out.detected = true;
      out.dir = -1;
      out.sweptLevel = swept[0];
      out.why = `Judas↓ swept ${swept.map(s => s.name).join('+')} → return to bias`;
      return out;
    }
  }

  return out;
}

// ─── KEY LEVELS FILTER SCORE ────────────────────────────────────────
function scoreKeyLevels(side, candles, atrNow, currentTime) {
  const out = { score: 0, levels: null, judas: null, atKeyLevel: null, why: '' };
  if (!CFG.keyLevelsEnabled) return out;
  const levels = detectKeyLevels(candles, currentTime);
  out.levels = levels;
  const judas = detectJudasSwing(candles, levels, atrNow);
  out.judas = judas;

  const isLong = side === 'L';
  const sigDir = isLong ? 1 : -1;
  const cur = candles[candles.length - 1].c;

  let score = 0;
  const labels = [];

  // 1) Price reacting at key HTF level → entry edge
  const tol = atrNow * 0.4;
  const checkLevels = [
    { name: 'PDH', price: levels.pdh, isResistance: true },
    { name: 'PDL', price: levels.pdl, isResistance: false },
    { name: 'PWH', price: levels.pwh, isResistance: true },
    { name: 'PWL', price: levels.pwl, isResistance: false },
    { name: 'PMH', price: levels.pmh, isResistance: true },
    { name: 'PML', price: levels.pml, isResistance: false },
  ].filter(l => l.price != null);

  for (const lvl of checkLevels) {
    if (Math.abs(cur - lvl.price) <= tol) {
      // SHORT at resistance / LONG at support
      if (!isLong && lvl.isResistance) {
        score += 5;
        labels.push(`@${lvl.name}↓`);
        out.atKeyLevel = lvl;
        break;
      }
      if (isLong && !lvl.isResistance) {
        score += 5;
        labels.push(`@${lvl.name}↑`);
        out.atKeyLevel = lvl;
        break;
      }
    }
  }

  // 2) Midnight open bias confluence
  if (levels.midnightOpen != null) {
    const aboveMidnight = cur > levels.midnightOpen;
    if ((isLong && aboveMidnight) || (!isLong && !aboveMidnight)) {
      score += 2;
      labels.push(`MO${aboveMidnight ? '↑' : '↓'}`);
    }
  }

  // 3) Judas Swing — VERY STRONG reversal signal
  if (judas.detected && judas.dir === sigDir) {
    score += CFG.wJudas || 10;
    labels.push(`Judas·${judas.sweptLevel.name}`);
  }

  out.score = Math.min(CFG.wKeyLevels || 14, score);
  out.why = labels.join(' · ');
  return out;
}

export { detectKeyLevels, detectJudasSwing, scoreKeyLevels };
