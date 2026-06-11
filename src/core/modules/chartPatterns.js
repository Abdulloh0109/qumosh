import { CFG } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v10 — CLASSICAL CHART PATTERNS (All_Chart_Patterns.pdf'dan)
// Globals: detectChartPatterns, scoreChartPatterns
// ═══════════════════════════════════════════════════════════════════
// Reversal patterns:
//   - Double Top / Double Bottom
//   - Head & Shoulders / Inverse H&S
//   - Rising Wedge / Falling Wedge (also continuation in some contexts)
// Continuation patterns:
//   - Bull Flag / Bear Flag
//   - Bullish/Bearish Rectangle
//   - Bullish/Bearish Pennant
// Bilateral:
//   - Ascending / Descending / Symmetrical Triangle
// ═══════════════════════════════════════════════════════════════════

// ─── PIVOT DETECTION (3-bar fractal) ────────────────────────────────
function _findPivots(candles, lookback) {
  const len = 3;
  const N = Math.min(candles.length, lookback || 60);
  const start = candles.length - N;
  const highs = [], lows = [];
  for (let i = start + len; i < candles.length - len; i++) {
    const c = candles[i];
    let isH = true, isL = true;
    for (let j = i - len; j <= i + len; j++) {
      if (j === i) continue;
      if (candles[j].h >= c.h) isH = false;
      if (candles[j].l <= c.l) isL = false;
    }
    if (isH) highs.push({ idx: i, price: c.h, ts: c.epoch });
    if (isL) lows.push({ idx: i, price: c.l, ts: c.epoch });
  }
  return { highs, lows };
}

// ─── DOUBLE TOP / DOUBLE BOTTOM ─────────────────────────────────────
function detectDoubleTopBottom(candles, atrNow) {
  const out = { patterns: [] };
  if (!candles || candles.length < 20) return out;
  const { highs, lows } = _findPivots(candles, 50);
  const tol = atrNow * 0.5;
  const cur = candles[candles.length - 1].c;

  // Double Top: 2 highs at similar price + neckline broken below
  if (highs.length >= 2) {
    const last2H = highs.slice(-2);
    const [h1, h2] = last2H;
    if (Math.abs(h1.price - h2.price) <= tol && h2.idx - h1.idx >= 5) {
      // Neckline = lowest low between h1 and h2
      const between = candles.slice(h1.idx, h2.idx + 1);
      const neckline = Math.min(...between.map(c => c.l));
      const height = ((h1.price + h2.price) / 2) - neckline;
      // Pattern valid if price below neckline (broken) OR within 1 ATR of it
      if (cur < neckline + atrNow * 0.5) {
        out.patterns.push({
          type: 'DOUBLE_TOP', dir: -1,
          entry: neckline, sl: Math.max(h1.price, h2.price) + atrNow * 0.2,
          target: neckline - height, neckline, p1: h1, p2: h2,
          confirmed: cur < neckline,
          why: `Double Top @${h1.price.toFixed(1)}/${h2.price.toFixed(1)}`,
        });
      }
    }
  }

  // Double Bottom: 2 lows at similar price + neckline broken above
  if (lows.length >= 2) {
    const last2L = lows.slice(-2);
    const [l1, l2] = last2L;
    if (Math.abs(l1.price - l2.price) <= tol && l2.idx - l1.idx >= 5) {
      const between = candles.slice(l1.idx, l2.idx + 1);
      const neckline = Math.max(...between.map(c => c.h));
      const height = neckline - ((l1.price + l2.price) / 2);
      if (cur > neckline - atrNow * 0.5) {
        out.patterns.push({
          type: 'DOUBLE_BOTTOM', dir: 1,
          entry: neckline, sl: Math.min(l1.price, l2.price) - atrNow * 0.2,
          target: neckline + height, neckline, p1: l1, p2: l2,
          confirmed: cur > neckline,
          why: `Double Bottom @${l1.price.toFixed(1)}/${l2.price.toFixed(1)}`,
        });
      }
    }
  }

  return out;
}

// ─── HEAD & SHOULDERS / INVERSE H&S ─────────────────────────────────
function detectHeadShoulders(candles, atrNow) {
  const out = { patterns: [] };
  if (!candles || candles.length < 30) return out;
  const { highs, lows } = _findPivots(candles, 80);
  const tol = atrNow * 0.4;
  const cur = candles[candles.length - 1].c;

  // H&S: 3 highs gde middle = highest, shoulders ~similar
  if (highs.length >= 3) {
    const last3H = highs.slice(-3);
    const [ls, head, rs] = last3H;  // left shoulder, head, right shoulder
    if (head.price > ls.price * 1.001 && head.price > rs.price * 1.001
        && Math.abs(ls.price - rs.price) <= tol * 1.5
        && head.idx - ls.idx >= 4 && rs.idx - head.idx >= 4) {
      // Neckline = lowest between ls and rs (or interpolated)
      const between = candles.slice(ls.idx, rs.idx + 1);
      const neckline = Math.min(...between.map(c => c.l));
      const height = head.price - neckline;
      if (cur < neckline + atrNow * 0.5) {
        out.patterns.push({
          type: 'HEAD_SHOULDERS', dir: -1,
          entry: neckline, sl: head.price + atrNow * 0.2,
          target: neckline - height, neckline,
          confirmed: cur < neckline,
          why: `H&S head@${head.price.toFixed(1)}`,
        });
      }
    }
  }

  // Inverse H&S: 3 lows gde middle = lowest
  if (lows.length >= 3) {
    const last3L = lows.slice(-3);
    const [ls, head, rs] = last3L;
    if (head.price < ls.price * 0.999 && head.price < rs.price * 0.999
        && Math.abs(ls.price - rs.price) <= tol * 1.5
        && head.idx - ls.idx >= 4 && rs.idx - head.idx >= 4) {
      const between = candles.slice(ls.idx, rs.idx + 1);
      const neckline = Math.max(...between.map(c => c.h));
      const height = neckline - head.price;
      if (cur > neckline - atrNow * 0.5) {
        out.patterns.push({
          type: 'INV_HEAD_SHOULDERS', dir: 1,
          entry: neckline, sl: head.price - atrNow * 0.2,
          target: neckline + height, neckline,
          confirmed: cur > neckline,
          why: `Inv H&S head@${head.price.toFixed(1)}`,
        });
      }
    }
  }
  return out;
}

// ─── WEDGE (Rising / Falling) ───────────────────────────────────────
function detectWedge(candles, atrNow) {
  const out = { patterns: [] };
  if (!candles || candles.length < 20) return out;
  const { highs, lows } = _findPivots(candles, 50);
  if (highs.length < 2 || lows.length < 2) return out;

  const last2H = highs.slice(-2);
  const last2L = lows.slice(-2);

  // Rising Wedge: HH + HL, but slope (HL) > slope (HH) → converging → bearish reversal
  const hSlope = (last2H[1].price - last2H[0].price) / (last2H[1].idx - last2H[0].idx);
  const lSlope = (last2L[1].price - last2L[0].price) / (last2L[1].idx - last2L[0].idx);
  if (hSlope > 0 && lSlope > 0 && lSlope > hSlope * 1.2) {
    out.patterns.push({
      type: 'RISING_WEDGE', dir: -1,
      entry: last2L[1].price, sl: last2H[1].price + atrNow * 0.3,
      target: last2L[0].price - (last2H[0].price - last2L[0].price) * 0.5,
      why: 'Rising Wedge → bearish reversal',
    });
  }
  // Falling Wedge: LL + LH, but slope LH > LL → converging → bullish reversal
  if (hSlope < 0 && lSlope < 0 && hSlope > lSlope * 1.2) {
    out.patterns.push({
      type: 'FALLING_WEDGE', dir: 1,
      entry: last2H[1].price, sl: last2L[1].price - atrNow * 0.3,
      target: last2H[0].price + (last2H[0].price - last2L[0].price) * 0.5,
      why: 'Falling Wedge → bullish reversal',
    });
  }
  return out;
}

// ─── TRIANGLES (Asc/Desc/Sym) ───────────────────────────────────────
function detectTriangles(candles, atrNow) {
  const out = { patterns: [] };
  if (!candles || candles.length < 20) return out;
  const { highs, lows } = _findPivots(candles, 50);
  if (highs.length < 2 || lows.length < 2) return out;
  const tol = atrNow * 0.3;

  const last2H = highs.slice(-2);
  const last2L = lows.slice(-2);
  const hFlat = Math.abs(last2H[1].price - last2H[0].price) <= tol;
  const lFlat = Math.abs(last2L[1].price - last2L[0].price) <= tol;
  const hRising = last2H[1].price > last2H[0].price + tol;
  const hFalling = last2H[1].price < last2H[0].price - tol;
  const lRising = last2L[1].price > last2L[0].price + tol;
  const lFalling = last2L[1].price < last2L[0].price - tol;

  // Ascending Triangle: flat top + rising bottom → bullish breakout
  if (hFlat && lRising) {
    const resistance = (last2H[0].price + last2H[1].price) / 2;
    const height = resistance - last2L[0].price;
    out.patterns.push({
      type: 'ASC_TRIANGLE', dir: 1,
      entry: resistance, sl: last2L[1].price - atrNow * 0.3,
      target: resistance + height,
      why: 'Ascending Triangle → bullish breakout',
    });
  }
  // Descending Triangle: flat bottom + falling top → bearish breakdown
  if (lFlat && hFalling) {
    const support = (last2L[0].price + last2L[1].price) / 2;
    const height = last2H[0].price - support;
    out.patterns.push({
      type: 'DESC_TRIANGLE', dir: -1,
      entry: support, sl: last2H[1].price + atrNow * 0.3,
      target: support - height,
      why: 'Descending Triangle → bearish breakdown',
    });
  }
  // Symmetrical Triangle: highs falling + lows rising → bilateral (no dir)
  if (hFalling && lRising) {
    // Direction determined by breakout
    out.patterns.push({
      type: 'SYM_TRIANGLE', dir: 0,
      entry: null, sl: null, target: null,
      why: 'Symmetrical Triangle → kuting breakout',
    });
  }
  return out;
}

// ─── BULL / BEAR FLAG ───────────────────────────────────────────────
function detectFlags(candles, atrNow) {
  const out = { patterns: [] };
  if (!candles || candles.length < 15) return out;
  // Flag: strong directional pole (5-10 candles) + tight pullback (3-7 candles, 30-50% retrace)
  const poleLen = 8;
  if (candles.length < poleLen + 7) return out;
  const pole = candles.slice(-poleLen - 7, -7);
  const flag = candles.slice(-7);
  const poleStart = pole[0];
  const poleEnd = pole[pole.length - 1];
  const poleMove = poleEnd.c - poleStart.o;
  if (Math.abs(poleMove) < atrNow * 3) return out;  // weak pole

  const flagHigh = Math.max(...flag.map(c => c.h));
  const flagLow = Math.min(...flag.map(c => c.l));
  const flagRange = flagHigh - flagLow;
  if (flagRange > Math.abs(poleMove) * 0.6) return out;  // pullback too big

  // Bull Flag: bullish pole + sideways/slight pullback
  if (poleMove > 0 && flagLow > poleStart.o) {
    out.patterns.push({
      type: 'BULL_FLAG', dir: 1,
      entry: flagHigh, sl: flagLow - atrNow * 0.3,
      target: flagHigh + Math.abs(poleMove),
      why: 'Bull Flag continuation',
    });
  }
  // Bear Flag: bearish pole + sideways/slight bounce
  if (poleMove < 0 && flagHigh < poleStart.o) {
    out.patterns.push({
      type: 'BEAR_FLAG', dir: -1,
      entry: flagLow, sl: flagHigh + atrNow * 0.3,
      target: flagLow - Math.abs(poleMove),
      why: 'Bear Flag continuation',
    });
  }
  return out;
}

// ─── RECTANGLE (range consolidation) ────────────────────────────────
function detectRectangle(candles, atrNow) {
  const out = { patterns: [] };
  if (!candles || candles.length < 20) return out;
  const recent = candles.slice(-15);
  const high = Math.max(...recent.map(c => c.h));
  const low = Math.min(...recent.map(c => c.l));
  const range = high - low;
  if (range > atrNow * 4) return out;  // too wide

  // Count touches of high and low
  let highTouches = 0, lowTouches = 0;
  const tol = atrNow * 0.3;
  for (const c of recent) {
    if (Math.abs(c.h - high) <= tol) highTouches++;
    if (Math.abs(c.l - low) <= tol) lowTouches++;
  }
  if (highTouches >= 2 && lowTouches >= 2) {
    // Rectangle confirmed — bias depends on prior trend (not detected here)
    out.patterns.push({
      type: 'RECTANGLE', dir: 0,
      high, low, range,
      why: `Rectangle ${low.toFixed(1)}-${high.toFixed(1)}`,
    });
  }
  return out;
}

// ─── MAIN DETECTOR ──────────────────────────────────────────────────
function detectChartPatterns(candles, atrNow) {
  const out = { all: [], byDir: { 1: [], '-1': [] } };
  if (!candles || candles.length < 20) return out;
  const all = [];
  all.push(...detectDoubleTopBottom(candles, atrNow).patterns);
  all.push(...detectHeadShoulders(candles, atrNow).patterns);
  all.push(...detectWedge(candles, atrNow).patterns);
  all.push(...detectTriangles(candles, atrNow).patterns);
  all.push(...detectFlags(candles, atrNow).patterns);
  all.push(...detectRectangle(candles, atrNow).patterns);
  out.all = all;
  for (const p of all) {
    if (p.dir === 1) out.byDir[1].push(p);
    else if (p.dir === -1) out.byDir['-1'].push(p);
  }
  return out;
}

// ─── CHART PATTERN SCORE ────────────────────────────────────────────
function scoreChartPatterns(side, candles, atrNow) {
  const out = { score: 0, matching: [], why: '' };
  if (!CFG.chartPatternsEnabled) return out;
  const patterns = detectChartPatterns(candles, atrNow);
  const sigDir = side === 'L' ? 1 : -1;
  const matching = patterns.byDir[sigDir] || [];
  out.matching = matching;

  // Score per pattern type:
  //   H&S / Inv H&S: +8 (strong, confirmed by neckline break)
  //   Double Top/Bot: +6
  //   Wedge: +5
  //   Triangle (asc/desc): +5
  //   Flag: +4 (continuation)
  let score = 0;
  const labels = [];
  for (const p of matching) {
    if (p.type === 'HEAD_SHOULDERS' || p.type === 'INV_HEAD_SHOULDERS') {
      score += p.confirmed ? 8 : 5;
      labels.push(p.confirmed ? 'H&S✓' : 'H&S~');
    } else if (p.type === 'DOUBLE_TOP' || p.type === 'DOUBLE_BOTTOM') {
      score += p.confirmed ? 6 : 4;
      labels.push(p.confirmed ? 'DT/DB✓' : 'DT/DB~');
    } else if (p.type.includes('WEDGE')) {
      score += 5;
      labels.push('Wedge');
    } else if (p.type.includes('TRIANGLE')) {
      score += 5;
      labels.push('Tri');
    } else if (p.type.includes('FLAG')) {
      score += 4;
      labels.push('Flag');
    }
  }
  out.score = Math.min(CFG.wChartPatterns || 10, score);
  out.why = labels.join(' + ');
  return out;
}

export { detectDoubleTopBottom, detectHeadShoulders, detectWedge, detectTriangles, detectFlags, detectRectangle, detectChartPatterns, scoreChartPatterns };
