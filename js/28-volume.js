// ═══════════════════════════════════════════════════════════════════
// QUMASH v11 — VOLUME CONFIRMATION
// (VolumeTradingStrategy.pdf + Market_Note_X_TF_TA_X1_TF_POI.pdf'дан)
// Globals: detectVolumeContext, scoreVolume
// ═══════════════════════════════════════════════════════════════════
// Volume signals (Deriv tick volume — bizda c.v mavjud):
//   1. VOLUME SPIKE: cur volume > 1.8 × avg(last 20) — breakout confirmation
//   2. VOLUME DIVERGENCE: price HH, but volume LL → reversal warning
//   3. VOLUME EXPANSION on reversal trigger candle → high probability
//   4. VOLUME COLLAPSE (cur < 0.5 × avg) → likely fakeout
//
// Score logic:
//   + Reversal candle + volume spike       → +5 (confirms move)
//   + Volume divergence aligned with side   → +4 (smart money exit/entry)
//   - Volume collapse                       → −3 (penalize, fakeout risk)
// ═══════════════════════════════════════════════════════════════════

// ─── VOLUME CONTEXT ─────────────────────────────────────────────────
function detectVolumeContext(candles) {
  const out = {
    curVol: null, avgVol: null, ratio: null,
    spike: false, collapse: false,
    divergence: null, // 'BEAR' (price up vol down) or 'BULL' (price down vol up)
  };
  if (!candles || candles.length < 25) return out;
  const N = candles.length;
  const cur = candles[N - 1];
  // Tick volume on Deriv: c.v field
  const curVol = (cur.v ?? cur.volume ?? 0) || 0;
  if (curVol <= 0) return out;
  // Average of last 20 (excluding current)
  let sum = 0, cnt = 0;
  for (let i = N - 21; i < N - 1; i++) {
    const v = (candles[i].v ?? candles[i].volume ?? 0) || 0;
    if (v > 0) { sum += v; cnt++; }
  }
  if (cnt < 10) return out;
  const avg = sum / cnt;
  out.curVol = curVol;
  out.avgVol = avg;
  out.ratio = avg > 0 ? curVol / avg : 1;
  out.spike = out.ratio >= 1.8;
  out.collapse = out.ratio < 0.5;
  // ─── Divergence check (last 10 vs prior 10) ─────────────────────
  if (N >= 21) {
    const lastWindow = candles.slice(-10);
    const priorWindow = candles.slice(-20, -10);
    const lastHigh = Math.max(...lastWindow.map(c => c.h));
    const priorHigh = Math.max(...priorWindow.map(c => c.h));
    const lastLow = Math.min(...lastWindow.map(c => c.l));
    const priorLow = Math.min(...priorWindow.map(c => c.l));
    const lastAvgVol = lastWindow.reduce((a, c) => a + ((c.v ?? 0) || 0), 0) / lastWindow.length;
    const priorAvgVol = priorWindow.reduce((a, c) => a + ((c.v ?? 0) || 0), 0) / priorWindow.length;
    // Bearish divergence: price HH, volume LL → top exhaustion
    if (lastHigh > priorHigh && lastAvgVol < priorAvgVol * 0.85) {
      out.divergence = 'BEAR';
    }
    // Bullish divergence: price LL, volume LL → bottom exhaustion (selling drying up)
    else if (lastLow < priorLow && lastAvgVol < priorAvgVol * 0.85) {
      out.divergence = 'BULL';
    }
  }
  return out;
}

// ─── VOLUME SCORE ───────────────────────────────────────────────────
function scoreVolume(side, candles) {
  const out = { score: 0, ctx: null, why: '' };
  if (!CFG.volumeEnabled) return out;
  const ctx = detectVolumeContext(candles);
  out.ctx = ctx;
  if (ctx.ratio == null) return out;
  let score = 0;
  const labels = [];
  // 1. Volume spike on current candle = momentum confirmation
  if (ctx.spike) {
    score += 5;
    labels.push(`Vol↑×${ctx.ratio.toFixed(1)}`);
  }
  // 2. Divergence aligned with side
  if (ctx.divergence === 'BEAR' && side === 'S') {
    score += 4;
    labels.push('Vol÷');
  } else if (ctx.divergence === 'BULL' && side === 'L') {
    score += 4;
    labels.push('Vol÷');
  }
  // 3. Volume collapse — penalize fakeout
  if (ctx.collapse) {
    score -= 3;
    labels.push(`Vol×${ctx.ratio.toFixed(1)}`);
  }
  // Bound score
  score = Math.max(-3, Math.min(CFG.wVolume || 8, score));
  out.score = score;
  out.why = labels.join(' · ');
  return out;
}
