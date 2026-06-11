// ═══════════════════════════════════════════════════════════════════
// QUMASH v11 — WEEKEND GAP
// (GapTradingStrategiesQuickGuide.pdf'дан)
// Globals: detectWeekendGap, scoreGap
// ═══════════════════════════════════════════════════════════════════
// Weekend Gap rules (XAUUSD specifics):
//   - Friday ~21:00 UTC last candle vs Sunday/Monday ~22:00 UTC first candle
//   - If |open - prevClose| >= 0.3% (≈ 1 ATR_D1) = significant gap
//   - 90% of gaps fill eventually
//   - Gap acts as Support (if filled from below) or Resistance (if from above)
//
// Bias logic:
//   GAP UP (open > Friday close) → expect price to come DOWN to fill = SHORT bias
//   GAP DOWN (open < Friday close) → expect price to come UP to fill = LONG bias
//   This bias active until gap is filled (price touches Friday close level)
// ═══════════════════════════════════════════════════════════════════

// ─── DETECT WEEKEND GAP ─────────────────────────────────────────────
// Strategy: scan last 200 candles for big timestamp gap (>= 24h) indicating weekend
function detectWeekendGap(candles, atrD1) {
  const out = {
    gap: null,         // { direction: 'UP'/'DOWN', size, sizeAtr, fridayClose, sundayOpen, filled, fillPrice }
    bias: null,        // 'L' or 'S' until gap fills
  };
  if (!candles || candles.length < 50) return out;
  const N = candles.length;
  // Find most recent "weekend gap" — timestamp jump > 24h
  // (M5 candles are 5 min apart; weekend = 48h = 576 candles missed)
  let weekendIdx = -1;
  for (let i = N - 2; i > Math.max(0, N - 500); i--) {
    if (!candles[i] || !candles[i + 1]) continue;
    const tA = candles[i].t || candles[i].time;
    const tB = candles[i + 1].t || candles[i + 1].time;
    if (!tA || !tB) continue;
    const dtMin = (tB - tA) / 60000;
    // Weekend gap on Deriv XAUUSD: typically ~25-50h closure
    if (dtMin >= 60 * 24) {
      weekendIdx = i;
      break;
    }
  }
  if (weekendIdx < 0) return out;
  const fridayClose = candles[weekendIdx].c;
  const sundayOpen = candles[weekendIdx + 1].o;
  const size = sundayOpen - fridayClose;
  const sizeAbs = Math.abs(size);
  const sizeAtr = atrD1 > 0 ? sizeAbs / atrD1 : 0;
  // Minimum significance: 0.3 × ATR_D1 (smaller is noise)
  if (sizeAtr < 0.3) return out;
  const direction = size > 0 ? 'UP' : 'DOWN';
  // Has gap been filled?
  // Gap filled = price touched fridayClose since the gap
  let filled = false;
  let fillPrice = null;
  for (let i = weekendIdx + 1; i < N; i++) {
    if (direction === 'UP') {
      // Gap up: gap filled if price drops back to fridayClose
      if (candles[i].l <= fridayClose) {
        filled = true; fillPrice = fridayClose; break;
      }
    } else {
      // Gap down: gap filled if price rises back to fridayClose
      if (candles[i].h >= fridayClose) {
        filled = true; fillPrice = fridayClose; break;
      }
    }
  }
  out.gap = {
    direction, size, sizeAbs, sizeAtr,
    fridayClose, sundayOpen,
    filled, fillPrice,
    age: N - 1 - weekendIdx,    // how many bars since gap
  };
  // Bias: if not filled yet, expect fill direction
  if (!filled) {
    out.bias = direction === 'UP' ? 'S' : 'L';
  }
  return out;
}

// ─── GAP SCORE ──────────────────────────────────────────────────────
function scoreGap(side, candles, atrD1) {
  const out = { score: 0, gap: null, why: '' };
  if (!CFG.gapEnabled) return out;
  const g = detectWeekendGap(candles, atrD1);
  out.gap = g.gap;
  if (!g.gap) return out;
  let score = 0;
  const labels = [];
  // Bias matches side → reward
  if (g.bias === side && !g.gap.filled) {
    // Stronger if recent gap (< 100 bars old) and bigger
    const ageFactor = g.gap.age < 100 ? 1.0 : 0.6;
    const sizeFactor = Math.min(1.5, g.gap.sizeAtr);
    score = Math.round(4 * ageFactor * sizeFactor);
    labels.push(`Gap${g.gap.direction}→fill`);
  }
  // Gap level acting as S/R when price is near it
  if (candles && candles.length > 0) {
    const cur = candles[candles.length - 1].c;
    const distAtr = atrD1 > 0 ? Math.abs(cur - g.gap.fridayClose) / atrD1 : 99;
    if (distAtr < 0.3) {
      // Price near Friday close = potential reversal at gap level
      score += 3;
      labels.push('@gapLvl');
    }
  }
  out.score = Math.min(CFG.wGap || 6, score);
  out.why = labels.join(' · ');
  return out;
}
