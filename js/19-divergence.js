// ═══════════════════════════════════════════════════════════════════
// QUMASH v9 — DIVERGENCE ENGINE (ICT Materials + Divergence_notes PDF'дан)
// Globals: detectDivergence, scoreDivergence
// ═══════════════════════════════════════════════════════════════════
// Divergence типлари:
//   TYPE 1 (Regular / Reversal):
//     - Bullish: price LL, indicator HL → trend reversal UP
//     - Bearish: price HH, indicator LH → trend reversal DOWN
//   TYPE 2 (Hidden / Continuation):
//     - Bullish: price HL, indicator LL → trend continuation UP
//     - Bearish: price LH, indicator HH → trend continuation DOWN
//   STINGER:
//     - Type 1 nested INSIDE Type 2 — ENG kuchli signal (Nick Van Nice)
//     - Bullish Stinger: bullish T1 within bullish T2
// ═══════════════════════════════════════════════════════════════════

// ─── FIND LAST 2 SWING POINTS ON PRICE + INDICATOR ──────────────────
// Returns {p1, p2, i1, i2, idx1, idx2} where p1 = first swing, p2 = second
function findLast2Swings(candles, indicator, lookback, isHigh) {
  if (!candles || candles.length < lookback) return null;
  const len = 4;  // pivot lookback
  const start = Math.max(len, candles.length - lookback);
  const swings = [];
  for (let i = start; i < candles.length - len; i++) {
    let isPivot = true;
    if (isHigh) {
      const pivot = candles[i].h;
      for (let j = i - len; j <= i + len; j++) {
        if (j === i) continue;
        if (j < 0 || j >= candles.length) continue;
        if (candles[j].h >= pivot) { isPivot = false; break; }
      }
      if (isPivot) swings.push({ idx: i, price: pivot, ind: indicator[i] });
    } else {
      const pivot = candles[i].l;
      for (let j = i - len; j <= i + len; j++) {
        if (j === i) continue;
        if (j < 0 || j >= candles.length) continue;
        if (candles[j].l <= pivot) { isPivot = false; break; }
      }
      if (isPivot) swings.push({ idx: i, price: pivot, ind: indicator[i] });
    }
  }
  if (swings.length < 2) return null;
  const last2 = swings.slice(-2);
  return { p1: last2[0], p2: last2[1] };
}

// ─── DETECT DIVERGENCE ──────────────────────────────────────────────
// Returns array of {type, kind, dir, p1, p2, strength}
function detectDivergence(candles, rsiSeries, macdHistSeries) {
  const out = [];
  if (!candles || candles.length < 30) return out;
  if (!rsiSeries || rsiSeries.length !== candles.length) return out;

  const lookback = 50;

  // ─── BEARISH divergence (на highs) ──
  const swingHighsRSI = findLast2Swings(candles, rsiSeries, lookback, true);
  if (swingHighsRSI) {
    const { p1, p2 } = swingHighsRSI;
    if (p1.ind != null && p2.ind != null) {
      // Type 1: price HH, RSI LH → bearish reversal
      if (p2.price > p1.price * 1.001 && p2.ind < p1.ind * 0.99) {
        out.push({
          type: 'T1_BEAR_RSI', kind: 'reversal', dir: -1,
          p1, p2, strength: (p1.ind - p2.ind) / p1.ind,
        });
      }
      // Type 2: price LH, RSI HH → bearish continuation (hidden)
      else if (p2.price < p1.price * 0.999 && p2.ind > p1.ind * 1.01) {
        out.push({
          type: 'T2_BEAR_RSI', kind: 'continuation', dir: -1,
          p1, p2, strength: (p2.ind - p1.ind) / p1.ind,
        });
      }
    }
  }

  // ─── BULLISH divergence (на lows) ──
  const swingLowsRSI = findLast2Swings(candles, rsiSeries, lookback, false);
  if (swingLowsRSI) {
    const { p1, p2 } = swingLowsRSI;
    if (p1.ind != null && p2.ind != null) {
      // Type 1: price LL, RSI HL → bullish reversal
      if (p2.price < p1.price * 0.999 && p2.ind > p1.ind * 1.01) {
        out.push({
          type: 'T1_BULL_RSI', kind: 'reversal', dir: 1,
          p1, p2, strength: (p2.ind - p1.ind) / Math.abs(p1.ind || 1),
        });
      }
      // Type 2: price HL, RSI LL → bullish continuation
      else if (p2.price > p1.price * 1.001 && p2.ind < p1.ind * 0.99) {
        out.push({
          type: 'T2_BULL_RSI', kind: 'continuation', dir: 1,
          p1, p2, strength: (p1.ind - p2.ind) / Math.abs(p1.ind || 1),
        });
      }
    }
  }

  // ─── MACD divergence (separate signal — more reliable when combined with RSI)
  if (macdHistSeries && macdHistSeries.length === candles.length) {
    const swingHighsMACD = findLast2Swings(candles, macdHistSeries, lookback, true);
    if (swingHighsMACD) {
      const { p1, p2 } = swingHighsMACD;
      if (p1.ind != null && p2.ind != null) {
        if (p2.price > p1.price * 1.001 && p2.ind < p1.ind * 0.95) {
          out.push({
            type: 'T1_BEAR_MACD', kind: 'reversal', dir: -1,
            p1, p2, strength: Math.abs((p1.ind - p2.ind) / (p1.ind || 1)),
          });
        }
      }
    }
    const swingLowsMACD = findLast2Swings(candles, macdHistSeries, lookback, false);
    if (swingLowsMACD) {
      const { p1, p2 } = swingLowsMACD;
      if (p1.ind != null && p2.ind != null) {
        if (p2.price < p1.price * 0.999 && p2.ind > p1.ind * 1.05) {
          out.push({
            type: 'T1_BULL_MACD', kind: 'reversal', dir: 1,
            p1, p2, strength: Math.abs((p2.ind - p1.ind) / (p1.ind || 1)),
          });
        }
      }
    }
  }

  return out;
}

// ─── STINGER DETECTOR ──────────────────────────────────────────────
// Stinger = Type 1 nested INSIDE Type 2 (same direction)
// Very rare, very powerful — Nick Van Nice signature
function detectStinger(divergences) {
  if (!divergences || divergences.length < 2) return null;
  // Find pair: T1 and T2 same direction
  const t1Bull = divergences.find(d => d.kind === 'reversal' && d.dir === 1);
  const t2Bull = divergences.find(d => d.kind === 'continuation' && d.dir === 1);
  const t1Bear = divergences.find(d => d.kind === 'reversal' && d.dir === -1);
  const t2Bear = divergences.find(d => d.kind === 'continuation' && d.dir === -1);

  if (t1Bull && t2Bull) {
    // T1 nested INSIDE T2: T1's swings should be within T2's range
    if (t1Bull.p1.idx >= t2Bull.p1.idx && t1Bull.p2.idx <= t2Bull.p2.idx + 5) {
      return { type: 'STINGER_BULL', dir: 1, t1: t1Bull, t2: t2Bull, why: 'T1↑ ichidа T2↑ (nested)' };
    }
  }
  if (t1Bear && t2Bear) {
    if (t1Bear.p1.idx >= t2Bear.p1.idx && t1Bear.p2.idx <= t2Bear.p2.idx + 5) {
      return { type: 'STINGER_BEAR', dir: -1, t1: t1Bear, t2: t2Bear, why: 'T1↓ ichidа T2↓ (nested)' };
    }
  }
  return null;
}

// ─── DIVERGENCE FILTER SCORE ────────────────────────────────────────
function scoreDivergence(side, candles, rsiSeries, macdHistSeries) {
  const out = { score: 0, divergences: [], stinger: null, why: '' };
  if (!CFG.divergenceEnabled) return out;
  const divs = detectDivergence(candles, rsiSeries, macdHistSeries);
  out.divergences = divs;
  if (!divs.length) return out;

  const stinger = detectStinger(divs);
  out.stinger = stinger;

  const isLong = side === 'L';
  const sigDir = isLong ? 1 : -1;

  const matching = divs.filter(d => d.dir === sigDir);
  if (!matching.length) return out;

  // Score by type:
  //   T1 (reversal): +6 (strong reversal signal)
  //   T2 (continuation): +3 (trend continuation hint)
  //   MACD T1: +4 (additional confirmation)
  //   Stinger: +10 (extremely rare, strongest)
  let score = 0;
  const labels = [];
  for (const d of matching) {
    if (d.type.startsWith('T1') && d.type.includes('RSI')) { score += 6; labels.push('T1·RSI'); }
    else if (d.type.startsWith('T2') && d.type.includes('RSI')) { score += 3; labels.push('T2·RSI'); }
    else if (d.type.startsWith('T1') && d.type.includes('MACD')) { score += 4; labels.push('T1·MACD'); }
  }
  if (stinger && stinger.dir === sigDir) {
    score += 10;
    labels.push('STINGER');
  }

  out.score = Math.min(CFG.wDivergence || 12, score);
  out.why = labels.join(' + ');
  return out;
}
