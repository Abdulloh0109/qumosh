// ═══════════════════════════════════════════════════════════════════
// QUMASH v7 — BACKTEST МОТОРИ (Reversal Hunter)
// Битта мукаммал режим — тарихий маълумот бўйича симуляция қилади.
// Жонли тизим билан **айни бир хил формула** ишлатилади (FVG, HTFEng,
// candlestick — sliced candles'дан, look-ahead йўқ).
// ═══════════════════════════════════════════════════════════════════

const BT = {
  running: false,
  progress: 0,
  result: null,
};

async function runBacktest(opts = {}) {
  if (!ST.candles || ST.candles.length < 250) {
    alert('Маълумот етарли эмас. Бошида тизимни уланг ва ~5 минут кутинг.');
    return;
  }
  if (BT.running) return;
  BT.running = true;
  BT.progress = 0;

  const candles = ST.candles;
  // HTF candles массив (агар backtest'да HTF Engulfing'ни ҳисоблаш керак бўлса)
  const htfCandlesAll = ST.candlesHTF || [];

  log('BT', `▶ Backtest бошланди: REVERSAL HUNTER, ${candles.length} шам`);

  const sim = {
    condition: 0, snap: null, slLine: 0,
    tradeReachedTP1: false, barsSinceEntry: 9999,
    history: [],
    equity: [],
    rSum: 0, total: 0,
    tpFull: 0, beHits: 0, slLosses: 0, timeouts: 0, endOpen: 0,
    rWinSum: 0, rLossSum: 0, rWinCount: 0, rLossCount: 0,
    maxR: 0, minR: 0,
    perRegime: {TREND_UP:{n:0,wins:0,r:0}, TREND_DN:{n:0,wins:0,r:0}, RANGE:{n:0,wins:0,r:0}, CHOP:{n:0,wins:0,r:0}},
    perTier: {T1:{n:0,wins:0,r:0}, T2:{n:0,wins:0,r:0}},
    perSession: {LONDON:{n:0,wins:0,r:0}, NY:{n:0,wins:0,r:0}, OVERLAP:{n:0,wins:0,r:0}, NY_AFTER:{n:0,wins:0,r:0}, ASIA:{n:0,wins:0,r:0}, LUNCH:{n:0,wins:0,r:0}, OTHER:{n:0,wins:0,r:0}, FRI_LATE:{n:0,wins:0,r:0}, LATE:{n:0,wins:0,r:0}},
    perFilter: {},
    perTrigger: {SWEEP:{n:0,wins:0,r:0}, CHoCH:{n:0,wins:0,r:0}, MSS:{n:0,wins:0,r:0}, FVG:{n:0,wins:0,r:0}, NONE:{n:0,wins:0,r:0}},
    blocked: 0,
  };
  FILTERS.forEach(f => sim.perFilter[f] = {n:0, wins:0, r:0});

  const startIdx = Math.max(220, opts.startIdx || 220);
  const endIdx = candles.length - 1;
  const totalBars = endIdx - startIdx;
  let lastUiUpdate = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const c = candles[i];
    const barTime = c.epoch * 1000;

    // 1) Check exits using this bar's high/low
    if (sim.condition !== 0 && sim.snap) {
      const snap = sim.snap;
      const isLong = snap.isLong;
      // SL check
      if ((isLong && c.l <= sim.slLine) || (!isLong && c.h >= sim.slLine)) {
        const exitPrice = sim.slLine;
        const slDist = Math.abs(snap.entry - snap.sl);
        let r = sim.tradeReachedTP1 ? 0 : -1;
        if (sim.slLine !== snap.sl) {
          const moved = isLong ? sim.slLine - snap.entry : snap.entry - sim.slLine;
          r = moved / slDist;
        }
        recordTradeOutcome(sim, snap, exitPrice, r, sim.tradeReachedTP1 ? 'BE' : 'SL', barTime);
        sim.condition = 0; sim.snap = null;
        continue;
      }
      // TP checks (partial: TP1 → BE, TP2 → trail, TP3 → close)
      if (!snap.tp1Hit && ((isLong && c.h >= snap.tp1) || (!isLong && c.l <= snap.tp1))) {
        snap.tp1Hit = true;
        sim.tradeReachedTP1 = true;
        if (CFG.beAfter === 'TP1') sim.slLine = snap.entry;
      }
      if (snap.tp1Hit && !snap.tp2Hit && ((isLong && c.h >= snap.tp2) || (!isLong && c.l <= snap.tp2))) {
        snap.tp2Hit = true;
        if (CFG.beAfter === 'TP2') sim.slLine = snap.entry;
      }
      if (snap.tp2Hit && ((isLong && c.h >= snap.tp3) || (!isLong && c.l <= snap.tp3))) {
        const exitPrice = snap.tp3;
        // Weighted R: qtyTP1+qtyTP2+qtyTP3 → 100
        const slDist = Math.abs(snap.entry - snap.sl);
        const r1 = (CFG.tp1ATR * snap.atrAtEntry) / slDist;
        const r2 = (CFG.tp2ATR * snap.atrAtEntry) / slDist;
        const r3 = (CFG.tp3ATR * snap.atrAtEntry) / slDist;
        const r = r1 * (CFG.qtyTP1/100) + r2 * (CFG.qtyTP2/100) + r3 * (CFG.qtyTP3/100);
        recordTradeOutcome(sim, snap, exitPrice, r, 'TP', barTime);
        sim.condition = 0; sim.snap = null;
        continue;
      }
      // Trail SL after TP1
      if (sim.tradeReachedTP1 && CFG.trailATR > 0) {
        const sliced = candles.slice(0, i + 1);
        const ind = computeBaseIndicators(sliced);
        if (ind) {
          const trailDist = ind.atr * CFG.trailATR;
          if (isLong) sim.slLine = Math.max(sim.slLine, c.c - trailDist);
          else sim.slLine = Math.min(sim.slLine, c.c + trailDist);
        }
      }
      sim.barsSinceEntry++;
      if (sim.barsSinceEntry > 50) {
        const exitPrice = c.c;
        const slDist = Math.abs(snap.entry - snap.sl);
        const r = isLong ? (exitPrice - snap.entry) / slDist : (snap.entry - exitPrice) / slDist;
        recordTradeOutcome(sim, snap, exitPrice, r, 'TIMEOUT', barTime);
        sim.condition = 0; sim.snap = null;
      }
    }

    // 2) Try open new trade
    if (sim.condition === 0) {
      const sliced = candles.slice(0, i + 1);
      const ind = computeBaseIndicators(sliced);
      if (!ind) continue;
      const regime = detectRegime(sliced);
      const sweep = detectLiquiditySweep(sliced, ind.atr);
      const corr = computeCorrelation(barTime);
      const pd = detectPremiumDiscount(sliced);
      const ses = detectSession(barTime);
      const news = detectNews(barTime);
      const magnets = detectLiquidityMagnets(sliced, ind.atr);
      const htf = htfBias(barTime);
      const struct = detectStructure(sliced);
      const ob = detectOrderBlocks(sliced, ind.atr);
      const ote = detectOTE(sliced);
      // ⭐ FVG ва HTF Engulfing — backtest учун sliced'дан ҳисобланади (look-ahead йўқ)
      const fvgs = detectFVGs(sliced, ind.atr);
      // HTF candles'ни ҳам barTime'гача кесамиз
      let htfSliced = htfCandlesAll;
      if (htfCandlesAll.length > 0) {
        let endHtfIdx = htfCandlesAll.length - 1;
        while (endHtfIdx >= 0 && (htfCandlesAll[endHtfIdx].epoch * 1000) > barTime) endHtfIdx--;
        htfSliced = htfCandlesAll.slice(0, endHtfIdx + 1);
      }
      const htfEng = detectHTFEngulfing(htfSliced);

      // Gates (same as live)
      if (ses.session === 'WEEKEND') continue;
      if (CFG.allowedSessions && CFG.allowedSessions[ses.session] === false) continue;
      if (CFG.allowedRegimes && CFG.allowedRegimes[regime.kind] === false) continue;
      if (!news.clear) continue;
      if (CFG.sessionFilter && ses.quality < 0.5) continue;
      if (regime.kind === 'CHOP' && CFG.strict) continue;
      // Volatility gate
      const atrPct = (ind.atr / ind.close) * 100;
      if (CFG.atrPctMin && atrPct < CFG.atrPctMin) continue;
      if (CFG.atrPctMax && atrPct > CFG.atrPctMax) continue;

      // ⭐ Reversal triggers (same as live)
      const reversalL = hasReversalTrigger('L', sweep, struct, fvgs, ind, regime);
      const reversalS = hasReversalTrigger('S', sweep, struct, fvgs, ind, regime);

      // ⭐ Score — sliced candles узатилади (look-ahead bias тузатилди)
      const scoreL = computeEurekaScore('L', ind, regime, sweep, corr, pd, ses, news, magnets, htf, struct, ob, ote, fvgs, htfEng, sliced);
      const scoreS = computeEurekaScore('S', ind, regime, sweep, corr, pd, ses, news, magnets, htf, struct, ob, ote, fvgs, htfEng, sliced);

      const mtfL = checkMTFConfluence('L', htf);
      const mtfS = checkMTFConfluence('S', htf);
      const mtfTh = 0.25;  // 0.4 → 0.25 (HTF align'i kamroq strict)
      const minDiff = CFG.minScoreDiff || 0;

      // Tier: T2 фақат reversal trigger билан
      const longTier = tierFor(scoreL.score, reversalL.length > 0);
      const shortTier = tierFor(scoreS.score, reversalS.length > 0);

      // ⭐ Yumshatilgan trigger logic (v12.2)
      // Reversal trigger 1 ta yetarli (was: 2)
      // Yoki: ALMA buy/sell, Supertrend cross, MSS/CHoCH
      const longTrigger = (ind.almaBuy || ind.stBuy || (struct.event && struct.eventDir === 1) || reversalL.length >= 1)
        && longTier
        && (scoreL.score - scoreS.score) >= minDiff
        && mtfL.score >= mtfTh;
      const shortTrigger = (ind.almaSell || ind.stSell || (struct.event && struct.eventDir === -1) || reversalS.length >= 1)
        && shortTier
        && (scoreS.score - scoreL.score) >= minDiff
        && mtfS.score >= mtfTh;

      let signalSide = null, signalScore = null, signalTier = null, signalTriggers = null;
      if (longTrigger && (!shortTrigger || scoreL.score >= scoreS.score)) {
        signalSide = 'L'; signalScore = scoreL; signalTier = longTier; signalTriggers = reversalL;
      } else if (shortTrigger) {
        signalSide = 'S'; signalScore = scoreS; signalTier = shortTier; signalTriggers = reversalS;
      } else {
        if (longTier && !mtfL.aligned) sim.blocked++;
        if (shortTier && !mtfS.aligned) sim.blocked++;
      }

      if (signalSide) {
        const isLong = signalSide === 'L';
        const entry = ind.close;
        // ⭐ Smart SL — FVG → OB → ATR (live'дагидек)
        let sl = isLong ? entry - ind.atr * CFG.slATR : entry + ind.atr * CFG.slATR;
        if (CFG.smartSLenabled && signalScore.breakdown && signalScore.breakdown._fvg) {
          const fvg = signalScore.breakdown._fvg;
          const buf = ind.atr * CFG.smartSLbuffer;
          const minDist = ind.atr * CFG.smartSLminATR;
          let cand = isLong ? fvg.bot - buf : fvg.top + buf;
          if (Math.abs(entry - cand) < minDist) cand = isLong ? entry - minDist : entry + minDist;
          if (Math.abs(entry - cand) <= ind.atr * CFG.slATR) sl = cand;
        } else if (CFG.smartSLenabled) {
          const activeOB = isLong ? ob.activeBull : ob.activeBear;
          if (activeOB) {
            const buf = ind.atr * CFG.smartSLbuffer;
            const minDist = ind.atr * CFG.smartSLminATR;
            let cand = isLong ? activeOB.bot - buf : activeOB.top + buf;
            if (Math.abs(entry - cand) < minDist) cand = isLong ? entry - minDist : entry + minDist;
            if (Math.abs(entry - cand) <= ind.atr * CFG.slATR) sl = cand;
          }
        }
        const slDistActual = Math.abs(entry - sl);
        const tp1 = isLong ? entry + ind.atr*CFG.tp1ATR : entry - ind.atr*CFG.tp1ATR;
        const tp2 = isLong ? entry + ind.atr*CFG.tp2ATR : entry - ind.atr*CFG.tp2ATR;
        const tp3 = isLong ? entry + ind.atr*CFG.tp3ATR : entry - ind.atr*CFG.tp3ATR;
        // Min R:R текшируви
        const rrEff = Math.abs(tp1 - entry) / slDistActual;
        if (rrEff < (CFG.minRR || 1.5)) continue;

        sim.snap = {
          isLong, entry, sl, tp1, tp2, tp3, tp1Hit:false, tp2Hit:false,
          tier: signalTier.tier, score: signalScore.score, breakdown: {...signalScore.breakdown},
          regime: regime.kind, session: ses.session, entryTime: barTime,
          atrAtEntry: ind.atr,           // R:R ҳисоблаш учун керак
          triggers: signalTriggers || [],
        };
        sim.condition = isLong ? 1 : -1;
        sim.slLine = sl;
        sim.tradeReachedTP1 = false;
        sim.barsSinceEntry = 0;
      }
    }

    // 3) Update progress
    const now = Date.now();
    if (now - lastUiUpdate > 80) {
      BT.progress = Math.round((i - startIdx) / totalBars * 100);
      updateBacktestProgress(BT.progress);
      lastUiUpdate = now;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Close any remaining trade
  if (sim.snap) {
    const last = candles[endIdx];
    const exitPrice = last.c;
    const slDist = Math.abs(sim.snap.entry - sim.snap.sl);
    const r = sim.snap.isLong ? (exitPrice - sim.snap.entry) / slDist : (sim.snap.entry - exitPrice) / slDist;
    recordTradeOutcome(sim, sim.snap, exitPrice, r, 'END', last.epoch * 1000);
  }

  BT.progress = 100;
  BT.running = false;
  BT.result = computeBacktestStats(sim, 'reversal');
  log('BT', `✅ Тугатилди: ${sim.total} битим, WR ${(sim.rWinCount/Math.max(1,sim.total)*100).toFixed(1)}%, R сум ${sim.rSum.toFixed(2)}`);
  return BT.result;
}

function recordTradeOutcome(sim, snap, exitPrice, r, exitType, exitTime) {
  sim.total++;
  sim.rSum += r;
  if (exitType === 'TP') sim.tpFull++;
  else if (exitType === 'BE') sim.beHits++;
  else if (exitType === 'SL') sim.slLosses++;
  else if (exitType === 'TIMEOUT') sim.timeouts++;
  else if (exitType === 'END') sim.endOpen++;
  if (r > 0.05) {
    sim.rWinSum += r; sim.rWinCount++;
  } else if (r >= -0.05 && r <= 0.05) {
    // BE-like
  } else {
    sim.rLossSum += Math.abs(r); sim.rLossCount++;
  }
  sim.maxR = Math.max(sim.maxR, sim.rSum);
  sim.minR = Math.min(sim.minR, sim.rSum);
  sim.equity.push({t: exitTime, r: sim.rSum, n: sim.total});

  const won = r > 0.05;
  const rg = sim.perRegime[snap.regime] || sim.perRegime.CHOP;
  rg.n++; if (won) rg.wins++; rg.r += r;
  const tr = sim.perTier[snap.tier] || sim.perTier.T2;
  tr.n++; if (won) tr.wins++; tr.r += r;
  const ss = sim.perSession[snap.session] || sim.perSession.OTHER;
  ss.n++; if (won) ss.wins++; ss.r += r;
  for (const f of FILTERS) {
    if ((snap.breakdown[f] || 0) > 0) {
      sim.perFilter[f].n++; if (won) sim.perFilter[f].wins++; sim.perFilter[f].r += r;
    }
  }
  // Per-trigger stats
  if (snap.triggers && snap.triggers.length > 0) {
    for (const t of snap.triggers) {
      if (sim.perTrigger[t]) { sim.perTrigger[t].n++; if (won) sim.perTrigger[t].wins++; sim.perTrigger[t].r += r; }
    }
  } else {
    sim.perTrigger.NONE.n++; if (won) sim.perTrigger.NONE.wins++; sim.perTrigger.NONE.r += r;
  }
  sim.history.push({
    t: snap.entryTime, exitT: exitTime,
    side: snap.isLong ? 'L' : 'S',
    entry: snap.entry, exit: exitPrice,
    sl: snap.sl, tp1: snap.tp1, tp2: snap.tp2, tp3: snap.tp3,
    r, exitType, tier: snap.tier, score: snap.score,
    regime: snap.regime, session: snap.session, triggers: snap.triggers || [],
  });
}

function computeBacktestStats(sim, mode) {
  const wr = sim.total > 0 ? sim.rWinCount / sim.total : 0;
  const tp3Rate = sim.total > 0 ? sim.tpFull / sim.total : 0;
  const pf = sim.rLossSum > 0 ? sim.rWinSum / sim.rLossSum : (sim.rWinSum > 0 ? 999 : 0);
  const exp = sim.total > 0 ? sim.rSum / sim.total : 0;
  let maxDD = 0, peak = 0;
  for (const e of sim.equity) {
    if (e.r > peak) peak = e.r;
    const dd = peak - e.r;
    if (dd > maxDD) maxDD = dd;
  }
  const avgWin = sim.rWinCount > 0 ? sim.rWinSum / sim.rWinCount : 0;
  const avgLoss = sim.rLossCount > 0 ? sim.rLossSum / sim.rLossCount : 0;
  return {
    mode, total: sim.total,
    wr, tp3Rate, pf, exp,
    rSum: sim.rSum, maxR: sim.maxR, minR: sim.minR,
    avgWin, avgLoss,
    tpFull: sim.tpFull, beHits: sim.beHits, slLosses: sim.slLosses, timeouts: sim.timeouts, endOpen: sim.endOpen,
    rWinCount: sim.rWinCount, rLossCount: sim.rLossCount,
    perRegime: sim.perRegime, perTier: sim.perTier, perSession: sim.perSession, perFilter: sim.perFilter,
    perTrigger: sim.perTrigger,
    history: sim.history,
    equity: sim.equity,
    maxDD,
    blocked: sim.blocked,
  };
}

function updateBacktestProgress(pct) {
  const el = document.getElementById('btProgress');
  if (el) {
    el.style.width = pct + '%';
    el.textContent = pct + '%';
  }
}
