import { CFG, ST } from '../state.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v8 — DAILY PROFILE & WEEKLY NARRATIVE
// Globals: detectDailyProfile, detectWeeklyNarrative, isMondayBlocked
// ═══════════════════════════════════════════════════════════════════
// TTrades PDF'дан:
//   - London Reversal: London юқори/паст ҳосил қилади ва қайтади → NY continuation
//   - New York Reversal: London consolidates/opposing run → NY reversal
//   - Invalidation: London експansion қилса → NY'да ишламанг
//
// Weekly Profile:
//   Mon, Tue, Wed бир йўналишда expansion → Thu reversal expected
//   Битта кун expansion бўлмаса → narrative йўқ
//
// Monday Rule:
//   - Monday кам volatil
//   - News йўқ
//   - Олдинги кунлар йўқ → weekly profile applicable эмас
//   → Default: Monday'да T2 setup'лар блок (T1 қолади)
// ═══════════════════════════════════════════════════════════════════

const SESSION_RANGE_UTC = {
  ASIA:    { start: 0,   end: 7 },     // 00-07 UTC
  LONDON:  { start: 7,   end: 12.5 },  // 07-12:30 UTC
  NY:      { start: 12.5, end: 17 },   // 12:30-17 UTC
};

// ─── BUILD SESSION RANGE FROM RECENT CANDLES ───────────────────────
// Returns: {high, low, open, close, candleCount}
function buildSessionRange(candles, sessionKey, currentTime) {
  const range = SESSION_RANGE_UTC[sessionKey];
  if (!range) return null;
  const now = currentTime || (candles.length ? candles[candles.length - 1].epoch * 1000 : Date.now());
  const today = new Date(now);
  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const sessStart = dayStart + range.start * 3600 * 1000;
  const sessEnd = dayStart + range.end * 3600 * 1000;

  const inRange = candles.filter(c => {
    const t = c.epoch * 1000;
    return t >= sessStart && t < sessEnd && t <= now;
  });
  if (inRange.length < 2) return null;
  return {
    high: Math.max(...inRange.map(c => c.h)),
    low: Math.min(...inRange.map(c => c.l)),
    open: inRange[0].o,
    close: inRange[inRange.length - 1].c,
    candleCount: inRange.length,
    rangeSize: Math.max(...inRange.map(c => c.h)) - Math.min(...inRange.map(c => c.l)),
  };
}

// ─── DETECT DAILY PROFILE ───────────────────────────────────────────
// Returns: {profile: 'LONDON_REVERSAL' | 'NY_REVERSAL' | 'EXPANSION' | 'PENDING',
//           dir: +1/-1/0, londonRange, nyValid, why}
function detectDailyProfile(candles, atrNow, currentTime) {
  const out = { profile: 'PENDING', dir: 0, londonRange: null, nyValid: false, why: 'data' };
  if (!candles || candles.length < 30) return out;

  const now = currentTime || candles[candles.length - 1].epoch * 1000;
  const utc = new Date(now).getUTCHours() + new Date(now).getUTCMinutes() / 60;
  const dow = new Date(now).getUTCDay();
  if (dow === 0 || dow === 6) { out.why = 'weekend'; return out; }

  const london = buildSessionRange(candles, 'LONDON', now);
  if (!london) { out.why = 'London data йўқ'; return out; }
  out.londonRange = london;

  // London still active — wait
  if (utc < SESSION_RANGE_UTC.LONDON.end) {
    out.why = 'London ҳали актив';
    return out;
  }

  // Asia range for context
  const asia = buildSessionRange(candles, 'ASIA', now);
  if (!asia) { out.why = 'Asia range йўқ'; return out; }

  // Did London form a high/low and reverse? (=London Reversal)
  // → London high above Asia high AND closed back below mid-range, OR vice versa
  const londonMid = (london.high + london.low) / 2;
  const londonRangeBigEnough = london.rangeSize >= atrNow * 1.5;

  // London Reversal HIGH → expect bearish NY continuation
  if (london.high > asia.high && london.close < londonMid && londonRangeBigEnough) {
    out.profile = 'LONDON_REVERSAL';
    out.dir = -1;
    out.nyValid = utc >= SESSION_RANGE_UTC.NY.start && utc < SESSION_RANGE_UTC.NY.end;
    out.why = 'London пиш yuqori → NY continuation SHORT';
    return out;
  }

  // London Reversal LOW → expect bullish NY continuation
  if (london.low < asia.low && london.close > londonMid && londonRangeBigEnough) {
    out.profile = 'LONDON_REVERSAL';
    out.dir = 1;
    out.nyValid = utc >= SESSION_RANGE_UTC.NY.start && utc < SESSION_RANGE_UTC.NY.end;
    out.why = 'London paст → NY continuation LONG';
    return out;
  }

  // London consolidation / opposing run — NY Reversal candidate
  // London range кам ёки equal AND no clear directional close
  const londonExpanded = Math.abs(london.close - london.open) >= atrNow * 1.0
                        && london.rangeSize >= atrNow * 2.0;
  if (londonExpanded) {
    // London express expansion → invalidate NY
    out.profile = 'EXPANSION';
    out.dir = london.close > london.open ? 1 : -1;
    out.nyValid = false;
    out.why = `London експansion ${out.dir > 0 ? 'BUY' : 'SELL'} → NY participate этмаслик`;
    return out;
  }

  // Else: NY Reversal possible (direction TBD by NY itself)
  out.profile = 'NY_REVERSAL';
  out.dir = 0;  // direction determined when NY runs
  out.nyValid = utc >= SESSION_RANGE_UTC.NY.start && utc < SESSION_RANGE_UTC.NY.end;
  out.why = 'London consolidated → NY reversal каttакоч';

  // If we're in NY, look for NY's opposing run direction
  if (out.nyValid) {
    const ny = buildSessionRange(candles, 'NY', now);
    if (ny && ny.candleCount >= 2) {
      // NY swept London high → expect bearish
      if (ny.high > london.high && ny.close < ny.open) { out.dir = -1; out.why += ' (NY swept London↑)'; }
      else if (ny.low < london.low && ny.close > ny.open) { out.dir = 1; out.why += ' (NY swept London↓)'; }
    }
  }
  return out;
}

// ─── WEEKLY NARRATIVE (Mon/Tue/Wed → Thu reversal) ──────────────────
// Returns: {expectThursdayReversal: bool, weekDir: +1/-1/0, why}
function detectWeeklyNarrative(candles, currentTime) {
  const out = { expectThursdayReversal: false, weekDir: 0, why: 'data' };
  if (!candles || candles.length < 200) return out;
  const now = currentTime || candles[candles.length - 1].epoch * 1000;
  const today = new Date(now);
  const dow = today.getUTCDay();

  // Need at least Mon/Tue/Wed data
  if (dow < 3) { out.why = 'haftaн boshlanishi'; return out; }

  // Get this Monday 00:00 UTC
  const thisDayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const mondayOffset = (dow === 0 ? 6 : dow - 1) * 24 * 3600 * 1000;
  const mondayStart = thisDayUTC - mondayOffset;

  // Build day-candle ranges for Mon, Tue, Wed
  const dayRange = (offsetDays) => {
    const ds = mondayStart + offsetDays * 24 * 3600 * 1000;
    const de = ds + 24 * 3600 * 1000;
    const inDay = candles.filter(c => {
      const t = c.epoch * 1000;
      return t >= ds && t < de;
    });
    if (inDay.length < 3) return null;
    return {
      open: inDay[0].o,
      close: inDay[inDay.length - 1].c,
      dir: inDay[inDay.length - 1].c > inDay[0].o ? 1 : -1,
      expansion: Math.abs(inDay[inDay.length - 1].c - inDay[0].o),
    };
  };

  const mon = dayRange(0), tue = dayRange(1), wed = dayRange(2);
  if (!mon || !tue || !wed) { out.why = 'кунлик data йетарли эмас'; return out; }

  // All three same direction → Thursday counter-week reversal expected
  if (mon.dir === tue.dir && tue.dir === wed.dir) {
    out.expectThursdayReversal = true;
    out.weekDir = mon.dir;
    out.why = `Mon/Tue/Wed ${mon.dir > 0 ? 'UP' : 'DN'} → Thu reversal ${mon.dir > 0 ? 'SELL' : 'BUY'}`;
  } else {
    out.why = 'Mon/Tue/Wed yo\'naлиш бирхил эмас';
  }
  return out;
}

// ─── MONDAY RULE ────────────────────────────────────────────────────
function isMondayBlocked(currentTime) {
  if (!CFG.mondayBlock) return false;
  const now = currentTime || Date.now();
  const dow = new Date(now).getUTCDay();
  return dow === 1;  // Monday
}

// ─── DAILY PROFILE FILTER SCORE ─────────────────────────────────────
// Adds confluence boost when signal direction aligns with daily profile
function scoreDailyProfile(side, currentTime) {
  const out = { score: 0, profile: null, aligned: false, why: '' };
  if (!CFG.dailyProfileEnabled) return out;
  const dp = detectDailyProfile(ST.candles, ST.lastAtr || 1.0, currentTime);
  out.profile = dp;
  if (dp.profile === 'PENDING' || dp.profile === 'EXPANSION') {
    out.why = dp.why;
    return out;
  }
  const isLong = side === 'L';
  // London Reversal: dir is the EXPECTED NY direction (opposite of London move)
  // NY Reversal: dir is the EXPECTED NY reversal direction
  const sigDir = isLong ? 1 : -1;
  if (dp.dir !== 0 && dp.dir === sigDir && dp.nyValid) {
    out.aligned = true;
    out.score = CFG.wDailyProfile || 6;
    out.why = `${dp.profile} ${dp.dir > 0 ? 'BUY' : 'SELL'} confluence`;
  } else if (dp.dir !== 0 && dp.dir !== sigDir) {
    out.aligned = false;
    out.score = -Math.min(4, (CFG.wDailyProfile || 6) / 2);  // penalty against profile
    out.why = `${dp.profile} ${dp.dir > 0 ? 'BUY' : 'SELL'} қарши`;
  }
  return out;
}

export { SESSION_RANGE_UTC, buildSessionRange, detectDailyProfile, detectWeeklyNarrative, isMondayBlocked, scoreDailyProfile };
