// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Инициализация ва event handlerlar
// Globals: loadCfgFromUI, loadCfgFromStorage, changeTF, autoHtfMult
// ═══════════════════════════════════════════════════════════════════

// ─── INIT ────────────────────────────────────────────────────────────
const SESSION_KEYS = ['LONDON','OVERLAP','NY','NY_AFTER','ASIA','LUNCH','FRI_LATE','LATE','OTHER'];
const REGIME_KEYS = ['TREND_UP','TREND_DN','RANGE','CHOP'];

function loadCfgFromUI() {
  CFG.granularity = +$('setTF').value;
  CFG.htfMult = +$('setHTF').value;
  CFG.direction = $('setDir').value;
  CFG.tgEnabled = $('setTgEnabled').checked;
  CFG.tgToken = $('setTgToken').value.trim();
  CFG.tgChat = $('setTgChat').value.trim();
  CFG.newsBlock = $('setNewsBlock').checked;
  CFG.sessionFilter = $('setSessionFilter').checked;
  CFG.adaptiveEnabled = $('setAdaptive').checked;
  // ⭐ v8: PDF module toggles
  if ($('setTTrades')) CFG.ttradesEnabled = $('setTTrades').checked;
  if ($('setDailyProfile')) CFG.dailyProfileEnabled = $('setDailyProfile').checked;
  if ($('setMondayBlock')) CFG.mondayBlock = $('setMondayBlock').checked;
  if ($('setCompression')) CFG.compressionEnabled = $('setCompression').checked;
  if ($('setHLQ')) CFG.hlqEnabled = $('setHLQ').checked;
  if ($('setQMR')) CFG.qmrEnabled = $('setQMR').checked;
  if ($('setMacro')) CFG.macroContextEnabled = $('setMacro').checked;
  // ⭐ v9: PDF module toggles
  if ($('setDivergence')) CFG.divergenceEnabled = $('setDivergence').checked;
  if ($('setKeyLevels')) CFG.keyLevelsEnabled = $('setKeyLevels').checked;
  if ($('setSMT')) CFG.smtEnabled = $('setSMT').checked;
  if ($('setAMD')) CFG.amdEnabled = $('setAMD').checked;
  if ($('setICTBlocks')) CFG.ictBlocksEnabled = $('setICTBlocks').checked;
  if ($('setPsychBlock')) CFG.psychBlock = $('setPsychBlock').checked;
  // ⭐ v10: PDF module toggles
  if ($('setChartPatterns')) CFG.chartPatternsEnabled = $('setChartPatterns').checked;
  if ($('setFibonacci')) CFG.fibonacciEnabled = $('setFibonacci').checked;
  if ($('setInducement')) CFG.inducementEnabled = $('setInducement').checked;
  // ⭐ v11: PDF module toggles
  if ($('setNewsDriven')) CFG.newsDrivenEnabled = $('setNewsDriven').checked;
  // ⭐ v12: M5 + Override
  if ($('setM5')) CFG.m5Enabled = $('setM5').checked;
  if ($('setOverride')) CFG.overrideEnabled = $('setOverride').checked;
  // Read session checkboxes
  for (const s of SESSION_KEYS) {
    const el = $('sess' + s);
    if (el) CFG.allowedSessions[s] = el.checked;
  }
  // Read regime checkboxes
  for (const r of REGIME_KEYS) {
    const el = $('reg' + r);
    if (el) CFG.allowedRegimes[r] = el.checked;
  }
  try {
    localStorage.setItem('qumash_v5_cfg', JSON.stringify({
      tf:CFG.granularity, htf:CFG.htfMult, dir:CFG.direction,
      tg:CFG.tgEnabled, token:CFG.tgToken, chat:CFG.tgChat,
      news:CFG.newsBlock, session:CFG.sessionFilter, adaptive:CFG.adaptiveEnabled,
      sessions: CFG.allowedSessions, regimes: CFG.allowedRegimes,
      // v8
      ttrades: CFG.ttradesEnabled, dailyProfile: CFG.dailyProfileEnabled,
      mondayBlock: CFG.mondayBlock, compression: CFG.compressionEnabled,
      hlq: CFG.hlqEnabled, qmr: CFG.qmrEnabled, macro: CFG.macroContextEnabled,
      // v9
      divergence: CFG.divergenceEnabled, keyLevels: CFG.keyLevelsEnabled,
      smt: CFG.smtEnabled, amd: CFG.amdEnabled, ictBlocks: CFG.ictBlocksEnabled,
      psychBlock: CFG.psychBlock,
      // v10
      chartPatterns: CFG.chartPatternsEnabled, fibonacci: CFG.fibonacciEnabled,
      inducement: CFG.inducementEnabled,
      // v11
      trendline: undefined, volume: undefined, gap: undefined, mtv: undefined,
      newsDriven: CFG.newsDrivenEnabled,
      // v12
      m5: CFG.m5Enabled, override: CFG.overrideEnabled,
    }));
  } catch(e) {}
}

function loadCfgFromStorage() {
  try {
    const s = localStorage.getItem('qumash_v5_cfg');
    if (!s) return;
    const o = JSON.parse(s);
    if (o.tf) $('setTF').value = o.tf;
    if (o.htf) $('setHTF').value = o.htf;
    if (o.dir) $('setDir').value = o.dir;
    // signalMode/trendFollow OLIB TASHLANDI — битта режим
    $('setTgEnabled').checked = !!o.tg;
    $('setTgToken').value = o.token || '';
    $('setTgChat').value = o.chat || '';
    $('setNewsBlock').checked = o.news !== false;
    $('setSessionFilter').checked = !!o.session;
    $('setAdaptive').checked = o.adaptive !== false;
    // Sessions
    if (o.sessions && typeof o.sessions === 'object') {
      Object.assign(CFG.allowedSessions, o.sessions);
      for (const s of SESSION_KEYS) {
        const el = $('sess' + s);
        if (el) el.checked = !!CFG.allowedSessions[s];
      }
    }
    // Regimes
    if (o.regimes && typeof o.regimes === 'object') {
      Object.assign(CFG.allowedRegimes, o.regimes);
      for (const r of REGIME_KEYS) {
        const el = $('reg' + r);
        if (el) el.checked = !!CFG.allowedRegimes[r];
      }
    }
    // ⭐ v8: PDF module toggles
    if ($('setTTrades') && o.ttrades !== undefined) { $('setTTrades').checked = !!o.ttrades; CFG.ttradesEnabled = !!o.ttrades; }
    if ($('setDailyProfile') && o.dailyProfile !== undefined) { $('setDailyProfile').checked = !!o.dailyProfile; CFG.dailyProfileEnabled = !!o.dailyProfile; }
    if ($('setMondayBlock') && o.mondayBlock !== undefined) { $('setMondayBlock').checked = !!o.mondayBlock; CFG.mondayBlock = !!o.mondayBlock; }
    if ($('setCompression') && o.compression !== undefined) { $('setCompression').checked = !!o.compression; CFG.compressionEnabled = !!o.compression; }
    if ($('setHLQ') && o.hlq !== undefined) { $('setHLQ').checked = !!o.hlq; CFG.hlqEnabled = !!o.hlq; }
    if ($('setQMR') && o.qmr !== undefined) { $('setQMR').checked = !!o.qmr; CFG.qmrEnabled = !!o.qmr; }
    if ($('setMacro') && o.macro !== undefined) { $('setMacro').checked = !!o.macro; CFG.macroContextEnabled = !!o.macro; }
    // ⭐ v9: PDF module toggles
    if ($('setDivergence') && o.divergence !== undefined) { $('setDivergence').checked = !!o.divergence; CFG.divergenceEnabled = !!o.divergence; }
    if ($('setKeyLevels') && o.keyLevels !== undefined) { $('setKeyLevels').checked = !!o.keyLevels; CFG.keyLevelsEnabled = !!o.keyLevels; }
    if ($('setSMT') && o.smt !== undefined) { $('setSMT').checked = !!o.smt; CFG.smtEnabled = !!o.smt; }
    if ($('setAMD') && o.amd !== undefined) { $('setAMD').checked = !!o.amd; CFG.amdEnabled = !!o.amd; }
    if ($('setICTBlocks') && o.ictBlocks !== undefined) { $('setICTBlocks').checked = !!o.ictBlocks; CFG.ictBlocksEnabled = !!o.ictBlocks; }
    if ($('setPsychBlock') && o.psychBlock !== undefined) { $('setPsychBlock').checked = !!o.psychBlock; CFG.psychBlock = !!o.psychBlock; }
    // ⭐ v10: PDF module toggles
    if ($('setChartPatterns') && o.chartPatterns !== undefined) { $('setChartPatterns').checked = !!o.chartPatterns; CFG.chartPatternsEnabled = !!o.chartPatterns; }
    if ($('setFibonacci') && o.fibonacci !== undefined) { $('setFibonacci').checked = !!o.fibonacci; CFG.fibonacciEnabled = !!o.fibonacci; }
    if ($('setInducement') && o.inducement !== undefined) { $('setInducement').checked = !!o.inducement; CFG.inducementEnabled = !!o.inducement; }
    // v11
    if ($('setNewsDriven') && o.newsDriven !== undefined) { $('setNewsDriven').checked = !!o.newsDriven; CFG.newsDrivenEnabled = !!o.newsDriven; }
    // ⭐ v12: M5 + Override
    if ($('setM5') && o.m5 !== undefined) { $('setM5').checked = !!o.m5; CFG.m5Enabled = !!o.m5; }
    if ($('setOverride') && o.override !== undefined) { $('setOverride').checked = !!o.override; CFG.overrideEnabled = !!o.override; }
  } catch(e) {}
}

// ─── DYNAMIC TF SWITCHING ────────────────────────────────────────────
// Auto-pick HTF multiplier based on TF (so HTF is always sensible)
function autoHtfMult(tfSec) {
  if (tfSec <= 60) return 15;       // M1 → M15
  if (tfSec <= 300) return 12;      // M5 → H1
  if (tfSec <= 900) return 4;       // M15 → H1
  if (tfSec <= 1800) return 2;      // M30 → H1
  return 4;                          // H1 → H4
}

function setActiveTfButton(tfSec) {
  document.querySelectorAll('.tf-pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.tf === tfSec);
  });
}

function changeTF(newGran) {
  if (newGran === CFG.granularity) return;
  if (!ST.connected) { log('WARN', '⚠️ Аввал уланиш керак'); return; }

  // Active trade — don't close it. SL/TP are price-based, not TF-based.
  // Just reset chart data and reload new TF candles. Trade continues.
  const hadActiveTrade = ST.condition !== 0;
  if (hadActiveTrade) {
    log('INFO', `📊 ТФ ${tfLabel(CFG.granularity)} → ${tfLabel(newGran)} (битим очиқ — давом этади)`);
  }

  // Disable buttons during transition
  document.querySelectorAll('.tf-pill-btn').forEach(b => b.disabled = true);

  const oldGran = CFG.granularity;
  CFG.granularity = newGran;
  CFG.htfMult = autoHtfMult(newGran);

  // Reset only candle data — KEEP trade state (ST.condition, ST.snap, ST.slLine)
  ST.candles = []; ST.candlesHTF = []; ST.feeds = {};
  ST.warmedUp = false;
  ST.lastPrice = null; ST.prevClose = null;
  // Don't reset: ST.condition, ST.snap, ST.slLine, ST.barsSinceEntry — keep active trade

  // Forget existing subscriptions and re-request with new granularity
  if (ST.ws && ST.ws.readyState === 1) {
    try {
      Object.values(ST.subIds).forEach(id => wsSend({forget: id}));
      Object.values(ST.feedSubs).forEach(id => wsSend({forget: id}));
    } catch(_) {}
    ST.subIds = {}; ST.feedSubs = {};
    requestAllHistory();
  }

  setActiveTfButton(newGran);
  $('chartTfLbl').textContent = tfLabel(newGran);
  resetChartForTF();
  log('INFO', `🔄 ТФ ўзгарди: ${tfLabel(oldGran)} → ${tfLabel(newGran)}`, `HTF=${CFG.htfMult}x авто`);

  setTimeout(() => {
    document.querySelectorAll('.tf-pill-btn').forEach(b => b.disabled = false);
  }, 2000);

  try {
    const s = JSON.parse(localStorage.getItem('qumash_v5_cfg') || '{}');
    s.tf = newGran;
    localStorage.setItem('qumash_v5_cfg', JSON.stringify(s));
  } catch(_) {}
}

// Wire up TF buttons
document.querySelectorAll('.tf-pill-btn').forEach(btn => {
  btn.addEventListener('click', () => changeTF(+btn.dataset.tf));
});

// soft/medium/hard mode buttons OLIB TASHLANDI — битта режим (REVERSAL HUNTER)
// News mode toggle ҳам OLIB TASHLANDI — энди 'auto' (доимий)

// ⚡ News Mode Calendar Auto-Refresh — actual value'ни ushlash uchun
(function() {
  setInterval(() => {
    if (CFG.newsMode !== 'auto') return;
    if (!CAL || !CAL.events) return;
    // Check if any HIGH-impact USD event released within last 45 min
    const now = Date.now();
    let needsRefresh = false;
    for (const ev of CAL.events) {
      if (!ev?.date || ev.impact !== 'high' || ev.currency !== 'USD') continue;
      const sinceMs = now - ev.date.getTime();
      if (sinceMs > -5*60*1000 && sinceMs < 45*60*1000) {
        // Event in window AND actual still missing → refresh
        if (!ev.actual) { needsRefresh = true; break; }
      }
    }
    if (needsRefresh && typeof buildCalendar === 'function') {
      buildCalendar().then(() => {
        if (typeof refreshNewsUI === 'function') refreshNewsUI();
        log('NEWS', '📅 Calendar янгиланди (actual ушлaш)');
      }).catch(()=>{});
    }
  }, 60000); // Every 60 seconds during news window
})();

// Recommendation banner — close + remember preference
(function() {
  const banner = document.querySelector('.reco-banner');
  const closeBtn = document.getElementById('recoClose');
  if (!banner || !closeBtn) return;
  // Restore hidden state
  try {
    if (localStorage.getItem('qumash_reco_hidden') === '1') banner.classList.add('hidden');
  } catch(_) {}
  closeBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    try { localStorage.setItem('qumash_reco_hidden', '1'); } catch(_) {}
  });
})();

// Chart toolbar (only fullscreen remaining — drawing tools removed)
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.action === 'fullscreen') toggleFullscreen();
  });
});

function tfLabel(g) {
  if (g >= 86400) return 'D' + (g/86400);
  if (g >= 3600) return 'H' + (g/3600);
  return 'M' + (g/60);
}

let _periodicRefreshInterval = null;

$('connectBtn').addEventListener('click', () => {
  loadCfgFromUI();
  loadAdaptiveWeights();
  // ⭐ REVERSAL HUNTER — битта режим, тунинг 01-config.js'дан келади
  $('settingsPanel').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('dashboard').classList.add('fade-in');
  setActiveTfButton(CFG.granularity);
  $('chartTfLbl').textContent = tfLabel(CFG.granularity);
  log('INFO', '🚀 QUMASH v7 REVERSAL HUNTER ишга тушди', `TF=${tfLabel(CFG.granularity)} HTF=${CFG.htfMult}x T1≥${CFG.tier1} T2≥${CFG.tier2}`);
  log('INFO', `News:${CFG.newsBlock?'AUTO':'OFF'} Adapt:${CFG.adaptiveEnabled?'ON':'OFF'} MinR:R 1:${CFG.minRR}`);
  if (CFG.tgEnabled) tgSend(`✅ <b>QUMASH v7 REVERSAL HUNTER</b> ишга тушди\n📊 XAUUSD ${tfLabel(CFG.granularity)}\n🎯 T1≥${CFG.tier1} T2≥${CFG.tier2} (R:R мин 1:${CFG.minRR})\n🤖 Сигнал кутилмоқда...`);
  // Mark auto-reconnect intent for next page load
  try { localStorage.setItem('qumash_auto_reconnect', '1'); } catch(_) {}
  wsConnect();

  // Periodic UI refresh — clear previous interval to prevent leak on reconnect
  if (_periodicRefreshInterval) clearInterval(_periodicRefreshInterval);
  _periodicRefreshInterval = setInterval(() => {
    if (ST.warmedUp) {
      runSignalEvaluation(false);
      refreshNewsUI();
    }
  }, 5000);
});

// ⭐ AUTO-RECONNECT on page load if user was previously connected
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      if (localStorage.getItem('qumash_auto_reconnect') === '1') {
        const btn = document.getElementById('connectBtn');
        const settingsVisible = !document.getElementById('settingsPanel').classList.contains('hidden');
        if (btn && settingsVisible) {
          log('INFO', '🔄 Автоматик қайта уланиш...');
          btn.click();
        }
      }
    } catch(_) {}
  }, 800);
});

// ⭐ WARN before browser refresh/close if connected
window.addEventListener('beforeunload', (e) => {
  if (ST.connected) {
    const msg = 'Тизим уланган. Чиқаётганингизга ишончингиз комилми? (Ҳолат сақланади — қайта улаш орқали тикланади)';
    e.preventDefault();
    e.returnValue = msg;
    return msg;
  }
});

$('dcBtn').addEventListener('click', () => { if (confirm('Узишни тасдиқлайсизми?')) disconnect(); });
$('copyLogBtn').addEventListener('click', copyLog);
$('newsRefreshBtn').addEventListener('click', async () => {
  log('INFO', '🔄 Янгиликлар қўлда янгиланмоқда...');
  $('newsRefreshBtn').textContent = '⏳ Юкланмоқда...';
  await buildCalendar();
  refreshNewsUI();
  $('newsRefreshBtn').textContent = '🔄 Янгиликларни янгилаш';
});

// ─── EXPORT / IMPORT (data portability) ──────────────────────────────
function exportData() {
  const snap = {
    version: 'qumash_v5_pro',
    timestamp: new Date().toISOString(),
    adaptWeights: ST.adaptWeights,
    adaptHistory: ST.adaptHistory,
    history: ST.history,
    pastImpacts: CAL.past,
    drawShapes: DRAW?.shapes || [],
    customEvents: JSON.parse(localStorage.getItem('qumash_custom_events') || '[]'),
    cfg: JSON.parse(localStorage.getItem('qumash_v5_cfg') || '{}'),
    stats: {
      total: ST.total, tpWins: ST.tpWins, beHits: ST.beHits, slLosses: ST.slLosses,
      rSum: ST.rSum, rWinSum: ST.rWinSum, rLossSum: ST.rLossSum,
      rWinCount: ST.rWinCount, rLossCount: ST.rLossCount,
      todayR: ST.todayR, maxR: ST.maxR, minR: ST.minR,
    },
  };
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.download = `qumash-snapshot-${ts}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  alert('💾 Снапшот юклаб олинди.\n\nФайлни data/ папкасига кучиринг (керак бўлса).');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const snap = JSON.parse(e.target.result);
      if (snap.version !== 'qumash_v5_pro') {
        if (!confirm('Бу файл версияси номаълум. Импорт қилаверайми?')) return;
      }
      if (snap.adaptWeights) {
        Object.assign(ST.adaptWeights, snap.adaptWeights);
        try { localStorage.setItem('qumash_v5_adapt', JSON.stringify(ST.adaptWeights)); } catch(_) {}
      }
      if (Array.isArray(snap.adaptHistory)) ST.adaptHistory = snap.adaptHistory;
      if (Array.isArray(snap.history)) ST.history = snap.history;
      if (Array.isArray(snap.pastImpacts)) {
        CAL.past = snap.pastImpacts;
        try { localStorage.setItem('qumash_past_impacts', JSON.stringify(CAL.past)); } catch(_) {}
      }
      if (Array.isArray(snap.drawShapes) && typeof DRAW !== 'undefined') {
        DRAW.shapes = snap.drawShapes;
        try { localStorage.setItem('qumash_v5_shapes', JSON.stringify(DRAW.shapes)); } catch(_) {}
      }
      if (Array.isArray(snap.customEvents)) {
        try { localStorage.setItem('qumash_custom_events', JSON.stringify(snap.customEvents)); } catch(_) {}
      }
      if (snap.cfg && typeof snap.cfg === 'object') {
        try { localStorage.setItem('qumash_v5_cfg', JSON.stringify(snap.cfg)); } catch(_) {}
      }
      if (snap.stats) {
        Object.assign(ST, snap.stats);
      }
      alert('✅ Импорт муваффақиятли. Тизимни қайта ишга туширсангиз ўзгаришлар тўлиқ ишлайди.');
      log('INFO', '📥 Импорт', `weights:${Object.keys(snap.adaptWeights||{}).length}, history:${(snap.history||[]).length}`);
    } catch(e) {
      alert('❌ Импорт хатоси: ' + e.message);
    }
  };
  reader.readAsText(file);
}

$('exportBtn').addEventListener('click', exportData);
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
});

// ─── BACKTEST ────────────────────────────────────────────────────────
$('btRunBtn').addEventListener('click', async () => {
  if (BT.running) { alert('Allaqachon ишламоқда...'); return; }
  if (!ST.candles || ST.candles.length < 250) {
    alert('Маълумот етарли эмас. Bошида тизимни уланг ва ~5 минут кутинг.');
    return;
  }
  const btn = $('btRunBtn'), status = $('btStatus');
  btn.disabled = true;
  btn.textContent = '⏳ Ҳисобланмоқда...';
  status.textContent = 'Бажарилмоқда...';
  $('btInfo').style.display = 'block';
  $('btResults').style.display = 'none';
  try {
    const result = await runBacktest({});
    if (result) {
      renderBacktestResults(result);
      status.textContent = `✅ Тугатилди (${result.total} битим)`;
      $('btResults').style.display = 'block';
    } else {
      status.textContent = '⚠ Натижа йўқ';
    }
  } catch(e) {
    status.textContent = '❌ Хато: ' + e.message;
    log('BT', '❌ Backtest хато', e.message);
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Backtest бошлаш';
    $('btInfo').style.display = 'none';
  }
});

function renderBacktestResults(r) {
  // Top stats grid
  const wrPct = (r.wr * 100).toFixed(1);
  const tp3Pct = (r.tp3Rate * 100).toFixed(1);
  const pf = r.pf > 99 ? '∞' : r.pf.toFixed(2);
  const exp = r.exp.toFixed(2);
  const wrColor = r.wr >= 0.55 ? 'var(--green)' : r.wr >= 0.45 ? 'var(--gold)' : 'var(--red)';
  const pfColor = r.pf >= 1.4 ? 'var(--green)' : r.pf >= 1.0 ? 'var(--gold)' : 'var(--red)';
  const rColor = r.rSum > 0 ? 'var(--green)' : 'var(--red)';
  const expColor = r.exp > 0.05 ? 'var(--green)' : r.exp > -0.05 ? 'var(--gold)' : 'var(--red)';
  const grid = $('btStatsGrid');
  grid.innerHTML = `
    <div class="bt-stat"><div class="bt-stat-l">Жами битимлар</div><div class="bt-stat-v">${r.total}</div></div>
    <div class="bt-stat"><div class="bt-stat-l">Жами R</div><div class="bt-stat-v" style="color:${rColor}">${r.rSum >= 0 ? '+' : ''}${r.rSum.toFixed(2)}</div></div>
    <div class="bt-stat"><div class="bt-stat-l">WR (фойдали)</div><div class="bt-stat-v" style="color:${wrColor}">${wrPct}%</div></div>
    <div class="bt-stat"><div class="bt-stat-l">TP3 толиқ</div><div class="bt-stat-v">${tp3Pct}%</div></div>
    <div class="bt-stat"><div class="bt-stat-l">Profit Factor</div><div class="bt-stat-v" style="color:${pfColor}">${pf}</div></div>
    <div class="bt-stat"><div class="bt-stat-l">Expectancy/трейд</div><div class="bt-stat-v" style="color:${expColor}">${r.exp >= 0 ? '+' : ''}${exp}R</div></div>
    <div class="bt-stat"><div class="bt-stat-l">Max DD</div><div class="bt-stat-v" style="color:var(--red)">-${r.maxDD.toFixed(2)}R</div></div>
    <div class="bt-stat"><div class="bt-stat-l">TP3 / BE / SL / TO</div><div class="bt-stat-v" style="font-size:14px">${r.tpFull}/${r.beHits}/${r.slLosses}/${r.timeouts}</div></div>
  `;

  // Statistical significance warning
  let warning = '';
  if (r.total < 30) {
    warning = `<div class="bt-warn red">⚠️ <b>${r.total} битим — статистик кучсиз.</b> Хулоса учун камида 100+ битим керак. M15 ёки H1 таймфреймга ўтинг ёки тарих юкланишини кенгайтириш керак.</div>`;
  } else if (r.total < 100) {
    warning = `<div class="bt-warn yellow">⚠️ <b>${r.total} битим — статистик ўрта.</b> 100+ битим тавсия қилинади.</div>`;
  } else {
    warning = `<div class="bt-warn green">✅ <b>${r.total} битим — статистик яхши.</b></div>`;
  }
  // Interpretation
  let interp = '<div class="bt-interp"><div class="bt-interp-h">📋 ҲУКМ:</div>';
  if (r.total < 10) {
    interp += '<div>Кам битим — тахлил қилишга етмайди.</div>';
  } else {
    if (r.pf >= 1.4) interp += `<div class="bt-i-good">✅ Profit Factor ${pf} — кучли. Тизим бу шароитда фойдали.</div>`;
    else if (r.pf >= 1.0) interp += `<div class="bt-i-mid">⚠ Profit Factor ${pf} — break-even атрофида.</div>`;
    else interp += `<div class="bt-i-bad">❌ Profit Factor ${pf} — ёмонатига чиқади. Параметрларни кўриб чиқинг.</div>`;
    
    if (r.exp > 0.1) interp += `<div class="bt-i-good">✅ Expectancy +${exp}R — ҳар битимдан фойда.</div>`;
    else if (r.exp >= -0.1) interp += `<div class="bt-i-mid">⚠ Expectancy ${r.exp >= 0 ? '+' : ''}${exp}R — нейтрал.</div>`;
    else interp += `<div class="bt-i-bad">❌ Expectancy ${exp}R — ҳар битим ўртача йўқотади.</div>`;
    
    // Best/worst regime
    const regimes = Object.entries(r.perRegime).filter(([k,v]) => v.n >= 3).sort((a,b) => b[1].r - a[1].r);
    if (regimes.length > 0) {
      const best = regimes[0], worst = regimes[regimes.length-1];
      if (best[1].r > 0) interp += `<div class="bt-i-good">✅ Энг яхши режим: <b>${best[0]}</b> ${best[1].r.toFixed(2)}R (${best[1].n} битим)</div>`;
      if (worst[1].r < -0.5 && worst[0] !== best[0]) interp += `<div class="bt-i-bad">❌ Энг ёмон режим: <b>${worst[0]}</b> ${worst[1].r.toFixed(2)}R (${worst[1].n} битим) — ушбу режимда signal'ларни блок қилиш керак?</div>`;
    }
    // Bad filters
    const badFilters = Object.entries(r.perFilter).filter(([k,v]) => v.n >= 5 && v.wins/v.n < 0.3).sort((a,b) => a[1].r - b[1].r);
    if (badFilters.length > 0) {
      const f = badFilters[0];
      interp += `<div class="bt-i-bad">❌ <b>${f[0].toUpperCase()}</b> филтри ёмон ишлайди: ${(f[1].wins/f[1].n*100).toFixed(0)}% WR, ${f[1].r.toFixed(1)}R (${f[1].n} битим). Adaptive вақт ўтиши билан вазнини камайтиради.</div>`;
    }
    // Best session
    const sessions = Object.entries(r.perSession).filter(([k,v]) => v.n >= 3).sort((a,b) => b[1].r - a[1].r);
    if (sessions.length > 0 && sessions[0][1].r > 0) {
      interp += `<div class="bt-i-good">✅ Энг яхши сеанс: <b>${sessions[0][0]}</b> ${sessions[0][1].r.toFixed(2)}R</div>`;
    }
  }
  interp += '</div>';

  // Breakdowns
  const renderTable = (title, data, keys) => {
    let rows = '';
    for (const k of keys) {
      const d = data[k];
      if (!d || !d.n) continue;
      const wr = (d.wins / d.n * 100).toFixed(0);
      const wrColor = wr >= 55 ? 'var(--green)' : wr >= 45 ? 'var(--gold)' : 'var(--red)';
      const rColor = d.r > 0 ? 'var(--green)' : 'var(--red)';
      rows += `<tr><td>${k}</td><td>${d.n}</td><td style="color:${wrColor}">${wr}%</td><td style="color:${rColor}">${d.r >= 0 ? '+' : ''}${d.r.toFixed(2)}R</td></tr>`;
    }
    if (!rows) return '';
    return `<div class="bt-bd"><div class="bt-bd-h">${title}</div><table class="bt-bd-t"><thead><tr><th></th><th>N</th><th>WR</th><th>R</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  let bd = warning + interp;
  bd += '<div class="bt-breakdowns">';
  bd += renderTable('Режим бўйича', r.perRegime, ['TREND_UP','TREND_DN','RANGE','CHOP']);
  bd += renderTable('Tier бўйича', r.perTier, ['T1','T2','T3']);
  bd += renderTable('Сеанс бўйича', r.perSession, ['LONDON','NY','OVERLAP','NY_AFTER','ASIA','LUNCH','FRI_LATE','LATE','OTHER']);
  // Top filters
  const filterArr = FILTERS.map(f => ({f, ...r.perFilter[f]}))
    .filter(x => x.n >= 3)
    .sort((a, b) => (b.wins/b.n) - (a.wins/a.n));
  if (filterArr.length) {
    let rows = '';
    for (const x of filterArr.slice(0, 11)) {
      const wr = (x.wins / x.n * 100).toFixed(0);
      const wrColor = wr >= 55 ? 'var(--green)' : wr >= 45 ? 'var(--gold)' : 'var(--red)';
      rows += `<tr><td>${x.f}</td><td>${x.n}</td><td style="color:${wrColor}">${wr}%</td><td>${x.r >= 0 ? '+' : ''}${x.r.toFixed(1)}R</td></tr>`;
    }
    bd += `<div class="bt-bd"><div class="bt-bd-h">Филтрлар бўйича (улар + бўлганда)</div><table class="bt-bd-t"><thead><tr><th></th><th>N</th><th>WR</th><th>R</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  bd += '</div>';
  $('btBreakdowns').innerHTML = bd;
}

// Boot
loadCfgFromStorage();
loadAdaptiveWeights();
log('INFO', '⚙️ QUMASH ULTIMATE v6');
log('INFO', '11 қатлам + Per-regime adaptive + Multi-TF + Backtest');
