// ═══════════════════════════════════════════════════════════════════
// QUMASH v8 — TTrades CISD MODEL (MoneiacVIP PDF'дан)
// Globals: detectTTradesSwing, detectCISD, getCandleNumbering
// ═══════════════════════════════════════════════════════════════════
// TTrades Model: 3 candle swing formation
//   Candle 1: high/low'дан олдинги
//   Candle 2: high/low ҳосил қилади
//   Candle 3: high/low'дан кейинги (expansion)
//   Candle 4: continuation
//
// Two swing types:
//   1) Candle 2 Closure (reversal): C2 takes C1 high/low ва қайтиб C1 range'ига ёпилади
//   2) Candle 3 Closure (conditional): C2 қайтмаган, лекин C3 кучли ёпилди
//
// CISD = Change in State of Delivery — LTF'да swing'ни тасдиқлайди.
//   For M15 trade: HTF (H1) swing point → M15 CISD confirmation
//   (бизнинг tизимда HTF = htfMult × granularity, ёки 4x M15 = H1)
// ═══════════════════════════════════════════════════════════════════

// ─── CANDLE 2 CLOSURE DETECTION ─────────────────────────────────────
// Returns: {type: 'C2_BEAR' | 'C2_BULL' | null, c1, c2, swingPrice, wickMid}
// Bullish C2: C2 takes C1 low + closes back above C1 low
// Bearish C2: C2 takes C1 high + closes back below C1 high
function detectCandle2Closure(candles, idx) {
  if (!candles || candles.length < 3 || idx < 1 || idx >= candles.length) return null;
  const c1 = candles[idx - 1];
  const c2 = candles[idx];
  if (!c1 || !c2) return null;

  // Bullish C2: swept C1 low AND closed back above C1 low
  if (c2.l < c1.l && c2.c > c1.l) {
    const wickLow = c2.l;
    const closeBack = c2.c;
    const wickMid = (wickLow + Math.max(c2.o, c2.c)) / 2;  // wick equilibrium
    return {
      type: 'C2_BULL',
      c1, c2, idx,
      swingPrice: wickLow,    // the low — where swing formed
      wickMid,                 // equilibrium of c2 wick
      strength: (closeBack - wickLow) / (c1.h - c1.l + 1e-9),
    };
  }

  // Bearish C2: swept C1 high AND closed back below C1 high
  if (c2.h > c1.h && c2.c < c1.h) {
    const wickHigh = c2.h;
    const closeBack = c2.c;
    const wickMid = (wickHigh + Math.min(c2.o, c2.c)) / 2;
    return {
      type: 'C2_BEAR',
      c1, c2, idx,
      swingPrice: wickHigh,
      wickMid,
      strength: (wickHigh - closeBack) / (c1.h - c1.l + 1e-9),
    };
  }

  return null;
}

// ─── CANDLE 3 CLOSURE (conditional rule) ────────────────────────────
// C2 фейл (C1 range'га қайтмаган), лекин C3 кучли ёпилса swing валид
function detectCandle3Closure(candles, idx, atrNow) {
  if (!candles || candles.length < 4 || idx < 2 || idx >= candles.length) return null;
  const c1 = candles[idx - 2];
  const c2 = candles[idx - 1];
  const c3 = candles[idx];
  if (!c1 || !c2 || !c3) return null;

  const c3Body = Math.abs(c3.c - c3.o);
  const minBody = atrNow * 0.6;  // strong close threshold
  if (c3Body < minBody) return null;

  // Bullish C3 closure: C2 took C1 low but didn't close back; C3 closes strong bull
  if (c2.l < c1.l && c2.c < c1.l && c3.c > c3.o && c3.c > c2.h) {
    return {
      type: 'C3_BULL',
      c1, c2, c3, idx,
      swingPrice: c2.l,
      rangeMid: (c3.l + c3.c) / 2,
      strength: c3Body / atrNow,
    };
  }

  // Bearish C3 closure
  if (c2.h > c1.h && c2.c > c1.h && c3.c < c3.o && c3.c < c2.l) {
    return {
      type: 'C3_BEAR',
      c1, c2, c3, idx,
      swingPrice: c2.h,
      rangeMid: (c3.h + c3.c) / 2,
      strength: c3Body / atrNow,
    };
  }

  return null;
}

// ─── SCAN RECENT BARS FOR TTRADES SWING ─────────────────────────────
// Returns the MOST RECENT swing (C2 or C3 closure) within `lookback` bars
function detectTTradesSwing(candles, atrNow, lookback) {
  if (!candles || candles.length < 5) return null;
  const lb = lookback || 8;
  const start = Math.max(2, candles.length - lb);
  let lastSwing = null;
  for (let i = start; i < candles.length; i++) {
    const s2 = detectCandle2Closure(candles, i);
    if (s2) { lastSwing = { ...s2, age: candles.length - 1 - i }; continue; }
    const s3 = detectCandle3Closure(candles, i, atrNow);
    if (s3) { lastSwing = { ...s3, age: candles.length - 1 - i }; }
  }
  return lastSwing;
}

// ─── CISD CONFIRMATION (Change in State of Delivery) ────────────────
// CISD = LTF'да опposing close candle'нинг очилиш нархидан ёпилиш ўтиб кетади
//   For bullish swing: топ pastki up-close candle'нинг open'ига price closed below'дан yuqori ёпилиши
//   ёки oddiy ifoda: trend'нинг охирги counter-candle'и engulfed бўлиши
// Бизнинг tизимда: LTF candles = primary timeframe (M15), HTF = htfMult ×
// Returns: {confirmed: boolean, dir: +1/-1, level: number, why: string}
function detectCISD(candles, swing) {
  if (!swing || !candles || candles.length < 4) {
    return { confirmed: false, dir: 0, level: null, why: 'no swing' };
  }
  const isBull = swing.type === 'C2_BULL' || swing.type === 'C3_BULL';
  const dir = isBull ? 1 : -1;

  // Look at last few candles after the swing for opposite-color close-through
  const tail = candles.slice(-5);
  const last = tail[tail.length - 1];

  if (isBull) {
    // Find the lowest down-close (red) candle in last 5 — CISD when close above its open
    let lowestDown = null;
    for (const c of tail) {
      if (c.c < c.o) {
        if (!lowestDown || c.l < lowestDown.l) lowestDown = c;
      }
    }
    if (lowestDown && last.c > lowestDown.o) {
      return { confirmed: true, dir: 1, level: lowestDown.o, why: `CISD↑ break ${lowestDown.o.toFixed(2)}` };
    }
  } else {
    // Find the highest up-close (green) candle — CISD when close below its open
    let highestUp = null;
    for (const c of tail) {
      if (c.c > c.o) {
        if (!highestUp || c.h > highestUp.h) highestUp = c;
      }
    }
    if (highestUp && last.c < highestUp.o) {
      return { confirmed: true, dir: -1, level: highestUp.o, why: `CISD↓ break ${highestUp.o.toFixed(2)}` };
    }
  }

  return { confirmed: false, dir, level: null, why: 'CISD pending' };
}

// ─── PROJECTION TARGETS (TTrades -2, -4 expansion targets) ──────────
// Anchor: manipulation leg (swing high/low → opposite end of C2 wick or C3 close)
// Target -2 = 2× manipulation leg in direction
// Target -4 = 4× manipulation leg
function projectTargets(swing, currentPrice) {
  if (!swing) return { t2: null, t4: null, legSize: 0 };
  const isBull = swing.type === 'C2_BULL' || swing.type === 'C3_BULL';
  let anchor, manipEnd;
  if (swing.c2) {
    if (isBull) {
      anchor = swing.swingPrice;            // C2 low (manipulation start)
      manipEnd = Math.max(swing.c2.c, swing.c2.o);  // body top
    } else {
      anchor = swing.swingPrice;            // C2 high
      manipEnd = Math.min(swing.c2.c, swing.c2.o);  // body bot
    }
  }
  const legSize = Math.abs(manipEnd - anchor);
  if (legSize < 1e-6) return { t2: null, t4: null, legSize: 0 };
  const sign = isBull ? 1 : -1;
  const t2 = manipEnd + sign * legSize * 2;
  const t4 = manipEnd + sign * legSize * 4;
  return { t2, t4, legSize, anchor, manipEnd };
}

// ─── TTRADES FILTER SCORE ───────────────────────────────────────────
// Returns score contribution + side preference
function scoreTTrades(candles, htfCandles, atrNow) {
  const out = { score: 0, dir: 0, swing: null, cisd: null, targets: null, why: '' };
  if (!CFG.ttradesEnabled) return out;

  // HTF swing (higher conviction) — look at last 10 HTF bars
  let swing = null;
  if (htfCandles && htfCandles.length >= 5) {
    swing = detectTTradesSwing(htfCandles, atrNow, 10);
    if (swing) swing._tf = 'HTF';
  }
  // LTF fallback if no HTF swing
  if (!swing) {
    swing = detectTTradesSwing(candles, atrNow, 8);
    if (swing) swing._tf = 'LTF';
  }

  if (!swing) return out;
  out.swing = swing;

  // CISD confirmation on LTF (current timeframe)
  const cisd = detectCISD(candles, swing);
  out.cisd = cisd;

  // Projections
  out.targets = projectTargets(swing, candles[candles.length - 1].c);

  // Direction & scoring
  const isBull = swing.type === 'C2_BULL' || swing.type === 'C3_BULL';
  out.dir = isBull ? 1 : -1;

  // Base score by swing type + strength
  let s = 0;
  if (swing.type === 'C2_BULL' || swing.type === 'C2_BEAR') s += 8;  // C2 = ideal
  else s += 5;                                                          // C3 = conditional
  if (swing._tf === 'HTF') s += 4;                                      // HTF swing = stronger
  s += Math.min(4, swing.strength * 6);                                 // strength bonus
  if (cisd && cisd.confirmed) s += 4;                                   // CISD confirmation
  if (swing.age != null && swing.age <= 3) s += 2;                      // fresh swing

  out.score = Math.min(CFG.wTTrades || 12, Math.round(s));
  out.why = `${swing.type}${swing._tf === 'HTF' ? '·HTF' : ''}${cisd && cisd.confirmed ? '·CISD✓' : ''}`;
  return out;
}
