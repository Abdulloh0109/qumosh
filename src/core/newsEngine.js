import { CFG } from './state.js';
import { CAL } from './calendar.js';

// ═══════════════════════════════════════════════════════════════════
// NEWS ENGINE v1 — Янгиликни ўз-ўзидан таҳлил қилади (manual ввод йўқ)
// Source: ForexFactory XML (CAL.events)
// ═══════════════════════════════════════════════════════════════════

// Direction rules для XAUUSD
// dir = +1 → event "beat" (actual > forecast) → XAU bullish
// dir = -1 → event "beat" → XAU bearish (USD strong)
// dir = +0.5 / -0.5 → weak signal
//
// Logic: most US economic data — beat = USD strong = XAU weak (-1)
//        Unemployment Rate — higher unempl = USD weak = XAU strong (+1)
const NEWS_RULES = [
  // ── JOBS ────────────────────────────────────────────────────────
  { match: /Non-Farm|NFP|Nonfarm Pay/i,            dir: -1.0, type: 'jobs',     w: 1.0 },
  { match: /Average Hourly Earnings/i,             dir: -1.0, type: 'wages',    w: 0.7 },
  { match: /Unemployment Rate/i,                   dir: +1.0, type: 'jobs_inv', w: 0.9 },
  { match: /Unemployment Claims|Jobless Claims/i,  dir: +0.6, type: 'jobs_inv', w: 0.5 },
  { match: /ADP/i,                                 dir: -0.7, type: 'jobs',     w: 0.5 },
  { match: /JOLTS/i,                               dir: -0.5, type: 'jobs',     w: 0.4 },

  // ── INFLATION ───────────────────────────────────────────────────
  { match: /Core CPI/i,                            dir: -1.0, type: 'inflation',w: 1.0 },
  { match: /CPI/i,                                 dir: -1.0, type: 'inflation',w: 0.95 },
  { match: /Core PPI/i,                            dir: -0.7, type: 'inflation',w: 0.6 },
  { match: /PPI|Producer Price/i,                  dir: -0.7, type: 'inflation',w: 0.6 },
  { match: /Core PCE|Core Personal Consumption/i,  dir: -1.0, type: 'inflation',w: 0.95 },
  { match: /PCE Price/i,                           dir: -0.8, type: 'inflation',w: 0.7 },

  // ── FED ─────────────────────────────────────────────────────────
  { match: /Federal Funds Rate|FOMC|Fed Rate/i,    dir: -1.0, type: 'fed',      w: 1.2 },
  { match: /FOMC Statement|FOMC Minutes/i,         dir: -0.5, type: 'fed',      w: 0.6 },
  { match: /Fed Chair Powell|Powell/i,             dir: -0.4, type: 'fed',      w: 0.4 },

  // ── GROWTH/CONSUMER ─────────────────────────────────────────────
  { match: /Retail Sales/i,                        dir: -0.8, type: 'consumer', w: 0.7 },
  { match: /GDP/i,                                 dir: -0.5, type: 'growth',   w: 0.6 },
  { match: /ISM Manufacturing|Manufacturing PMI/i, dir: -0.5, type: 'pmi',      w: 0.5 },
  { match: /ISM Services|Services PMI/i,           dir: -0.5, type: 'pmi',      w: 0.5 },

  // ── SENTIMENT ───────────────────────────────────────────────────
  { match: /Consumer Confidence/i,                 dir: -0.4, type: 'sentiment',w: 0.4 },
  { match: /Consumer Sentiment/i,                  dir: -0.4, type: 'sentiment',w: 0.4 },
  { match: /Philly Fed|Empire State/i,             dir: -0.4, type: 'pmi',      w: 0.3 },
];

// Find rule for an event name
function findNewsRule(eventName) {
  for (const r of NEWS_RULES) {
    if (r.match.test(eventName)) return r;
  }
  return null;
}

// Parse value from string: "177K", "1.2%", "-0.3", "4.50%", "215.5K"
function parseNewsValue(s) {
  if (s == null) return null;
  const str = String(s).trim();
  if (!str || str === '-' || str.toLowerCase() === 'na') return null;

  const match = str.replace(/[^\d.\-]/g, '');
  if (!match || match === '-' || match === '.') return null;

  let n = parseFloat(match);
  if (isNaN(n)) return null;

  // Multiplier suffixes
  if (/K/i.test(str)) n *= 1000;
  else if (/M/i.test(str)) n *= 1000000;
  else if (/B/i.test(str)) n *= 1000000000;

  return n;
}

// Compute surprise factor in std dev units
function computeSurpriseFactor(forecast, actual, previous) {
  const f = parseNewsValue(forecast);
  const a = parseNewsValue(actual);
  const p = parseNewsValue(previous);

  if (f === null || a === null) return 0;

  // Standard deviation estimate
  let stdEst;
  if (p !== null) {
    // Use historic delta or 5% of forecast as scale
    stdEst = Math.max(Math.abs(f) * 0.05, Math.abs(f - p) * 0.7, 0.0001);
  } else {
    stdEst = Math.max(Math.abs(f) * 0.1, 0.0001);
  }

  const surprise = (a - f) / stdEst;
  return Math.max(-3, Math.min(3, surprise));  // clamp to ±3 std dev
}

// Compute news direction score for XAU (-100 = max bearish, +100 = max bullish)
function computeNewsScore(event) {
  if (!event) return null;
  if (!event.actual || !event.forecast) return null;  // not released yet
  if (event.impact !== 'high' && event.impact !== 'med') return null;

  const rule = findNewsRule(event.name);
  if (!rule) return null;

  const surprise = computeSurpriseFactor(event.forecast, event.actual, event.previous);
  if (Math.abs(surprise) < 0.3) return null;  // nearly in line — no signal

  // XAU direction: surprise × rule.dir × rule weight
  const xauDirection = surprise * rule.dir * rule.w;
  // Map to -100..+100
  const score = Math.max(-100, Math.min(100, xauDirection * 33));

  return {
    score,
    surprise: Number(surprise.toFixed(2)),
    side: score > 0 ? 'L' : 'S',
    confidence: Math.abs(score),
    eventName: event.name,
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    ruleType: rule.type,
    impact: event.impact,
  };
}

// Find currently active news event (released within window)
// Returns null if no qualifying event found
function findActiveNewsEvent() {
  if (!CAL || !CAL.events || CAL.events.length === 0) return null;
  const now = Date.now();
  const minMs = (CFG.newsActiveMinAgoMin || 5) * 60 * 1000;
  const maxMs = (CFG.newsActiveMaxAgoMin || 30) * 60 * 1000;

  let best = null;

  for (const ev of CAL.events) {
    if (!ev || !ev.date) continue;
    if (ev.impact !== 'high') continue;            // only HIGH impact
    if (!ev.actual) continue;                       // not yet released
    if (ev.currency !== 'USD') continue;            // XAU pegged to USD

    const eventTime = ev.date.getTime();
    const sinceRelease = now - eventTime;

    if (sinceRelease < minMs || sinceRelease > maxMs) continue;

    const ns = computeNewsScore(ev);
    if (!ns) continue;
    if (ns.confidence < (CFG.newsConfidenceMin || 30)) continue;

    // Prefer stronger event
    if (!best || ns.confidence > best.confidence) {
      best = { ...ns, event: ev, sinceRelease, sinceMin: Math.round(sinceRelease / 60000) };
    }
  }

  return best;
}

// Combined score: 60% news + 40% technical
// Returns { combined, tier, risk } or null
function evaluateNewsModeSignal(activeNews, scoreL, scoreS) {
  if (!activeNews) return null;
  const newsConf = activeNews.confidence;       // 0-100
  const targetSide = activeNews.side;
  const techScore = (targetSide === 'L' ? scoreL.score : scoreS.score);

  const wNews = (CFG.newsSplitNews || 0.6);
  const wTech = (CFG.newsSplitTech || 0.4);

  const newsComponent = newsConf * wNews;
  const techComponent = techScore * wTech;
  const combined = newsComponent + techComponent;

  let tier = null, risk = 0;
  if (combined >= (CFG.newsTier1 || 70)) {
    tier = 1; risk = (CFG.newsTier1Risk || 1.5);
  } else if (combined >= (CFG.newsTier2 || 55)) {
    tier = 2; risk = (CFG.newsTier2Risk || 1.0);
  }

  return {
    combined: Number(combined.toFixed(1)),
    newsComponent: Number(newsComponent.toFixed(1)),
    techComponent: Number(techComponent.toFixed(1)),
    targetSide,
    techScore: Number(techScore.toFixed(1)),
    newsScore: activeNews.score,
    tier,
    risk,
    qualifies: tier !== null,
  };
}

export { NEWS_RULES, findNewsRule, parseNewsValue, computeSurpriseFactor, computeNewsScore, findActiveNewsEvent, evaluateNewsModeSignal };
