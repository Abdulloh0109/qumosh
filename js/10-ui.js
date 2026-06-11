// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Дашборд UI янгилаш
// Globals: refreshDashboardUI, refreshAdaptiveUI, refreshNewsUI
// ═══════════════════════════════════════════════════════════════════

// ─── UI UPDATES ──────────────────────────────────────────────────────
function refreshDashboardUI() {
  if (!_lastSnapshot.ind) return;
  const {ind, regime, sweep, corr, pd, ses, news, magnets, htf, struct, ob, ote, scoreL, scoreS} = _lastSnapshot;

  // State bar
  const stWait = $('stWait'), stLong = $('stLong'), stShort = $('stShort');
  stWait.classList.toggle('on', ST.condition === 0);
  stLong.classList.toggle('on', ST.condition > 0);
  stLong.classList.toggle('l', ST.condition > 0);
  stShort.classList.toggle('on', ST.condition < 0);
  stShort.classList.toggle('s', ST.condition < 0);
  if (ST.condition === 0) {
    $('stWaitStage').textContent = 'сигнал излаяпти';
    $('stLongStage').textContent = '—'; $('stShortStage').textContent = '—';
  } else {
    const stage = Math.abs(ST.condition) === 1.0 ? '0/3 — TP1 кутилмоқда'
                : Math.abs(ST.condition) === 1.1 ? '1/3 — BE himoyada'
                : Math.abs(ST.condition) === 1.2 ? '2/3 — Trailing'
                : '3/3 — Тугади';
    if (ST.condition > 0) { $('stLongStage').textContent = stage; $('stShortStage').textContent = '—'; $('stWaitStage').textContent = '—'; }
    else { $('stShortStage').textContent = stage; $('stLongStage').textContent = '—'; $('stWaitStage').textContent = '—'; }
  }

  // Score
  $('scoreLong').textContent = scoreL.score.toFixed(0);
  $('scoreShort').textContent = scoreS.score.toFixed(0);
  $('scoreBarLong').style.width = scoreL.score + '%';
  $('scoreBarShort').style.width = scoreS.score + '%';
  // Score — UI учун `tierFor` ҳар қандай ҳолда тоифа қайтариши керак (display only)
  // Reversal trigger йўқ бўлган T2 балл "—" сифатида кўринади
  const reversalL = _lastSnapshot.reversalL || [];
  const reversalS = _lastSnapshot.reversalS || [];
  const tL = tierFor(scoreL.score, reversalL.length > 0) || {tier:'—', risk:0};
  const tS = tierFor(scoreS.score, reversalS.length > 0) || {tier:'—', risk:0};
  $('scoreTierLong').textContent = tL.tier; $('scoreTierLong').className = 'score-tier tier-' + tL.tier;
  $('scoreTierShort').textContent = tS.tier; $('scoreTierShort').className = 'score-tier tier-' + tS.tier;
  const bestSide = scoreL.score >= scoreS.score ? 'LONG' : 'SHORT';
  const bestScore = Math.max(scoreL.score, scoreS.score);
  const bestTier = bestSide === 'LONG' ? tL : tS;
  $('scoreVerdict').textContent = `${bestSide} ${bestScore.toFixed(0)} (${bestTier.tier})`;
  $('riskRec').textContent = bestTier.risk.toFixed(1) + '%';
  $('sideL').classList.toggle('active', bestSide === 'LONG');
  $('sideS').classList.toggle('active', bestSide === 'SHORT');

  // Active trade levels
  if (ST.snap) {
    $('lvlEntry').textContent = fmtPx(ST.snap.entry);
    $('lvlSL').textContent = fmtPx(ST.slLine);
    $('lvlTP1').textContent = fmtPx(ST.snap.tp1);
    $('lvlTP2').textContent = fmtPx(ST.snap.tp2);
    $('lvlTP3').textContent = fmtPx(ST.snap.tp3);
    $('rowTP1').classList.toggle('hit', Math.abs(ST.condition) >= 1.1);
    $('rowTP2').classList.toggle('hit', Math.abs(ST.condition) >= 1.2);
    $('rowTP3').classList.toggle('hit', Math.abs(ST.condition) >= 1.3);
    $('tradeBars').textContent = `${ST.barsSinceEntry} бар`;
  } else {
    ['lvlEntry','lvlSL','lvlTP1','lvlTP2','lvlTP3'].forEach(id => $(id).textContent = '—');
    $('rowTP1').classList.remove('hit'); $('rowTP2').classList.remove('hit'); $('rowTP3').classList.remove('hit');
    $('tradeBars').textContent = '—';
  }

  // Eureka filter rows
  // Detect current candlestick patterns for live UI display
  let _curPat = { buy: [], sell: [] };
  if (typeof detectCandlestickPatterns === 'function' && ST.candles && ST.candles.length >= 3) {
    _curPat = detectCandlestickPatterns(ST.candles);
  }
  const _allPat = [..._curPat.buy, ..._curPat.sell];
  let _patVal = 'нет';
  let _patStatus = 'neut';
  if (_allPat.length > 0) {
    const _strong = _allPat.reduce((m, p) => p.score > m.score ? p : m, _allPat[0]);
    _patVal = (typeof PATTERN_NAMES !== 'undefined' && PATTERN_NAMES[_strong.name]) ? PATTERN_NAMES[_strong.name] : _strong.name;
    _patStatus = _strong.score >= 10 ? 'pass' : 'warn';
  }

  // FVG
  let _fvgVal = 'нет';
  let _fvgStatus = 'neut';
  if (typeof detectFVGs === 'function' && ind && ST.candles) {
    const _fvgs = detectFVGs(ST.candles, ind.atr);
    if (_fvgs.length > 0) {
      const _bullFVG = _fvgs.filter(f => f.type === 'bull' && ind.close >= f.bot && ind.close <= f.top);
      const _bearFVG = _fvgs.filter(f => f.type === 'bear' && ind.close >= f.bot && ind.close <= f.top);
      if (_bullFVG.length > 0) {
        _fvgVal = `🟢 ${_bullFVG[0].bot.toFixed(1)}-${_bullFVG[0].top.toFixed(1)}`;
        _fvgStatus = 'pass';
      } else if (_bearFVG.length > 0) {
        _fvgVal = `🔴 ${_bearFVG[0].bot.toFixed(1)}-${_bearFVG[0].top.toFixed(1)}`;
        _fvgStatus = 'pass';
      } else {
        _fvgVal = `${_fvgs.length} faol`;
        _fvgStatus = 'warn';
      }
    }
  }

  // HTF Engulfing
  let _htfEngVal = 'нет';
  let _htfEngStatus = 'neut';
  if (typeof detectHTFEngulfing === 'function' && ST.candlesHTF && ST.candlesHTF.length >= 2) {
    const _hte = detectHTFEngulfing(ST.candlesHTF);
    if (_hte.bull) { _htfEngVal = '🟢 BULL'; _htfEngStatus = 'pass'; }
    else if (_hte.bear) { _htfEngVal = '🔴 BEAR'; _htfEngStatus = 'pass'; }
  }

  const filters = [
    {f:'regime', icon:'🌀', val:`${regime.kind} (${(regime.confidence*100).toFixed(0)}%)`, status: regime.kind === 'CHOP' ? 'fail' : regime.confidence > 0.5 ? 'pass' : 'warn'},
    {f:'sweep', icon:'💧', val: sweep.detected ? sweep.why : 'нет', status: sweep.detected ? 'pass' : 'neut'},
    {f:'dxy', icon:'📊', val: corr.verdictTxt, status: (corr.verdict === 'mix' || corr.verdict === 'flat') ? 'warn' : 'pass'},
    {f:'premium', icon:'⚖️', val: `${pd.zone.toUpperCase()} (${(pd.pos*100).toFixed(0)}%)`, status: pd.zone === 'mid' ? 'neut' : 'pass'},
    {f:'session', icon:'🕒', val: ses.txt, status: ses.quality >= 0.7 ? 'pass' : ses.quality >= 0.4 ? 'warn' : 'fail'},
    {f:'news', icon:'📰', val: news.txt, status: news.clear ? 'pass' : 'fail'},
    {f:'liquidity', icon:'🧲', val: magnets.nearestAbove ? `↑${magnets.nearestAbove.price.toFixed(2)}` : magnets.nearestBelow ? `↓${magnets.nearestBelow.price.toFixed(2)}` : 'нет', status: (magnets.nearestAbove?.count >= 2 || magnets.nearestBelow?.count >= 2) ? 'pass' : 'neut'},
    {f:'candlestick', icon:'🕯', val: _patVal, status: _patStatus},
    {f:'fvg', icon:'📦', val: _fvgVal, status: _fvgStatus},
    {f:'htf_eng', icon:'🔄', val: _htfEngVal, status: _htfEngStatus},
  ];
  let passes = 0;
  document.querySelectorAll('#fltGrid .flt-row').forEach(row => {
    const f = row.dataset.f;
    const found = filters.find(x => x.f === f); if (!found) return;
    row.className = 'flt-row ' + found.status;
    row.querySelector('.flt-val').textContent = found.val;
    row.querySelector('.flt-icon').textContent = found.icon;
    if (found.status === 'pass') passes++;
  });
  $('passCount').textContent = `${passes}/10`;

  // SMC Structure card
  $('strucBias').textContent = struct.bias === 'up' ? '⬆ UPTREND' : struct.bias === 'dn' ? '⬇ DOWNTREND' : struct.bias === 'mixed' ? '↔ MIXED' : '—';
  $('strucBias').className = 'struc-tag ' + (struct.bias === 'up' ? 'tag-up' : struct.bias === 'dn' ? 'tag-dn' : 'tag-neut');
  if (struct.event) {
    $('strucLast').textContent = struct.event;
    $('strucLast').className = 'struc-tag ' + (struct.event.startsWith('BOS') ? 'tag-bos' : struct.event.startsWith('CHoCH') ? 'tag-choch' : 'tag-mix');
  } else {
    $('strucLast').textContent = '—';
    $('strucLast').className = 'struc-tag tag-neut';
  }
  $('strucEvent').textContent = struct.event || '—';
  $('strucObBull').textContent = ob.activeBull ? `${ob.activeBull.bot.toFixed(2)}-${ob.activeBull.top.toFixed(2)}` : '—';
  $('strucObBear').textContent = ob.activeBear ? `${ob.activeBear.bot.toFixed(2)}-${ob.activeBear.top.toFixed(2)}` : '—';
  $('strucOTEzone').textContent = (ote.oteLow !== null && ote.oteHigh !== null) ? `${ote.oteLow.toFixed(2)}-${ote.oteHigh.toFixed(2)}` : '—';
  $('strucInOTE').textContent = ote.inOTE ? '✓ ДА' : '✗ ЙЎҚ';
  $('strucInOTE').className = 'struc-tag ' + (ote.inOTE ? 'tag-up' : 'tag-neut');

  // MTF (Multi-TF) confluence — show alignment for current dominant signal
  const mtfL = _lastSnapshot.mtfLong, mtfS = _lastSnapshot.mtfShort;
  if (mtfL && mtfS) {
    const lScore = _lastSnapshot.scoreL?.score || 0;
    const sScore = _lastSnapshot.scoreS?.score || 0;
    const dominant = lScore >= sScore ? mtfL : mtfS;
    const side = lScore >= sScore ? 'L' : 'S';
    const txt = `${dominant.aligned ? '✓' : '✗'} ${(dominant.score * 100).toFixed(0)}%`;
    const el = $('strucMTF');
    if (el) {
      el.textContent = txt + (dominant.reason ? ` · ${dominant.reason.slice(0, 30)}` : '');
      el.className = 'struc-tag ' + (dominant.aligned ? 'tag-up' : 'tag-dn');
      el.title = `${side === 'L' ? 'LONG' : 'SHORT'}: ${dominant.reason}`;
    }
  } else {
    const el = $('strucMTF');
    if (el) { el.textContent = '—'; el.className = 'struc-tag tag-neut'; }
  }

  // Correlation
  // Synth DXY (8 валюта para'дан ҳисобланган — 96% real correlation)
  $('corDXY').textContent = corr.dxy !== null ? pct(corr.dxy, 2) : '—';
  $('corDXYarr').textContent = corr.dxyDir === 'up' ? '▲ USD' : corr.dxyDir === 'dn' ? '▼ USD' : '─';
  $('corDXYarr').className = 'cor-arr ' + (corr.dxyDir === 'up' ? 'dn' : corr.dxyDir === 'dn' ? 'up' : 'flat');
  $('corRisk').textContent = corr.risk !== null ? pct(corr.risk, 2) : '—';
  $('corRiskArr').textContent = corr.riskDir === 'up' ? 'RISK-ON' : corr.riskDir === 'dn' ? 'RISK-OFF' : '─';
  $('corRiskArr').className = 'cor-arr ' + (corr.riskDir === 'dn' ? 'up' : corr.riskDir === 'up' ? 'dn' : 'flat');
  $('corSafe').textContent = corr.safe !== null ? pct(corr.safe, 2) : '—';
  $('corSafeArr').textContent = corr.safeDir === 'up' ? '▲ HAVEN' : corr.safeDir === 'dn' ? '▼ HAVEN' : '─';
  $('corSafeArr').className = 'cor-arr ' + (corr.safeDir === 'up' ? 'up' : corr.safeDir === 'dn' ? 'dn' : 'flat');
  $('corYields').textContent = corr.yields !== null ? pct(corr.yields, 2) : '—';
  $('corYieldsArr').textContent = corr.yieldsDir === 'up' ? '▲ YIELDS' : corr.yieldsDir === 'dn' ? '▼ YIELDS' : '─';
  $('corYieldsArr').className = 'cor-arr ' + (corr.yieldsDir === 'up' ? 'dn' : corr.yieldsDir === 'dn' ? 'up' : 'flat');
  const cv = $('corVerdict');
  cv.className = 'cor-verdict ' + corr.verdict;
  cv.textContent = corr.verdictTxt;

  // Indicators
  $('indATR').textContent = fmt(ind.atr, 3);
  $('indATRpct').textContent = (regime.atrPct * 100).toFixed(0) + '%';
  $('indRSI').textContent = ind.rsi !== null ? ind.rsi.toFixed(1) : '—';
  $('indHurst').textContent = regime.hurst.toFixed(2);
  $('indEMA200').textContent = ind.close > ind.ema200 ? 'ABOVE 🟢' : 'BELOW 🔴';
  $('indMACD').textContent = ind.macdHist !== null ? (ind.macdHist > 0 ? '+' : '') + ind.macdHist.toFixed(2) : '—';
  $('indALMA').textContent = ind.closeMA > ind.openMA ? '🟢 BULL' : '🔴 BEAR';
  $('indST').textContent = ind.stTrend === 1 ? '🟢 UP' : '🔴 DN';
  $('indFVG').textContent = ind.fvgBull ? '🟢 Bull' : ind.fvgBear ? '🔴 Bear' : '—';
  $('indHTF').textContent = htf.txt;

  // Stats
  const closed = ST.tpWins + ST.beHits + ST.slLosses;
  const trueWR = closed ? (ST.tpWins / closed) * 100 : null;
  const beRate = closed ? (ST.beHits / closed) * 100 : null;
  const lr = closed ? (ST.slLosses / closed) * 100 : null;
  const avgW = ST.rWinCount ? ST.rWinSum / ST.rWinCount : null;
  const avgL = ST.rLossCount ? ST.rLossSum / ST.rLossCount : null;
  const exp = closed ? (ST.rSum / closed) : null;
  $('stTotal').textContent = ST.total;
  $('stTrueWR').textContent = trueWR !== null ? trueWR.toFixed(0) + '%' : '—';
  $('stBE').textContent = beRate !== null ? beRate.toFixed(0) + '%' : '—';
  $('stLR').textContent = lr !== null ? lr.toFixed(0) + '%' : '—';
  $('stAvgW').textContent = avgW !== null ? '+' + avgW.toFixed(2) + 'R' : '—';
  $('stAvgL').textContent = avgL !== null ? '-' + avgL.toFixed(2) + 'R' : '—';
  $('stExp').textContent = exp !== null ? (exp >= 0 ? '+' : '') + exp.toFixed(2) + 'R' : '—';
  $('stExp').className = 'stat-val mono ' + (exp === null ? '' : exp > 0.1 ? 'good' : exp < -0.1 ? 'bad' : 'neut');
  $('stTodayR').textContent = (ST.todayR >= 0 ? '+' : '') + ST.todayR.toFixed(1) + 'R';
  $('stTodayR').className = 'stat-val mono ' + (ST.todayR > 0 ? 'good' : ST.todayR < 0 ? 'bad' : 'neut');
  $('statsExpTag').textContent = exp !== null ? (exp >= 0 ? '+' : '') + exp.toFixed(2) + 'R' : '—';

  // Adaptive weights panel
  refreshAdaptiveUI();

  // News panel
  refreshNewsUI();

  // History
  const tb = $('histBody');
  if (ST.history.length === 0) {
    tb.innerHTML = '<tr><td colspan="11" style="text-align:center; color:var(--mute); padding:18px;">Битимлар бўш</td></tr>';
  } else {
    tb.innerHTML = ST.history.slice(0, 12).map((h, i) => {
      const sideCls = h.side === 'L' ? 'B' : 'S';
      const sideTxt = h.side === 'L' ? 'BUY' : 'SELL';
      const exitCls = h.exit === 'tp' ? 'tp' : h.exit === 'sl' ? 'sl' : h.exit === 'be' ? 'be' : 'live';
      const exitTxt = h.exit === 'tp' ? '🏆 TP' : h.exit === 'sl' ? '✗ SL' : h.exit === 'be' ? '🛡 BE' : '⏳';
      return `<tr>
        <td style="color:var(--mute)">${ST.history.length - i}</td>
        <td>${h.ts}</td>
        <td><span class="hist-side ${sideCls}">${sideTxt}</span></td>
        <td>${h.score} ${h.tier}</td>
        <td style="color:var(--orange)">${fmtPx(h.entry)}</td>
        <td style="color:var(--red)">${fmtPx(h.sl)}</td>
        <td style="color:var(--green)">${fmtPx(h.tp3)}</td>
        <td><span class="hist-out ${exitCls}">${exitTxt}</span></td>
        <td style="color:${h.r>0?'var(--green)':h.r<0?'var(--red)':'var(--orange)'};font-weight:700">${(h.r>=0?'+':'') + h.r.toFixed(1)}R</td>
        <td style="font-size:9.5px; color:var(--dim)">${h.regime||'-'}</td>
        <td style="font-size:9.5px; color:var(--purple)">${h.structEvent||'-'}</td>
      </tr>`;
    }).join('');
  }
  $('histCount').textContent = ST.history.length + ' та';

  // Daily reset
  const today = new Date().getUTCDate();
  if (ST.lastDay !== -1 && ST.lastDay !== today) ST.todayR = 0;
  ST.lastDay = today;

  // ⭐ v8: PDF MODULES UI
  refreshV8UI();
  // ⭐ v9: ICT Bible + Divergence + SMT + AMD + Blocks + Psych
  refreshV9UI();
  // ⭐ v10: Chart Patterns + Fibonacci + Inducement
  refreshV10UI();
  // ⭐ v11: Trendline + Volume + Gap + MTV
  if (typeof refreshV11UI === 'function') refreshV11UI();
}

// ─── v8 PDF MODULES UI ───────────────────────────────────────────────
function refreshV8UI() {
  if (!_lastSnapshot.ind) return;
  const snap = _lastSnapshot;

  // ─── TTrades swing ──
  const tt = snap.ttrades;
  if (tt && tt.swing) {
    const sw = tt.swing;
    const dirEmoji = tt.dir > 0 ? '🟢↑' : '🔴↓';
    const tfTag = sw._tf === 'HTF' ? ' <small>(HTF)</small>' : ' <small>(LTF)</small>';
    setEl('v8Swing', `${dirEmoji} ${sw.type}${tfTag}`, tt.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v8Swing', '—', 'tag-neut');
  }
  // CISD
  if (tt && tt.cisd) {
    const cls = tt.cisd.confirmed ? 'tag-good' : 'tag-neut';
    const txt = tt.cisd.confirmed ? `✓ ${tt.cisd.why}` : tt.cisd.why;
    setEl('v8Cisd', txt, cls);
  } else {
    setEl('v8Cisd', '—', 'tag-neut');
  }
  // Targets
  if (tt && tt.targets && tt.targets.t2) {
    document.getElementById('v8Targets').textContent =
      `${tt.targets.t2.toFixed(1)} / ${tt.targets.t4.toFixed(1)}`;
  } else {
    document.getElementById('v8Targets').textContent = '—';
  }

  // ─── Daily Profile ──
  const dp = (snap.dailyProfileL && snap.dailyProfileL.profile) || (snap.dailyProfileS && snap.dailyProfileS.profile);
  if (dp && dp.londonRange) {
    document.getElementById('v8London').textContent =
      `${dp.londonRange.low.toFixed(1)}-${dp.londonRange.high.toFixed(1)} (${dp.londonRange.rangeSize.toFixed(1)})`;
  } else {
    document.getElementById('v8London').textContent = '—';
  }
  if (dp) {
    const cls = dp.profile === 'LONDON_REVERSAL' ? 'tag-good' :
                dp.profile === 'NY_REVERSAL' ? 'tag-good' :
                dp.profile === 'EXPANSION' ? 'tag-bad' : 'tag-neut';
    const dirTxt = dp.dir > 0 ? ' ↑' : dp.dir < 0 ? ' ↓' : '';
    setEl('v8Profile', `${dp.profile}${dirTxt}`, cls);
  } else {
    setEl('v8Profile', '—', 'tag-neut');
  }

  // ─── Weekly narrative ──
  if (typeof detectWeeklyNarrative === 'function' && ST.candles && ST.candles.length > 200) {
    const wn = detectWeeklyNarrative(ST.candles);
    document.getElementById('v8Weekly').textContent = wn.why || '—';
  }

  // ─── Compression ──
  const chL = snap.chlL, chS = snap.chlS;
  const comp = (chL && chL.compression && chL.compression.detected) ? chL.compression :
               (chS && chS.compression && chS.compression.detected) ? chS.compression : null;
  if (comp && comp.detected) {
    const cls = comp.dir > 0 ? 'tag-good' : 'tag-bad';
    setEl('v8Comp', comp.why, cls);
  } else {
    setEl('v8Comp', '—', 'tag-neut');
  }
  // HLQ
  const hlq = (chL && chL.hlq) || (chS && chS.hlq);
  if (hlq && hlq.zones && hlq.zones.length) {
    document.getElementById('v8Hlq').textContent =
      `${hlq.zones.length} зона (${hlq.zones.map(z => z.sources.join('+')).slice(0, 2).join(', ')})`;
  } else {
    document.getElementById('v8Hlq').textContent = '—';
  }
  // QMR
  const qmr = (chL && chL.qmr && chL.qmr.detected) ? chL.qmr :
              (chS && chS.qmr && chS.qmr.detected) ? chS.qmr : null;
  if (qmr && qmr.detected) {
    setEl('v8Qmr', qmr.why, qmr.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v8Qmr', '—', 'tag-neut');
  }
  // Risk regime
  const macroAny = (snap.macroL && snap.macroL.risk) || (snap.macroS && snap.macroS.risk);
  if (macroAny) {
    const cls = macroAny.regime === 'RISK_OFF' ? 'tag-good' :
                macroAny.regime === 'RISK_ON' ? 'tag-bad' : 'tag-neut';
    setEl('v8Risk', `${macroAny.regime} (${macroAny.score.toFixed(2)})`, cls);
    document.getElementById('v8Macro').textContent = macroAny.why || '—';
  } else {
    setEl('v8Risk', '—', 'tag-neut');
    document.getElementById('v8Macro').textContent = '—';
  }

  // Monday rule
  const isMon = (typeof isMondayBlocked === 'function') ? isMondayBlocked() : false;
  const mondayDow = new Date().getUTCDay() === 1;
  if (mondayDow) {
    setEl('v8Monday', CFG.mondayBlock ? '🚫 АКТИВ (T2 блок)' : 'Monday — кузатинг', CFG.mondayBlock ? 'tag-bad' : 'tag-neut');
  } else {
    setEl('v8Monday', 'Monday эмас', 'tag-good');
  }

  // ─── Daily 10-checklist ──
  if (typeof buildDailyChecklist === 'function') {
    try {
      const items = buildDailyChecklist();
      const bullCount = items.filter(i => i.signal === 'bull').length;
      const bearCount = items.filter(i => i.signal === 'bear').length;
      document.getElementById('v8ClistAcc').textContent = `🟢${bullCount} 🔴${bearCount} ⚪${items.length - bullCount - bearCount}`;
      document.getElementById('v8Checklist').innerHTML = items.map(it => {
        const color = it.signal === 'bull' ? 'var(--green)' :
                      it.signal === 'bear' ? 'var(--red)' : 'var(--mute)';
        const icon = it.signal === 'bull' ? '🟢' : it.signal === 'bear' ? '🔴' : '⚪';
        return `<div style="border:1px solid var(--bord); border-radius:6px; padding:6px 8px; background:var(--bg2)">
          <div style="display:flex; justify-content:space-between; gap:4px; align-items:start">
            <span style="font-weight:600; color:var(--text); font-size:10px">${it.q}</span>
            <span style="font-size:10px">${icon}</span>
          </div>
          <div style="color:${color}; font-weight:600; margin-top:2px; font-size:10.5px">${it.answer}</div>
          <div style="color:var(--dim); font-size:9px; margin-top:2px">${it.detail || ''}</div>
        </div>`;
      }).join('');
    } catch(e) {
      document.getElementById('v8Checklist').innerHTML = '<div style="color:var(--mute); padding:8px">Кутилмоқда...</div>';
    }
  }
}

// Helper for setting element text + class
function setEl(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (cls) {
    el.className = el.className.replace(/tag-\w+/g, '').trim() + ' ' + cls;
  }
}

// ─── v9 PDF MODULES UI ───────────────────────────────────────────────
function refreshV9UI() {
  if (!_lastSnapshot.ind) return;
  const snap = _lastSnapshot;

  // ─── Divergence ──
  const divL = snap.divL, divS = snap.divS;
  const allDivs = [...(divL?.divergences || []), ...(divS?.divergences || [])];
  if (allDivs.length) {
    const types = [...new Set(allDivs.map(d => d.type.replace('_RSI', '').replace('_MACD', '')))];
    const dir = allDivs[0].dir;
    setEl('v9Div', `${dir > 0 ? '🟢' : '🔴'} ${types.join(', ')}`, dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v9Div', '—', 'tag-neut');
  }
  // Stinger
  const stinger = divL?.stinger || divS?.stinger;
  if (stinger) {
    setEl('v9Stinger', `🐝 ${stinger.type}`, stinger.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v9Stinger', '—', 'tag-neut');
  }

  // ─── Key Levels ──
  const levels = (snap.klL && snap.klL.levels) || (snap.klS && snap.klS.levels);
  if (levels) {
    if (levels.pdh && levels.pdl) {
      document.getElementById('v9PDHPDL').textContent = `${levels.pdh.toFixed(1)} / ${levels.pdl.toFixed(1)}`;
    }
    if (levels.pwh && levels.pwl) {
      document.getElementById('v9PWHPWL').textContent = `${levels.pwh.toFixed(1)} / ${levels.pwl.toFixed(1)}`;
    }
    if (levels.midnightOpen) {
      const cur = snap.ind.close;
      const arrow = cur > levels.midnightOpen ? '↑' : '↓';
      const color = cur > levels.midnightOpen ? 'color:var(--green)' : 'color:var(--red)';
      document.getElementById('v9Midnight').innerHTML = `<span style="${color}">${levels.midnightOpen.toFixed(1)} ${arrow}</span>`;
    }
  }
  // Judas Swing
  const judas = snap.klL?.judas?.detected ? snap.klL.judas : (snap.klS?.judas?.detected ? snap.klS.judas : null);
  if (judas && judas.detected) {
    setEl('v9Judas', `⚔️ ${judas.sweptLevel?.name || ''} ${judas.dir > 0 ? '↑' : '↓'}`,
          judas.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v9Judas', '—', 'tag-neut');
  }

  // ─── SMT ──
  const smt = snap.smtAmdL?.smt?.divergences?.length ? snap.smtAmdL.smt : (snap.smtAmdS?.smt?.divergences?.length ? snap.smtAmdS.smt : null);
  if (smt && smt.strongest) {
    setEl('v9SMT', `${smt.strongest.pair}: ${smt.strongest.dir > 0 ? '↑' : '↓'}`,
          smt.strongest.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v9SMT', '—', 'tag-neut');
  }

  // ─── AMD ──
  const amd = snap.smtAmdL?.amd || snap.smtAmdS?.amd;
  if (amd) {
    const cls = amd.dir > 0 ? 'tag-good' : amd.dir < 0 ? 'tag-bad' : 'tag-neut';
    setEl('v9AMD', amd.day || '—', cls);
  } else {
    setEl('v9AMD', '—', 'tag-neut');
  }

  // ─── Breaker ──
  const blocksL = snap.blocksL, blocksS = snap.blocksS;
  const breaker = blocksL?.breakers?.activeBull || blocksS?.breakers?.activeBear;
  if (breaker) {
    const isBull = !!(blocksL?.breakers?.activeBull);
    setEl('v9Breaker', `📦 ${isBull ? 'BULL' : 'BEAR'} ${breaker.top.toFixed(1)}`, isBull ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v9Breaker', '—', 'tag-neut');
  }

  // Rejection
  const rejL = blocksL?.rejections?.bullishRejections || [];
  const rejS = blocksS?.rejections?.bearishRejections || [];
  const recentRej = [...rejL.filter(r => r.age <= 3), ...rejS.filter(r => r.age <= 3)];
  if (recentRej.length) {
    const isBull = rejL.length > 0;
    setEl('v9Rejection', `🕯 ${isBull ? 'BULL' : 'BEAR'} wick`, isBull ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v9Rejection', '—', 'tag-neut');
  }

  // ─── Psychology ──
  if (typeof detectRiskState === 'function') {
    const riskState = detectRiskState();
    const cls = riskState.state === 'NORMAL' ? 'tag-good' :
                ['REVENGE_RISK', 'DRAWDOWN'].includes(riskState.state) ? 'tag-bad' : 'tag-neut';
    setEl('v9Psych', riskState.state, cls);
  }

  // ─── Quote ──
  if (typeof getPsychQuote === 'function') {
    const q = getPsychQuote();
    document.getElementById('v9Quote').textContent = `"${q.en}" — ${q.author}`;
  }

  // ─── Psychology Checklist ──
  if (typeof buildPsychChecklist === 'function') {
    try {
      const { items, warnings, state } = buildPsychChecklist();
      document.getElementById('v9PsychAcc').textContent = state;
      const warningsHtml = warnings.length
        ? `<div style="grid-column:1/-1; background:#7a2f2f; color:#fff; padding:8px; border-radius:6px; font-weight:600">${warnings.join(' · ')}</div>`
        : '';
      document.getElementById('v9PsychList').innerHTML = warningsHtml + items.map(it => {
        const color = it.signal === 'good' ? 'var(--green)' :
                      it.signal === 'warn' ? 'var(--red)' : 'var(--mute)';
        const icon = it.signal === 'good' ? '✅' : it.signal === 'warn' ? '⚠️' : '⚪';
        return `<div style="border:1px solid var(--bord); border-radius:6px; padding:6px 8px; background:var(--bg2)">
          <div style="display:flex; justify-content:space-between; gap:4px; align-items:start">
            <span style="font-weight:600; color:var(--text); font-size:10px">${it.q}</span>
            <span style="font-size:10px">${icon}</span>
          </div>
          <div style="color:${color}; font-weight:600; margin-top:2px; font-size:10.5px">${it.answer}</div>
          <div style="color:var(--dim); font-size:9px; margin-top:2px">${it.detail || ''}</div>
        </div>`;
      }).join('');
    } catch(e) {}
  }
}

function refreshAdaptiveUI() {
  const list = $('adaptList');
  // Show currently active regime's weights
  const activeRegime = _lastSnapshot?.regime?.kind || 'CHOP';
  const W = ST.adaptWeights[activeRegime] || ST.adaptWeights.CHOP;
  const items = FILTERS.map(f => {
    const wr = getFilterRecentWR(f, activeRegime);
    const w = (W && typeof W[f] === 'number') ? W[f] : 1.0;
    const trend = w > 1.05 ? 'up' : w < 0.95 ? 'dn' : 'eq';
    return {f, wr, weight: w, trend};
  });
  // Show only filters with samples or non-default weight
  const visible = items.filter(x => x.wr || Math.abs(x.weight - 1.0) > 0.05);
  // Get total samples in this regime
  const regimeStats = getRegimeStats(activeRegime);
  // Active regime header
  const regimeLabel = {TREND_UP:'📈 TREND UP', TREND_DN:'📉 TREND DN', RANGE:'═ RANGE', CHOP:'⊿ CHOP'}[activeRegime] || activeRegime;
  const headerHtml = `<div class="adapt-header">
    <span class="adapt-regime-label">Ҳозирги: <b>${regimeLabel}</b></span>
    <span class="adapt-regime-n">${regimeStats.n} битим${regimeStats.n > 0 ? ` · WR ${(regimeStats.wr*100).toFixed(0)}%` : ''}</span>
  </div>`;
  if (visible.length === 0) {
    list.innerHTML = headerHtml + '<div class="news-empty">Ушбу режимда 8+ битимдан кейин ишлайди</div>';
    return;
  }
  const fLabels = {regime:'Регим', sweep:'Sweep', dxy:'DXY', premium:'Prem/Disc', session:'Сеанс', liquidity:'Liq Mag', almast:'ALMA+ST', momentum:'Momentum', mss:'MSS/BOS', ob:'OrderBlk', ote:'OTE', candlestick:'Шамчa', fvg:'FVG', htf_eng:'HTF Eng'};
  list.innerHTML = headerHtml + visible.map(x => {
    const wr = x.wr ? Math.round(x.wr.wr * 100) : null;
    const wrTxt = wr !== null ? `${wr}%` : '—';
    const wrColor = wr === null ? 'var(--dim)' : wr >= 60 ? 'var(--green)' : wr >= 40 ? 'var(--gold)' : 'var(--red)';
    const barW = Math.min(100, x.weight * 60);
    const barColor = x.trend === 'up' ? 'var(--green)' : x.trend === 'dn' ? 'var(--red)' : 'var(--mute)';
    const tagCls = x.trend === 'up' ? 'adapt-up' : x.trend === 'dn' ? 'adapt-dn' : 'adapt-eq';
    const tagSym = x.trend === 'up' ? '▲' : x.trend === 'dn' ? '▼' : '═';
    return `<div class="adapt-row">
      <span class="adapt-name">${fLabels[x.f] || x.f}</span>
      <div class="adapt-bar-wrap"><div class="adapt-bar" style="width:${barW}%; background:${barColor}"></div></div>
      <span class="adapt-wr" style="color:${wrColor}">${wrTxt}</span>
      <span class="adapt-tag ${tagCls}">${tagSym}${x.weight.toFixed(2)}</span>
    </div>`;
  }).join('');
}

// Track which news item is expanded (by name+timestamp)
let _expandedNewsKey = null;

function toggleNewsExpansion(key) {
  _expandedNewsKey = (_expandedNewsKey === key) ? null : key;
  refreshNewsUI();
}

function refreshNewsUI() {
  const list = $('newsList');
  const now = Date.now();
  const today = new Date();
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const todayEnd = todayStart + 86400000;
  // Filter to TODAY only (UTC) — both upcoming and recent past today
  const todayEvents = CAL.events.filter(e => {
    const t = e.date.getTime();
    return t >= todayStart && t < todayEnd;
  });
  if (todayEvents.length === 0) {
    list.innerHTML = `<div class="news-empty">Бугун ивент йўқ${CAL.source === 'pattern' ? ' (паттерн режим — 🔄 босиб синаб кўринг)' : ''}</div>`;
  } else {
    list.innerHTML = todayEvents.map((ev, idx) => {
      const ms = ev.date.getTime() - now;
      const past = ms < 0;
      const imminent = ms > 0 && ms < 30 * 60 * 1000;
      const cls = imminent ? 'imminent' : past ? 'passed' : '';
      let when;
      if (past) {
        const m = Math.floor(-ms / 60000);
        when = m < 60 ? `${m}мин олдин` : `${Math.floor(m/60)}с олдин`;
      } else {
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        if (hrs > 0) when = `${hrs}с ${mins}м`;
        else when = `${mins}мин кейин`;
      }
      const tm = ev.date.toISOString().slice(11, 16);
      const fc = ev.forecast || '—';
      const pv = ev.previous || '—';
      const desc = ev.desc || '';
      const key = ev.name + '_' + ev.date.getTime();
      const isExpanded = _expandedNewsKey === key;
      const expandIcon = isExpanded ? '▾' : '▸';
      return `<div class="news-row ${ev.impact} ${cls} ${isExpanded ? 'expanded' : ''}" data-news-key="${key}">
        <div class="news-row-main">
          <div class="news-time"><span class="when">${when}</span>${tm} UTC</div>
          <div class="news-name">
            <div>${ev.name}<span class="ccy">${ev.currency}</span> <span style="color:var(--cyan); font-size:11px; margin-left:4px">${expandIcon}</span></div>
            ${desc ? `<div class="news-desc">${desc}</div>` : ''}
            <div class="news-fc"><span>Прогноз: <b>${fc}</b></span><span>Олдинги: <b>${pv}</b></span></div>
          </div>
          <div class="news-impact ${ev.impact}">${ev.impact.toUpperCase()}</div>
        </div>
        ${isExpanded ? buildAnalysisHtml(ev) : ''}
      </div>`;
    }).join('');
    // Wire up click handlers
    list.querySelectorAll('.news-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't toggle if clicking inside detail panel
        if (e.target.closest('.news-detail')) return;
        const key = row.dataset.newsKey;
        if (key) toggleNewsExpansion(key);
      });
    });
  }
  const srcLabel = CAL.source === 'forexfactory' ? `🟢 FF · ${todayEvents.length}` : `🟡 паттерн · ${todayEvents.length}`;
  $('newsCount').textContent = srcLabel;

  // Past impacts
  const il = $('impList');
  if (CAL.past.length === 0) {
    il.innerHTML = '<div class="news-empty">Ивент кутилмоқда</div>';
  } else {
    il.innerHTML = CAL.past.slice(0, 8).map(p => {
      const swing = `±$${p.swing.toFixed(1)}`;
      const dirIcon = p.direction === 'up' ? '↑' : p.direction === 'dn' ? '↓' : '═';
      return `<div class="imp-row ${p.direction}">
        <div class="imp-date">${p.dateTxt}</div>
        <div class="imp-name">${p.name}</div>
        <div class="imp-swing ${p.direction}">${dirIcon}${swing}</div>
      </div>`;
    }).join('');
  }
  $('impCount').textContent = CAL.past.length;
}

// ─── v10 PDF MODULES UI ──────────────────────────────────────────────
function refreshV10UI() {
  if (!_lastSnapshot.ind) return;
  const snap = _lastSnapshot;

  // ─── Chart Patterns ──
  const cpAll = [...(snap.cpL?.matching || []), ...(snap.cpS?.matching || [])];
  if (cpAll.length) {
    const types = [...new Set(cpAll.map(p => p.type))];
    const firstWithDir = cpAll.find(p => p.dir !== 0);
    const dir = firstWithDir?.dir || 0;
    const cls = dir > 0 ? 'tag-good' : dir < 0 ? 'tag-bad' : 'tag-neut';
    setEl('v10Pattern', types.join(', '), cls);
    // Show entry/SL/target if we have one
    const p = firstWithDir || cpAll[0];
    if (p && p.entry != null && p.target != null) {
      document.getElementById('v10PatternLevels').textContent =
        `E:${p.entry.toFixed(1)} SL:${p.sl ? p.sl.toFixed(1) : '—'} TP:${p.target.toFixed(1)}`;
    } else {
      document.getElementById('v10PatternLevels').textContent = '—';
    }
  } else {
    setEl('v10Pattern', '—', 'tag-neut');
    document.getElementById('v10PatternLevels').textContent = '—';
  }

  // ─── Fibonacci ──
  const fib = snap.fibL?.fib || snap.fibS?.fib;
  if (fib && (snap.fibL?.activeZone || snap.fibS?.activeZone)) {
    const zone = snap.fibL?.activeZone || snap.fibS?.activeZone;
    setEl('v10FibZone', `${zone.pct.toFixed(1)}% @ ${zone.price.toFixed(1)}`,
          zone.pct >= 50 && zone.pct <= 78.6 ? 'tag-good' : 'tag-neut');
  } else {
    setEl('v10FibZone', '—', 'tag-neut');
  }
  const ext = snap.fibL?.nearestExt || snap.fibS?.nearestExt;
  if (ext) {
    document.getElementById('v10FibExt').textContent = `${ext.pct.toFixed(1)}% → ${ext.price.toFixed(1)}`;
  } else {
    document.getElementById('v10FibExt').textContent = '—';
  }

  // ─── Algo Candle ──
  const algoL = snap.idmL?.algoCandle;
  const algoS = snap.idmS?.algoCandle;
  const algo = algoL || algoS;
  if (algo) {
    setEl('v10Algo', `${algo.type} ${algo.grabsLiq ? '+liq' : ''}`,
          algo.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v10Algo', '—', 'tag-neut');
  }

  // ─── Inducement ──
  const idmL = snap.idmL?.inducement;
  const idmS = snap.idmS?.inducement;
  const idm = idmL || idmS;
  if (idm) {
    setEl('v10IDM', `${idm.type} @${idm.idmLevel.toFixed(1)}`,
          idm.dir > 0 ? 'tag-good' : 'tag-bad');
  } else {
    setEl('v10IDM', '—', 'tag-neut');
  }

  // ─── v10 scores ──
  const lScore = (snap.cpL?.score || 0) + (snap.fibL?.score || 0) + (snap.idmL?.score || 0);
  const sScore = (snap.cpS?.score || 0) + (snap.fibS?.score || 0) + (snap.idmS?.score || 0);
  document.getElementById('v10LScore').textContent = lScore.toFixed(0);
  document.getElementById('v10SScore').textContent = sScore.toFixed(0);
}

// ─── v11 NEWS-DRIVEN UI ──────────────────────────────────────────────
function refreshV11UI() {
  if (!_lastSnapshot.ind) return;
  const snap = _lastSnapshot;

  // ─── Active news reactions ──
  const activeList = (typeof NEWS_REACTIONS !== 'undefined') ? NEWS_REACTIONS.active : [];
  const ndL = snap.ndL, ndS = snap.ndS;

  // Status badge
  let statusText = '—', statusCls = 'tag-neut';
  if (activeList.length > 0) {
    const dirL = ndL?.active ? '↑' : '';
    const dirS = ndS?.active ? '↓' : '';
    if (ndL?.score > 0 || ndS?.score > 0) {
      statusText = `ACTIVE ${dirL}${dirS}`;
      statusCls = (ndL?.score > 0) ? 'tag-good' : 'tag-bad';
    } else {
      statusText = `${activeList.length} kuting`;
      statusCls = 'tag-warn';
    }
  }
  setEl('v11Status', statusText, statusCls);

  // Active news event names
  if (activeList.length > 0) {
    const names = activeList.map(a => {
      const evName = (a.event.name || a.event.title || 'News').slice(0, 18);
      const ageMin = Math.floor((Date.now() - new Date(a.event.dateTime || a.event.time).getTime()) / 60000);
      return `${evName} (${a.strength.slice(0, 6)}, ${ageMin}m, ${a.direction > 0 ? '↑' : '↓'})`;
    });
    document.getElementById('v11NewsList').innerHTML = names.map(n =>
      `<div style="padding:4px 6px; background:var(--bg2); border-radius:4px; margin:2px 0; font-size:10.5px">${n}</div>`
    ).join('');
  } else {
    document.getElementById('v11NewsList').innerHTML =
      '<div style="color:var(--mute); font-size:10.5px; padding:4px;">Кучли news кутилмоқда...</div>';
  }

  // Retracement status
  const nd = ndL?.active ? ndL : (ndS?.active ? ndS : null);
  if (nd && nd.retracement) {
    const r = nd.retracement;
    const cls = r.ready ? 'tag-good' : 'tag-warn';
    setEl('v11Retrace', r.ready ? `READY ${r.currentRetracePct}%` : `${r.currentRetracePct}%`, cls);
    document.getElementById('v11FibLevels').textContent =
      `Fib50 ${r.fib50.toFixed(1)} · Fib618 ${r.fib618.toFixed(1)}`;
  } else {
    setEl('v11Retrace', '—', 'tag-neut');
    document.getElementById('v11FibLevels').textContent = '—';
  }

  // Bonus score
  const bonusText = (ndL?.score || 0) > 0 ? `+${ndL.score}↑` : (ndS?.score || 0) > 0 ? `+${ndS.score}↓` : '—';
  const bonusCls = (ndL?.score || 0) > 0 ? 'tag-good' : (ndS?.score || 0) > 0 ? 'tag-bad' : 'tag-neut';
  setEl('v11Bonus', bonusText, bonusCls);
}
