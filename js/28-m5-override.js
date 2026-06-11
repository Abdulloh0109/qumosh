// ═══════════════════════════════════════════════════════════════════
// QUMASH v12 — M5 INTRADAY + OVERRIDE HIERARCHY
// Globals: M5_STATE, evaluateM5Reversal, checkOverrideHierarchy
// ═══════════════════════════════════════════════════════════════════
// CONCEPT 1: M5 Intraday Reversals
//   - M5 feed уланади (M15 билан параллел)
//   - M5'да микро-разворотлар: CHoCH, sweep, OB, FVG
//   - M15 HTF confluence — фон, бирим bias
//   - Натижа: 6-15 signal/day (M15 only 1-3)
//
// CONCEPT 2: Override Hierarchy
//   - Strong model triggers override weak filter conflicts
//   - LEVEL 1 (ULTRA, override anything except safety):
//       NEWS_DRIVEN (STRONG_*), STINGER, JUDAS+HLQ×3
//   - LEVEL 2 (HIGH, override session/regime):
//       STINGER alone, JUDAS alone, SMT 2-pair, HLQ×3 alone
//   - LEVEL 3 (MEDIUM, override session quality):
//       CISD+QMR, NEWS_DRIVEN (MILD), Stinger T2 only
//   - SAFETY FLOOR (NEVER override):
//       Drawdown -3R, Volatility ATR×5+, Weekend
// ═══════════════════════════════════════════════════════════════════

const M5_STATE = {
  candles: [],            // M5 candles for XAUUSD
  lastEvalTs: 0,          // last evaluation timestamp
  microSignals: [],       // last 20 M5 micro-signals for logging
};

// ─── M5 DATA INGESTION ──────────────────────────────────────────────
// Push new M5 candle to state. Called by feed handler.
function pushM5Candle(candle) {
  if (!candle || !candle.epoch) return;
  // Avoid duplicates
  const last = M5_STATE.candles[M5_STATE.candles.length - 1];
  if (last && last.epoch === candle.epoch) {
    // Update in place (real-time update)
    M5_STATE.candles[M5_STATE.candles.length - 1] = candle;
  } else {
    M5_STATE.candles.push(candle);
    // Keep max 500 (~ 41 hours of M5)
    if (M5_STATE.candles.length > 500) M5_STATE.candles.shift();
  }
}

// ─── M5 STRUCTURE DETECTION (CHoCH on M5) ───────────────────────────
function detectM5CHoCH(candles, lookback) {
  const out = { detected: false, dir: 0, level: null, why: '' };
  if (!candles || candles.length < 15) return out;
  const lb = lookback || 20;
  const len = 2;
  const recent = candles.slice(-lb);

  // Find last 2 swing highs and 2 swing lows on M5
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
  if (highs.length < 2 || lows.length < 2) return out;

  const cur = candles[candles.length - 1].c;
  const lastH = highs[highs.length - 1];
  const prevH = highs[highs.length - 2];
  const lastL = lows[lows.length - 1];
  const prevL = lows[lows.length - 2];

  // Bullish CHoCH on M5: was downtrending (LL+LH), now broke above last LH
  if (prevH.price > lastH.price && prevL.price > lastL.price) {
    // Was downtrending — check if cur broke above last LH
    if (cur > lastH.price * 1.0003) {
      out.detected = true;
      out.dir = 1;
      out.level = lastH.price;
      out.why = `M5 CHoCH↑ broke LH @${lastH.price.toFixed(1)}`;
    }
  }
  // Bearish CHoCH on M5: was uptrending (HH+HL), now broke below last HL
  if (prevH.price < lastH.price && prevL.price < lastL.price) {
    if (cur < lastL.price * 0.9997) {
      out.detected = true;
      out.dir = -1;
      out.level = lastL.price;
      out.why = `M5 CHoCH↓ broke HL @${lastL.price.toFixed(1)}`;
    }
  }
  return out;
}

// ─── M5 LIQUIDITY SWEEP ─────────────────────────────────────────────
function detectM5Sweep(candles, atrM5) {
  const out = { detected: false, dir: 0, level: null, why: '' };
  if (!candles || candles.length < 10) return out;
  const recent = candles.slice(-12);
  const last = recent[recent.length - 1];
  // Look for swings 8-3 bars back
  const window = recent.slice(0, -2);
  const swingHigh = Math.max(...window.map(c => c.h));
  const swingLow = Math.min(...window.map(c => c.l));

  // Bearish sweep: wick swept high, body closed below
  if (last.h > swingHigh * 1.0002 && last.c < swingHigh) {
    out.detected = true;
    out.dir = -1;
    out.level = swingHigh;
    out.why = `M5 sweep↓ above ${swingHigh.toFixed(1)}`;
  }
  // Bullish sweep: wick swept low, body closed above
  if (last.l < swingLow * 0.9998 && last.c > swingLow) {
    out.detected = true;
    out.dir = 1;
    out.level = swingLow;
    out.why = `M5 sweep↑ below ${swingLow.toFixed(1)}`;
  }
  return out;
}

// ─── M5 FVG ────────────────────────────────────────────────────────
function detectM5FVG(candles) {
  const out = { fvgs: [] };
  if (!candles || candles.length < 5) return out;
  const recent = candles.slice(-15);
  for (let i = 1; i < recent.length - 1; i++) {
    const c1 = recent[i - 1], c2 = recent[i], c3 = recent[i + 1];
    // Bullish FVG: c1.h < c3.l (gap up)
    if (c1.h < c3.l) {
      out.fvgs.push({ type: 'bull', top: c3.l, bot: c1.h, mid: (c3.l + c1.h) / 2, idx: i });
    }
    // Bearish FVG: c1.l > c3.h (gap down)
    if (c1.l > c3.h) {
      out.fvgs.push({ type: 'bear', top: c1.l, bot: c3.h, mid: (c1.l + c3.h) / 2, idx: i });
    }
  }
  return out;
}

// ─── M5 ATR ────────────────────────────────────────────────────────
function calcM5Atr(candles, period) {
  if (!candles || candles.length < (period || 14) + 1) return null;
  const p = period || 14;
  const trs = [];
  for (let i = candles.length - p; i < candles.length; i++) {
    if (i < 1) continue;
    const c = candles[i], prev = candles[i - 1];
    const tr = Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c));
    trs.push(tr);
  }
  return trs.reduce((s, x) => s + x, 0) / trs.length;
}

// ─── EVALUATE M5 REVERSAL (called every M5 candle close) ────────────
// Returns: { hasSignal, side, score, triggers, entry, sl, atr, m5Snap }
function evaluateM5Reversal(htfBias) {
  const out = { hasSignal: false, side: null, score: 0, triggers: [], m5Snap: null };
  if (!CFG.m5Enabled) return out;
  const candles = M5_STATE.candles;
  if (!candles || candles.length < 30) return out;

  const atrM5 = calcM5Atr(candles, 14);
  if (!atrM5) return out;
  const cur = candles[candles.length - 1].c;

  // Build M5 snapshot
  const choch = detectM5CHoCH(candles, 20);
  const sweep = detectM5Sweep(candles, atrM5);
  const fvgs = detectM5FVG(candles).fvgs;

  // ─── LONG side evaluation ──
  const triggersL = [];
  let scoreL = 0;
  if (choch.dir === 1) { triggersL.push('M5_CHoCH'); scoreL += 25; }
  if (sweep.dir === 1) { triggersL.push('M5_SWEEP'); scoreL += 20; }
  const bullFVGs = fvgs.filter(f => f.type === 'bull' && cur >= f.bot - atrM5 * 0.3 && cur <= f.top + atrM5 * 0.3);
  if (bullFVGs.length) { triggersL.push('M5_FVG'); scoreL += 15; }
  // HTF alignment bonus
  if (htfBias === 1) { scoreL += 25; triggersL.push('HTF_align'); }
  else if (htfBias === -1) { scoreL -= 15; }

  // ─── SHORT side evaluation ──
  const triggersS = [];
  let scoreS = 0;
  if (choch.dir === -1) { triggersS.push('M5_CHoCH'); scoreS += 25; }
  if (sweep.dir === -1) { triggersS.push('M5_SWEEP'); scoreS += 20; }
  const bearFVGs = fvgs.filter(f => f.type === 'bear' && cur >= f.bot - atrM5 * 0.3 && cur <= f.top + atrM5 * 0.3);
  if (bearFVGs.length) { triggersS.push('M5_FVG'); scoreS += 15; }
  if (htfBias === -1) { scoreS += 25; triggersS.push('HTF_align'); }
  else if (htfBias === 1) { scoreS -= 15; }

  // Decide direction
  if (scoreL >= 55 && scoreL > scoreS) {
    out.hasSignal = true;
    out.side = 'L';
    out.score = scoreL;
    out.triggers = triggersL;
  } else if (scoreS >= 55 && scoreS > scoreL) {
    out.hasSignal = true;
    out.side = 'S';
    out.score = scoreS;
    out.triggers = triggersS;
  }

  if (out.hasSignal) {
    out.entry = cur;
    out.atr = atrM5;
    // Tight M5 SL: 1× ATR (M5 ATR is small, ~$2-4 for XAU)
    out.sl = out.side === 'L' ? cur - atrM5 * 1.0 : cur + atrM5 * 1.0;
  }
  out.m5Snap = { choch, sweep, fvgs, atrM5, scoreL, scoreS };
  return out;
}

// ─── OVERRIDE HIERARCHY ────────────────────────────────────────────
// Called when gate FAIL but a strong model signal is present.
// Returns: { canOverride, level, why, blockSafety }
function checkOverrideHierarchy(snap, side) {
  const result = {
    canOverride: false,
    level: 0,             // 1 = ULTRA, 2 = HIGH, 3 = MEDIUM
    why: '',
    blockSafety: false,   // if true, NEVER override
  };
  if (!CFG.overrideEnabled) return result;
  const isLong = side === 'L';

  // ─── SAFETY FLOOR — never override these ─────────────
  // 1. Psychology drawdown
  if (typeof checkPsychBlock === 'function') {
    const psych = checkPsychBlock();
    if (psych.block) {
      result.blockSafety = true;
      result.why = 'Safety: ' + psych.reason;
      return result;
    }
  }
  // 2. Volatility extreme (ATR × 5+)
  const atrPct = snap.ind ? (snap.ind.atr / snap.ind.close) * 100 : 0;
  if (CFG.atrPctMax && atrPct > CFG.atrPctMax * 1.5) {
    result.blockSafety = true;
    result.why = `Safety: ATR ${atrPct.toFixed(2)}% extreme`;
    return result;
  }
  // 3. Weekend
  if (snap.ses && snap.ses.session === 'WEEKEND') {
    result.blockSafety = true;
    result.why = 'Safety: weekend';
    return result;
  }

  // ─── LEVEL 1 (ULTRA) — overrides anything except safety ──
  // News-driven STRONG reaction
  const nd = isLong ? snap.ndL : snap.ndS;
  if (nd && nd.score > 0 && nd.active && nd.active.strength.startsWith('STRONG')) {
    result.canOverride = true;
    result.level = 1;
    result.why = `🔥 NEWS_DRIVEN STRONG (${nd.active.event.name || 'News'})`;
    return result;
  }

  // STINGER pattern (T1+T2 nested divergence)
  const div = isLong ? snap.divL : snap.divS;
  if (div && div.stinger && div.stinger.dir === (isLong ? 1 : -1)) {
    result.canOverride = true;
    result.level = 1;
    result.why = `🐝 STINGER (${div.stinger.type})`;
    return result;
  }

  // Judas + HLQ×3 combo
  const kl = isLong ? snap.klL : snap.klS;
  const chl = isLong ? snap.chlL : snap.chlS;
  const judasActive = kl && kl.judas && kl.judas.detected && kl.judas.dir === (isLong ? 1 : -1);
  const hlqStrong = chl && chl.hlq && chl.hlq.zones && chl.hlq.zones.length >= 3;
  if (judasActive && hlqStrong) {
    result.canOverride = true;
    result.level = 1;
    result.why = `⚔️ JUDAS + HLQ×${chl.hlq.zones.length}`;
    return result;
  }

  // ─── LEVEL 2 (HIGH) — overrides session quality + regime + CHOP ──
  if (judasActive) {
    result.canOverride = true;
    result.level = 2;
    result.why = `⚔️ JUDAS swept ${kl.judas.sweptLevel?.name || ''}`;
    return result;
  }
  if (hlqStrong) {
    result.canOverride = true;
    result.level = 2;
    result.why = `🎯 HLQ×${chl.hlq.zones.length} confluence`;
    return result;
  }
  const smt = isLong ? snap.smtAmdL : snap.smtAmdS;
  if (smt && smt.smt && smt.smt.divergences && smt.smt.divergences.length >= 2) {
    result.canOverride = true;
    result.level = 2;
    result.why = `📊 SMT × ${smt.smt.divergences.length} pairs`;
    return result;
  }

  // ─── LEVEL 3 (MEDIUM) — overrides session quality only ──
  // CISD + QMR combo
  const cisdMatch = snap.ttrades && snap.ttrades.cisd && snap.ttrades.cisd.confirmed &&
                    snap.ttrades.dir === (isLong ? 1 : -1);
  const qmrMatch = chl && chl.qmr && chl.qmr.detected && chl.qmr.dir === (isLong ? 1 : -1);
  if (cisdMatch && qmrMatch) {
    result.canOverride = true;
    result.level = 3;
    result.why = `🎯 CISD + QMR combo`;
    return result;
  }
  // News-driven MILD
  if (nd && nd.score > 0 && nd.active && nd.active.strength.startsWith('MILD')) {
    result.canOverride = true;
    result.level = 3;
    result.why = `📰 NEWS_DRIVEN MILD`;
    return result;
  }
  // Stinger T2 alone (kuchsizroq)
  if (div && div.divergences && div.divergences.some(d => d.type.startsWith('T2'))) {
    const t2Match = div.divergences.find(d => d.type.startsWith('T2') && d.dir === (isLong ? 1 : -1));
    if (t2Match) {
      result.canOverride = true;
      result.level = 3;
      result.why = `📊 T2 divergence (continuation)`;
      return result;
    }
  }

  return result;
}

// ─── DECIDE IF OVERRIDE APPLIES TO SPECIFIC GATE FAIL ────────────────
// gateFail = ground truth fail reason. Returns true if override permits passing.
function overrideAppliesToGate(gateFail, overrideLevel) {
  if (!gateFail || overrideLevel === 0) return false;
  const fail = (gateFail || '').toLowerCase();

  // LEVEL 1 (ULTRA): override anything (except safety, which is handled separately)
  if (overrideLevel === 1) {
    // Don't override impossible conditions
    if (fail.includes('weekend') || fail.includes('safety')) return false;
    return true;
  }
  // LEVEL 2 (HIGH): override session, regime, CHOP, sessionFilter
  if (overrideLevel === 2) {
    if (fail.includes('сеанс') || fail.includes('session')) return true;
    if (fail.includes('режим') || fail.includes('regime')) return true;
    if (fail.includes('chop')) return true;
    return false;
  }
  // LEVEL 3 (MEDIUM): override session quality only
  if (overrideLevel === 3) {
    if (fail.includes('сеанс:') || fail.includes('session quality')) return true;
    return false;
  }
  return false;
}
