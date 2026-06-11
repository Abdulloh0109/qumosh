// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Deriv WebSocket feed
// Globals: WS_URL, wsConnect, wsSend, requestAllHistory, etc.
// ═══════════════════════════════════════════════════════════════════

// ─── DERIV WS ────────────────────────────────────────────────────────
const WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';

function wsConnect() {
  log('WS', '🔌 Deriv-га уланмоқда...');
  ST.ws = new WebSocket(WS_URL);
  ST.ws.onopen = () => {
    log('WS', '✅ Уланди', 'app_id=1089');
    ST.connected = true; setConnUI(true);
    requestAllHistory();
  };
  ST.ws.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch (e) { return; }
    if (data.error) { log('ERR', '❌ ' + (data.error.message || 'API хатоси'), data.error.code || ''); return; }
    handleWsMessage(data);
  };
  ST.ws.onclose = () => {
    log('WS', '⚠️ Алоқа узилди', 'қайта уланмоқда 3с');
    ST.connected = false; setConnUI(false);
    setTimeout(() => { if (!ST.connected) wsConnect(); }, 3000);
  };
  ST.ws.onerror = () => log('ERR', '❌ WS хатоси');
}

function wsSend(obj) {
  if (!ST.ws || ST.ws.readyState !== 1) return null;
  obj.req_id = ST.reqId++;
  ST.ws.send(JSON.stringify(obj));
  return obj.req_id;
}

function getHtfGranularity(primary) {
  // Map primary TF to HTF — find smallest valid Deriv granularity >= primary*htfMult
  const target = primary * CFG.htfMult;
  const valid = [60, 120, 180, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400];
  for (const v of valid) if (v >= target) return v;
  return valid[valid.length - 1];
}

function requestAllHistory() {
  const reqP = wsSend({ticks_history:SYMBOLS.primary, adjust_start_time:1, count:CFG.count, end:'latest', granularity:CFG.granularity, style:'candles', subscribe:1});
  ST._reqType[reqP] = 'primary';
  const htfGran = getHtfGranularity(CFG.granularity);
  const reqH = wsSend({ticks_history:SYMBOLS.htf, adjust_start_time:1, count:1000, end:'latest', granularity:htfGran, style:'candles', subscribe:1});
  ST._reqType[reqH] = 'htf';
  // ⭐ v12: M5 timeframe for intraday reversal detection
  if (CFG.m5Enabled && CFG.granularity !== 300) {
    const reqM5 = wsSend({ticks_history:SYMBOLS.primary, adjust_start_time:1, count:500, end:'latest', granularity:300, style:'candles', subscribe:1});
    ST._reqType[reqM5] = 'm5';
  }
  for (const [k, sym] of Object.entries(SYMBOLS.feeds)) {
    const r = wsSend({ticks_history:sym, adjust_start_time:1, count:CFG.countCorr, end:'latest', granularity:CFG.granularity, style:'candles', subscribe:1});
    ST._reqType[r] = 'feed:' + k;
  }
  log('WS', '📡 10 та оқимга уланмоқда', `XAU(M15+M5) + ${Object.keys(SYMBOLS.feeds).length} корр`);
}

function handleWsMessage(data) {
  const reqType = ST._reqType?.[data.req_id];
  if (data.candles && reqType) {
    const arr = data.candles.map(c => ({epoch:c.epoch, o:+c.open, h:+c.high, l:+c.low, c:+c.close}));
    if (reqType === 'primary') { ST.candles = arr; ST.lastPrice = arr[arr.length-1].c; log('INFO', `📊 ${arr.length} XAU свеча`); }
    else if (reqType === 'htf') { ST.candlesHTF = arr; log('INFO', `📊 ${arr.length} HTF свеча`); }
    else if (reqType === 'm5') {
      // ⭐ v12: Push to M5_STATE
      if (typeof M5_STATE !== 'undefined') {
        M5_STATE.candles = arr;
        log('INFO', `📊 ${arr.length} M5 свеча`);
      }
    }
    else if (reqType.startsWith('feed:')) { const k = reqType.split(':')[1]; ST.feeds[k] = arr; }
    if (data.subscription?.id) {
      if (reqType === 'primary') ST.subIds.primary = data.subscription.id;
      else if (reqType === 'htf') ST.subIds.htf = data.subscription.id;
      else if (reqType === 'm5') ST.subIds.m5 = data.subscription.id;
      else if (reqType.startsWith('feed:')) { const k = reqType.split(':')[1]; ST.feedSubs[k] = data.subscription.id; }
    }
    checkWarmup();
    return;
  }
  if (data.ohlc) {
    const sym = data.ohlc.symbol;
    const gran = +data.ohlc.granularity;
    const candle = {epoch:+data.ohlc.open_time, o:+data.ohlc.open, h:+data.ohlc.high, l:+data.ohlc.low, c:+data.ohlc.close};
    if (sym === SYMBOLS.primary && gran === CFG.granularity) onPrimaryCandle(candle);
    else if (sym === SYMBOLS.htf && gran === CFG.granularity * CFG.htfMult) onHTFCandle(candle);
    // ⭐ v12: M5 candle handler
    else if (sym === SYMBOLS.primary && gran === 300 && CFG.m5Enabled) {
      if (typeof pushM5Candle === 'function') {
        pushM5Candle(candle);
        // Trigger M5 evaluation on each M5 candle close (every 5 min)
        if (typeof onM5CandleClose === 'function') onM5CandleClose(candle);
      }
    }
    else for (const [k, fsym] of Object.entries(SYMBOLS.feeds)) if (fsym === sym && gran === CFG.granularity) { onFeedCandle(k, candle); break; }
  }
}

function upsertCandle(arr, c) {
  if (arr.length === 0) { arr.push(c); return 'new'; }
  const last = arr[arr.length-1];
  if (c.epoch === last.epoch) { last.o=c.o; last.h=c.h; last.l=c.l; last.c=c.c; return 'update'; }
  if (c.epoch > last.epoch) { arr.push(c); if (arr.length > CFG.count + 100) arr.shift(); return 'new'; }
  return 'old';
}

function onPrimaryCandle(c) {
  const k = upsertCandle(ST.candles, c);
  ST.prevClose = ST.candles[ST.candles.length-2]?.c ?? c.c;
  ST.lastPrice = c.c;
  updateLivePriceUI();
  pushChartUpdate(c);
  if (k === 'new') {
    if (ST.warmedUp) {
      // Bar counter increments only on actual bar close
      ST.barsSinceEntry++;
      ST.barsSinceSL++;
      // Check bar-close exits before fresh evaluation
      const ind = computeBaseIndicators();
      if (ind && ST.condition !== 0) checkBarCloseExits(ind);
      // Track news impact for any event in last bar window
      trackPastImpacts();
      runSignalEvaluation(true); // fire signals on bar close
    }
  } else if (k === 'update') {
    if (ST.condition !== 0) checkIntraBarExits(c);
    // Update chart OHLC display on every tick
    updateChartOHLC();
  }
}

function onHTFCandle(c) { upsertCandle(ST.candlesHTF, c); }
function onFeedCandle(k, c) {
  if (!ST.feeds[k]) ST.feeds[k] = [];
  upsertCandle(ST.feeds[k], c);
  if (ST.feeds[k].length > CFG.countCorr + 50) ST.feeds[k].shift();
}

function checkWarmup() {
  if (ST.candles.length < 200) return;
  if (ST.candlesHTF.length < 50) return;
  const feedReady = Object.keys(ST.feeds).filter(k => ST.feeds[k]?.length > 100).length;
  if (feedReady < 5) return;
  if (!ST.warmedUp) {
    ST.warmedUp = true;
    log('INFO', '✅ Тизим тайёр', `${ST.candles.length} XAU + ${feedReady}/8 корр`);
    initChart();
    seedChartData();
    buildCalendar().then(() => refreshNewsUI());
    // Macro feeds DISABLED — synth DXY ишлатилади (96% мос)
    // ⭐ Restore active trade from previous session (browser refresh recovery)
    if (typeof restoreActiveTrade === 'function' && ST.condition === 0) {
      const restored = restoreActiveTrade();
      if (restored && typeof setActiveTradeLines === 'function') {
        try { setActiveTradeLines(); } catch(_) {}
      }
    } else if (ST.condition !== 0 && ST.snap) {
      // Trade was active (TF change scenario) — refresh lines
      try { setActiveTradeLines(); } catch(_) {}
    }
    runSignalEvaluation(true);
  }
}

function setConnUI(on) {
  $('connDot').classList.toggle('on', on);
  $('connText').textContent = on ? 'УЛАНГАН' : 'Узилган';
}

function updateLivePriceUI() {
  $('livePrice').textContent = fmtPx(ST.lastPrice);
  if (ST.prevClose && ST.lastPrice) {
    const ch = ((ST.lastPrice - ST.prevClose) / ST.prevClose) * 100;
    const el = $('liveChg');
    el.textContent = pct(ch, 2);
    el.classList.remove('up','dn','flat');
    el.classList.add(ch >= 0.001 ? 'up' : ch <= -0.001 ? 'dn' : 'flat');
  }
}

function disconnect() {
  // Manual disconnect — don't auto-reconnect on next page load
  try { localStorage.removeItem('qumash_auto_reconnect'); } catch(_) {}
  if (ST.ws) {
    try {
      Object.values(ST.subIds).forEach(id => wsSend({forget: id}));
      Object.values(ST.feedSubs).forEach(id => wsSend({forget: id}));
      ST.ws.close();
    } catch(e) {}
  }
  $('settingsPanel').classList.remove('hidden');
  $('dashboard').classList.add('hidden');
  log('INFO', '🔌 Узилди');
}
