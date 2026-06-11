import { CFG } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v8 — COMPRESSION / HLQ / QMR
// Globals: detectCompression, detectHLQ, detectQMR
// ═══════════════════════════════════════════════════════════════════
// Hanzo Shadow Codes PDF'dan:
//   Compression — narx spring kabi siqiladi. Shu paytda buy/sell orderlar
//   tozalab tushadi. Keyin news/event bilan big spike → MPL zonaga qaray.
//   Compression buy → shadow spikelar yuqori (orderlar tozalab yuqori)
//   Compression sell → shadow spikelar past
//
// HLQ (High Liquidity Zone) — qaerda Support va Resistance birlashadi
// (bu tizimda: OB + FVG + EQH/EQL yoki swing high+low juft)
//
// QMR (Quasimodo Reversal) — TRADING_UZ.pdf:
//   5-candle reversal: H → L → HH → LL → entry from L (shoulder)
//   yoki: L → H → LL → HH → entry from H
// ═══════════════════════════════════════════════════════════════════

// ─── COMPRESSION DETECTION ──────────────────────────────────────────
// Detects narrowing range + shadow spikes (orderlar tozalanyapti)
// Returns: {detected, dir: +1/-1/0, mpl: target price, why}
function detectCompression(candles, atrNow) {
  const out = { detected: false, dir: 0, mpl: null, strength: 0, why: 'no' };
  if (!candles || candles.length < 20) return out;

  // Last N candles: check if range is contracting
  const N = 10;
  const recent = candles.slice(-N);
  const ranges = recent.map(c => c.h - c.l);
  const firstHalf = ranges.slice(0, N / 2);
  const lastHalf = ranges.slice(N / 2);
  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = lastHalf.reduce((a, b) => a + b, 0) / lastHalf.length;
  const contracting = avg2 < avg1 * 0.75 && avg2 < atrNow * 0.8;
  if (!contracting) return out;

  // Count shadow spikes — wick'i body'dan 2× katta boʻlgan candle'lar
  let upSpikes = 0, downSpikes = 0;
  for (const c of recent) {
    const body = Math.abs(c.c - c.o);
    const upW = c.h - Math.max(c.o, c.c);
    const downW = Math.min(c.o, c.c) - c.l;
    if (body < 1e-6) continue;
    if (upW > body * 1.5) upSpikes++;
    if (downW > body * 1.5) downSpikes++;
  }

  // Compression BUY = shadow spikes yuqori (selllar trap qilinmoqda)
  // Compression SELL = shadow spikes past (buylar trap qilinmoqda)
  if (upSpikes >= 3 && upSpikes > downSpikes) {
    out.detected = true;
    out.dir = -1;  // selllar trap → reversal SHORT uch SHORT? Hanzo: shadow yuqori = COMPRESSION SELL
    out.mpl = Math.max(...recent.map(c => c.h));
    out.strength = upSpikes / N;
    out.why = `Compression SELL (${upSpikes} yuqori spike, range -${((1-avg2/avg1)*100).toFixed(0)}%)`;
  } else if (downSpikes >= 3 && downSpikes > upSpikes) {
    out.detected = true;
    out.dir = 1;
    out.mpl = Math.min(...recent.map(c => c.l));
    out.strength = downSpikes / N;
    out.why = `Compression BUY (${downSpikes} past spike, range -${((1-avg2/avg1)*100).toFixed(0)}%)`;
  }

  return out;
}

// ─── HLQ — HIGH LIQUIDITY ZONE (confluence) ─────────────────────────
// Where multiple SMC zones overlap: OB + FVG + equal level + swing
// Returns: {zones: [{type:'HLQ_BULL'/'HLQ_BEAR', top, bot, strength, sources}], nearest}
function detectHLQ(candles, atrNow, snap) {
  const out = { zones: [], nearestBull: null, nearestBear: null };
  if (!candles || candles.length < 30 || !snap) return out;

  const cur = candles[candles.length - 1].c;
  const tol = atrNow * 0.4;  // confluence tolerance

  // Collect candidate zones
  const candidates = [];
  if (snap.fvg && snap.fvg.bullFVGs) {
    snap.fvg.bullFVGs.forEach(f => candidates.push({ type: 'BULL', top: f.top, bot: f.bot, source: 'FVG' }));
  }
  if (snap.fvg && snap.fvg.bearFVGs) {
    snap.fvg.bearFVGs.forEach(f => candidates.push({ type: 'BEAR', top: f.top, bot: f.bot, source: 'FVG' }));
  }
  if (snap.ob) {
    if (snap.ob.activeBull) candidates.push({ type: 'BULL', top: snap.ob.activeBull.top, bot: snap.ob.activeBull.bot, source: 'OB' });
    if (snap.ob.activeBear) candidates.push({ type: 'BEAR', top: snap.ob.activeBear.top, bot: snap.ob.activeBear.bot, source: 'OB' });
  }
  if (snap.magnets && snap.magnets.magnets) {
    snap.magnets.magnets.forEach(m => {
      const type = m.dir > 0 ? 'BULL' : 'BEAR';
      candidates.push({ type, top: m.price + tol, bot: m.price - tol, source: m.type });
    });
  }

  // Group overlapping zones
  const zones = [];
  const used = new Set();
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const cluster = [candidates[i]];
    used.add(i);
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      if (candidates[i].type !== candidates[j].type) continue;
      // Overlap check
      const overlap = candidates[i].top >= candidates[j].bot - tol
                     && candidates[i].bot <= candidates[j].top + tol;
      if (overlap) { cluster.push(candidates[j]); used.add(j); }
    }
    if (cluster.length >= 2) {  // HLQ requires at least 2 overlapping
      const top = Math.max(...cluster.map(c => c.top));
      const bot = Math.min(...cluster.map(c => c.bot));
      zones.push({
        type: cluster[0].type === 'BULL' ? 'HLQ_BULL' : 'HLQ_BEAR',
        top, bot,
        mid: (top + bot) / 2,
        strength: cluster.length,
        sources: [...new Set(cluster.map(c => c.source))],
      });
    }
  }

  out.zones = zones;
  // Nearest below price (bullish — support) and above (bearish — resistance)
  const bullCands = zones.filter(z => z.type === 'HLQ_BULL' && z.top < cur).sort((a, b) => b.top - a.top);
  const bearCands = zones.filter(z => z.type === 'HLQ_BEAR' && z.bot > cur).sort((a, b) => a.bot - b.bot);
  out.nearestBull = bullCands[0] || null;
  out.nearestBear = bearCands[0] || null;
  return out;
}

// ─── QMR — QUASIMODO REVERSAL (TRADING_UZ.pdf) ──────────────────────
// Classical QMR: pastki trend (LLLLLL) → narx HH hosil qiladi → yana LL hosil qiladi
//   → Entry: L "shoulder" darajasida (oldingi H'dan past)
// Returns: {detected, dir: +1/-1, entry, sl, why}
function detectQMR(candles, atrNow) {
  const out = { detected: false, dir: 0, entry: null, sl: null, why: 'no' };
  if (!candles || candles.length < 12) return out;

  // Use last 20 bars; find swing structure
  const N = 20;
  const recent = candles.slice(-N);
  const len = 3;

  // Manual pivot detection (lookback 3)
  const highs = [], lows = [];
  for (let i = len; i < recent.length - len; i++) {
    const c = recent[i];
    let isH = true, isL = true;
    for (let j = i - len; j <= i + len; j++) {
      if (j === i) continue;
      if (recent[j].h >= c.h) isH = false;
      if (recent[j].l <= c.l) isL = false;
    }
    if (isH) highs.push({ idx: i, price: c.h });
    if (isL) lows.push({ idx: i, price: c.l });
  }

  // Bearish QMR: L → H → LL? No, classical pattern:
  //   downtrend with progressive LL, then sudden HH (sweep), then LL again
  //   pattern: low1 < low2 < high1 (sweep) → entry at high1 level on retest? Actually:
  // From TRADING_UZ: H → L → HH → LL → entry at SHOULDER (the L between HH and LL)
  //   Bullish: L → H → LL (sweep down) → HH → entry from H shoulder
  //   Bearish: H → L → HH (sweep up) → LL → entry from L shoulder

  // Simplified detection: need last 4 pivots
  const allPivots = [...highs.map(p => ({ ...p, type: 'H' })), ...lows.map(p => ({ ...p, type: 'L' }))]
    .sort((a, b) => a.idx - b.idx);
  if (allPivots.length < 4) return out;
  const p = allPivots.slice(-4);  // last 4 alternating pivots

  // Bearish QMR: ... L, H, LL_sweep, HH_lower? Actually: H, L, HH, LL_breakdown
  // Sequence ideally: H, L, HH (higher), then LL (lower than first L)
  // [H1, L1, H2, L2] where H2 > H1 (sweep up) and L2 < L1 (break down) — SHORT
  if (p[0].type === 'H' && p[1].type === 'L' && p[2].type === 'H' && p[3].type === 'L'
      && p[2].price > p[0].price && p[3].price < p[1].price) {
    // Entry at L1 (shoulder) — current price near it for retest
    const cur = candles[candles.length - 1].c;
    const shoulder = p[1].price;
    if (Math.abs(cur - shoulder) <= atrNow * 0.8 && cur >= shoulder * 0.998) {
      out.detected = true;
      out.dir = -1;
      out.entry = shoulder;
      out.sl = p[2].price + atrNow * 0.2;  // above HH
      out.why = `QMR↓ (H/L/HH/LL) shoulder=${shoulder.toFixed(2)}`;
      return out;
    }
  }

  // Bullish QMR: [L1, H1, L2, H2] where L2 < L1 (sweep down) and H2 > H1 — LONG
  if (p[0].type === 'L' && p[1].type === 'H' && p[2].type === 'L' && p[3].type === 'H'
      && p[2].price < p[0].price && p[3].price > p[1].price) {
    const cur = candles[candles.length - 1].c;
    const shoulder = p[1].price;
    if (Math.abs(cur - shoulder) <= atrNow * 0.8 && cur <= shoulder * 1.002) {
      out.detected = true;
      out.dir = 1;
      out.entry = shoulder;
      out.sl = p[2].price - atrNow * 0.2;
      out.why = `QMR↑ (L/H/LL/HH) shoulder=${shoulder.toFixed(2)}`;
      return out;
    }
  }

  return out;
}

// ─── COMBINED SCORE ─────────────────────────────────────────────────
function scoreCompressionHLQ(side, candles, atrNow, snap) {
  const out = { score: 0, compression: null, hlq: null, qmr: null, why: '' };
  const reasons = [];
  const isLong = side === 'L';
  const sigDir = isLong ? 1 : -1;

  // 1) Compression
  if (CFG.compressionEnabled) {
    const comp = detectCompression(candles, atrNow);
    out.compression = comp;
    if (comp.detected && comp.dir === sigDir) {
      out.score += Math.round((CFG.wCompression || 5) * comp.strength * 1.5);
      reasons.push(`Compr·${comp.strength.toFixed(2)}`);
    }
  }

  // 2) HLQ
  if (CFG.hlqEnabled) {
    const hlq = detectHLQ(candles, atrNow, snap);
    out.hlq = hlq;
    const zone = isLong ? hlq.nearestBull : hlq.nearestBear;
    const cur = candles[candles.length - 1].c;
    if (zone) {
      const inZone = cur >= zone.bot && cur <= zone.top;
      const near = inZone || Math.abs(cur - zone.mid) <= atrNow * 0.5;
      if (near) {
        out.score += Math.min(CFG.wHLQ || 6, zone.strength * 2);
        reasons.push(`HLQ×${zone.strength}(${zone.sources.join('+')})`);
      }
    }
  }

  // 3) QMR pattern
  if (CFG.qmrEnabled) {
    const qmr = detectQMR(candles, atrNow);
    out.qmr = qmr;
    if (qmr.detected && qmr.dir === sigDir) {
      out.score += CFG.wQMR || 8;
      reasons.push('QMR');
    }
  }

  out.why = reasons.join(' · ');
  return out;
}

export { detectCompression, detectHLQ, detectQMR, scoreCompressionHLQ };
