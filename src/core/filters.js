import { CFG, ST, FILTERS, REGIMES } from './state.js';
import { IND } from './indicators.js';
import { CAL } from './calendar.js';
import { MACRO, getMacroChangeAt } from '../services/macro.js';
import { log, clamp, nowMs } from './utils.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v7 — REVERSAL HUNTER FILTERS
// Globals: detectRegime, detectLiquiditySweep, computeCorrelation, etc.
// ═══════════════════════════════════════════════════════════════════
// Bitta mukammal tuning qilingan rejim. soft/medium/hard preset'lar
// olib tashlandi — konfiguratsiyani 01-config.js'da qarang.
// ═══════════════════════════════════════════════════════════════════

// ─── LAYER 1: REGIME ENGINE ──────────────────────────────────────────
function detectRegime(candles) {
  if (candles.length < CFG.hurstWindow + 10) return {kind:'CHOP', confidence:0, hurst:0.5, atrPct:0, why:'data'};
  const closes = candles.map(x => x.c), highs = candles.map(x => x.h), lows = candles.map(x => x.l);
  const H = IND.hurst(closes, CFG.hurstWindow);
  const atr = IND.atrSeries(highs, lows, closes, CFG.atrLen);
  const lastAtr = atr[atr.length - 1] || 0;
  const atrSlice = atr.slice(-100).filter(v => v !== null);
  let rank = 0;
  for (const v of atrSlice) if (v <= lastAtr) rank++;
  const atrPct = atrSlice.length ? rank / atrSlice.length : 0;
  const ema50 = IND.emaSeries(closes, 50);
  const ema200 = IND.emaSeries(closes, 200);
  const e50 = ema50[ema50.length - 1];
  const e200 = ema200[ema200.length - 1];
  const e50Slope = (ema50[ema50.length - 1] || 0) - (ema50[ema50.length - 6] || 0);
  const recent = candles.slice(-20);
  let bodySum = 0, rangeSum = 0;
  for (const c of recent) { bodySum += Math.abs(c.c-c.o); rangeSum += c.h-c.l; }
  const bodyRatio = rangeSum ? bodySum / rangeSum : 0;
  let kind = 'CHOP', confidence = 0, why = '';
  const trendUp = e50 && e200 && e50 > e200 && e50Slope > 0;
  const trendDn = e50 && e200 && e50 < e200 && e50Slope < 0;
  if (H > 0.58 && bodyRatio > 0.45 && atrPct > 0.4) {
    if (trendUp) { kind='TREND_UP'; confidence=Math.min(1,(H-0.5)*2+bodyRatio*0.5); why=`H=${H.toFixed(2)} body=${(bodyRatio*100).toFixed(0)}%`; }
    else if (trendDn) { kind='TREND_DN'; confidence=Math.min(1,(H-0.5)*2+bodyRatio*0.5); why=`H=${H.toFixed(2)} body=${(bodyRatio*100).toFixed(0)}%`; }
    else { kind='CHOP'; confidence=0.3; why='H high but EMAs flat'; }
  } else if (H < 0.42 && atrPct < 0.5) {
    kind='RANGE'; confidence=Math.min(1, (0.5-H)*2.5); why=`H=${H.toFixed(2)} mean-rev`;
  } else if (bodyRatio < 0.3 || atrPct < 0.25) {
    kind='CHOP'; confidence=0.5; why=`body=${(bodyRatio*100).toFixed(0)}% atr=${(atrPct*100).toFixed(0)}%`;
  } else {
    kind = trendUp ? 'TREND_UP' : trendDn ? 'TREND_DN' : 'RANGE';
    confidence = 0.4; why = 'aralash';
  }
  return {kind, confidence, hurst:H, atrPct, bodyRatio, why};
}

// ─── LAYER 2: LIQUIDITY SWEEP ────────────────────────────────────────
function detectLiquiditySweep(candles, atrNow) {
  if (candles.length < 20) return {detected:false, dir:0, level:null, why:'data'};
  const last = candles[candles.length-1];
  const prev = candles.slice(-30, -1);
  const recentHigh = Math.max(...prev.slice(-15).map(c => c.h));
  const recentLow = Math.min(...prev.slice(-15).map(c => c.l));
  const closeBack = atrNow * CFG.sweepCloseBackTolATR;
  if (last.h > recentHigh && last.c < recentHigh - closeBack && last.c < last.o)
    return {detected:true, dir:-1, level:recentHigh, why:`Sell sweep @${recentHigh.toFixed(2)}`};
  if (last.l < recentLow && last.c > recentLow + closeBack && last.c > last.o)
    return {detected:true, dir:1, level:recentLow, why:`Buy sweep @${recentLow.toFixed(2)}`};
  return {detected:false, dir:0, level:null, why:'yoʻq'};
}

// ─── LAYER 3: DXY CORRELATION ────────────────────────────────────────
function computeCorrelation(currentTime) {
  const out = {dxy:null, dxyDir:'flat', risk:null, riskDir:'flat', safe:null, safeDir:'flat', yields:null, yieldsDir:'flat', verdict:'flat', verdictTxt:'MAʼLUMOT YIGʻILMOQDA', divergence:0, bullScore:0, bearScore:0, source:'synth'};
  const need = ['EURUSD','USDJPY','GBPUSD'];
  for (const k of need) if (!ST.feeds[k] || ST.feeds[k].length < 20) return out;
  // Helper: pct change at currentTime (latest if undefined)
  const ch = (k, n=5) => {
    const f = ST.feeds[k];
    if (!f || f.length < n+1) return null;
    let endIdx = f.length - 1;
    if (currentTime != null) {
      while (endIdx >= 0 && (f[endIdx].epoch * 1000) > currentTime) endIdx--;
    }
    if (endIdx < n) return null;
    return (f[endIdx].c - f[endIdx-n].c) / f[endIdx-n].c;
  };
  const dEur=ch('EURUSD'), dJpy=ch('USDJPY'), dGbp=ch('GBPUSD'), dCad=ch('USDCAD'), dChf=ch('USDCHF'), dAJ=ch('AUDJPY'), dEJ=ch('EURJPY');
  // XAU at current time
  let dXau = 0;
  if (ST.candles.length > 6) {
    let endIdx = ST.candles.length - 1;
    if (currentTime != null) while (endIdx >= 0 && (ST.candles[endIdx].epoch * 1000) > currentTime) endIdx--;
    if (endIdx >= 5) dXau = (ST.candles[endIdx].c - ST.candles[endIdx-5].c) / ST.candles[endIdx-5].c;
  }
  // ⭐ REAL DXY (Yahoo Finance) — fallback to synth
  if (typeof MACRO !== 'undefined' && MACRO.dxy.history && MACRO.dxy.history.length > 0) {
    const dxyChange = getMacroChangeAt(MACRO.dxy, currentTime, 30 * 60 * 1000); // 30-min change
    if (dxyChange !== null) {
      out.dxy = dxyChange;
      out.dxyDir = dxyChange > 0.05 ? 'up' : dxyChange < -0.05 ? 'dn' : 'flat';
      out.source = 'real';
    }
  }
  if (out.dxy === null && dEur !== null && dJpy !== null && dGbp !== null) {
    // Synth fallback
    const d = (-0.60*dEur + 0.14*dJpy - 0.12*dGbp + 0.10*(dCad??0) + 0.04*(dChf??0)) * 100;
    out.dxy=d; out.dxyDir = d>0.05?'up':d<-0.05?'dn':'flat';
  }
  // ⭐ REAL US10Y yield change (Yahoo Finance ^TNX)
  if (typeof MACRO !== 'undefined' && MACRO.us10y.history && MACRO.us10y.history.length > 0) {
    const us10yChange = getMacroChangeAt(MACRO.us10y, currentTime, 30 * 60 * 1000);
    if (us10yChange !== null) {
      out.yields = us10yChange;
      out.yieldsDir = us10yChange > 0.1 ? 'up' : us10yChange < -0.1 ? 'dn' : 'flat';
    }
  }
  if (out.yields === null && dJpy !== null) {
    out.yields = dJpy * 100;
    out.yieldsDir = out.yields > 0.05 ? 'up' : out.yields < -0.05 ? 'dn' : 'flat';
  }
  if (dAJ !== null && dEJ !== null) { const d=((dAJ+dEJ)/2)*100; out.risk=d; out.riskDir=d>0.05?'up':d<-0.05?'dn':'flat'; }
  if (dJpy !== null && dChf !== null) { const d=(-((dJpy+(dChf??0))/2))*100; out.safe=d; out.safeDir=d>0.05?'up':d<-0.05?'dn':'flat'; }
  let bull=0, bear=0;
  if (out.dxyDir==='dn') bull++; if (out.dxyDir==='up') bear++;
  if (out.yieldsDir==='dn') bull++; if (out.yieldsDir==='up') bear++;
  if (out.safeDir==='up') bull++; if (out.safeDir==='dn') bear++;
  if (out.riskDir==='dn') bull++; if (out.riskDir==='up') bear++;
  if (bull >= 3 && bear <= 1) { out.verdict='bull'; out.verdictTxt='BULLISH XAU (+haven)'; }
  else if (bear >= 3 && bull <= 1) { out.verdict='bear'; out.verdictTxt='BEARISH XAU (USD/yields)'; }
  else if (Math.abs(bull-bear) <= 1) { out.verdict='mix'; out.verdictTxt='MIXED — feykaut zona'; }
  else { out.verdict='flat'; out.verdictTxt='tinch'; }
  out.bullScore=bull; out.bearScore=bear;
  if (dXau !== null && out.dxy !== null) out.divergence = Math.abs((dXau*100) + out.dxy);
  return out;
}

// ─── LAYER 4: PREMIUM/DISCOUNT ───────────────────────────────────────
function detectPremiumDiscount(candles) {
  if (candles.length < CFG.swingLookback) return {pos:0.5, zone:'mid', swingH:null, swingL:null};
  const win = candles.slice(-CFG.swingLookback);
  const swingH = Math.max(...win.map(c => c.h));
  const swingL = Math.min(...win.map(c => c.l));
  if (swingH <= swingL) return {pos:0.5, zone:'mid', swingH, swingL};
  const cur = candles[candles.length-1].c;
  const pos = (cur - swingL) / (swingH - swingL);
  let zone = 'mid';
  if (pos > 0.62) zone = 'premium';
  else if (pos < 0.38) zone = 'discount';
  return {pos, zone, swingH, swingL};
}

// ─── LAYER 5: SESSION ────────────────────────────────────────────────
function detectSession(currentTime) {
  const now = currentTime != null ? new Date(currentTime) : new Date();
  const utc = now.getUTCHours() + now.getUTCMinutes()/60;
  const dow = now.getUTCDay();
  // Helper: convert UTC end-hour to user's local time string
  const tzH = -now.getTimezoneOffset() / 60;
  const localEnd = (utcEnd) => {
    let h = utcEnd + tzH;
    while (h >= 24) h -= 24;
    while (h < 0) h += 24;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };

  if (dow === 0 || dow === 6) return {session:'WEEKEND', quality:0, txt:'Dam olish'};
  if (dow === 5 && utc >= 16) return {session:'FRI_LATE', quality:0.2, txt:'Juma oxiri ⚠️'};
  if (utc >= 7 && utc < 10) return {session:'LONDON', quality:1.0, txt:`London ✅ → ${localEnd(10)}`};
  if (utc >= 12.5 && utc < 15.5) return {session:'NY', quality:1.0, txt:`NY ✅ → ${localEnd(15.5)}`};
  if (utc >= 15.5 && utc < 17) return {session:'NY_AFTER', quality:0.7, txt:`NY keyin → ${localEnd(17)}`};
  if (utc >= 10 && utc < 12.5) return {session:'LUNCH', quality:0.4, txt:`Tush — feykaut → ${localEnd(12.5)}`};
  if (utc >= 0 && utc < 7) return {session:'ASIA', quality:0.5, txt:`Osiyo → ${localEnd(7)}`};
  if (utc >= 17) return {session:'LATE', quality:0.3, txt:`Kech → ${localEnd(24)}`};
  return {session:'OTHER', quality:0.5, txt:'boshqa'};
}

// ─── LAYER 6: NEWS BLACKOUT ──────────────────────────────────────────
// Faqat HIGH impact iventlarni bloklaydi (low/med — bozor reaktsiyasi kam)
function detectNews(currentTime) {
  if (!CFG.newsBlock) return {clear:true, txt:'filtr oʻchiq', minutes:999};
  const now = currentTime != null ? currentTime : nowMs();
  const beforeMs = (CFG.newsBlockBefore || 10) * 60 * 1000;
  const afterMs = (CFG.newsBlockAfter || 3) * 60 * 1000;
  for (const ev of CAL.events) {
    // ⭐ FAQAT HIGH impact va USD/EUR/GBP — past taʼsirlisi bloklamaydi
    if (ev.impact !== 'high') continue;
    const evTime = ev.date.getTime();
    const diff = evTime - now;
    // Block window: [-afterMs ... +beforeMs] from event (event in past = -, future = +)
    if ((diff >= 0 && diff <= beforeMs) || (diff < 0 && Math.abs(diff) <= afterMs)) {
      const diffMin = Math.round(diff / 60000);
      return {clear:false, txt:`🚨 ${ev.name} ${diff>0?'+':''}${diffMin}min`, minutes:Math.abs(diffMin), event:ev.name};
    }
  }
  return {clear:true, txt:'toza', minutes:999};
}

// ─── LAYER 7: EQUAL HIGHS/LOWS (LIQUIDITY MAGNETS) ───────────────────
function detectLiquidityMagnets(candles, atrNow) {
  if (candles.length < 30) return {magnets:[], nearestAbove:null, nearestBelow:null};
  const {ph, pl} = IND.pivots(candles.map(c => c.h), candles.map(c => c.l), CFG.swingLen);
  const tol = atrNow * CFG.equalLevelTolATR;
  const highs = ph.map((v,i) => v !== null ? {price:v, idx:i} : null).filter(Boolean);
  const lows = pl.map((v,i) => v !== null ? {price:v, idx:i} : null).filter(Boolean);
  const cur = candles[candles.length-1].c;
  const magnets = [];
  for (let i = 0; i < highs.length; i++) {
    let count = 1;
    for (let j = i+1; j < highs.length; j++) if (Math.abs(highs[j].price - highs[i].price) < tol) count++;
    if (count >= 2) magnets.push({type:'EQH', price:highs[i].price, count, dir:-1});
  }
  for (let i = 0; i < lows.length; i++) {
    let count = 1;
    for (let j = i+1; j < lows.length; j++) if (Math.abs(lows[j].price - lows[i].price) < tol) count++;
    if (count >= 2) magnets.push({type:'EQL', price:lows[i].price, count, dir:1});
  }
  const dedup = [];
  for (const m of magnets) {
    const exists = dedup.find(d => d.type === m.type && Math.abs(d.price - m.price) < tol);
    if (!exists) dedup.push(m);
  }
  const above = dedup.filter(m => m.price > cur).sort((a,b) => a.price - b.price)[0] || null;
  const below = dedup.filter(m => m.price < cur).sort((a,b) => b.price - a.price)[0] || null;
  return {magnets:dedup, nearestAbove:above, nearestBelow:below};
}

// ─── LAYER 8: MSS / BOS / CHoCH ──────────────────────────────────────
// Track confirmed swing highs/lows. Detect when price breaks them.
// BOS = break in trend direction (continuation)
// CHoCH = break opposite to trend (reversal start)
// MSS = first structure break (when no clear trend)
function detectStructure(candles) {
  const len = CFG.swingLen;
  if (candles.length < len * 4) return {bias:'unknown', event:null, lastSwingH:null, lastSwingL:null};
  const {ph, pl} = IND.pivots(candles.map(c=>c.h), candles.map(c=>c.l), len);
  // Last 5 swing highs / lows
  const swingHighs = [], swingLows = [];
  for (let i = ph.length - 1; i >= 0; i--) {
    if (ph[i] !== null && swingHighs.length < 5) swingHighs.unshift({idx:i, price:ph[i]});
    if (pl[i] !== null && swingLows.length < 5) swingLows.unshift({idx:i, price:pl[i]});
    if (swingHighs.length >= 5 && swingLows.length >= 5) break;
  }
  if (swingHighs.length < 2 || swingLows.length < 2) return {bias:'unknown', event:null, lastSwingH:null, lastSwingL:null};
  // Trend = HH+HL = up, LH+LL = down
  const lastH = swingHighs[swingHighs.length-1].price, prevH = swingHighs[swingHighs.length-2].price;
  const lastL = swingLows[swingLows.length-1].price, prevL = swingLows[swingLows.length-2].price;
  const isUp = lastH > prevH && lastL > prevL;
  const isDn = lastH < prevH && lastL < prevL;
  // Most recent confirmed pivot index
  const latestPivotIdx = Math.max(swingHighs[swingHighs.length-1].idx, swingLows[swingLows.length-1].idx);
  const after = candles.slice(latestPivotIdx);
  const maxAfter = Math.max(...after.map(c => c.h));
  const minAfter = Math.min(...after.map(c => c.l));
  let event = null, eventDir = 0;
  if (isUp) {
    if (maxAfter > lastH) { event='BOS_UP'; eventDir=1; }
    else if (minAfter < lastL) { event='CHoCH_DN'; eventDir=-1; }
  } else if (isDn) {
    if (minAfter < lastL) { event='BOS_DN'; eventDir=-1; }
    else if (maxAfter > lastH) { event='CHoCH_UP'; eventDir=1; }
  } else {
    if (maxAfter > lastH) { event='MSS_UP'; eventDir=1; }
    else if (minAfter < lastL) { event='MSS_DN'; eventDir=-1; }
  }
  return {
    bias: isUp ? 'up' : isDn ? 'dn' : 'mixed',
    event, eventDir,
    lastSwingH:lastH, lastSwingL:lastL,
    swingHighs, swingLows,
  };
}

// ─── LAYER 9: ORDER BLOCK ────────────────────────────────────────────
// OB = last opposite candle BEFORE strong displacement (>1.2 ATR body)
function detectOrderBlocks(candles, atrNow) {
  if (candles.length < CFG.obLookback || !atrNow) return {bullishOBs:[], bearishOBs:[], activeBull:null, activeBear:null};
  const obs = [];
  const start = Math.max(1, candles.length - CFG.obLookback);
  for (let i = start; i < candles.length - 1; i++) {
    const c = candles[i];
    const body = Math.abs(c.c - c.o);
    if (body < CFG.obDisplacementATR * atrNow) continue;
    const isBull = c.c > c.o;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const pc = candles[j];
      if (isBull && pc.c < pc.o) {
        obs.push({type:'BULL', idx:j, top:pc.h, bot:pc.l, mid:(pc.h+pc.l)/2, mitigated:false, displacementIdx:i});
        break;
      } else if (!isBull && pc.c > pc.o) {
        obs.push({type:'BEAR', idx:j, top:pc.h, bot:pc.l, mid:(pc.h+pc.l)/2, mitigated:false, displacementIdx:i});
        break;
      }
    }
  }
  // Mitigation check
  for (const ob of obs) {
    for (let i = ob.displacementIdx + 1; i < candles.length; i++) {
      const c = candles[i];
      if (ob.type === 'BULL' && c.l <= ob.top) { ob.mitigated = true; break; }
      if (ob.type === 'BEAR' && c.h >= ob.bot) { ob.mitigated = true; break; }
    }
  }
  const cur = candles[candles.length-1].c;
  const bullishUnm = obs.filter(o => o.type === 'BULL' && !o.mitigated && o.top < cur);
  const bearishUnm = obs.filter(o => o.type === 'BEAR' && !o.mitigated && o.bot > cur);
  const activeBull = bullishUnm.sort((a,b) => b.top - a.top)[0] || null; // closest below
  const activeBear = bearishUnm.sort((a,b) => a.bot - b.bot)[0] || null; // closest above
  return {bullishOBs:bullishUnm, bearishOBs:bearishUnm, activeBull, activeBear};
}

// ─── LAYER 10: FIBONACCI OTE ─────────────────────────────────────────
// OTE = 0.62-0.79 retracement of last meaningful swing
function detectOTE(candles) {
  const len = CFG.swingLen;
  if (candles.length < len * 3) return {inOTE:false, dir:0, oteLow:null, oteHigh:null, lastSwingH:null, lastSwingL:null};
  const {ph, pl} = IND.pivots(candles.map(c=>c.h), candles.map(c=>c.l), len);
  let lastSwingH = null, lastSwingL = null, hIdx = -1, lIdx = -1;
  for (let i = ph.length - 1; i >= 0; i--) {
    if (ph[i] !== null && hIdx === -1) { lastSwingH = ph[i]; hIdx = i; }
    if (pl[i] !== null && lIdx === -1) { lastSwingL = pl[i]; lIdx = i; }
    if (lastSwingH !== null && lastSwingL !== null) break;
  }
  if (lastSwingH === null || lastSwingL === null) return {inOTE:false, dir:0, oteLow:null, oteHigh:null, lastSwingH, lastSwingL};
  const isUpImpulse = hIdx > lIdx;
  const cur = candles[candles.length-1].c;
  const range = lastSwingH - lastSwingL;
  let oteLow, oteHigh, dir;
  if (isUpImpulse) {
    oteLow = lastSwingH - CFG.oteHigh * range;
    oteHigh = lastSwingH - CFG.oteLow * range;
    dir = 1;
  } else {
    oteLow = lastSwingL + CFG.oteLow * range;
    oteHigh = lastSwingL + CFG.oteHigh * range;
    dir = -1;
  }
  const inOTE = cur >= oteLow && cur <= oteHigh;
  return {inOTE, dir, oteLow, oteHigh, lastSwingH, lastSwingL};
}

// ─── LAYER 11: ADAPTIVE WEIGHTS (PER-REGIME) ─────────────────────────
// Track each filter's contribution + outcome PER REGIME.
// On every closed trade, recompute filter WR per-regime and adjust multipliers.
function recordFactorContribution(side, breakdown, won, r, regime) {
  const entry = {ts: Date.now(), side, won: !!won, r: r || 0, regime: regime || 'CHOP', breakdown: {...breakdown}};
  ST.adaptHistory.unshift(entry);
  if (ST.adaptHistory.length > 200) ST.adaptHistory.pop();
}

function recomputeAdaptiveWeights() {
  if (!CFG.adaptiveEnabled) {
    REGIMES.forEach(rg => FILTERS.forEach(f => ST.adaptWeights[rg][f] = 1.0));
    return;
  }
  const recent = ST.adaptHistory.slice(0, 100); // last 100 closed trades
  if (recent.length < CFG.adaptMinSamples) return;

  // Per regime: compute filter WR
  for (const rg of REGIMES) {
    const regimeTrades = recent.filter(t => t.regime === rg);
    if (regimeTrades.length < 8) continue; // need min 8 in this regime
    for (const f of FILTERS) {
      // Only count trades where this filter contributed positively (>0)
      const positive = regimeTrades.filter(t => (t.breakdown[f] || 0) > 0);
      if (positive.length < 5) continue;
      const wins = positive.filter(t => t.won).length;
      const wr = wins / positive.length;
      // Map WR to weight multiplier:
      // WR 0.25 → 0.5 multiplier, WR 0.5 → 1.0, WR 0.75+ → 1.3
      let m = 0.5 + (wr - 0.25) * 1.6;
      m = clamp(m, CFG.adaptMinFactor, CFG.adaptMaxFactor);
      ST.adaptWeights[rg][f] = m;
    }
  }
  // Persist (new format)
  try { localStorage.setItem('qumash_v6_adapt', JSON.stringify(ST.adaptWeights)); } catch(_) {}
  try { localStorage.setItem('qumash_v6_adaptHist', JSON.stringify(ST.adaptHistory)); } catch(_) {}
}

function loadAdaptiveWeights() {
  try {
    // New format (v6 per-regime)
    const s2 = localStorage.getItem('qumash_v6_adapt');
    if (s2) {
      const o = JSON.parse(s2);
      for (const rg of REGIMES) {
        if (o[rg]) for (const f of FILTERS) {
          if (typeof o[rg][f] === 'number') ST.adaptWeights[rg][f] = o[rg][f];
        }
      }
    } else {
      // Migration: old flat format → apply same weight to all regimes
      const s1 = localStorage.getItem('qumash_v5_adapt');
      if (s1) {
        const o = JSON.parse(s1);
        for (const rg of REGIMES) for (const f of FILTERS) {
          if (typeof o[f] === 'number') ST.adaptWeights[rg][f] = o[f];
        }
        log('INFO', '🔄 v5→v6 migratsiya: vaznlar tarixi kuchirildi');
      }
    }
    // Load history
    const h = localStorage.getItem('qumash_v6_adaptHist');
    if (h) {
      const arr = JSON.parse(h);
      if (Array.isArray(arr)) {
        // Ensure regime field on each entry (default CHOP for old entries)
        ST.adaptHistory = arr.map(e => ({...e, regime: e.regime || 'CHOP'}));
      }
    }
  } catch(_) {}
}

function getFilterRecentWR(f, regime) {
  const recent = ST.adaptHistory.slice(0, 100);
  const filtered = regime ? recent.filter(t => t.regime === regime) : recent;
  const positive = filtered.filter(t => (t.breakdown[f] || 0) > 0);
  if (positive.length < 3) return null;
  const wins = positive.filter(t => t.won).length;
  return {wr: wins/positive.length, n: positive.length};
}

function getRegimeStats(regime) {
  const recent = ST.adaptHistory.slice(0, 100);
  const filtered = recent.filter(t => t.regime === regime);
  if (filtered.length === 0) return {n: 0, wr: 0};
  const wins = filtered.filter(t => t.won).length;
  return {n: filtered.length, wr: wins / filtered.length};
}

// ═══════════════════════════════════════════════════════════════════
// CANDLESTICK PATTERN DETECTION (17 ta classic yapon shamchasi)
// ═══════════════════════════════════════════════════════════════════

const PATTERN_WEIGHTS = {
  // ⭐⭐⭐⭐⭐ Strongest 3-candle reversals
  morning_star: 15,
  evening_star: 15,
  evening_doji_star: 15,
  // ⭐⭐⭐⭐ Engulfing (very strong 2-candle)
  bullish_engulfing: 12,
  bearish_engulfing: 12,
  // ⭐⭐⭐ Gap-based
  piercing_line: 10,
  dark_cloud_cover: 10,
  // ⭐⭐⭐ Hammer-class
  hammer: 9,
  shooting_star: 9,
  hanging_man: 9,
  inverted_hammer: 7,
  // ⭐⭐⭐ Doji at extremes
  gravestone_doji: 8,
  dragonfly_doji: 8,
  double_doji_top: 7,
  // ⭐⭐ Harami (need confirmation)
  bullish_harami: 5,
  bearish_harami: 5,
};

// Pattern display names (for UI / Telegram)
const PATTERN_NAMES = {
  morning_star: '🌅 Morning Star',
  evening_star: '🌇 Evening Star',
  evening_doji_star: '🌇 Evening Doji Star',
  bullish_engulfing: '🟢 Bullish Engulfing',
  bearish_engulfing: '🔴 Bearish Engulfing',
  piercing_line: '⚔️ Piercing Line',
  dark_cloud_cover: '☁️ Dark Cloud Cover',
  hammer: '🔨 Hammer',
  shooting_star: '⭐ Shooting Star',
  hanging_man: '🪢 Hanging Man',
  inverted_hammer: '🔨 Inv. Hammer',
  gravestone_doji: '🪦 Gravestone',
  dragonfly_doji: '🐉 Dragonfly',
  double_doji_top: '⚖️ Double Doji',
  bullish_harami: '🤰 Bull Harami',
  bearish_harami: '🤰 Bear Harami',
};

// Helper functions
function _body(c) { return Math.abs(c.c - c.o); }
function _upperWick(c) { return c.h - Math.max(c.o, c.c); }
function _lowerWick(c) { return Math.min(c.o, c.c) - c.l; }
function _range(c) { return c.h - c.l; }
function _isBull(c) { return c.c > c.o; }
function _isBear(c) { return c.c < c.o; }
function _midBody(c) { return (c.o + c.c) / 2; }
function _isDoji(c) { return _body(c) <= _range(c) * 0.1; }
function _isSmallBody(c) { return _body(c) <= _range(c) * 0.3; }

// ─── BUY PATTERNS ──────────────────────────────────────────────
function isMorningStar(c1, c2, c3) {
  if (!c1 || !c2 || !c3) return false;
  return _isBear(c1) && _body(c1) > _range(c1) * 0.5
    && _isSmallBody(c2) && c2.h < c1.c
    && _isBull(c3) && _body(c3) > _range(c3) * 0.5
    && c3.c > _midBody(c1);
}

function isBullishEngulfing(c1, c2) {
  if (!c1 || !c2) return false;
  return _isBear(c1) && _isBull(c2)
    && c2.o <= c1.c && c2.c >= c1.o
    && _body(c2) > _body(c1);
}

function isHammer(c) {
  if (!c) return false;
  const b = _body(c), lw = _lowerWick(c), uw = _upperWick(c), r = _range(c);
  return b > 0 && b <= r * 0.35 && lw >= b * 2.0 && uw <= b * 0.5;
}

function isInvertedHammer(c) {
  if (!c) return false;
  const b = _body(c), lw = _lowerWick(c), uw = _upperWick(c), r = _range(c);
  return b > 0 && b <= r * 0.35 && uw >= b * 2.0 && lw <= b * 0.5;
}

function isBullishHarami(c1, c2) {
  if (!c1 || !c2) return false;
  return _isBear(c1) && _body(c1) > _range(c1) * 0.5
    && _isBull(c2) && c2.o > c1.c && c2.c < c1.o
    && _body(c2) < _body(c1) * 0.6;
}

function isPiercingLine(c1, c2) {
  if (!c1 || !c2) return false;
  return _isBear(c1) && _body(c1) > _range(c1) * 0.5
    && _isBull(c2) && c2.o < c1.l
    && c2.c > _midBody(c1) && c2.c < c1.o;
}

function isDragonflyDoji(c) {
  if (!c) return false;
  const b = _body(c), lw = _lowerWick(c), uw = _upperWick(c), r = _range(c);
  return r > 0 && b <= r * 0.1 && lw >= r * 0.6 && uw <= r * 0.1;
}

// ─── SELL PATTERNS ─────────────────────────────────────────────
function isEveningStar(c1, c2, c3) {
  if (!c1 || !c2 || !c3) return false;
  return _isBull(c1) && _body(c1) > _range(c1) * 0.5
    && _isSmallBody(c2) && c2.l > c1.c
    && _isBear(c3) && _body(c3) > _range(c3) * 0.5
    && c3.c < _midBody(c1);
}

function isEveningDojiStar(c1, c2, c3) {
  if (!c1 || !c2 || !c3) return false;
  return _isBull(c1) && _body(c1) > _range(c1) * 0.5
    && _isDoji(c2) && c2.l > c1.c
    && _isBear(c3) && _body(c3) > _range(c3) * 0.5
    && c3.c < _midBody(c1);
}

function isBearishEngulfing(c1, c2) {
  if (!c1 || !c2) return false;
  return _isBull(c1) && _isBear(c2)
    && c2.o >= c1.c && c2.c <= c1.o
    && _body(c2) > _body(c1);
}

function isBearishHarami(c1, c2) {
  if (!c1 || !c2) return false;
  return _isBull(c1) && _body(c1) > _range(c1) * 0.5
    && _isBear(c2) && c2.o < c1.c && c2.c > c1.o
    && _body(c2) < _body(c1) * 0.6;
}

function isDarkCloudCover(c1, c2) {
  if (!c1 || !c2) return false;
  return _isBull(c1) && _body(c1) > _range(c1) * 0.5
    && _isBear(c2) && c2.o > c1.h
    && c2.c < _midBody(c1) && c2.c > c1.o;
}

function isGravestoneDoji(c) {
  if (!c) return false;
  const b = _body(c), lw = _lowerWick(c), uw = _upperWick(c), r = _range(c);
  return r > 0 && b <= r * 0.1 && uw >= r * 0.6 && lw <= r * 0.1;
}

function isDoubleDoji(c1, c2) {
  if (!c1 || !c2) return false;
  return _isDoji(c1) && _isDoji(c2);
}

// ─── PATTERN DETECTOR ──────────────────────────────────────────
function detectCandlestickPatterns(candles) {
  if (!candles || candles.length < 3) return { buy: [], sell: [] };
  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];

  const buy = [], sell = [];

  // 3-candle BUY
  if (isMorningStar(c1, c2, c3)) buy.push({ name: 'morning_star', score: PATTERN_WEIGHTS.morning_star });
  // 2-candle BUY
  if (isBullishEngulfing(c2, c3)) buy.push({ name: 'bullish_engulfing', score: PATTERN_WEIGHTS.bullish_engulfing });
  if (isPiercingLine(c2, c3)) buy.push({ name: 'piercing_line', score: PATTERN_WEIGHTS.piercing_line });
  if (isBullishHarami(c2, c3)) buy.push({ name: 'bullish_harami', score: PATTERN_WEIGHTS.bullish_harami });
  // 1-candle BUY
  if (isHammer(c3)) buy.push({ name: 'hammer', score: PATTERN_WEIGHTS.hammer });
  if (isInvertedHammer(c3)) buy.push({ name: 'inverted_hammer', score: PATTERN_WEIGHTS.inverted_hammer });
  if (isDragonflyDoji(c3)) buy.push({ name: 'dragonfly_doji', score: PATTERN_WEIGHTS.dragonfly_doji });

  // 3-candle SELL
  if (isEveningStar(c1, c2, c3)) sell.push({ name: 'evening_star', score: PATTERN_WEIGHTS.evening_star });
  if (isEveningDojiStar(c1, c2, c3)) sell.push({ name: 'evening_doji_star', score: PATTERN_WEIGHTS.evening_doji_star });
  // 2-candle SELL
  if (isBearishEngulfing(c2, c3)) sell.push({ name: 'bearish_engulfing', score: PATTERN_WEIGHTS.bearish_engulfing });
  if (isDarkCloudCover(c2, c3)) sell.push({ name: 'dark_cloud_cover', score: PATTERN_WEIGHTS.dark_cloud_cover });
  if (isBearishHarami(c2, c3)) sell.push({ name: 'bearish_harami', score: PATTERN_WEIGHTS.bearish_harami });
  if (isDoubleDoji(c2, c3)) sell.push({ name: 'double_doji_top', score: PATTERN_WEIGHTS.double_doji_top });
  // 1-candle SELL
  if (isHangingMan_check(c3)) sell.push({ name: 'hanging_man', score: PATTERN_WEIGHTS.hanging_man });
  if (isShootingStar_check(c3)) sell.push({ name: 'shooting_star', score: PATTERN_WEIGHTS.shooting_star });
  if (isGravestoneDoji(c3)) sell.push({ name: 'gravestone_doji', score: PATTERN_WEIGHTS.gravestone_doji });

  return { buy, sell };
}

// Hanging Man = same shape as Hammer (context filtered later via regime)
function isHangingMan_check(c) { return isHammer(c); }
// Shooting Star = same shape as Inverted Hammer (context filtered later)
function isShootingStar_check(c) { return isInvertedHammer(c); }

// ─── CONTEXT-WEIGHTED PATTERN SCORE ─────────────────────────────
// Returns { score: 0-15 normalized, strongestPattern: string|null }
// Context multipliers:
//   discount+BUY / premium+SELL → ×1.5
//   wrong zone                  → ×0.6
//   trend aligned               → ×1.2
//   counter-trend               → ×0.6
//   CHOP                        → ×0.3 (noise)
function computeCandlestickScore(side, patterns, regimeKind, pdZone) {
  const isLong = side === 'L';
  const sidePatterns = isLong ? patterns.buy : patterns.sell;
  if (sidePatterns.length === 0) return { score: 0, strongestPattern: null };

  const strongest = sidePatterns.reduce((max, p) => p.score > max.score ? p : max, sidePatterns[0]);

  let mult = 1.0;
  if (isLong && pdZone === 'discount') mult *= 1.5;
  else if (!isLong && pdZone === 'premium') mult *= 1.5;
  else if (isLong && pdZone === 'premium') mult *= 0.6;
  else if (!isLong && pdZone === 'discount') mult *= 0.6;

  if (regimeKind === 'TREND_UP' && isLong) mult *= 1.2;
  else if (regimeKind === 'TREND_DN' && !isLong) mult *= 1.2;
  else if (regimeKind === 'TREND_UP' && !isLong) mult *= 0.6;
  else if (regimeKind === 'TREND_DN' && isLong) mult *= 0.6;
  else if (regimeKind === 'CHOP') mult *= 0.3;

  const finalScore = Math.min(15, strongest.score * mult / 1.5);
  return { score: finalScore, strongestPattern: strongest.name };
}

// ═══════════════════════════════════════════════════════════════════
// FVG (Fair Value Gap) DETECTION — razvorot uchun ajoyib
// ═══════════════════════════════════════════════════════════════════

// 3-bar FVG formula:
//   Bullish FVG: candle[i].low > candle[i-2].high
//   Bearish FVG: candle[i].high < candle[i-2].low
// Returns array of FVG objects, sorted oldest→newest

function detectFVGs(candles, atr) {
  if (!candles || candles.length < 3) return [];
  const fvgs = [];
  const lookback = Math.min(CFG.fvgLookback, candles.length - 2);
  const minSize = atr * CFG.fvgMinSizeATR;
  const maxSize = atr * CFG.fvgMaxSizeATR;

  for (let i = candles.length - lookback; i < candles.length; i++) {
    if (i < 2) continue;
    const c0 = candles[i - 2];
    const c2 = candles[i];

    // Bullish FVG (gap to upside)
    if (c2.l > c0.h) {
      const size = c2.l - c0.h;
      if (size >= minSize && size <= maxSize) {
        fvgs.push({
          type: 'bull',
          top: c2.l,
          bot: c0.h,
          mid: (c2.l + c0.h) / 2,
          createdAt: i,
          age: candles.length - 1 - i,
          size,
          mitigated: false,
        });
      }
    }
    // Bearish FVG (gap to downside)
    else if (c2.h < c0.l) {
      const size = c0.l - c2.h;
      if (size >= minSize && size <= maxSize) {
        fvgs.push({
          type: 'bear',
          top: c0.l,
          bot: c2.h,
          mid: (c0.l + c2.h) / 2,
          createdAt: i,
          age: candles.length - 1 - i,
          size,
          mitigated: false,
        });
      }
    }
  }

  // Mark mitigated FVGs (boshidan oxirigacha price chizganlar)
  for (const fvg of fvgs) {
    for (let j = fvg.createdAt + 1; j < candles.length; j++) {
      const c = candles[j];
      // Bull FVG mitigated when price returns into the gap
      if (fvg.type === 'bull' && c.l <= fvg.bot) { fvg.mitigated = true; break; }
      if (fvg.type === 'bear' && c.h >= fvg.top) { fvg.mitigated = true; break; }
    }
  }

  // Filter: faqat un-mitigated va ne ochen old
  return fvgs.filter(f => !f.mitigated && f.age <= CFG.fvgMaxAge);
}

// Find active FVG (price inside) in trade direction
function findActiveFVG(fvgs, currentPrice, side) {
  if (!fvgs || fvgs.length === 0) return null;
  const isLong = side === 'L';

  // For BUY — need bullish FVG that price is inside or near top edge
  // For SELL — need bearish FVG that price is inside or near bottom edge
  let candidates = fvgs.filter(f => {
    if (isLong && f.type === 'bull') {
      // Price inside FVG zone (between bot and top)
      return currentPrice >= f.bot && currentPrice <= f.top * 1.001;
    }
    if (!isLong && f.type === 'bear') {
      return currentPrice <= f.top && currentPrice >= f.bot * 0.999;
    }
    return false;
  });

  if (candidates.length === 0) return null;

  // Choose the most recent (smallest age)
  return candidates.reduce((best, f) => f.age < best.age ? f : best, candidates[0]);
}

// ═══════════════════════════════════════════════════════════════════
// HTF ENGULFING DETECTION (Double Engulfing concept'dan)
// ═══════════════════════════════════════════════════════════════════
// LTF (M15) engulfing'ni taqviya qiladi: HTF (H1)'da ham engulfing bo'lsa = sinergiya

function detectHTFEngulfing(htfCandles) {
  if (!htfCandles || htfCandles.length < 2) return { bull: false, bear: false };
  const c1 = htfCandles[htfCandles.length - 2];
  const c2 = htfCandles[htfCandles.length - 1];
  return {
    bull: isBullishEngulfing(c1, c2),
    bear: isBearishEngulfing(c1, c2),
  };
}

export { detectRegime, detectLiquiditySweep, computeCorrelation, detectPremiumDiscount, detectSession, detectNews, detectLiquidityMagnets, detectStructure, detectOrderBlocks, detectOTE, recordFactorContribution, recomputeAdaptiveWeights, loadAdaptiveWeights, getFilterRecentWR, getRegimeStats, PATTERN_WEIGHTS, PATTERN_NAMES, detectCandlestickPatterns, computeCandlestickScore, detectFVGs, findActiveFVG, detectHTFEngulfing };
