// ═══════════════════════════════════════════════════════════════════
// QUMASH v11 — TRENDLINE AUTO-DETECT
// (TrendlineTradingStrategiesGuide.pdf'дан)
// Globals: detectTrendlines, scoreTrendline
// ═══════════════════════════════════════════════════════════════════
// Trendline qoidalari:
//   1. Kamida 3 ta swing point bo'lishi kerak (2 ta = noise, 3+ = valid)
//   2. Trendline = zone (1 ATR tolerance), perfect line emas
//   3. 3 ta opportunity:
//      - REVERSAL BOUNCE: narx trendlinega tegsa → reversal (bounce)
//      - BREAKOUT: narx trendlinedan tashqarida yopilsa → trend changed
//      - RETEST: breakout dan keyin → eski TL yangi S/R bo'lib qaytadi
//   4. Breakout + retest = eng kuchli setup (NEW REVERSAL TRIGGER)
// ═══════════════════════════════════════════════════════════════════

// ─── FIND SWING PIVOTS ───────────────────────────────────────────────
function _findSwingPivots(candles, len = 3) {
  const highs = [], lows = [];
  for (let i = len; i < candles.length - len; i++) {
    const c = candles[i];
    let isH = true, isL = true;
    for (let j = i - len; j <= i + len; j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isH = false;
      if (candles[j].l <= c.l) isL = false;
    }
    if (isH) highs.push({ idx: i, price: c.h, time: c.t });
    if (isL) lows.push({ idx: i, price: c.l, time: c.t });
  }
  return { highs, lows };
}

// ─── FIT TRENDLINE THROUGH POINTS ──────────────────────────────────
// Tries to fit a line through 3+ points; returns slope, intercept, R²
function _fitTrendline(points, atrNow) {
  if (points.length < 3) return null;
  // Linear regression: y = mx + b on (idx, price)
  const n = points.length;
  const sx = points.reduce((a, p) => a + p.idx, 0);
  const sy = points.reduce((a, p) => a + p.price, 0);
  const sxx = points.reduce((a, p) => a + p.idx * p.idx, 0);
  const sxy = points.reduce((a, p) => a + p.idx * p.price, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  // R² — how well points fit
  const meanY = sy / n;
  let ssTot = 0, ssRes = 0;
  for (const p of points) {
    const pred = slope * p.idx + intercept;
    ssRes += (p.price - pred) ** 2;
    ssTot += (p.price - meanY) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  // Max deviation in ATR units
  const maxDevAtr = points.reduce((mx, p) => {
    const pred = slope * p.idx + intercept;
    return Math.max(mx, Math.abs(p.price - pred) / atrNow);
  }, 0);
  return { slope, intercept, r2, maxDevAtr, n };
}

// ─── DETECT TRENDLINES ──────────────────────────────────────────────
function detectTrendlines(candles, atrNow) {
  const out = { support: null, resistance: null, bounce: null, breakout: null };
  if (!candles || candles.length < 30) return out;
  const { highs, lows } = _findSwingPivots(candles, 3);
  // Need at least 3 recent points
  const recentLows = lows.slice(-6);   // last 6 swing lows
  const recentHighs = highs.slice(-6); // last 6 swing highs
  // Try to fit support trendline (rising = uptrend support)
  if (recentLows.length >= 3) {
    // Try every 3-point combination, find best fit
    let bestSup = null;
    for (let i = 0; i < recentLows.length - 2; i++) {
      const subset = recentLows.slice(i);
      if (subset.length < 3) continue;
      const fit = _fitTrendline(subset, atrNow);
      if (!fit) continue;
      // Valid trendline: maxDev < 0.6 ATR, R² > 0.5, slope reasonable
      if (fit.maxDevAtr < 0.6 && fit.r2 > 0.5 && Math.abs(fit.slope) > 1e-6) {
        if (!bestSup || fit.r2 > bestSup.r2) {
          bestSup = { ...fit, points: subset, type: fit.slope > 0 ? 'RISING_SUP' : 'FALLING_SUP' };
        }
      }
    }
    out.support = bestSup;
  }
  // Resistance trendline
  if (recentHighs.length >= 3) {
    let bestRes = null;
    for (let i = 0; i < recentHighs.length - 2; i++) {
      const subset = recentHighs.slice(i);
      if (subset.length < 3) continue;
      const fit = _fitTrendline(subset, atrNow);
      if (!fit) continue;
      if (fit.maxDevAtr < 0.6 && fit.r2 > 0.5 && Math.abs(fit.slope) > 1e-6) {
        if (!bestRes || fit.r2 > bestRes.r2) {
          bestRes = { ...fit, points: subset, type: fit.slope < 0 ? 'FALLING_RES' : 'RISING_RES' };
        }
      }
    }
    out.resistance = bestRes;
  }
  // ─── CHECK CURRENT INTERACTION ────────────────────────────────────
  const curIdx = candles.length - 1;
  const cur = candles[curIdx];
  const tol = atrNow * 0.5;
  // Bounce detection: price testing trendline now
  if (out.support) {
    const tlPrice = out.support.slope * curIdx + out.support.intercept;
    if (Math.abs(cur.l - tlPrice) < tol && cur.c > tlPrice) {
      out.bounce = { side: 'L', tlPrice, tlType: out.support.type, why: 'Support TL bounce' };
    }
  }
  if (out.resistance) {
    const tlPrice = out.resistance.slope * curIdx + out.resistance.intercept;
    if (Math.abs(cur.h - tlPrice) < tol && cur.c < tlPrice) {
      out.bounce = { side: 'S', tlPrice, tlType: out.resistance.type, why: 'Resistance TL bounce' };
    }
  }
  // Breakout + retest detection (last 5 candles)
  // Breakout: previous candle closed beyond trendline, current is retesting it
  if (out.support && candles.length > 5) {
    const lastN = candles.slice(-5);
    let brokeBelow = false;
    let retesting = false;
    for (let i = 0; i < lastN.length; i++) {
      const ci = candles.length - 5 + i;
      const tlPrice = out.support.slope * ci + out.support.intercept;
      if (lastN[i].c < tlPrice - tol * 0.5) brokeBelow = true;
    }
    const curTlPrice = out.support.slope * curIdx + out.support.intercept;
    retesting = Math.abs(cur.c - curTlPrice) < tol;
    if (brokeBelow && retesting) {
      out.breakout = { side: 'S', tlPrice: curTlPrice, brokeWhich: 'SUPPORT', why: 'Support broken+retested → SHORT' };
    }
  }
  if (out.resistance && candles.length > 5) {
    const lastN = candles.slice(-5);
    let brokeAbove = false;
    let retesting = false;
    for (let i = 0; i < lastN.length; i++) {
      const ci = candles.length - 5 + i;
      const tlPrice = out.resistance.slope * ci + out.resistance.intercept;
      if (lastN[i].c > tlPrice + tol * 0.5) brokeAbove = true;
    }
    const curTlPrice = out.resistance.slope * curIdx + out.resistance.intercept;
    retesting = Math.abs(cur.c - curTlPrice) < tol;
    if (brokeAbove && retesting) {
      out.breakout = { side: 'L', tlPrice: curTlPrice, brokeWhich: 'RESISTANCE', why: 'Resistance broken+retested → LONG' };
    }
  }
  return out;
}

// ─── TRENDLINE SCORE ────────────────────────────────────────────────
function scoreTrendline(side, candles, atrNow) {
  const out = { score: 0, trendlines: null, bounce: null, breakout: null, isTrigger: false, why: '' };
  if (!CFG.trendlineEnabled) return out;
  const td = detectTrendlines(candles, atrNow);
  out.trendlines = { support: td.support, resistance: td.resistance };
  out.bounce = td.bounce;
  out.breakout = td.breakout;
  let score = 0;
  const labels = [];
  // Bounce on TL in correct direction
  if (td.bounce && td.bounce.side === side) {
    score += 5;
    labels.push('TL_BOUNCE');
  }
  // Breakout + retest → STRONGEST signal, also a reversal trigger
  if (td.breakout && td.breakout.side === side) {
    score += 8;
    out.isTrigger = true;
    labels.push('TL_BREAK+RETEST');
  }
  out.score = Math.min(CFG.wTrendline || 10, score);
  out.why = labels.join(' · ');
  return out;
}
