// ═══════════════════════════════════════════════════════════════════
// QUMASH v8 — MACRO CONTEXT (XAUUSD_Yangiliklar PDF'дан)
// Globals: detectRiskRegime, buildDailyChecklist
// ═══════════════════════════════════════════════════════════════════
// Kathy Lien yangiliklar PDF'дан 2025-2026 XAUUSD ўзига хослиги:
//   - DXY ~ -0.85 ўрта
//   - AUDUSD ~ +0.82 (toy ҳамкори)
//   - 10Y Treasury ~ -0.75 (yield тушса → oltin yuqori)
//   - USDJPY ~ -0.60 (risk-off да yen ва oltin биргалик)
//   - VIX > 25 → risk-off → oltin yuqori
//
// Risk Regime:
//   RISK_OFF: JPY кучли + аксиялар paст + DXY мухтож → oltin yuqori bias
//   RISK_ON:  Аксиялар yuqori + JPY zaif → oltin bosимda
//   NEUTRAL:  aralash
// ═══════════════════════════════════════════════════════════════════

// ─── DETECT RISK REGIME ─────────────────────────────────────────────
// Uses existing correlation feeds (ST.feeds) to determine risk sentiment
// Returns: {regime: 'RISK_OFF'|'RISK_ON'|'NEUTRAL', score: -1..+1 (positive = bullish gold), why}
function detectRiskRegime(currentTime) {
  const out = { regime: 'NEUTRAL', score: 0, components: {}, why: '' };
  if (!ST.feeds) return out;

  // Helper: pct change at currentTime
  const ch = (k, n = 10) => {
    const f = ST.feeds[k];
    if (!f || f.length < n + 1) return null;
    let endIdx = f.length - 1;
    if (currentTime != null) {
      while (endIdx >= 0 && (f[endIdx].epoch * 1000) > currentTime) endIdx--;
    }
    if (endIdx < n) return null;
    return (f[endIdx].c - f[endIdx - n].c) / f[endIdx - n].c;
  };

  // 1) USDJPY tushishi = Yen кучли = risk-off = gold bullish (+)
  const dJpy = ch('USDJPY', 10);
  if (dJpy !== null) {
    const w = -dJpy * 50;  // JPY кучли → +score
    out.components.usdjpy = w;
    out.score += w * 0.25;
  }

  // 2) AUDUSD ko'tarilishi = risk-on commodity demand = gold bullish (+)
  // Lekin commodity demand холиси сезgir, кам вазн
  const dAud = ch('AUDUSD', 10);
  if (dAud !== null) {
    const w = dAud * 50;
    out.components.audusd = w;
    out.score += w * 0.15;
  }

  // 3) EUR/USD ko'tarilishi = DXY zaif = gold bullish (+)
  const dEur = ch('EURUSD', 10);
  if (dEur !== null) {
    const w = dEur * 50;
    out.components.eurusd = w;
    out.score += w * 0.25;
  }

  // 4) USDCHF tushishi = CHF safe-haven кучли = risk-off = gold bullish (+)
  const dChf = ch('USDCHF', 10);
  if (dChf !== null) {
    const w = -dChf * 50;
    out.components.usdchf = w;
    out.score += w * 0.2;
  }

  // 5) AUDJPY tushishi = classic risk-off proxy = gold bullish (+)
  const dAJ = ch('AUDJPY', 10);
  if (dAJ !== null) {
    const w = -dAJ * 50;
    out.components.audjpy_riskoff = w;
    out.score += w * 0.15;
  }

  // Normalize score to [-1, +1]
  out.score = Math.max(-1, Math.min(1, out.score));

  if (out.score > 0.3) { out.regime = 'RISK_OFF'; out.why = 'JPY/CHF кучли, AUDJPY pasт → safe haven'; }
  else if (out.score < -0.3) { out.regime = 'RISK_ON'; out.why = 'risk asset rally → oltin bosимda'; }
  else { out.regime = 'NEUTRAL'; out.why = 'aralash sentiment'; }
  return out;
}

// ─── DAILY 10-QUESTION CHECKLIST (Kathy Lien PDF'дан) ───────────────
// Returns array of {q, answer, signal: 'bull'|'bear'|'neutral', detail}
function buildDailyChecklist(currentTime) {
  const items = [];
  const ch = (k, n = 10) => {
    const f = ST.feeds && ST.feeds[k];
    if (!f || f.length < n + 1) return null;
    let endIdx = f.length - 1;
    if (currentTime != null) {
      while (endIdx >= 0 && (f[endIdx].epoch * 1000) > currentTime) endIdx--;
    }
    if (endIdx < n) return null;
    return ((f[endIdx].c - f[endIdx - n].c) / f[endIdx - n].c) * 100;
  };

  // 1) DXY (synth) йўналиши
  const dxyDir = (() => {
    const e = ch('EURUSD', 20), j = ch('USDJPY', 20), g = ch('GBPUSD', 20);
    if (e === null || j === null || g === null) return null;
    return -(e + g) * 0.5 + j * 0.5;  // synth DXY
  })();
  if (dxyDir !== null) {
    items.push({
      q: '1. DXY йўналиши?',
      answer: dxyDir < -0.3 ? `pasт ${dxyDir.toFixed(2)}%` : dxyDir > 0.3 ? `yuqori ${dxyDir.toFixed(2)}%` : `flat ${dxyDir.toFixed(2)}%`,
      signal: dxyDir < -0.3 ? 'bull' : dxyDir > 0.3 ? 'bear' : 'neutral',
      detail: 'DXY pasт = oltin bullish',
    });
  }

  // 2) AUDUSD (+0.82 corr)
  const audDir = ch('AUDUSD', 20);
  if (audDir !== null) {
    items.push({
      q: '2. AUDUSD йўналиши?',
      answer: audDir > 0.1 ? `yuqori ${audDir.toFixed(2)}%` : audDir < -0.1 ? `pasт ${audDir.toFixed(2)}%` : 'flat',
      signal: audDir > 0.1 ? 'bull' : audDir < -0.1 ? 'bear' : 'neutral',
      detail: 'AUD yuqori = oltin tasdiqlash',
    });
  }

  // 3) Risk regime
  const risk = detectRiskRegime(currentTime);
  items.push({
    q: '3. Risk Regime?',
    answer: risk.regime,
    signal: risk.score > 0.2 ? 'bull' : risk.score < -0.2 ? 'bear' : 'neutral',
    detail: risk.why,
  });

  // 4) JPY кучлилиги (safe-haven proxy)
  const jpyChg = ch('USDJPY', 20);
  if (jpyChg !== null) {
    items.push({
      q: '4. JPY (safe-haven)?',
      answer: jpyChg < -0.2 ? `кучли (USDJPY ${jpyChg.toFixed(2)}%)` : 'oddiy',
      signal: jpyChg < -0.2 ? 'bull' : 'neutral',
      detail: 'JPY кучли = risk-off = oltin bullish',
    });
  }

  // 5) High-impact news bugun?
  if (typeof CAL !== 'undefined' && CAL.events) {
    const now = currentTime || Date.now();
    const today = new Date(now);
    const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const dayEnd = dayStart + 24 * 3600 * 1000;
    const todayEvents = CAL.events.filter(e => {
      const t = e.date.getTime();
      return t >= dayStart && t < dayEnd && (e.impact === 'high' || e.impact === 'High');
    });
    items.push({
      q: '5. Бугун high-impact news?',
      answer: todayEvents.length ? `${todayEvents.length} та: ${todayEvents.slice(0, 2).map(e => e.name).join(', ')}` : 'йўқ',
      signal: 'neutral',
      detail: todayEvents.length ? 'Эҳтиёт бўлинг, янгилик yaqin' : 'тоза кун',
    });
  }

  // 6) Сеанс
  if (typeof detectSession === 'function') {
    const sess = detectSession(currentTime);
    items.push({
      q: '6. Қайси сеанс?',
      answer: sess.txt || sess.session,
      signal: sess.quality >= 0.8 ? 'bull' : sess.quality <= 0.4 ? 'bear' : 'neutral',
      detail: `Sifat: ${(sess.quality * 100).toFixed(0)}%`,
    });
  }

  // 7) Регим (XAUUSD'нинг ўзи)
  if (ST.candles && ST.candles.length > 60 && typeof detectRegime === 'function') {
    const reg = detectRegime(ST.candles);
    items.push({
      q: '7. XAUUSD режими?',
      answer: reg.kind,
      signal: reg.kind === 'CHOP' ? 'bear' : 'neutral',
      detail: `H=${reg.hurst?.toFixed(2)} ATR%=${(reg.atrPct * 100).toFixed(0)}%`,
    });
  }

  // 8) Daily Profile
  if (typeof detectDailyProfile === 'function' && ST.candles && ST.candles.length > 30) {
    const dp = detectDailyProfile(ST.candles, ST.lastAtr || 1.0, currentTime);
    items.push({
      q: '8. Daily Profile?',
      answer: dp.profile,
      signal: dp.dir > 0 ? 'bull' : dp.dir < 0 ? 'bear' : 'neutral',
      detail: dp.why,
    });
  }

  // 9) Weekly Narrative
  if (typeof detectWeeklyNarrative === 'function' && ST.candles && ST.candles.length > 200) {
    const wn = detectWeeklyNarrative(ST.candles, currentTime);
    items.push({
      q: '9. Hafта narrative?',
      answer: wn.expectThursdayReversal ? `Thu reversal kutилмоқда` : 'аниқ эмас',
      signal: 'neutral',
      detail: wn.why,
    });
  }

  // 10) Monday rule
  const now = currentTime || Date.now();
  const dow = new Date(now).getUTCDay();
  items.push({
    q: '10. Bugun Monday?',
    answer: dow === 1 ? 'ҲА — эҳтиёт бўлинг' : 'йўқ',
    signal: dow === 1 ? 'bear' : 'bull',
    detail: dow === 1 ? 'TTrades qoidasi: Monday avoid' : 'савдо кунги',
  });

  return items;
}

// ─── MACRO BIAS SCORE ───────────────────────────────────────────────
// Returns score contribution for signal direction based on macro context
function scoreMacroContext(side, currentTime) {
  const out = { score: 0, risk: null, why: '' };
  if (!CFG.macroContextEnabled) return out;
  const risk = detectRiskRegime(currentTime);
  out.risk = risk;
  const isLong = side === 'L';
  // Long: бизга RISK_OFF керак (gold safe haven)
  // Short: бизга RISK_ON керак (gold bosимda)
  if (isLong && risk.score > 0.3) {
    out.score = Math.round((CFG.wMacro || 4) * Math.min(1, risk.score));
    out.why = `Macro: RISK_OFF (${risk.score.toFixed(2)})`;
  } else if (!isLong && risk.score < -0.3) {
    out.score = Math.round((CFG.wMacro || 4) * Math.min(1, -risk.score));
    out.why = `Macro: RISK_ON (${risk.score.toFixed(2)})`;
  } else if (isLong && risk.score < -0.5) {
    out.score = -2;
    out.why = `Macro: kuchli RISK_ON (qarши)`;
  } else if (!isLong && risk.score > 0.5) {
    out.score = -2;
    out.why = `Macro: kuchli RISK_OFF (qarши)`;
  }
  return out;
}
