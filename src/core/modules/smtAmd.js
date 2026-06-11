import { CFG, ST } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v9 — SMT DIVERGENCE + AMD POWER OF 3
// Globals: detectSMT, detectAMD, scoreSMTandAMD
// ═══════════════════════════════════════════════════════════════════
// SMT (Smart Money Tool) Divergence (ICT'дан):
//   Корреляция қилувчи активлар синхрон ҳаракат қилмаганда signal.
//   - XAUUSD vs AUDUSD (+0.82 corr): birga o'sishi kerak
//     - Agar XAU yangi high yaratса lekin AUD yaratmaса → SMT bearish (XAU SELL)
//     - Agar XAU yangi low yaratса lekin AUD yaratmaса → SMT bullish (XAU BUY)
//   - XAUUSD vs DXY synth (-0.85 corr): teskari harakat kerak
//     - Agar XAU yangi high yaratса va DXY ham yangi high → no inverse → SMT bearish
//     - Agar XAU yangi low yaratса va DXY ham yangi low → no inverse → SMT bullish
//
// AMD POWER OF 3 (ICT Bible'дан):
//   Daily candle = 3 фаза:
//     ACCUMULATION (Asia 00:00-07:00 UTC): kichik range, накопление
//     MANIPULATION (London 07:00-12:30 UTC): Judas swing - false move
//     DISTRIBUTION (NY 12:30-17:00 UTC): asosiy ҳаракат - smart money chiqадi
//   Day classification:
//     "SELL DAY":  high formed in Asia/London, then bearish distribution in NY
//     "BUY DAY":   low formed in Asia/London, then bullish distribution in NY
//     "REVERSAL":  swing high or low formed mid-day with full reversal
//     "CONSOLIDATION": no clear distribution
// ═══════════════════════════════════════════════════════════════════

// ─── SMT DIVERGENCE DETECTOR ────────────────────────────────────────
// Compares XAU swing high/low vs correlated asset's swing
function detectSMT(candles, lookback) {
  const out = { divergences: [], strongest: null };
  if (!candles || candles.length < 20 || !ST.feeds) return out;
  const lb = lookback || 30;
  const recent = candles.slice(-lb);
  const xauRecentHigh = Math.max(...recent.map(c => c.h));
  const xauRecentLow = Math.min(...recent.map(c => c.l));
  const xauHighIdx = recent.length - 1 - [...recent].reverse().findIndex(c => c.h === xauRecentHigh);
  const xauLowIdx = recent.length - 1 - [...recent].reverse().findIndex(c => c.l === xauRecentLow);

  // Check vs AUDUSD (+0.82 correlation)
  const aud = ST.feeds.AUDUSD;
  if (aud && aud.length >= lb) {
    const audRecent = aud.slice(-lb);
    const audRecentHigh = Math.max(...audRecent.map(c => c.h));
    const audRecentLow = Math.min(...audRecent.map(c => c.l));

    // Last 5 bars: did XAU make new high BUT AUD didn't?
    const xauLast5 = recent.slice(-5);
    const audLast5 = audRecent.slice(-5);
    const xauLast5High = Math.max(...xauLast5.map(c => c.h));
    const audLast5High = Math.max(...audLast5.map(c => c.h));
    if (xauLast5High >= xauRecentHigh * 0.999 && audLast5High < audRecentHigh * 0.998) {
      out.divergences.push({
        type: 'SMT_BEAR_AUD', dir: -1, pair: 'AUDUSD',
        why: 'XAU yangi high, AUD yo\'q → bearish',
        strength: (audRecentHigh - audLast5High) / audRecentHigh,
      });
    }
    const xauLast5Low = Math.min(...xauLast5.map(c => c.l));
    const audLast5Low = Math.min(...audLast5.map(c => c.l));
    if (xauLast5Low <= xauRecentLow * 1.001 && audLast5Low > audRecentLow * 1.002) {
      out.divergences.push({
        type: 'SMT_BULL_AUD', dir: 1, pair: 'AUDUSD',
        why: 'XAU yangi low, AUD yo\'q → bullish',
        strength: (audLast5Low - audRecentLow) / audRecentLow,
      });
    }
  }

  // Check vs EURUSD (DXY synthetic — EUR negative corr to DXY, so XAU positive corr to EUR)
  const eur = ST.feeds.EURUSD;
  if (eur && eur.length >= lb) {
    const eurRecent = eur.slice(-lb);
    const eurRecentHigh = Math.max(...eurRecent.map(c => c.h));
    const eurRecentLow = Math.min(...eurRecent.map(c => c.l));
    const eurLast5 = eurRecent.slice(-5);
    const xauLast5 = recent.slice(-5);
    const xauLast5High = Math.max(...xauLast5.map(c => c.h));
    const eurLast5High = Math.max(...eurLast5.map(c => c.h));
    if (xauLast5High >= xauRecentHigh * 0.999 && eurLast5High < eurRecentHigh * 0.998) {
      out.divergences.push({
        type: 'SMT_BEAR_EUR', dir: -1, pair: 'EURUSD',
        why: 'XAU yangi high, EUR yo\'q → bearish',
        strength: 0.7,
      });
    }
    const xauLast5Low = Math.min(...xauLast5.map(c => c.l));
    const eurLast5Low = Math.min(...eurLast5.map(c => c.l));
    if (xauLast5Low <= xauRecentLow * 1.001 && eurLast5Low > eurRecentLow * 1.002) {
      out.divergences.push({
        type: 'SMT_BULL_EUR', dir: 1, pair: 'EURUSD',
        why: 'XAU yangi low, EUR yo\'q → bullish',
        strength: 0.7,
      });
    }
  }

  // Strongest = highest absolute strength
  if (out.divergences.length) {
    out.strongest = out.divergences.reduce((best, d) =>
      (d.strength > (best?.strength || 0)) ? d : best, null);
  }
  return out;
}

// ─── AMD POWER OF 3 DETECTOR ───────────────────────────────────────
// Classifies today's day type based on Asia/London/NY behavior
function detectAMD(candles, currentTime) {
  const out = { day: 'PENDING', dir: 0, asia: null, london: null, ny: null, why: 'data' };
  if (!candles || candles.length < 30) return out;
  const now = currentTime || (candles[candles.length - 1].epoch * 1000);
  const today = new Date(now);
  const dow = today.getUTCDay();
  if (dow === 0 || dow === 6) { out.why = 'weekend'; return out; }

  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const asiaStart = dayStart;
  const asiaEnd = dayStart + 7 * 3600 * 1000;
  const londonEnd = dayStart + 12.5 * 3600 * 1000;
  const nyEnd = dayStart + 17 * 3600 * 1000;

  const asia = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= asiaStart && t < asiaEnd;
  });
  const london = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= asiaEnd && t < londonEnd;
  });
  const ny = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= londonEnd && t < nyEnd;
  });

  if (asia.length < 3) { out.why = 'Asia data yo\'q'; return out; }
  out.asia = {
    high: Math.max(...asia.map(c => c.h)), low: Math.min(...asia.map(c => c.l)),
    open: asia[0].o, close: asia[asia.length - 1].c,
  };
  if (london.length >= 3) {
    out.london = {
      high: Math.max(...london.map(c => c.h)), low: Math.min(...london.map(c => c.l)),
      open: london[0].o, close: london[london.length - 1].c,
    };
  }
  if (ny.length >= 3) {
    out.ny = {
      high: Math.max(...ny.map(c => c.h)), low: Math.min(...ny.map(c => c.l)),
      open: ny[0].o, close: ny[ny.length - 1].c,
    };
  }

  // Wait for at least London to form
  if (!out.london) { out.why = 'London ҳали актив emas'; return out; }

  // Classify day:
  //   SELL DAY: London makes high above Asia, then closes below Asia close (manipulation up, distribution down)
  //   BUY DAY: London makes low below Asia, then closes above Asia close
  //   REVERSAL: London opposite of expected continuation
  //   CONSOLIDATION: London range << Asia range

  const londonAboveAsia = out.london.high > out.asia.high * 1.0005;
  const londonBelowAsia = out.london.low < out.asia.low * 0.9995;
  const londonClosedBearish = out.london.close < out.london.open;
  const londonClosedBullish = out.london.close > out.london.open;

  if (londonAboveAsia && londonClosedBearish) {
    out.day = 'SELL_DAY';
    out.dir = -1;
    out.why = 'London swept Asia high → manipulation up, distribution down kutilmoqda';
  } else if (londonBelowAsia && londonClosedBullish) {
    out.day = 'BUY_DAY';
    out.dir = 1;
    out.why = 'London swept Asia low → manipulation down, distribution up kutilmoqda';
  } else if (londonAboveAsia && londonClosedBullish) {
    out.day = 'TREND_UP';
    out.dir = 1;
    out.why = 'London break above Asia + bullish close = trend kun';
  } else if (londonBelowAsia && londonClosedBearish) {
    out.day = 'TREND_DN';
    out.dir = -1;
    out.why = 'London break below Asia + bearish close = trend kun';
  } else {
    out.day = 'CONSOLIDATION';
    out.dir = 0;
    out.why = 'London range Asia ichida → consolidation';
  }
  return out;
}

// ─── COMBINED SCORE ─────────────────────────────────────────────────
function scoreSMTandAMD(side, candles, currentTime) {
  const out = { score: 0, smt: null, amd: null, why: '' };
  const reasons = [];

  // SMT divergence
  if (CFG.smtEnabled) {
    const smt = detectSMT(candles);
    out.smt = smt;
    const isLong = side === 'L';
    const sigDir = isLong ? 1 : -1;
    const matching = smt.divergences.filter(d => d.dir === sigDir);
    if (matching.length) {
      // 1 SMT = +4, 2 SMT (both AUD and EUR) = +7
      out.score += matching.length >= 2 ? 7 : 4;
      reasons.push(`SMT·${matching.map(d => d.pair).join('+')}`);
    }
  }

  // AMD
  if (CFG.amdEnabled) {
    const amd = detectAMD(candles, currentTime);
    out.amd = amd;
    const sigDir = side === 'L' ? 1 : -1;
    if (amd.dir !== 0 && amd.dir === sigDir) {
      // BUY_DAY/SELL_DAY = +5 (high reliability)
      // TREND_UP/DN = +3 (medium)
      if (amd.day === 'BUY_DAY' || amd.day === 'SELL_DAY') {
        out.score += 5;
        reasons.push(`AMD·${amd.day}`);
      } else if (amd.day === 'TREND_UP' || amd.day === 'TREND_DN') {
        out.score += 3;
        reasons.push(`AMD·${amd.day}`);
      }
    } else if (amd.day === 'CONSOLIDATION') {
      out.score -= 2;  // mild penalty in consolidation
      reasons.push('AMD·CONSOL(−)');
    }
  }

  out.score = Math.min(CFG.wSMTandAMD || 10, Math.max(-3, out.score));
  out.why = reasons.join(' · ');
  return out;
}

export { detectSMT, detectAMD, scoreSMTandAMD };
