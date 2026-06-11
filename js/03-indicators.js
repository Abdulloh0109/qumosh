// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Техник индикаторлар
// Globals: IND (EMA, ALMA, ATR, RSI, MACD, HA-SuperTrend, Pivots, Hurst)
// ═══════════════════════════════════════════════════════════════════

// ─── INDICATORS ──────────────────────────────────────────────────────
const IND = {
  smaSeries(arr, len) {
    const out = new Array(arr.length).fill(null);
    if (arr.length < len) return out;
    let s = 0;
    for (let i = 0; i < len; i++) s += arr[i];
    out[len-1] = s / len;
    for (let i = len; i < arr.length; i++) { s += arr[i] - arr[i-len]; out[i] = s/len; }
    return out;
  },
  emaSeries(arr, len) {
    const out = new Array(arr.length).fill(null);
    if (arr.length < len) return out;
    const k = 2/(len+1);
    let s = 0;
    for (let i = 0; i < len; i++) s += arr[i];
    let prev = s/len;
    out[len-1] = prev;
    for (let i = len; i < arr.length; i++) { prev = arr[i]*k + prev*(1-k); out[i] = prev; }
    return out;
  },
  rmaSeries(arr, len) {
    const out = new Array(arr.length).fill(null);
    if (arr.length < len) return out;
    const a = 1/len;
    let s = 0;
    for (let i = 0; i < len; i++) s += arr[i];
    let prev = s/len;
    out[len-1] = prev;
    for (let i = len; i < arr.length; i++) { prev = arr[i]*a + prev*(1-a); out[i] = prev; }
    return out;
  },
  almaSeries(arr, len, off, sigma) {
    const out = new Array(arr.length).fill(null);
    if (arr.length < len) return out;
    const m = Math.floor(off*(len-1));
    const s = len/sigma;
    const w = []; let wsum = 0;
    for (let i = 0; i < len; i++) { const v = Math.exp(-((i-m)**2)/(2*s*s)); w.push(v); wsum += v; }
    for (let i = len-1; i < arr.length; i++) {
      let v = 0;
      for (let j = 0; j < len; j++) v += arr[i-len+1+j]*w[j];
      out[i] = v/wsum;
    }
    return out;
  },
  trSeries(highs, lows, closes) {
    const tr = new Array(closes.length).fill(0);
    tr[0] = highs[0] - lows[0];
    for (let i = 1; i < closes.length; i++) {
      tr[i] = Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1]));
    }
    return tr;
  },
  atrSeries(highs, lows, closes, len) { return IND.rmaSeries(IND.trSeries(highs, lows, closes), len); },
  rsiSeries(closes, len) {
    const out = new Array(closes.length).fill(null);
    if (closes.length < len+1) return out;
    const g = [], l = [];
    for (let i = 1; i < closes.length; i++) {
      const ch = closes[i] - closes[i-1];
      g.push(ch > 0 ? ch : 0);
      l.push(ch < 0 ? -ch : 0);
    }
    const ag = IND.rmaSeries(g, len);
    const al = IND.rmaSeries(l, len);
    for (let i = 0; i < ag.length; i++) {
      if (ag[i] === null) continue;
      const rs = al[i] === 0 ? 100 : ag[i]/al[i];
      out[i+1] = 100 - (100/(1+rs));
    }
    return out;
  },
  macdSeries(closes, fast = 12, slow = 26, sig = 9) {
    const ef = IND.emaSeries(closes, fast);
    const es = IND.emaSeries(closes, slow);
    const macd = closes.map((_,i) => (ef[i] !== null && es[i] !== null) ? ef[i] - es[i] : null);
    const sigArr = new Array(closes.length).fill(null);
    const k = 2/(sig+1);
    let prev = null, sum = 0, n = 0;
    for (let i = 0; i < closes.length; i++) {
      if (macd[i] === null) continue;
      if (prev === null) { sum += macd[i]; n++; if (n >= sig) { prev = sum/sig; sigArr[i] = prev; } }
      else { prev = macd[i]*k + prev*(1-k); sigArr[i] = prev; }
    }
    const hist = closes.map((_,i) => (macd[i] !== null && sigArr[i] !== null) ? macd[i] - sigArr[i] : null);
    return {macd, sig:sigArr, hist};
  },
  haSuperTrend(opens, highs, lows, closes, atrLen, mult) {
    const n = closes.length;
    const haC = new Array(n), haO = new Array(n);
    haC[0] = (opens[0]+highs[0]+lows[0]+closes[0])/4;
    haO[0] = (opens[0]+closes[0])/2;
    for (let i = 1; i < n; i++) {
      haC[i] = (opens[i]+highs[i]+lows[i]+closes[i])/4;
      haO[i] = (haO[i-1]+haC[i-1])/2;
    }
    const atr = IND.atrSeries(highs, lows, closes, atrLen);
    const upF = new Array(n).fill(null), dnF = new Array(n).fill(null), trend = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (atr[i] === null) continue;
      const upB = haC[i] - mult*atr[i], dnB = haC[i] + mult*atr[i];
      const pu = i > 0 ? upF[i-1] : null;
      const pd = i > 0 ? dnF[i-1] : null;
      const phc = i > 0 ? haC[i-1] : haC[i];
      upF[i] = (pu !== null && phc > pu) ? Math.max(upB, pu) : upB;
      dnF[i] = (pd !== null && phc < pd) ? Math.min(dnB, pd) : dnB;
      const pt = i > 0 ? trend[i-1] : null;
      if (pt === null) trend[i] = 1;
      else if (pt === -1 && haC[i] > pd) trend[i] = 1;
      else if (pt === 1 && haC[i] < pu) trend[i] = -1;
      else trend[i] = pt;
    }
    return {trend, haClose:haC, haOpen:haO, upFinal:upF, dnFinal:dnF};
  },
  pivots(highs, lows, len) {
    const ph = new Array(highs.length).fill(null);
    const pl = new Array(lows.length).fill(null);
    for (let i = len; i < highs.length - len; i++) {
      let isH = true, isL = true;
      for (let j = 1; j <= len; j++) {
        if (highs[i] < highs[i-j] || highs[i] < highs[i+j]) isH = false;
        if (lows[i] > lows[i-j] || lows[i] > lows[i+j]) isL = false;
      }
      if (isH) ph[i] = highs[i];
      if (isL) pl[i] = lows[i];
    }
    return {ph, pl};
  },
  hurst(arr, win) {
    if (arr.length < win) return 0.5;
    const series = arr.slice(-win);
    const mean = series.reduce((a,b) => a+b, 0) / series.length;
    const dev = series.map(v => v - mean);
    const cum = []; let acc = 0;
    for (const v of dev) { acc += v; cum.push(acc); }
    const R = Math.max(...cum) - Math.min(...cum);
    const sd = Math.sqrt(dev.reduce((a,b) => a + b*b, 0) / series.length);
    if (sd === 0 || R === 0) return 0.5;
    return Math.log(R/sd) / Math.log(series.length);
  },
};
