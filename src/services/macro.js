import { log } from '../core/utils.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v6 — РЕАЛ MACRO FEED'лар
// Yahoo Finance API (CORS proxies орқали) — DXY index + US 10Y yield
// ═══════════════════════════════════════════════════════════════════

const MACRO = {
  dxy: {value: null, prev: null, change: null, lastUpdate: 0, history: []},
  us10y: {value: null, prev: null, change: null, lastUpdate: 0, history: []},
  vix: {value: null, prev: null, change: null, lastUpdate: 0, history: []},
};

// Yahoo Finance chart API endpoint
function yahooChartUrl(symbol, range, interval) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
}

async function fetchYahoo(symbol, range = '5d', interval = '15m') {
  const baseUrl = yahooChartUrl(symbol, range, interval);
  const proxies = [
    {url: 'https://corsproxy.io/?' + encodeURIComponent(baseUrl), via: 'corsproxy.io'},
    {url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(baseUrl), via: 'allorigins'},
    {url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(baseUrl), via: 'codetabs'},
  ];
  for (const {url, via} of proxies) {
    try {
      const res = await fetch(url, {cache: 'no-store'});
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const ts = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      if (ts.length === 0 || closes.length === 0) continue;
      // Build history array
      const history = [];
      for (let i = 0; i < ts.length; i++) {
        if (closes[i] !== null && closes[i] !== undefined) {
          history.push({t: ts[i] * 1000, v: closes[i]});
        }
      }
      if (history.length < 2) continue;
      return {history, via};
    } catch(e) {}
  }
  return null;
}

async function refreshMacroFeeds() {
  // DXY
  const dxyResult = await fetchYahoo('DX-Y.NYB', '1mo', '30m');
  if (dxyResult) {
    MACRO.dxy.history = dxyResult.history;
    const last = dxyResult.history[dxyResult.history.length - 1];
    const prev24h = dxyResult.history.find(h => h.t >= last.t - 24 * 3600 * 1000) || dxyResult.history[0];
    MACRO.dxy.value = last.v;
    MACRO.dxy.prev = prev24h.v;
    MACRO.dxy.change = (last.v - prev24h.v) / prev24h.v * 100;
    MACRO.dxy.lastUpdate = Date.now();
    log('MACRO', `📊 DXY: ${last.v.toFixed(2)} (${MACRO.dxy.change > 0 ? '+' : ''}${MACRO.dxy.change.toFixed(2)}%)`, dxyResult.via);
  } else {
    log('MACRO', '⚠ DXY юкланмади');
  }

  // US 10Y yield
  const tnxResult = await fetchYahoo('^TNX', '1mo', '30m');
  if (tnxResult) {
    MACRO.us10y.history = tnxResult.history;
    const last = tnxResult.history[tnxResult.history.length - 1];
    const prev24h = tnxResult.history.find(h => h.t >= last.t - 24 * 3600 * 1000) || tnxResult.history[0];
    MACRO.us10y.value = last.v / 100; // TNX is in basis points (e.g. 4520 = 4.52%)
    MACRO.us10y.prev = prev24h.v / 100;
    MACRO.us10y.change = (last.v - prev24h.v) / prev24h.v * 100;
    MACRO.us10y.lastUpdate = Date.now();
    log('MACRO', `📊 US10Y: ${MACRO.us10y.value.toFixed(2)}% (${MACRO.us10y.change > 0 ? '+' : ''}${MACRO.us10y.change.toFixed(2)}%)`, tnxResult.via);
  } else {
    log('MACRO', '⚠ US10Y юкланмади');
  }

  // VIX
  const vixResult = await fetchYahoo('^VIX', '1mo', '30m');
  if (vixResult) {
    MACRO.vix.history = vixResult.history;
    const last = vixResult.history[vixResult.history.length - 1];
    const prev24h = vixResult.history.find(h => h.t >= last.t - 24 * 3600 * 1000) || vixResult.history[0];
    MACRO.vix.value = last.v;
    MACRO.vix.prev = prev24h.v;
    MACRO.vix.change = (last.v - prev24h.v) / prev24h.v * 100;
    MACRO.vix.lastUpdate = Date.now();
    log('MACRO', `📊 VIX: ${last.v.toFixed(2)} (${MACRO.vix.change > 0 ? '+' : ''}${MACRO.vix.change.toFixed(2)}%)`, vixResult.via);
  }
}

// Get macro value at a specific time (for backtest)
function getMacroAt(macro, currentTime) {
  if (!macro || !macro.history || macro.history.length === 0) return null;
  if (currentTime == null) return macro.value;
  // Find closest history point at or before currentTime
  let endIdx = macro.history.length - 1;
  while (endIdx >= 0 && macro.history[endIdx].t > currentTime) endIdx--;
  if (endIdx < 0) return null;
  return macro.history[endIdx].v;
}

// Get pct change in last N candles for backtest correlation
function getMacroChangeAt(macro, currentTime, lookbackMs = 30 * 60 * 1000) {
  if (!macro || !macro.history || macro.history.length < 2) return null;
  const refTime = currentTime != null ? currentTime : Date.now();
  // Find current point
  let curIdx = macro.history.length - 1;
  while (curIdx >= 0 && macro.history[curIdx].t > refTime) curIdx--;
  if (curIdx < 1) return null;
  const cur = macro.history[curIdx];
  // Find prev point (at least lookbackMs ago)
  let prevIdx = curIdx;
  while (prevIdx > 0 && (cur.t - macro.history[prevIdx].t) < lookbackMs) prevIdx--;
  if (prevIdx === curIdx) return 0;
  const prev = macro.history[prevIdx];
  return (cur.v - prev.v) / prev.v * 100;
}

// Auto-refresh every 15 minutes
let _macroInterval = null;
function startMacroAutoRefresh() {
  if (_macroInterval) return;
  refreshMacroFeeds(); // immediate
  _macroInterval = setInterval(() => {
    refreshMacroFeeds();
  }, 15 * 60 * 1000);
}

function stopMacroAutoRefresh() {
  if (_macroInterval) clearInterval(_macroInterval);
  _macroInterval = null;
}

export { MACRO, yahooChartUrl, fetchYahoo, refreshMacroFeeds, getMacroAt, getMacroChangeAt, startMacroAutoRefresh, stopMacroAutoRefresh };
