import { CFG, ST, HIST_MAX, FILTERS } from './state.js';
import { log, fmtPx, clamp, nowMs } from './utils.js';
import { IND } from './indicators.js';
import {
  detectRegime, detectLiquiditySweep, computeCorrelation, detectPremiumDiscount,
  detectSession, detectNews, detectLiquidityMagnets, detectStructure,
  detectOrderBlocks, detectOTE, detectFVGs, findActiveFVG, detectHTFEngulfing,
  detectCandlestickPatterns, computeCandlestickScore, recordFactorContribution,
  recomputeAdaptiveWeights, PATTERN_NAMES,
} from './filters.js';
import { findActiveNewsEvent, evaluateNewsModeSignal } from './newsEngine.js';
import { scoreTTrades } from './modules/ttradesCisd.js';
import { scoreDailyProfile, isMondayBlocked } from './modules/dailyProfile.js';
import { scoreCompressionHLQ } from './modules/compressionHlq.js';
import { scoreMacroContext } from './modules/macroContext.js';
import { scoreDivergence } from './modules/divergence.js';
import { scoreKeyLevels } from './modules/ictLevels.js';
import { scoreSMTandAMD } from './modules/smtAmd.js';
import { scoreICTBlocks } from './modules/ictBlocks.js';
import { checkPsychBlock } from './modules/psychology.js';
import { scoreChartPatterns } from './modules/chartPatterns.js';
import { scoreFibonacci } from './modules/fibonacci.js';
import { scoreInducement } from './modules/inducement.js';
import { scanForActiveNewsTrade, scoreNewsDriven, NEWS_REACTIONS } from './modules/newsDriven.js';
import { M5_STATE, evaluateM5Reversal, checkOverrideHierarchy, overrideAppliesToGate } from './modules/m5Override.js';
import { refreshDashboardUI } from '../store/uiState.js';
import { setActiveTradeLines, refreshChartMarkers, clearActivePriceLines } from '../services/chart.js';
import { tgSend, tgSendEntry, tgSendTP, tgSendSL } from '../services/telegram.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Сигнал энжин + state machine
// Globals: computeBaseIndicators, computeEurekaScore, runSignalEvaluation, etc.
// ═══════════════════════════════════════════════════════════════════

// ─── BASE INDICATORS COMPUTATION ─────────────────────────────────────
function computeBaseIndicators(candlesArg) {
  const c = candlesArg || ST.candles;
  if (c.length < 220) return null;
  const opens = c.map(x=>x.o), highs = c.map(x=>x.h), lows = c.map(x=>x.l), closes = c.map(x=>x.c);
  const atr = IND.atrSeries(highs, lows, closes, CFG.atrLen);
  const rsi = IND.rsiSeries(closes, CFG.rsiLen);
  const ema200 = IND.emaSeries(closes, CFG.ema200Len);
  const ema50 = IND.emaSeries(closes, 50);
  const macd = IND.macdSeries(closes, 12, 26, 9);
  const closeMA = IND.emaSeries(closes, CFG.basisLen);
  const openMA = IND.emaSeries(opens, CFG.basisLen);
  const adjMult = CFG.stMult * CFG.stSens;
  const st = IND.haSuperTrend(opens, highs, lows, closes, CFG.stPeriods, adjMult);
  const i = c.length - 1;
  const cmaNow = closeMA[i], cmaPrev = closeMA[i-1];
  const omaNow = openMA[i], omaPrev = openMA[i-1];
  const almaBuy = cmaNow > omaNow && cmaPrev <= omaPrev;
  const almaSell = cmaNow < omaNow && cmaPrev >= omaPrev;
  const stTrend = st.trend[i], stTrendPrev = st.trend[i-1];
  const stBuy = stTrend === 1 && stTrendPrev === -1;
  const stSell = stTrend === -1 && stTrendPrev === 1;
  let fvgBull = false, fvgBear = false;
  if (c.length >= 3) {
    const a = c[i-2], b = c[i-1], cc = c[i];
    if (cc.l > a.h && b.c > a.h) fvgBull = true;
    if (cc.h < a.l && b.c < a.l) fvgBear = true;
  }
  return {
    atr:atr[i], rsi:rsi[i], ema50:ema50[i], ema200:ema200[i],
    macdHist:macd.hist[i], macdHistPrev:macd.hist[i-1],
    closeMA:cmaNow, openMA:omaNow, stTrend,
    almaBuy, almaSell, stBuy, stSell,
    almaBullRecent: almaBuy || (closeMA[i-1]>openMA[i-1] && closeMA[i-2]<=openMA[i-2]) || (closeMA[i-2]>openMA[i-2] && closeMA[i-3]<=openMA[i-3]),
    almaBearRecent: almaSell || (closeMA[i-1]<openMA[i-1] && closeMA[i-2]>=openMA[i-2]) || (closeMA[i-2]<openMA[i-2] && closeMA[i-3]>=openMA[i-3]),
    stBullRecent: stBuy || (st.trend[i-1]===1 && st.trend[i-2]===-1) || (st.trend[i-2]===1 && st.trend[i-3]===-1),
    stBearRecent: stSell || (st.trend[i-1]===-1 && st.trend[i-2]===1) || (st.trend[i-2]===-1 && st.trend[i-3]===1),
    fvgBull, fvgBear,
    close:closes[i], high:highs[i], low:lows[i], open:opens[i],
    // v9: full series for divergence detection
    rsiSeries: rsi,
    macdHistSeries: macd.hist,
  };
}

function htfBias(currentTime) {
  // Slice HTF candles up to currentTime if provided
  let htfArr = ST.candlesHTF;
  if (currentTime != null && htfArr.length > 0) {
    let endIdx = htfArr.length - 1;
    while (endIdx >= 0 && (htfArr[endIdx].epoch * 1000) > currentTime) endIdx--;
    if (endIdx < 0) return {dir:0, txt:'data', regime:null, struct:null};
    htfArr = htfArr.slice(0, endIdx + 1);
  }
  if (htfArr.length < 55) return {dir:0, txt:'data', regime:null, struct:null};
  const closes = htfArr.map(c => c.c);
  const ema50 = IND.emaSeries(closes, 50);
  const e50 = ema50[ema50.length-1];
  const cur = closes[closes.length-1];
  let dir = 0, txt = 'HTF FLAT';
  if (e50 !== null) {
    if (cur > e50 * 1.001) { dir = 1; txt = 'HTF UP'; }
    else if (cur < e50 * 0.999) { dir = -1; txt = 'HTF DN'; }
  }
  // Multi-TF: also compute HTF regime + structure
  let htfRegime = null, htfStruct = null;
  try {
    htfRegime = detectRegime(htfArr);
    htfStruct = detectStructure(htfArr);
  } catch(_) {}
  return {dir, txt, regime: htfRegime, struct: htfStruct, confluence: 0};
}

// Multi-TF confluence score: how aligned is HTF with signal direction
// Returns: {aligned: boolean, score: 0..1, reason: string}
function checkMTFConfluence(side, htf) {
  if (!htf || !htf.regime) return {aligned: true, score: 0.5, reason: 'HTF data yo\'q'};
  const isLong = side === 'L';
  let alignment = 0;
  const reasons = [];
  // 1) HTF regime check
  if (isLong) {
    if (htf.regime.kind === 'TREND_UP') { alignment += 0.45; reasons.push('HTF TREND_UP'); }
    else if (htf.regime.kind === 'TREND_DN') { alignment -= 0.5; reasons.push('HTF TREND_DN ✗'); }
    else if (htf.regime.kind === 'RANGE') { alignment += 0.15; }
  } else {
    if (htf.regime.kind === 'TREND_DN') { alignment += 0.45; reasons.push('HTF TREND_DN'); }
    else if (htf.regime.kind === 'TREND_UP') { alignment -= 0.5; reasons.push('HTF TREND_UP ✗'); }
    else if (htf.regime.kind === 'RANGE') { alignment += 0.15; }
  }
  // 2) HTF EMA bias
  if (isLong && htf.dir === 1) { alignment += 0.25; reasons.push('HTF EMA up'); }
  else if (!isLong && htf.dir === -1) { alignment += 0.25; reasons.push('HTF EMA dn'); }
  else if (isLong && htf.dir === -1) { alignment -= 0.3; reasons.push('HTF EMA dn ✗'); }
  else if (!isLong && htf.dir === 1) { alignment -= 0.3; reasons.push('HTF EMA up ✗'); }
  // 3) HTF structure
  if (htf.struct && htf.struct.event) {
    const sd = htf.struct.eventDir;
    if ((isLong && sd === 1) || (!isLong && sd === -1)) {
      alignment += 0.3; reasons.push(`HTF ${htf.struct.event}`);
    } else if ((isLong && sd === -1) || (!isLong && sd === 1)) {
      alignment -= 0.35; reasons.push(`HTF ${htf.struct.event} ✗`);
    }
  }
  alignment = clamp(alignment, -1, 1);
  // Aligned threshold: alignment > -0.2 (not strongly opposed)
  const aligned = alignment >= -0.2;
  return {aligned, score: (alignment + 1) / 2, reason: reasons.join(', ') || 'нейтрал', alignment};
}

// ─── EUREKA SCORING (14 layers + per-regime adaptive + multi-TF confluence + reversal trigger) ─
// candlesParam: бу argument backtest учун керак — sliced candles узатилади.
// Live'да argument берилмаса, ST.candles ишлатилади.
function computeEurekaScore(side, ind, regime, sweep, corr, premdisc, session, news, magnets, htf, struct, ob, ote, fvgs = [], htfEng = {bull:false, bear:false}, candlesParam = null) {
  const isLong = side === 'L';
  let score = 0;
  const breakdown = {};
  // Per-regime adaptive multipliers — fall back to CHOP if regime unknown
  const W = (ST.adaptWeights[regime.kind] || ST.adaptWeights['CHOP']);
  const candlesForPattern = candlesParam || ST.candles;

  // ALMA + ST agreement
  const dual = isLong ? (ind.almaBullRecent && ind.stBullRecent) : (ind.almaBearRecent && ind.stBearRecent);
  const single = isLong ? (ind.almaBullRecent || ind.stBullRecent) : (ind.almaBearRecent || ind.stBearRecent);
  let wAlmaSt = (dual ? CFG.wAlmaSt : single ? CFG.wAlmaSt * 0.4 : 0) * W.almast;
  score += wAlmaSt; breakdown.almast = wAlmaSt;

  // Layer 1: Regime
  let wReg = 0;
  if (regime.kind === 'TREND_UP' && isLong) wReg = CFG.wRegime * regime.confidence;
  else if (regime.kind === 'TREND_DN' && !isLong) wReg = CFG.wRegime * regime.confidence;
  else if (regime.kind === 'RANGE') wReg = CFG.wRegime * 0.4 * regime.confidence;
  else if (regime.kind === 'CHOP') wReg = -CFG.wRegime * 0.5;
  else if (regime.kind === 'TREND_UP' && !isLong) wReg = -CFG.wRegime * 0.4;
  else if (regime.kind === 'TREND_DN' && isLong) wReg = -CFG.wRegime * 0.4;
  wReg *= W.regime; score += wReg; breakdown.regime = wReg;

  // Layer 2: Sweep
  let wSwp = 0;
  if (sweep.detected) {
    if ((isLong && sweep.dir === 1) || (!isLong && sweep.dir === -1)) wSwp = CFG.wSweep;
    else wSwp = -CFG.wSweep * 0.3;
  }
  wSwp *= W.sweep; score += wSwp; breakdown.sweep = wSwp;

  // Layer 3: DXY
  let wDxy = 0;
  if (corr.verdict === 'bull' && isLong) wDxy = CFG.wDXY;
  else if (corr.verdict === 'bear' && !isLong) wDxy = CFG.wDXY;
  else if (corr.verdict === 'mix') wDxy = -CFG.wDXY * 0.2;
  else if ((corr.verdict === 'bull' && !isLong) || (corr.verdict === 'bear' && isLong)) wDxy = -CFG.wDXY * 0.6;
  wDxy *= W.dxy; score += wDxy; breakdown.dxy = wDxy;

  // Layer 4: Premium/Discount
  let wPD = 0;
  if (premdisc.zone === 'discount' && isLong) wPD = CFG.wPremium;
  else if (premdisc.zone === 'premium' && !isLong) wPD = CFG.wPremium;
  else if (premdisc.zone === 'premium' && isLong) wPD = -CFG.wPremium * 0.5;
  else if (premdisc.zone === 'discount' && !isLong) wPD = -CFG.wPremium * 0.5;
  wPD *= W.premium; score += wPD; breakdown.premium = wPD;

  // Layer 5: Session
  let wSes = CFG.wSession * session.quality * W.session;
  score += wSes; breakdown.session = wSes;

  // Layer 7: Liquidity magnets — ahead = target
  let wLiq = 0;
  if (isLong && magnets.nearestAbove && magnets.nearestAbove.count >= 2) {
    const dist = magnets.nearestAbove.price - ind.close;
    if (dist > 0 && dist < ind.atr * 6) wLiq = CFG.wLiquidity * Math.min(1, magnets.nearestAbove.count / 3);
  }
  if (!isLong && magnets.nearestBelow && magnets.nearestBelow.count >= 2) {
    const dist = ind.close - magnets.nearestBelow.price;
    if (dist > 0 && dist < ind.atr * 6) wLiq = CFG.wLiquidity * Math.min(1, magnets.nearestBelow.count / 3);
  }
  wLiq *= W.liquidity; score += wLiq; breakdown.liquidity = wLiq;

  // Layer 8: MSS / BOS / CHoCH
  let wMSS = 0;
  if (struct.event) {
    if ((struct.eventDir === 1 && isLong) || (struct.eventDir === -1 && !isLong)) {
      // BOS in trade direction = strongest, CHoCH = also valuable (reversal start)
      if (struct.event.startsWith('BOS')) wMSS = CFG.wMSS;
      else if (struct.event.startsWith('CHoCH')) wMSS = CFG.wMSS * 0.85;
      else if (struct.event.startsWith('MSS')) wMSS = CFG.wMSS * 0.7;
    } else {
      // Wrong direction structure event = strong negative
      wMSS = -CFG.wMSS * 0.5;
    }
  }
  wMSS *= W.mss; score += wMSS; breakdown.mss = wMSS;

  // Layer 9: Order Block — entry near unmitigated OB in trade direction
  let wOB = 0;
  const obRange = ind.atr * 1.5;
  if (isLong && ob.activeBull) {
    const dist = ind.close - ob.activeBull.top;
    if (dist >= 0 && dist < obRange) wOB = CFG.wOB * (1 - dist / obRange);
  }
  if (!isLong && ob.activeBear) {
    const dist = ob.activeBear.bot - ind.close;
    if (dist >= 0 && dist < obRange) wOB = CFG.wOB * (1 - dist / obRange);
  }
  wOB *= W.ob; score += wOB; breakdown.ob = wOB;

  // Layer 10: OTE
  let wOTE = 0;
  if (ote.inOTE) {
    if ((ote.dir === 1 && isLong) || (ote.dir === -1 && !isLong)) wOTE = CFG.wOTE;
    else wOTE = -CFG.wOTE * 0.3;
  }
  wOTE *= W.ote; score += wOTE; breakdown.ote = wOTE;

  // Bonus: HTF alignment
  let wHtf = 0;
  if (htf.dir === 1 && isLong) wHtf = CFG.wMomentum * 0.5;
  else if (htf.dir === -1 && !isLong) wHtf = CFG.wMomentum * 0.5;
  else if (htf.dir === 1 && !isLong) wHtf = -CFG.wMomentum * 0.3;
  else if (htf.dir === -1 && isLong) wHtf = -CFG.wMomentum * 0.3;
  score += wHtf; breakdown.htf = wHtf;

  // Bonus: MACD momentum
  let wMom = 0;
  if (ind.macdHist !== null && ind.macdHistPrev !== null) {
    if (isLong && ind.macdHist > 0 && ind.macdHist > ind.macdHistPrev) wMom = CFG.wMomentum * 0.5;
    else if (!isLong && ind.macdHist < 0 && ind.macdHist < ind.macdHistPrev) wMom = CFG.wMomentum * 0.5;
  }
  wMom *= W.momentum; score += wMom; breakdown.momentum = wMom;

  // Layer 11: Candlestick patterns (17 ta classic, context-weighted)
  let wCandle = 0;
  let _patternName = null;
  if (typeof detectCandlestickPatterns === 'function' && candlesForPattern && candlesForPattern.length >= 3) {
    const patterns = detectCandlestickPatterns(candlesForPattern);
    const patScore = computeCandlestickScore(side, patterns, regime.kind, premdisc.zone);
    if (patScore.score > 0) {
      // Map 0-15 score to 0-CFG.wCandlestick range
      wCandle = (patScore.score / 15) * CFG.wCandlestick * (W.candlestick || 1.0);
      _patternName = patScore.strongestPattern;
    }
  }
  score += wCandle; breakdown.candlestick = wCandle;
  if (_patternName) breakdown._patternName = _patternName;

  // Layer 12: FVG (Fair Value Gap) — разворот учун асосий
  let wFVG = 0;
  let _activeFVG = null;
  if (typeof findActiveFVG === 'function' && fvgs && fvgs.length > 0) {
    const af = findActiveFVG(fvgs, ind.close, side);
    if (af) {
      _activeFVG = af;
      // Score = base × (1 - age decay) × position factor
      const ageDecay = Math.max(0.5, 1 - (af.age / CFG.fvgMaxAge));

      // Position factor: ближe to FVG edge in trade direction = stronger
      // For BUY: closer to bot edge = stronger (price reverse эҳтимоли катта)
      // For SELL: closer to top edge = stronger
      let posFactor = 1.0;
      if (isLong) {
        const distFromBot = (ind.close - af.bot) / af.size;
        posFactor = 1.0 - distFromBot * 0.5;  // 0.5x at top, 1.0x at bot
      } else {
        const distFromTop = (af.top - ind.close) / af.size;
        posFactor = 1.0 - distFromTop * 0.5;
      }

      wFVG = CFG.wFVG * ageDecay * Math.max(0.5, posFactor) * (W.fvg || 1.0);
    }
  }
  score += wFVG; breakdown.fvg = wFVG;
  if (_activeFVG) breakdown._fvg = { type: _activeFVG.type, top: _activeFVG.top, bot: _activeFVG.bot, age: _activeFVG.age };

  // Layer 13: HTF Engulfing confirmation
  let wHtfEng = 0;
  if (htfEng.bull && isLong) wHtfEng = CFG.wHtfEng;
  else if (htfEng.bear && !isLong) wHtfEng = CFG.wHtfEng;
  else if (htfEng.bull && !isLong) wHtfEng = -CFG.wHtfEng * 0.4;  // counter-trend
  else if (htfEng.bear && isLong) wHtfEng = -CFG.wHtfEng * 0.4;
  wHtfEng *= (W.htf_eng || 1.0);
  score += wHtfEng; breakdown.htf_eng = wHtfEng;

  const maxPossible = CFG.wAlmaSt + CFG.wRegime + CFG.wSweep + CFG.wDXY + CFG.wPremium + CFG.wSession + CFG.wLiquidity + CFG.wMSS + CFG.wOB + CFG.wOTE + CFG.wMomentum * 1.0 + CFG.wCandlestick + CFG.wFVG + CFG.wHtfEng;
  const normalized = Math.max(0, Math.min(100, (score / maxPossible) * 100));
  return {raw:score, score:normalized, breakdown, dual};
}

// ─── REVERSAL TRIGGER CHECK ──────────────────────────────────────────
// Setup сифатини белгилайди: разворот учун камида биттаси бўлиши керак
//   (1) Liquidity Sweep (institutional stop hunt)
//   (2) CHoCH event (тренд ўзгариши бошланиши)
//   (3) FVG entry zone (нарх gap'га қайтган)
//   (4) MSS event (структура buzилиши, тренд йўқ)
// Хеч қайси бўлмаса — setup "тренд давоми" саналади ва Т1 талаб қилинади.
function hasReversalTrigger(side, sweep, struct, fvgs, ind, regime) {
  const isLong = side === 'L';
  const triggers = [];
  if (sweep.detected && ((isLong && sweep.dir === 1) || (!isLong && sweep.dir === -1))) triggers.push('SWEEP');
  if (struct.event && struct.event.startsWith('CHoCH') &&
      ((isLong && struct.eventDir === 1) || (!isLong && struct.eventDir === -1))) triggers.push('CHoCH');
  if (struct.event && struct.event.startsWith('MSS') &&
      ((isLong && struct.eventDir === 1) || (!isLong && struct.eventDir === -1))) triggers.push('MSS');
  if (fvgs && fvgs.length > 0 && typeof findActiveFVG === 'function') {
    const af = findActiveFVG(fvgs, ind.close, side);
    if (af) triggers.push('FVG');
  }
  return triggers;
}

// ─── TIER FOR (REVERSAL HUNTER) ──────────────────────────────────────
// Фақат T1/T2 — паст балли setup'лар умуман очилмайди.
// Тренд давоми (reversal trigger йўқ) учун T1 талаб қилинади.
// v8: Monday'да T2 блок (TTrades qoidasi)
function tierFor(score, hasReversal) {
  if (score >= CFG.tier1) return {tier:'T1', risk:CFG.tier1Risk};
  if (score >= CFG.tier2 && hasReversal) {
    // v8: Monday'да фақат T1 қабул қилинади (T2 reject)
    if (CFG.mondayBlock && typeof isMondayBlocked === 'function' && isMondayBlocked()) {
      return null;
    }
    return {tier:'T2', risk:CFG.tier2Risk};
  }
  return null; // signal rad — слабый setup
}

// ─── SIGNAL EVALUATION ───────────────────────────────────────────────
let _lastSnapshot = {};

function runSignalEvaluation(fireSignals = true) {
  const ind = computeBaseIndicators();
  if (!ind) return;
  const regime = detectRegime(ST.candles);
  const sweep = detectLiquiditySweep(ST.candles, ind.atr);
  const corr = computeCorrelation();
  const pd = detectPremiumDiscount(ST.candles);
  const ses = detectSession();
  const news = detectNews();
  const magnets = detectLiquidityMagnets(ST.candles, ind.atr);
  const htf = htfBias();
  const struct = detectStructure(ST.candles);
  const ob = detectOrderBlocks(ST.candles, ind.atr);
  const ote = detectOTE(ST.candles);

  // Yangi: FVG + HTF Engulfing
  const fvgs = detectFVGs(ST.candles, ind.atr);
  const htfEng = detectHTFEngulfing(ST.candlesHTF || []);  // ⭐ FIX: ST.candlesHTF (was ST.htfCandles bug)

  // ⭐ v8: PDF'лардан янги модуллар — TTrades, Daily Profile, Compression, HLQ, QMR, Macro
  ST.lastAtr = ind.atr;
  const snapBase = { fvg: { bullFVGs: fvgs.filter(f => f.type === 'bull'), bearFVGs: fvgs.filter(f => f.type === 'bear') }, ob, magnets };
  const ttrades = (typeof scoreTTrades === 'function') ? scoreTTrades(ST.candles, ST.candlesHTF, ind.atr) : { score: 0, dir: 0 };
  const dpL = (typeof scoreDailyProfile === 'function') ? scoreDailyProfile('L') : { score: 0 };
  const dpS = (typeof scoreDailyProfile === 'function') ? scoreDailyProfile('S') : { score: 0 };
  const chlL = (typeof scoreCompressionHLQ === 'function') ? scoreCompressionHLQ('L', ST.candles, ind.atr, snapBase) : { score: 0 };
  const chlS = (typeof scoreCompressionHLQ === 'function') ? scoreCompressionHLQ('S', ST.candles, ind.atr, snapBase) : { score: 0 };
  const macroL = (typeof scoreMacroContext === 'function') ? scoreMacroContext('L') : { score: 0 };
  const macroS = (typeof scoreMacroContext === 'function') ? scoreMacroContext('S') : { score: 0 };

  // ⭐ v9: ICT Bible, Divergence, SMT, AMD, ICT Blocks, Psychology
  const divL = (typeof scoreDivergence === 'function') ? scoreDivergence('L', ST.candles, ind.rsiSeries, ind.macdHistSeries) : { score: 0 };
  const divS = (typeof scoreDivergence === 'function') ? scoreDivergence('S', ST.candles, ind.rsiSeries, ind.macdHistSeries) : { score: 0 };
  const klL = (typeof scoreKeyLevels === 'function') ? scoreKeyLevels('L', ST.candles, ind.atr) : { score: 0 };
  const klS = (typeof scoreKeyLevels === 'function') ? scoreKeyLevels('S', ST.candles, ind.atr) : { score: 0 };
  const smtAmdL = (typeof scoreSMTandAMD === 'function') ? scoreSMTandAMD('L', ST.candles) : { score: 0 };
  const smtAmdS = (typeof scoreSMTandAMD === 'function') ? scoreSMTandAMD('S', ST.candles) : { score: 0 };
  const blocksL = (typeof scoreICTBlocks === 'function') ? scoreICTBlocks('L', ST.candles, ind.atr) : { score: 0 };
  const blocksS = (typeof scoreICTBlocks === 'function') ? scoreICTBlocks('S', ST.candles, ind.atr) : { score: 0 };

  // ⭐ v10: Chart Patterns + Fibonacci + Inducement
  const cpL = (typeof scoreChartPatterns === 'function') ? scoreChartPatterns('L', ST.candles, ind.atr) : { score: 0 };
  const cpS = (typeof scoreChartPatterns === 'function') ? scoreChartPatterns('S', ST.candles, ind.atr) : { score: 0 };
  const fibL = (typeof scoreFibonacci === 'function') ? scoreFibonacci('L', ST.candles, ind.atr) : { score: 0 };
  const fibS = (typeof scoreFibonacci === 'function') ? scoreFibonacci('S', ST.candles, ind.atr) : { score: 0 };
  const idmL = (typeof scoreInducement === 'function') ? scoreInducement('L', ST.candles, ind.atr) : { score: 0 };
  const idmS = (typeof scoreInducement === 'function') ? scoreInducement('S', ST.candles, ind.atr) : { score: 0 };

  // ⭐ v11: scan for new post-news reactions (called every M15 candle)
  if (typeof scanForActiveNewsTrade === 'function') {
    scanForActiveNewsTrade(ST.candles, ind.atr);
  }
  // ⭐ v11: News-driven signal score (bonus when in retracement after strong reaction)
  const ndL = (typeof scoreNewsDriven === 'function') ? scoreNewsDriven('L', ST.candles, ind.atr) : { score: 0 };
  const ndS = (typeof scoreNewsDriven === 'function') ? scoreNewsDriven('S', ST.candles, ind.atr) : { score: 0 };

  // ⭐ v11: Trendline + Volume + Gap + MTV — these modules are NOT bundled in
  // this build (their <script> tags were never loaded in the original either,
  // so the `typeof scoreX === 'function'` guards always failed). Kept as
  // zero-score placeholders so the downstream score math stays byte-identical.
  const tlL = { score: 0 };
  const tlS = { score: 0 };
  const volL = { score: 0 };
  const volS = { score: 0 };
  const gapL = { score: 0 };
  const gapS = { score: 0 };
  const mtvL = { score: 0 };
  const mtvS = { score: 0 };

  const scoreL = computeEurekaScore('L', ind, regime, sweep, corr, pd, ses, news, magnets, htf, struct, ob, ote, fvgs, htfEng);
  const scoreS = computeEurekaScore('S', ind, regime, sweep, corr, pd, ses, news, magnets, htf, struct, ob, ote, fvgs, htfEng);

  // ⭐ v8 + v9 + v10 + v11: PDF модуллар score'ларни қўшиш
  const ttL = (ttrades.dir === 1) ? ttrades.score : 0;
  const ttS = (ttrades.dir === -1) ? ttrades.score : 0;
  const v8AddL = ttL + (dpL.score || 0) + (chlL.score || 0) + (macroL.score || 0);
  const v8AddS = ttS + (dpS.score || 0) + (chlS.score || 0) + (macroS.score || 0);
  const v9AddL = (divL.score || 0) + (klL.score || 0) + (smtAmdL.score || 0) + (blocksL.score || 0);
  const v9AddS = (divS.score || 0) + (klS.score || 0) + (smtAmdS.score || 0) + (blocksS.score || 0);
  const v10AddL = (cpL.score || 0) + (fibL.score || 0) + (idmL.score || 0);
  const v10AddS = (cpS.score || 0) + (fibS.score || 0) + (idmS.score || 0);
  // ⭐ v11: News-Driven raw score (special — adds DIRECTLY to score, not normalized)
  const v11NdL = (ndL.score || 0);
  const v11NdS = (ndS.score || 0);

  // Normalize: v8 max + v9 max + v10 max
  const v8Max = (CFG.wTTrades || 0) + (CFG.wDailyProfile || 0) + (CFG.wCompression || 0) + (CFG.wHLQ || 0) + (CFG.wQMR || 0) + (CFG.wMacro || 0);
  const v9Max = (CFG.wDivergence || 0) + (CFG.wKeyLevels || 0) + (CFG.wSMTandAMD || 0) + (CFG.wICTBlocks || 0);
  const v10Max = (CFG.wChartPatterns || 0) + (CFG.wFibonacci || 0) + (CFG.wInducement || 0);
  if (v8Max > 0) {
    scoreL.score = Math.min(100, scoreL.score + (v8AddL / v8Max) * 100 * 0.35);
    scoreS.score = Math.min(100, scoreS.score + (v8AddS / v8Max) * 100 * 0.35);
  }
  if (v9Max > 0) {
    scoreL.score = Math.min(100, scoreL.score + (v9AddL / v9Max) * 100 * 0.40);
    scoreS.score = Math.min(100, scoreS.score + (v9AddS / v9Max) * 100 * 0.40);
  }
  if (v10Max > 0) {
    scoreL.score = Math.min(100, scoreL.score + (v10AddL / v10Max) * 100 * 0.45);
    scoreS.score = Math.min(100, scoreS.score + (v10AddS / v10Max) * 100 * 0.45);
  }
  // ⭐ v11: News-Driven adds DIRECTLY to score (+12 to +20) — this is a top-priority bonus
  // because post-news trades are uniquely high-probability when valid
  scoreL.score = Math.min(100, scoreL.score + v11NdL);
  scoreS.score = Math.min(100, scoreS.score + v11NdS);
  scoreL.breakdown = { ...scoreL.breakdown,
    _ttrades: ttrades, _dailyProfile: dpL.profile, _compression: chlL.compression, _hlq: chlL.hlq, _qmr: chlL.qmr, _macro: macroL.risk,
    _divergence: divL, _keyLevels: klL.levels, _judas: klL.judas, _smtAmd: smtAmdL, _ictBlocks: blocksL,
    _chartPatterns: cpL, _fibonacci: fibL, _inducement: idmL,
    _newsDriven: ndL,
  };
  scoreS.breakdown = { ...scoreS.breakdown,
    _ttrades: ttrades, _dailyProfile: dpS.profile, _compression: chlS.compression, _hlq: chlS.hlq, _qmr: chlS.qmr, _macro: macroS.risk,
    _divergence: divS, _keyLevels: klS.levels, _judas: klS.judas, _smtAmd: smtAmdS, _ictBlocks: blocksS,
    _chartPatterns: cpS, _fibonacci: fibS, _inducement: idmS,
    _newsDriven: ndS,
  };

  // ⭐ Reversal triggers (v7) + v8: TTrades CISD ва QMR + v9: Judas + Stinger
  const reversalL = hasReversalTrigger('L', sweep, struct, fvgs, ind, regime);
  const reversalS = hasReversalTrigger('S', sweep, struct, fvgs, ind, regime);
  if (ttrades.dir === 1 && ttrades.cisd && ttrades.cisd.confirmed) reversalL.push('CISD');
  if (ttrades.dir === -1 && ttrades.cisd && ttrades.cisd.confirmed) reversalS.push('CISD');
  if (chlL.qmr && chlL.qmr.detected && chlL.qmr.dir === 1) reversalL.push('QMR');
  if (chlS.qmr && chlS.qmr.detected && chlS.qmr.dir === -1) reversalS.push('QMR');
  // v9: Judas swing + Stinger pattern = ultra reversal triggers
  if (klL.judas && klL.judas.detected && klL.judas.dir === 1) reversalL.push('JUDAS');
  if (klS.judas && klS.judas.detected && klS.judas.dir === -1) reversalS.push('JUDAS');
  if (divL.stinger && divL.stinger.dir === 1) reversalL.push('STINGER');
  if (divS.stinger && divS.stinger.dir === -1) reversalS.push('STINGER');
  // ⭐ v11: News-Driven setup = NEW reversal trigger (post-news Fib retracement)
  if (ndL.score > 0) reversalL.push('NEWS_DRIVEN');
  if (ndS.score > 0) reversalS.push('NEWS_DRIVEN');

  _lastSnapshot = {ind, regime, sweep, corr, pd, ses, news, magnets, htf, struct, ob, ote, fvgs, htfEng, scoreL, scoreS, reversalL, reversalS,
    // v8:
    ttrades, dailyProfileL: dpL, dailyProfileS: dpS, chlL, chlS, macroL, macroS,
    // v9:
    divL, divS, klL, klS, smtAmdL, smtAmdS, blocksL, blocksS,
    // v10:
    cpL, cpS, fibL, fibS, idmL, idmS,
    // v11:
    ndL, ndS,
  };

  // Always refresh UI so user sees fresh data
  refreshDashboardUI();

  // Only proceed to signal firing on bar close (not periodic refresh)
  if (!fireSignals) return;

  const inActive = ST.condition !== 0 && Math.abs(ST.condition) !== 1.3;
  const blocked = CFG.blockReversal && inActive;
  const cooldownOK = !ST.lastWasSL || ST.barsSinceSL >= CFG.cooldownBars;

  // Gates
  let gateOK = true, gateFail = '';
  if (ses.session === 'WEEKEND') { gateOK = false; gateFail = 'дам олиш'; }
  // Session whitelist
  if (CFG.allowedSessions && CFG.allowedSessions[ses.session] === false) { gateOK = false; gateFail = `сеанс блок: ${ses.session}`; }
  // Regime whitelist
  if (CFG.allowedRegimes && CFG.allowedRegimes[regime.kind] === false) { gateOK = false; gateFail = `режим блок: ${regime.kind}`; }

  // ⚡ AUTO NEWS MODE — ҳамма муҳим янгиликда автоматик ишлайди
  // Эълондан 3 мин кейин очилади, news+tech синергияси билан signal беради
  let newsModeActive = null;
  if (CFG.newsMode === 'auto' && typeof findActiveNewsEvent === 'function') {
    newsModeActive = findActiveNewsEvent();
    _lastSnapshot.newsModeActive = newsModeActive;
  }

  if (newsModeActive) {
    // News active window'да — news.clear гейт скип қилинади (chunki news directional ҳаракат беради)
    if (CFG.sessionFilter && ses.quality < 0.5) { gateOK = false; gateFail = 'сеанс: ' + ses.txt; }
  } else {
    // ⭐ v12 (2-variant): 3-PHASE NEWS GATE
    // Phase 1: T-30..T+5  → BLOCK (хавфли волатиллик)
    // Phase 2: T+5..T+15  → faqat v11 News-Driven ишлайди (стандарт сигнал блок)
    // Phase 3: T+15..T+45 → ҳам v11, ҳам стандарт сигнал ишлайди (тех анализ мос келса)
    // Phase 4: T+45+      → нормал mode (news.clear = true)
    let newsPhase = 0;
    let v11Override = false;
    let standardAllowed = true;

    if (typeof NEWS_REACTIONS !== 'undefined' && NEWS_REACTIONS.active && NEWS_REACTIONS.active.length > 0) {
      // Has active reaction (T+5..T+45 ichida) — find oldest active news
      const now = Date.now();
      const oldestActive = NEWS_REACTIONS.active.reduce((oldest, curr) => {
        const currTime = new Date(curr.event.dateTime || curr.event.time).getTime();
        const oldestTime = oldest ? new Date(oldest.event.dateTime || oldest.event.time).getTime() : Infinity;
        return currTime < oldestTime ? curr : oldest;
      }, null);
      if (oldestActive) {
        const newsTime = new Date(oldestActive.event.dateTime || oldestActive.event.time).getTime();
        const minsSinceNews = (now - newsTime) / 60000;
        if (minsSinceNews >= 5 && minsSinceNews < 15) {
          newsPhase = 2;
          v11Override = CFG.newsDrivenEnabled;
          standardAllowed = false;  // faqat v11 ishlaydi
        } else if (minsSinceNews >= 15 && minsSinceNews <= 45) {
          newsPhase = 3;
          v11Override = CFG.newsDrivenEnabled;
          standardAllowed = true;   // standart signals ham
        }
      }
    }

    // Apply news block logic based on phase
    if (newsPhase === 0) {
      // No active reaction — standart news.clear check
      if (!news.clear) { gateOK = false; gateFail = news.txt; }
    } else if (newsPhase === 2) {
      // T+5..T+15: faqat v11 News-Driven yoqilgan bo'lsa o'tadi, standart yo'q
      if (!news.clear && !v11Override) {
        gateOK = false; gateFail = news.txt;
      }
      // Standart signal'ni блок қилиш — буни fireSignal'да текширамиз via _lastSnapshot.newsPhase
    } else if (newsPhase === 3) {
      // T+15..T+45: ham v11, ham standart signal'lar (news.clear = true bo'lsa standart, false bo'lsa v11 override)
      if (!news.clear && !v11Override) {
        gateOK = false; gateFail = news.txt;
      }
    }
    _lastSnapshot.newsPhase = newsPhase;
    _lastSnapshot.newsStandardAllowed = standardAllowed;

    if (CFG.sessionFilter && ses.quality < 0.5) { gateOK = false; gateFail = 'сеанс: ' + ses.txt; }
  }
  if (regime.kind === 'CHOP' && CFG.strict) { gateOK = false; gateFail = 'CHOP режим (қаттиқ)'; }
  // ⭐ VOLATILITY GATE — block extreme high or low volatility
  const atrPct = (ind.atr / ind.close) * 100;
  if (CFG.atrPctMin && atrPct < CFG.atrPctMin) { gateOK = false; gateFail = `волатиллик паст ${atrPct.toFixed(2)}% < ${CFG.atrPctMin}%`; }
  if (CFG.atrPctMax && atrPct > CFG.atrPctMax) { gateOK = false; gateFail = `волатиллик юқори ${atrPct.toFixed(2)}% > ${CFG.atrPctMax}%`; }

  // ⭐ v8: Monday rule — TTrades qoidasi
  if (typeof isMondayBlocked === 'function' && isMondayBlocked()) {
    // Monday'да T1 қолдиради (T2 авток. block)
    _lastSnapshot.mondayWarning = true;
  }
  // ⭐ v8: Daily Profile invalidation — если London expansion, NY participate этмаслик
  const dpAny = dpL.profile || dpS.profile;
  if (dpAny && dpAny.profile === 'EXPANSION' && dpAny.nyValid === false && ses.session === 'NY') {
    if (CFG.dailyProfileEnabled) {
      gateOK = false;
      gateFail = `London expansion → NY skip (${dpAny.why})`;
    }
  }
  // ⭐ v9: Psychology block — drawdown/revenge'да entry'ни блок
  if (typeof checkPsychBlock === 'function') {
    const psychBlock = checkPsychBlock();
    if (psychBlock.block) {
      gateOK = false;
      gateFail = `🧠 ${psychBlock.reason}`;
    }
  }

  // ⭐ v12: OVERRIDE HIERARCHY — strong model trigger can override weak filter conflicts
  // Check both sides — apply override based on which has higher-tier model signal
  let overrideResultL = { canOverride: false, level: 0 };
  let overrideResultS = { canOverride: false, level: 0 };
  if (!gateOK && typeof checkOverrideHierarchy === 'function') {
    overrideResultL = checkOverrideHierarchy(_lastSnapshot, 'L');
    overrideResultS = checkOverrideHierarchy(_lastSnapshot, 'S');
    // Pick the higher level override
    const bestLevel = Math.max(
      overrideResultL.canOverride ? overrideResultL.level : 0,
      overrideResultS.canOverride ? overrideResultS.level : 0
    );
    if (bestLevel > 0 && !overrideResultL.blockSafety && !overrideResultS.blockSafety) {
      // Check if override applies to current gate fail
      if (overrideAppliesToGate(gateFail, bestLevel)) {
        const overrideWhy = overrideResultL.canOverride ? overrideResultL.why : overrideResultS.why;
        log('SIG', `🟢 OVERRIDE L${bestLevel}: ${overrideWhy} → "${gateFail}" gate'ни override қилди`);
        gateOK = true;
        _lastSnapshot.overrideApplied = { level: bestLevel, why: overrideWhy, originalGate: gateFail };
        gateFail = '';
      }
    }
  }

  // Tier — Reversal Hunter: фақат T1/T2, T2 фақат reversal trigger билан
  const longTier = tierFor(scoreL.score, reversalL.length > 0);
  const shortTier = tierFor(scoreS.score, reversalS.length > 0);
  const wantLong = (CFG.direction === 'BOTH' || CFG.direction === 'LONG');
  const wantShort = (CFG.direction === 'BOTH' || CFG.direction === 'SHORT');

  // ⭐ MULTI-TF CONFLUENCE — block signals against HTF
  const mtfLong = checkMTFConfluence('L', htf);
  const mtfShort = checkMTFConfluence('S', htf);
  // Reversal Hunter: HTF қарши бўлмаса етарли (>= 0.4) — реверсал ҳолатлар учун ҳатто tighter эмас
  const mtfThreshold = 0.4;

  // ⭐ SCORE-DIFF GATE — avoid 21 vs 23 type fakes (need clear winner)
  const minDiff = CFG.minScoreDiff || 0;

  const longTrigger = wantLong
    && (ind.almaBuy || ind.stBuy || (struct.event && struct.eventDir === 1) || reversalL.length >= 2)
    && longTier  // null bo'lsa rad
    && (scoreL.score - scoreS.score) >= minDiff
    && mtfLong.score >= mtfThreshold;
  const shortTrigger = wantShort
    && (ind.almaSell || ind.stSell || (struct.event && struct.eventDir === -1) || reversalS.length >= 2)
    && shortTier
    && (scoreS.score - scoreL.score) >= minDiff
    && mtfShort.score >= mtfThreshold;

  // Save MTF info to snapshot for UI/Telegram
  _lastSnapshot.mtfLong = mtfLong;
  _lastSnapshot.mtfShort = mtfShort;

  if (!gateOK) {
    if (Math.random() < 0.1) log('FILT', `⛔ Гейт: ${gateFail}`);
  } else if (blocked) {} else if (!cooldownOK) {}
  // ⚡ NEWS-MODE signal: news direction + tech setup mos келиши керак
  else if (newsModeActive && typeof evaluateNewsModeSignal === 'function') {
    const ev = evaluateNewsModeSignal(newsModeActive, scoreL, scoreS);
    if (ev && ev.qualifies) {
      const targetSide = ev.targetSide;
      const targetScoreObj = (targetSide === 'L' ? scoreL : scoreS);
      const targetReversal = (targetSide === 'L' ? reversalL : reversalS);
      // ⭐ Alignment: news yo'nалиши tech yo'nалиши билан мос бўлиши керак
      // (tech score targetSide'да ҳеч бўлмаса 30+ бўлиши керак)
      const techScore = (targetSide === 'L' ? scoreL.score : scoreS.score);
      const techAligned = !CFG.newsAlignmentRequired || techScore >= 30;
      if (techAligned) {
        const newsScoreObj = { ...targetScoreObj, score: ev.combined, breakdown: { ...targetScoreObj.breakdown, _newsMode: ev } };
        const tierObj = { tier: ev.tier === 1 ? 'T1' : 'T2', risk: ev.risk };
        if ((targetSide === 'L' && ST.condition <= 0) || (targetSide === 'S' && ST.condition >= 0)) {
          log('NEWS', `📰 NEWS ${targetSide==='L'?'BUY':'SELL'} | ${newsModeActive.eventName} surprise=${newsModeActive.surprise}σ | tech=${techScore.toFixed(0)} → ${ev.combined}`);
          fireSignal(targetSide, ind, newsScoreObj, tierObj, _lastSnapshot);
        }
      } else {
        if (Math.random() < 0.3) log('NEWS', `⚠ News ${targetSide==='L'?'BUY':'SELL'} (${newsModeActive.eventName}) — tech qarshi (${techScore.toFixed(0)})`);
      }
    } else if (ev) {
      if (Math.random() < 0.2) log('NEWS', `📰 News active but combined=${ev.combined} < tier (${newsModeActive.eventName})`);
    }
  }
  else if (wantLong && longTier && !mtfLong.aligned) {
    if (Math.random() < 0.3) log('MTF', `⚠ LONG блокланди: HTF қарши (${mtfLong.reason})`);
  } else if (wantShort && shortTier && !mtfShort.aligned) {
    if (Math.random() < 0.3) log('MTF', `⚠ SHORT блокланди: HTF қарши (${mtfShort.reason})`);
  } else if (longTrigger && (!shortTrigger || scoreL.score >= scoreS.score) && ST.condition <= 0) {
    // ⭐ v12 (2-variant): Phase 2 check — fақat NEWS_DRIVEN signal'lar otsin
    const isPhase2 = _lastSnapshot.newsPhase === 2;
    const hasNewsDrivenL = (_lastSnapshot.reversalL || []).includes('NEWS_DRIVEN');
    if (isPhase2 && !hasNewsDrivenL) {
      if (Math.random() < 0.3) log('NEWS', `⏳ Phase 2 (T+5..T+15): фақат NEWS_DRIVEN signal — стандарт LONG блок`);
    } else {
      fireSignal('L', ind, scoreL, longTier, _lastSnapshot);
    }
  } else if (shortTrigger && (!longTrigger || scoreS.score >= scoreL.score) && ST.condition >= 0) {
    // ⭐ v12 (2-variant): Phase 2 check
    const isPhase2 = _lastSnapshot.newsPhase === 2;
    const hasNewsDrivenS = (_lastSnapshot.reversalS || []).includes('NEWS_DRIVEN');
    if (isPhase2 && !hasNewsDrivenS) {
      if (Math.random() < 0.3) log('NEWS', `⏳ Phase 2 (T+5..T+15): фақат NEWS_DRIVEN signal — стандарт SHORT блок`);
    } else {
      fireSignal('S', ind, scoreS, shortTier, _lastSnapshot);
    }
  }
  refreshDashboardUI();
}

// ─── STATE MACHINE ───────────────────────────────────────────────────
function fireSignal(side, ind, scoreObj, tier, snap) {
  const isLong = side === 'L';
  const entry = ind.close;

  // ⚡ SMART SL — мажбурий: FVG → OB → ATR fallback
  // Барча setup'лар учун кичик SL'га интилами
  let sl;
  let slType = 'ATR';
  const stdSlDist = ind.atr * CFG.slATR;
  const stdSL = isLong ? entry - stdSlDist : entry + stdSlDist;

  // 1) FVG edge'и (энг яхши)
  if (CFG.smartSLenabled && scoreObj.breakdown && scoreObj.breakdown._fvg) {
    const fvg = scoreObj.breakdown._fvg;
    const buf = ind.atr * CFG.smartSLbuffer;
    const minDist = ind.atr * CFG.smartSLminATR;
    let candidateSL = isLong ? fvg.bot - buf : fvg.top + buf;
    const dist = Math.abs(entry - candidateSL);
    if (dist < minDist) candidateSL = isLong ? entry - minDist : entry + minDist;
    // FVG edge SL фақат ATR×slATR'дан кам бўлсагина ишлатилади (катта бўлса fallback'га ўтади)
    sl = (Math.abs(entry - candidateSL) <= stdSlDist) ? candidateSL : stdSL;
    if (sl !== stdSL) slType = 'FVG-edge';
  }
  // 2) Active OB edge'и (FVG бўлмаса)
  if (!sl || sl === stdSL) {
    if (CFG.smartSLenabled && snap.ob) {
      const activeOB = isLong ? snap.ob.activeBull : snap.ob.activeBear;
      if (activeOB) {
        const buf = ind.atr * CFG.smartSLbuffer;
        const minDist = ind.atr * CFG.smartSLminATR;
        let candidateSL = isLong ? activeOB.bot - buf : activeOB.top + buf;
        const dist = Math.abs(entry - candidateSL);
        if (dist < minDist) candidateSL = isLong ? entry - minDist : entry + minDist;
        if (Math.abs(entry - candidateSL) <= stdSlDist) {
          sl = candidateSL;
          slType = 'OB-edge';
        }
      }
    }
  }
  // 2.5) ⭐ v8: TTrades CISD swing point — energi pasт SL, лекин валидиз
  if (!sl || sl === stdSL) {
    if (CFG.ttradesEnabled && snap.ttrades && snap.ttrades.swing) {
      const sw = snap.ttrades.swing;
      const swingDir = (sw.type === 'C2_BULL' || sw.type === 'C3_BULL') ? 1 : -1;
      if (swingDir === (isLong ? 1 : -1)) {
        const buf = ind.atr * CFG.smartSLbuffer;
        const candidateSL = isLong ? sw.swingPrice - buf : sw.swingPrice + buf;
        if (Math.abs(entry - candidateSL) <= stdSlDist * 1.2) {
          sl = candidateSL;
          slType = 'CISD-swing';
        }
      }
    }
  }
  // 3) Fallback — ATR
  if (!sl) sl = stdSL;

  // TP айни ATR'дан, лекин эфективная R:R'ни хисоблаймиз
  const slDistActual = Math.abs(entry - sl);
  let tp1 = isLong ? entry + ind.atr*CFG.tp1ATR : entry - ind.atr*CFG.tp1ATR;
  let tp2 = isLong ? entry + ind.atr*CFG.tp2ATR : entry - ind.atr*CFG.tp2ATR;
  let tp3 = isLong ? entry + ind.atr*CFG.tp3ATR : entry - ind.atr*CFG.tp3ATR;
  let tpSource = 'ATR';

  // ⭐ v8: Liquidity-based TPs — TTrades stiliда: target at liquidity levels / projections
  if (snap.magnets) {
    const liqTarget = isLong ? snap.magnets.nearestAbove : snap.magnets.nearestBelow;
    if (liqTarget) {
      const liqDist = Math.abs(liqTarget.price - entry);
      // If liquidity magnet is at >= 1.5R, use it as TP1
      if (liqDist >= slDistActual * 1.5 && liqDist <= slDistActual * 3) {
        tp1 = isLong ? liqTarget.price - ind.atr * 0.1 : liqTarget.price + ind.atr * 0.1;
        tpSource = 'liquidity';
      }
    }
  }
  // ⭐ v9: ICT Key Levels (PDH/PDL/PWH/PWL) as TP targets — natural liquidity
  if (CFG.keyLevelsEnabled && snap.klL) {
    const levels = isLong ? snap.klL.levels : snap.klS.levels;
    if (levels) {
      const target = isLong ? levels.nearestAbove : levels.nearestBelow;
      if (target && target.price) {
        const dist = Math.abs(target.price - entry);
        // If key level is at 2-5R, use as TP1 or TP2
        if (dist >= slDistActual * 2 && dist <= slDistActual * 3) {
          tp1 = isLong ? target.price - ind.atr * 0.15 : target.price + ind.atr * 0.15;
          tpSource = tpSource === 'ATR' ? `${target.name}` : tpSource + `+${target.name}`;
        } else if (dist >= slDistActual * 3 && dist <= slDistActual * 6) {
          tp2 = isLong ? target.price - ind.atr * 0.15 : target.price + ind.atr * 0.15;
          tpSource = tpSource === 'ATR' ? `${target.name}` : tpSource + `+${target.name}`;
        }
      }
    }
  }
  // ⭐ v8: TTrades projection targets (-2, -4) for TP2/TP3 if swing exists
  if (CFG.ttradesEnabled && snap.ttrades && snap.ttrades.targets) {
    const tg = snap.ttrades.targets;
    if (tg.t2 && tg.t4 && snap.ttrades.dir === (isLong ? 1 : -1)) {
      const t2RR = Math.abs(tg.t2 - entry) / slDistActual;
      const t4RR = Math.abs(tg.t4 - entry) / slDistActual;
      if (t2RR >= 2.5 && t2RR <= 6) { tp2 = tg.t2; tpSource = tpSource === 'ATR' ? 'TTrades' : tpSource + '+TT'; }
      if (t4RR >= 5 && t4RR <= 10) { tp3 = tg.t4; }
    }
  }

  // ⭐ R:R MIN CHECK — паст R:R сигналлар кучсиз, рад қилинади
  const rrEffective = Math.abs(tp1 - entry) / slDistActual;
  if (rrEffective < (CFG.minRR || 1.5)) {
    log('FILT', `⛔ R:R 1:${rrEffective.toFixed(2)} < 1:${CFG.minRR} — сигнал рад этилди`);
    return;
  }

  // Reversal trigger номлари
  const triggers = (isLong ? snap.reversalL : snap.reversalS) || [];

  ST.snap = {
    isLong, entry, sl, tp1, tp2, tp3, slType, tpSource,
    rrEffective: rrEffective.toFixed(2),
    score:scoreObj.score, tier:tier.tier, risk:tier.risk,
    breakdown:scoreObj.breakdown, bothSrc:scoreObj.dual,
    epoch:ST.candles[ST.candles.length-1].epoch, time:nowMs(),
    regime:snap.regime.kind,
    sweep:snap.sweep.detected ? snap.sweep.why : 'йўқ',
    corrVerdict:snap.corr.verdictTxt,
    pdZone:snap.pd.zone, pdPos:snap.pd.pos,
    structEvent:snap.struct.event || 'йўқ',
    obActive: isLong ? (snap.ob.activeBull ? `${snap.ob.activeBull.bot.toFixed(1)}-${snap.ob.activeBull.top.toFixed(1)}` : 'йўқ') : (snap.ob.activeBear ? `${snap.ob.activeBear.bot.toFixed(1)}-${snap.ob.activeBear.top.toFixed(1)}` : 'йўқ'),
    inOTE: snap.ote.inOTE ? 'ха' : 'йўқ',
    candlestickPattern: scoreObj.breakdown._patternName || null,
    fvgInfo: scoreObj.breakdown._fvg || null,
    htfEngBull: snap.htfEng?.bull || false,
    htfEngBear: snap.htfEng?.bear || false,
    newsMode: scoreObj.breakdown._newsMode || null,
    triggers,                              // reversal trigger номлари (CISD, QMR included)
    // ⭐ v12: override info if applied
    overrideApplied: _lastSnapshot.overrideApplied || null,
    // ⭐ v12 (2-variant): news phase info
    newsPhase: _lastSnapshot.newsPhase || 0,
    newsStandardAllowed: _lastSnapshot.newsStandardAllowed !== false,
    // v8 metadata
    v8: {
      ttradesSwing: snap.ttrades?.swing?.type || null,
      cisdConfirmed: snap.ttrades?.cisd?.confirmed || false,
      dailyProfile: (isLong ? snap.dailyProfileL : snap.dailyProfileS)?.profile?.profile || null,
      compression: (isLong ? snap.chlL : snap.chlS)?.compression?.detected || false,
      qmr: (isLong ? snap.chlL : snap.chlS)?.qmr?.detected || false,
      hlqStrength: (isLong ? snap.chlL : snap.chlS)?.hlq?.zones?.length || 0,
      riskRegime: (isLong ? snap.macroL : snap.macroS)?.risk?.regime || null,
    },
    // v9 metadata
    v9: {
      divergence: (isLong ? snap.divL : snap.divS)?.divergences?.map(d => d.type) || [],
      stinger: (isLong ? snap.divL : snap.divS)?.stinger?.type || null,
      atKeyLevel: (isLong ? snap.klL : snap.klS)?.atKeyLevel?.name || null,
      judas: (isLong ? snap.klL : snap.klS)?.judas?.detected || false,
      judasSwept: (isLong ? snap.klL : snap.klS)?.judas?.sweptLevel?.name || null,
      smtPairs: (isLong ? snap.smtAmdL : snap.smtAmdS)?.smt?.divergences?.map(d => d.pair) || [],
      amdDay: (isLong ? snap.smtAmdL : snap.smtAmdS)?.amd?.day || null,
      breaker: (isLong ? snap.blocksL : snap.blocksS)?.breakers?.activeBull || (isLong ? snap.blocksL : snap.blocksS)?.breakers?.activeBear ? true : false,
    },
    // v10 metadata
    v10: {
      chartPatterns: (isLong ? snap.cpL : snap.cpS)?.matching?.map(p => p.type) || [],
      fibZone: (isLong ? snap.fibL : snap.fibS)?.activeZone?.pct || null,
      fibTarget: (isLong ? snap.fibL : snap.fibS)?.nearestExt?.pct || null,
      algoCandle: (isLong ? snap.idmL : snap.idmS)?.algoCandle?.type || null,
      idm: (isLong ? snap.idmL : snap.idmS)?.inducement?.type || null,
    },
    // v11 metadata — News-Driven
    v11: (() => {
      const nd = isLong ? snap.ndL : snap.ndS;
      if (!nd || !nd.active) return null;
      return {
        eventName: (nd.active.event.name || nd.active.event.title || 'News').slice(0, 24),
        strength: nd.active.strength,
        magnitude: nd.active.magnitude?.toFixed(2) || null,
        retracePct: nd.retracement?.currentRetracePct || null,
        bonus: nd.score,
      };
    })(),
  };
  ST.slLine = sl;
  ST.condition = isLong ? 1.0 : -1.0;
  ST.barsSinceEntry = 0;
  ST.tradeReachedTP1 = false;
  ST.lastWasSL = false;
  ST.total++;
  const patTxt = ST.snap.candlestickPattern && typeof PATTERN_NAMES !== 'undefined'
    ? ` ${PATTERN_NAMES[ST.snap.candlestickPattern] || ST.snap.candlestickPattern}` : '';
  const fvgTxt = ST.snap.fvgInfo ? ` 📦FVG-${ST.snap.fvgInfo.type}` : '';
  const htfTxt = (ST.snap.htfEngBull && isLong) || (ST.snap.htfEngBear && !isLong) ? ' 🔄HTF-Eng' : '';
  const trigTxt = triggers.length ? ` [${triggers.join('+')}]` : '';
  log('SIG', `${isLong?'🟢 BUY':'🔴 SELL'} @${fmtPx(entry)}`, `${tier.tier} ${scoreObj.score.toFixed(0)} ${tier.risk}% [${slType} 1:${ST.snap.rrEffective}R]${trigTxt}${patTxt}${fvgTxt}${htfTxt}`);
  log('FILT', `${snap.regime.kind} | ${snap.sweep.detected?'SWEEP':'no'} | DXY:${snap.corr.verdict} | ${snap.pd.zone} | ${snap.ses.txt} | ${snap.struct.event||'-'} | OB:${ST.snap.obActive!=='йўқ'?'✓':'-'} | OTE:${ST.snap.inOTE}${patTxt}${fvgTxt}${htfTxt}`);
  ST.history.unshift({
    ts: new Date().toLocaleTimeString('uz-UZ', {hour12:false, hour:'2-digit', minute:'2-digit'}),
    side, score:scoreObj.score.toFixed(0), tier:tier.tier,
    entry, sl, tp1, tp2, tp3,
    exit:'live', r:0, exitPrice:null, epoch: ST.snap.epoch,
    tf: CFG.granularity,  // ⭐ tag with current TF — signal markers only show on this TF
    regime:snap.regime.kind, structEvent:snap.struct.event || '-', breakdown:{...scoreObj.breakdown},
  });
  if (ST.history.length > HIST_MAX) ST.history.pop();
  // Save active trade for browser refresh recovery
  persistActiveTrade();
  // Render on chart
  setActiveTradeLines();
  refreshChartMarkers();
  tgSendEntry();
}

function checkIntraBarExits(c) {
  if (!ST.snap) return;
  const isLong = ST.snap.isLong;
  if (isLong) {
    if (c.l <= ST.slLine) onSLHit(ST.slLine);
    else if (c.h >= ST.snap.tp3 && Math.abs(ST.condition) === 1.2) onTPHit(3, ST.snap.tp3);
    else if (c.h >= ST.snap.tp2 && Math.abs(ST.condition) === 1.1) onTPHit(2, ST.snap.tp2);
    else if (c.h >= ST.snap.tp1 && Math.abs(ST.condition) === 1.0) onTPHit(1, ST.snap.tp1);
  } else {
    if (c.h >= ST.slLine) onSLHit(ST.slLine);
    else if (c.l <= ST.snap.tp3 && Math.abs(ST.condition) === 1.2) onTPHit(3, ST.snap.tp3);
    else if (c.l <= ST.snap.tp2 && Math.abs(ST.condition) === 1.1) onTPHit(2, ST.snap.tp2);
    else if (c.l <= ST.snap.tp1 && Math.abs(ST.condition) === 1.0) onTPHit(1, ST.snap.tp1);
  }
}

function checkBarCloseExits(ind) {
  if (!ST.snap) return;
  const isLong = ST.snap.isLong;
  const last = ST.candles[ST.candles.length-1];
  if (isLong) {
    if (last.l <= ST.slLine) { onSLHit(ST.slLine); return; }
    if (last.h >= ST.snap.tp3 && Math.abs(ST.condition) === 1.2) onTPHit(3, ST.snap.tp3);
    else if (last.h >= ST.snap.tp2 && Math.abs(ST.condition) === 1.1) onTPHit(2, ST.snap.tp2);
    else if (last.h >= ST.snap.tp1 && Math.abs(ST.condition) === 1.0) onTPHit(1, ST.snap.tp1);
  } else {
    if (last.h >= ST.slLine) { onSLHit(ST.slLine); return; }
    if (last.l <= ST.snap.tp3 && Math.abs(ST.condition) === 1.2) onTPHit(3, ST.snap.tp3);
    else if (last.l <= ST.snap.tp2 && Math.abs(ST.condition) === 1.1) onTPHit(2, ST.snap.tp2);
    else if (last.l <= ST.snap.tp1 && Math.abs(ST.condition) === 1.0) onTPHit(1, ST.snap.tp1);
  }
  // Trailing
  if (Math.abs(ST.condition) === 1.2 && CFG.trailAfter === 'TP2') {
    const trailDist = ind.atr * CFG.trailATR;
    const newSL = isLong ? Math.max(ST.slLine, ind.close - trailDist) : Math.min(ST.slLine, ind.close + trailDist);
    if (newSL !== ST.slLine) {
      ST.slLine = newSL;
      persistActiveTrade();
      setActiveTradeLines(); // refresh chart line
    }
  }
}

function onTPHit(level, price) {
  if (!ST.snap) return;
  const isLong = ST.snap.isLong;
  if (level === 1) {
    ST.condition = isLong ? 1.1 : -1.1;
    ST.tradeReachedTP1 = true;
    log('EXIT', `✅ TP1 @${fmtPx(price)}`);
    if (CFG.beAfter === 'TP1') ST.slLine = ST.snap.entry + (isLong?1:-1) * ST.snap.entry * (CFG.beBuffer/100);
    persistActiveTrade();
    setActiveTradeLines(); // refresh chart lines (BE update)
    tgSendTP(1, price);
  } else if (level === 2) {
    ST.condition = isLong ? 1.2 : -1.2;
    log('EXIT', `✅ TP2 @${fmtPx(price)}`);
    if (CFG.beAfter === 'TP2') {
      ST.slLine = ST.snap.entry + (isLong?1:-1) * ST.snap.entry * (CFG.beBuffer/100);
      log('INFO', `🛡 BE → ${fmtPx(ST.slLine)}`);
    }
    persistActiveTrade();
    setActiveTradeLines();
    tgSendTP(2, price);
  } else if (level === 3) {
    ST.condition = isLong ? 1.3 : -1.3;
    log('EXIT', `🏆 TP3 @${fmtPx(price)}`);
    closeTrade('tp', price, +2.5);
    tgSendTP(3, price);
    setTimeout(() => { ST.condition = 0; ST.snap = null; clearActiveTrade(); clearActivePriceLines(); refreshDashboardUI(); }, 500);
  }
}

function onSLHit(price) {
  if (!ST.snap) return;
  const wasBE = ST.tradeReachedTP1 && Math.abs(ST.snap.entry - ST.slLine) < ST.snap.entry * 0.001;
  const exitType = wasBE ? 'be' : 'sl';
  const r = wasBE ? 0.5 : -1.0;
  log('EXIT', wasBE ? `🛡 BE SL` : `🛑 SL @${fmtPx(price)}`);
  closeTrade(exitType, price, r);
  ST.condition = 0;
  ST.barsSinceSL = 0;
  ST.lastWasSL = !wasBE;
  ST.snap = null;
  clearActiveTrade();
  clearActivePriceLines();
  tgSendSL(price, wasBE);
}

function closeTrade(type, exitPrice, r) {
  ST.todayR += r;
  if (type === 'tp') { ST.tpWins++; ST.rWinSum += r; ST.rWinCount++; }
  else if (type === 'be') { ST.beHits++; }
  else { ST.slLosses++; ST.rLossSum += Math.abs(r); ST.rLossCount++; }
  ST.rSum += r;
  ST.maxR = Math.max(ST.maxR, ST.rSum);
  ST.minR = Math.min(ST.minR, ST.rSum);
  // Update history + record adaptive feedback
  if (ST.history.length && ST.history[0].exit === 'live') {
    const h = ST.history[0];
    h.exit = type; h.r = r; h.exitPrice = exitPrice;
    h.exitEpoch = ST.candles[ST.candles.length - 1]?.epoch || h.epoch;
    const won = r > 0;
    const regime = h.regime || 'CHOP';
    recordFactorContribution(h.side, h.breakdown, won, r, regime);
    recomputeAdaptiveWeights();
    // Show changed weights in the regime that was active
    const W = ST.adaptWeights[regime];
    if (W) {
      const changed = FILTERS.filter(f => Math.abs((W[f] || 1.0) - 1.0) > 0.05).slice(0, 3);
      if (changed.length) log('ADAPT', `⚙ ${regime} режимида вазнлар янгиланди`, changed.map(f => `${f}:${W[f].toFixed(2)}`).join(' '));
    }
  }
  // Refresh chart markers to show exit
  refreshChartMarkers();
}

// ─── ACTIVE TRADE PERSISTENCE (browser refresh recovery) ─────────────
const ACTIVE_TRADE_KEY = 'qumash_active_trade';

function persistActiveTrade() {
  try {
    if (ST.condition !== 0 && ST.snap) {
      localStorage.setItem(ACTIVE_TRADE_KEY, JSON.stringify({
        condition: ST.condition,
        snap: ST.snap,
        slLine: ST.slLine,
        tradeReachedTP1: ST.tradeReachedTP1,
        barsSinceEntry: ST.barsSinceEntry || 0,
        savedAt: Date.now(),
        tf: CFG.granularity,
      }));
    } else {
      localStorage.removeItem(ACTIVE_TRADE_KEY);
    }
  } catch(_) {}
}

function clearActiveTrade() {
  try { localStorage.removeItem(ACTIVE_TRADE_KEY); } catch(_) {}
}

function restoreActiveTrade() {
  try {
    const s = localStorage.getItem(ACTIVE_TRADE_KEY);
    if (!s) return false;
    const data = JSON.parse(s);
    // Only restore if recent (< 24 hours)
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(ACTIVE_TRADE_KEY);
      return false;
    }
    // ⭐ TF mismatch — savedTF != current TF: bar counts/ATR хавфли. Битим бекор.
    if (data.tf && data.tf !== CFG.granularity) {
      log('WARN', `🔄 Битим бекор: сақлаш TF=${data.tf} ≠ жорий TF=${CFG.granularity}`);
      localStorage.removeItem(ACTIVE_TRADE_KEY);
      return false;
    }
    // ⭐ SL/TP3 ALREADY HIT during browser-offline period? — текширамиз
    const isLong = data.condition > 0;
    const lastPrice = ST.lastPrice || (ST.candles.length ? ST.candles[ST.candles.length - 1].c : null);
    if (lastPrice && data.snap) {
      // SL уриб ўтган ёки нархдан анча узоқ — фантом trade'дан қочамиз
      if (isLong && lastPrice <= data.slLine) {
        log('WARN', `🛑 Битим тикланмади: SL уриб ўтган (нарх ${lastPrice.toFixed(2)} ≤ SL ${data.slLine.toFixed(2)})`);
        localStorage.removeItem(ACTIVE_TRADE_KEY);
        return false;
      }
      if (!isLong && lastPrice >= data.slLine) {
        log('WARN', `🛑 Битим тикланмади: SL уриб ўтган (нарх ${lastPrice.toFixed(2)} ≥ SL ${data.slLine.toFixed(2)})`);
        localStorage.removeItem(ACTIVE_TRADE_KEY);
        return false;
      }
      // TP3 ҳам ўтган бўлса — битим аллақачон тугаган
      if (isLong && lastPrice >= data.snap.tp3) {
        log('WARN', `🏆 Битим тикланмади: TP3 урилган (нарх ${lastPrice.toFixed(2)} ≥ TP3 ${data.snap.tp3.toFixed(2)})`);
        localStorage.removeItem(ACTIVE_TRADE_KEY);
        return false;
      }
      if (!isLong && lastPrice <= data.snap.tp3) {
        log('WARN', `🏆 Битим тикланмади: TP3 урилган`);
        localStorage.removeItem(ACTIVE_TRADE_KEY);
        return false;
      }
    }
    ST.condition = data.condition;
    ST.snap = data.snap;
    ST.slLine = data.slLine;
    ST.tradeReachedTP1 = !!data.tradeReachedTP1;
    ST.barsSinceEntry = data.barsSinceEntry || 0;
    const sideTxt = data.condition > 0 ? '🟢 LONG' : '🔴 SHORT';
    const tier = data.snap.tier ? `${data.snap.tier}` : '';
    log('INFO', `🔄 Тикланди: ${sideTxt} ${tier} @${data.snap.entry.toFixed(2)} (SL ${data.slLine.toFixed(2)})`);
    return true;
  } catch(e) {
    log('WARN', 'Битим тиклаш хато: ' + (e.message||'').slice(0,40));
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// v12: M5 INTRADAY CANDLE HANDLER
// Called every M5 candle close. Evaluates M5 reversal, fires signal if found.
// ═══════════════════════════════════════════════════════════════════
function onM5CandleClose(candle) {
  if (!CFG.m5Enabled) return;
  if (!ST.warmupDone) return;
  // Avoid double-fire: if M15 just fired in last 5 min, skip M5
  if (ST.condition !== 0 && ST.barsSinceEntry < 1) return;

  // Get current HTF bias from last M15 snapshot
  let htfBias = 0;
  if (_lastSnapshot && _lastSnapshot.ind) {
    const ind = _lastSnapshot.ind;
    if (ind.ema50 > ind.ema200 && ind.close > ind.ema50) htfBias = 1;
    else if (ind.ema50 < ind.ema200 && ind.close < ind.ema50) htfBias = -1;
  }

  const m5Result = evaluateM5Reversal(htfBias);
  if (!m5Result.hasSignal) return;
  if (!_lastSnapshot.ind) return;

  // Safety checks (same as M15)
  if (typeof checkPsychBlock === 'function') {
    const psych = checkPsychBlock();
    if (psych.block) return;
  }
  // Skip if M15 already has active position
  if (ST.condition !== 0) return;

  // Build M5 signal — lighter than M15, no full breakdown
  const isLong = m5Result.side === 'L';
  const entry = m5Result.entry;
  const sl = m5Result.sl;
  const slDist = Math.abs(entry - sl);
  // M5 TPs: 1.5R, 3R, 5R (tighter than M15 because M5 moves are smaller)
  const tp1 = isLong ? entry + slDist * 1.5 : entry - slDist * 1.5;
  const tp2 = isLong ? entry + slDist * 3.0 : entry - slDist * 3.0;
  const tp3 = isLong ? entry + slDist * 5.0 : entry - slDist * 5.0;
  const riskPct = (CFG.riskPctT1 || 1.5) * (CFG.m5RiskMult || 0.6);

  M5_STATE.microSignals.unshift({
    ts: Date.now(),
    side: m5Result.side,
    entry, sl, tp1, tp2, tp3,
    score: m5Result.score,
    triggers: m5Result.triggers,
    htfBias,
  });
  if (M5_STATE.microSignals.length > 20) M5_STATE.microSignals.pop();

  log('SIG', `⚡ M5 ${isLong ? 'LONG' : 'SHORT'} signal — ${m5Result.triggers.join(' + ')} (score ${m5Result.score})`);

  // NOTE: the original had an optional telegram push here guarded by
  // `typeof sendTelegramM5/sendTelegram === 'function'`. Neither helper was ever
  // defined/loaded, so the block was always inert. Dropped for parity + lint.
  void slDist;
  void riskPct;
}

export function getSnapshot() {
  return _lastSnapshot;
}

export { computeBaseIndicators, htfBias, checkMTFConfluence, computeEurekaScore, hasReversalTrigger, tierFor, _lastSnapshot, runSignalEvaluation, fireSignal, checkIntraBarExits, checkBarCloseExits, onTPHit, onSLHit, closeTrade, ACTIVE_TRADE_KEY, persistActiveTrade, clearActiveTrade, restoreActiveTrade, onM5CandleClose };
