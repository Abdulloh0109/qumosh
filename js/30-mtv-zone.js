// ═══════════════════════════════════════════════════════════════════
// QUMASH v11 — MTV ZONE (Most Traded Volume / Point of Control)
// (Market_Notes_Series_Episode_2_MTV_FVG.pdf'дан)
// Globals: detectMTVZones, scoreMTV
// ═══════════════════════════════════════════════════════════════════
// MTV Zone = narx eng kўп вақт ўтказган ва энг кўп volume billan
// savdolanган diapazon (Volume Profile POC analogue).
//
// XAUUSD M5/M15 учун biz approximation қиламиз: oxirgi 100 candle'дан
// price levels'larga tick volume distribute qilamiz (har candle volume'i
// (h-l) range bo'ylab teng tarqaldi deb qabul qilamiz).
//
// Signal logic:
//   - Narx MTV zone'ga қaytsa (trend bilan) → continuation rejection
//   - MTV zone breakout + retest → reversal/continuation confirmation
//   - MTV zone aro "Strong OF" (Order Flow) → MTV birinchi reject qiladi
//     keyin FVG fill bo'ladi (Market Notes Ep2 rule)
// ═══════════════════════════════════════════════════════════════════

// ─── BUILD VOLUME PROFILE (BIN-BASED) ───────────────────────────────
function _buildVolProfile(candles, bins = 40) {
  const N = candles.length;
  if (N < 20) return null;
  const window = candles.slice(-100); // last 100 bars
  let lo = Infinity, hi = -Infinity;
  for (const c of window) {
    if (c.l < lo) lo = c.l;
    if (c.h > hi) hi = c.h;
  }
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return null;
  const binSize = (hi - lo) / bins;
  const profile = new Float64Array(bins);
  for (const c of window) {
    const v = (c.v ?? c.volume ?? 1) || 1;
    const range = c.h - c.l;
    if (range <= 0) {
      const bIdx = Math.min(bins - 1, Math.max(0, Math.floor((c.c - lo) / binSize)));
      profile[bIdx] += v;
    } else {
      // Distribute volume across (low,high) bins
      const lowBin = Math.max(0, Math.floor((c.l - lo) / binSize));
      const highBin = Math.min(bins - 1, Math.floor((c.h - lo) / binSize));
      const spread = highBin - lowBin + 1;
      const vPerBin = v / spread;
      for (let b = lowBin; b <= highBin; b++) profile[b] += vPerBin;
    }
  }
  // Find POC = max bin
  let pocIdx = 0, pocVol = 0;
  for (let i = 0; i < bins; i++) {
    if (profile[i] > pocVol) { pocVol = profile[i]; pocIdx = i; }
  }
  const pocPrice = lo + (pocIdx + 0.5) * binSize;
  // Total volume + value area (70% of volume around POC)
  const totalVol = profile.reduce((a, b) => a + b, 0);
  const target = totalVol * 0.7;
  let accum = profile[pocIdx];
  let lowBin = pocIdx, highBin = pocIdx;
  while (accum < target && (lowBin > 0 || highBin < bins - 1)) {
    const down = lowBin > 0 ? profile[lowBin - 1] : -1;
    const up = highBin < bins - 1 ? profile[highBin + 1] : -1;
    if (up >= down) { highBin++; accum += profile[highBin]; }
    else { lowBin--; accum += profile[lowBin]; }
  }
  return {
    lo, hi, binSize, profile, pocIdx, pocPrice, pocVol,
    valueAreaLow: lo + lowBin * binSize,
    valueAreaHigh: lo + (highBin + 1) * binSize,
  };
}

// ─── DETECT MTV ZONES ───────────────────────────────────────────────
function detectMTVZones(candles, atrNow) {
  const out = { profile: null, atPOC: false, atVAH: false, atVAL: false, direction: null };
  if (!candles || candles.length < 30) return out;
  const vp = _buildVolProfile(candles, 40);
  if (!vp) return out;
  out.profile = vp;
  const cur = candles[candles.length - 1].c;
  const tol = atrNow * 0.5;
  // Is current price at POC, VAH, or VAL?
  if (Math.abs(cur - vp.pocPrice) < tol) {
    out.atPOC = true;
    // Direction: above prev close = pushing up, below = pushing down
    const prev = candles[candles.length - 2];
    out.direction = cur > prev.c ? 'L' : 'S';
  }
  if (Math.abs(cur - vp.valueAreaHigh) < tol) out.atVAH = true;
  if (Math.abs(cur - vp.valueAreaLow) < tol) out.atVAL = true;
  return out;
}

// ─── MTV SCORE ──────────────────────────────────────────────────────
function scoreMTV(side, candles, atrNow) {
  const out = { score: 0, mtv: null, why: '' };
  if (!CFG.mtvEnabled) return out;
  const mt = detectMTVZones(candles, atrNow);
  out.mtv = mt;
  if (!mt.profile) return out;
  let score = 0;
  const labels = [];
  // VAH rejection = SHORT signal (price tried to break above value area, failing)
  if (mt.atVAH && side === 'S') {
    score += 4;
    labels.push('@VAH');
  }
  // VAL rejection = LONG signal (price tried to break below, failing)
  if (mt.atVAL && side === 'L') {
    score += 4;
    labels.push('@VAL');
  }
  // POC test in correct direction = +3 (price returning to POC is a fair value test)
  if (mt.atPOC) {
    if (mt.direction === side) {
      score += 3;
      labels.push('POC↑');
    }
  }
  out.score = Math.min(CFG.wMTV || 6, score);
  out.why = labels.join(' · ');
  return out;
}
