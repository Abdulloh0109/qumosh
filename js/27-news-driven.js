// ═══════════════════════════════════════════════════════════════════
// QUMASH v11 — NEWS-DRIVEN SIGNAL ENGINE
// Globals: NEWS_REACTIONS, scoreNewsDriven, scanForActiveNewsTrade
// ═══════════════════════════════════════════════════════════════════
// Concept:
//   1. 🔴 High impact news chiqadi (NFP, CPI, FOMC, GDP, Powell)
//   2. T+5 min davomida initial reaction o'qiladi:
//        - ATR×2 dan ko'p harakat = STRONG_USD / STRONG_XAU
//        - ATR×1-2 = MILD_USD / MILD_XAU
//        - <ATR = NON_EVENT (skip)
//   3. T+5..T+45 min ichida:
//        - Reaction yo'nalishida trend confirmation
//        - Fibonacci 50-61.8% retracement
//        - Order Block / FVG hosil bo'lgan
//        - Score >= 50 (v7 base)
//        → NEWS-DRIVEN signal
//   4. Risk: 1.5% (T1 standard) + +20 score bonus alohida
// ═══════════════════════════════════════════════════════════════════

// ─── ACTIVE NEWS TRACKING ───────────────────────────────────────────
// Each entry: { event, time, reactionStart, reactionPeak, reactionDir, reactionStrength, phase }
const NEWS_REACTIONS = {
  active: [],     // ongoing news trades being monitored (T+5..T+45)
  history: [],    // completed reactions for stats
};

// Currency pairs that affect XAU directly
const _XAU_CURRENCY = 'USD';
const _XAU_NEWS_KEYWORDS = [
  'nfp', 'non-farm', 'payroll', 'employment',
  'cpi', 'inflation', 'core cpi', 'pce',
  'fomc', 'fed', 'rate decision', 'interest rate',
  'gdp', 'gross domestic',
  'powell', 'fed chair',
  'unemployment',
  'retail sales', 'ppi', 'durable goods',
  'jobless claims', 'adp',
];

// ─── DETECT IF EVENT IS XAU-RELEVANT ────────────────────────────────
function isXauRelevantNews(event) {
  if (!event) return false;
  if (event.impact !== 'high' && event.impact !== '🔴' && event.impact !== 3) return false;
  if (event.currency && event.currency.toUpperCase() !== _XAU_CURRENCY) return false;
  const name = (event.name || event.title || '').toLowerCase();
  return _XAU_NEWS_KEYWORDS.some(kw => name.includes(kw));
}

// ─── READ POST-NEWS REACTION (T+5 min) ──────────────────────────────
// Reads price action in first 5 minutes after news release
// Returns: { direction, strength, magnitude, phase }
function readPostNewsReaction(candles, newsTimeMs, atrNow) {
  const out = { direction: 0, strength: 'NON_EVENT', magnitude: 0, valid: false };
  if (!candles || candles.length < 5 || !atrNow) return out;

  // Find candle at news time
  const newsCandle = candles.find(c => c.epoch * 1000 >= newsTimeMs);
  if (!newsCandle) return out;
  const startIdx = candles.indexOf(newsCandle);
  // Need at least 1 M15 candle (or 5 min on M5) after news for initial reaction
  const reactionCandles = candles.slice(startIdx, startIdx + 1);
  if (reactionCandles.length < 1) return out;

  const startPrice = reactionCandles[0].o;
  const high = Math.max(...reactionCandles.map(c => c.h));
  const low = Math.min(...reactionCandles.map(c => c.l));
  const endPrice = reactionCandles[reactionCandles.length - 1].c;

  // Determine direction: which side moved more from open?
  const upMove = high - startPrice;
  const downMove = startPrice - low;
  const netMove = endPrice - startPrice;

  // Direction = net close direction (where it settled)
  out.direction = netMove > 0 ? 1 : netMove < 0 ? -1 : 0;
  out.magnitude = Math.abs(netMove);
  out.maxMagnitude = Math.max(upMove, downMove);

  // Strength classification (in ATR units)
  const inAtr = out.magnitude / atrNow;
  if (inAtr >= 2) {
    out.strength = out.direction > 0 ? 'STRONG_XAU' : 'STRONG_USD';
    out.valid = true;
  } else if (inAtr >= 1) {
    out.strength = out.direction > 0 ? 'MILD_XAU' : 'MILD_USD';
    out.valid = true;
  } else {
    out.strength = 'NON_EVENT';
    out.valid = false;
  }

  return out;
}

// ─── REGISTER NEW POST-NEWS REACTION (called T+5 min) ───────────────
function registerNewsReaction(event, reaction, currentTime) {
  if (!reaction.valid) return null;
  const entry = {
    event,
    time: event.time,
    reactionRead: currentTime,
    direction: reaction.direction,           // +1 = bullish XAU, -1 = bearish XAU
    strength: reaction.strength,
    magnitude: reaction.magnitude,
    phase: 'WAITING_RETRACEMENT',            // → ACTIVE_SIGNAL → COMPLETED/EXPIRED
    expiresAt: currentTime + 40 * 60 * 1000, // T+45 min from news
  };
  NEWS_REACTIONS.active.push(entry);
  // Keep only last 5 active to avoid memory bloat
  if (NEWS_REACTIONS.active.length > 5) {
    const expired = NEWS_REACTIONS.active.shift();
    NEWS_REACTIONS.history.unshift(expired);
    if (NEWS_REACTIONS.history.length > 20) NEWS_REACTIONS.history.pop();
  }
  return entry;
}

// ─── SCAN FOR ACTIVE NEWS TRADES ────────────────────────────────────
// Called every M15 candle. Detects news that needs reaction reading or
// is currently in retracement phase.
function scanForActiveNewsTrade(candles, atrNow) {
  if (!CFG.newsDrivenEnabled) return;
  if (!candles || candles.length < 5 || !atrNow) return;
  const now = Date.now();

  // 1) Check past news (CAL.past) within last 45 min — find ones we haven't processed
  if (typeof CAL !== 'undefined' && CAL.past && Array.isArray(CAL.past)) {
    for (const e of CAL.past) {
      if (!isXauRelevantNews(e)) continue;
      const eTime = new Date(e.dateTime || e.time).getTime();
      const elapsed = now - eTime;
      // Process between T+5 and T+10 min (read reaction once after first candle closes)
      if (elapsed >= 5 * 60 * 1000 && elapsed <= 10 * 60 * 1000) {
        // Not yet registered?
        const alreadyTracked = NEWS_REACTIONS.active.some(a => a.time === e.time) ||
                              NEWS_REACTIONS.history.some(h => h.time === e.time);
        if (!alreadyTracked) {
          const reaction = readPostNewsReaction(candles, eTime, atrNow);
          if (reaction.valid) {
            registerNewsReaction(e, reaction, now);
          }
        }
      }
    }
  }

  // 2) Cleanup expired
  NEWS_REACTIONS.active = NEWS_REACTIONS.active.filter(a => now <= a.expiresAt);
}

// ─── DETECT RETRACEMENT FROM NEWS LEVEL ─────────────────────────────
// After initial reaction, check if price retraced 50-61.8% Fib
function detectNewsRetracement(active, candles) {
  if (!active || !candles || candles.length < 5) return { ready: false };
  const newsTime = new Date(active.event.dateTime || active.event.time).getTime();
  const postNews = candles.filter(c => c.epoch * 1000 >= newsTime);
  if (postNews.length < 2) return { ready: false };

  // Find extreme reaction point (peak/trough in reaction direction)
  const newsOpen = postNews[0].o;
  let reactionExtreme;
  if (active.direction > 0) {
    reactionExtreme = Math.max(...postNews.map(c => c.h));
  } else {
    reactionExtreme = Math.min(...postNews.map(c => c.l));
  }
  const reactionRange = Math.abs(reactionExtreme - newsOpen);
  if (reactionRange < 0.01) return { ready: false };

  // Current price vs Fib levels of reaction move
  const cur = candles[candles.length - 1].c;
  const fib50 = active.direction > 0
    ? reactionExtreme - reactionRange * 0.5
    : reactionExtreme + reactionRange * 0.5;
  const fib618 = active.direction > 0
    ? reactionExtreme - reactionRange * 0.618
    : reactionExtreme + reactionRange * 0.618;

  // Is current price in 50-61.8% retracement zone?
  const inZone = active.direction > 0
    ? (cur <= fib50 && cur >= fib618)
    : (cur >= fib50 && cur <= fib618);

  return {
    ready: inZone,
    reactionExtreme,
    fib50, fib618,
    reactionRange,
    currentRetracePct: ((reactionExtreme - cur) / (reactionExtreme - newsOpen) * 100 * (active.direction > 0 ? 1 : -1)).toFixed(1),
  };
}

// ─── NEWS-DRIVEN SIGNAL SCORE ──────────────────────────────────────
// Returns: { score, direction, source, why }
function scoreNewsDriven(side, candles, atrNow) {
  const out = { score: 0, direction: 0, active: null, retracement: null, why: '' };
  if (!CFG.newsDrivenEnabled) return out;
  if (!NEWS_REACTIONS.active.length) return out;

  const sigDir = side === 'L' ? 1 : -1;

  // Find an active news reaction matching trade direction
  for (const active of NEWS_REACTIONS.active) {
    if (active.direction !== sigDir) continue;
    if (active.phase !== 'WAITING_RETRACEMENT' && active.phase !== 'ACTIVE_SIGNAL') continue;

    const retr = detectNewsRetracement(active, candles);
    if (!retr.ready) continue;

    // Match found!
    out.active = active;
    out.retracement = retr;
    out.direction = sigDir;

    // Score calculation:
    //   STRONG reaction = +20 bonus
    //   MILD reaction = +12 bonus
    const baseBonus = active.strength.startsWith('STRONG') ? 20 : 12;
    out.score = Math.min(CFG.wNewsDriven || 20, baseBonus);

    const eventName = (active.event.name || active.event.title || 'News').slice(0, 20);
    out.why = `${eventName} · ${active.strength} · Fib ${retr.currentRetracePct}%`;
    active.phase = 'ACTIVE_SIGNAL';
    break;
  }

  return out;
}

// ─── PRE-FIRE VALIDATION ───────────────────────────────────────────
// Called before fireSignal to confirm news-driven setup still valid
function isNewsDrivenSignalReady(side) {
  if (!CFG.newsDrivenEnabled) return { ready: false };
  if (!NEWS_REACTIONS.active.length) return { ready: false };
  const sigDir = side === 'L' ? 1 : -1;
  const active = NEWS_REACTIONS.active.find(a =>
    a.direction === sigDir && a.phase === 'ACTIVE_SIGNAL'
  );
  if (!active) return { ready: false };
  return { ready: true, active };
}

// ─── METADATA GETTER FOR ALERTS/UI ─────────────────────────────────
function getNewsDrivenMeta(side) {
  const result = isNewsDrivenSignalReady(side);
  if (!result.ready) return null;
  return {
    eventName: result.active.event.name || result.active.event.title,
    strength: result.active.strength,
    direction: result.active.direction > 0 ? 'BULLISH_XAU' : 'BEARISH_XAU',
    magnitude: result.active.magnitude,
    age: ((Date.now() - new Date(result.active.event.dateTime || result.active.event.time).getTime()) / 60000).toFixed(0) + 'm',
  };
}
