import { CFG, ST } from '../state.js';
import { detectSession } from '../filters.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v9 — PSYCHOLOGY & DISCIPLINE (Mark Douglas + Falcon FX PDF'dan)
// Globals: buildPsychChecklist, detectRiskState, getPsychQuote
// ═══════════════════════════════════════════════════════════════════
// Mark Douglas "Trading in the Zone"'dan:
//   - Probabilistic thinking
//   - Each trade = nezavisimaya statistika
//   - Mistakes = part of edge, not personal failure
//
// Falcon FX'dan:
//   - "News creates volatility, not direction"
//   - "Consistency develops through focusing on winning trades, not losses"
//   - "Humble yourself or the market will do it for you"
//
// Risk states bizning tizimda:
//   - FOMO RISK: ko'p signal o'tib ketdi, foydalanuvchi entry'ni majburlash istaydi
//   - REVENGE: oxirgi 2+ SL, daily R manfiy
//   - OVERCONFIDENT: kuchli streak (3+ wins), risk ni oshirishga moil bo'lish
//   - DRAWDOWN: -3R yoki ko'proq daily
// ═══════════════════════════════════════════════════════════════════

// ─── PSYCHOLOGY QUOTES (rotating) ───────────────────────────────────
const PSYCH_QUOTES = [
  { en: 'Patience is not about waiting, but about keeping a good attitude while waiting.', author: 'Falcon FX' },
  { en: 'Consistency develops through focusing on the power of the winning trades, not the losses.', author: 'Falcon FX' },
  { en: 'News creates volatility, not direction.', author: 'Falcon FX' },
  { en: 'Not one bad day, week, or month will make or break you as a trader.', author: 'Falcon FX' },
  { en: 'Above all else the nature of the market will always guide us in the right direction.', author: 'Falcon FX' },
  { en: 'Humble yourself or the market will do it for you.', author: 'Falcon FX' },
  { en: 'Anything can happen.', author: 'Mark Douglas' },
  { en: 'You don\'t need to know what will happen next to make money.', author: 'Mark Douglas' },
  { en: 'Every moment in the market is unique.', author: 'Mark Douglas' },
  { en: 'There is a random distribution between wins and losses for any given set of variables that define an edge.', author: 'Mark Douglas' },
  { en: 'The consistency you seek is in your mind, not in the markets.', author: 'Mark Douglas' },
  { en: 'Trade like a casino — manage your risk and let probabilities work.', author: 'Mark Douglas' },
];

function getPsychQuote() {
  // Rotate based on the day so user sees different ones
  const idx = Math.floor(Date.now() / (1000 * 3600 * 4)) % PSYCH_QUOTES.length;
  return PSYCH_QUOTES[idx];
}

// ─── DETECT RISK STATE (bugungi xatarni baholash) ────────────────────
function detectRiskState() {
  const out = { state: 'NORMAL', warnings: [], advice: '' };

  // FOMO risk: too many signals skipped, current quality not great
  const recent = ST.history.slice(0, 10);

  // Revenge: last 2+ trades were losses, today's R negative
  const last2 = recent.slice(0, 2);
  if (last2.length === 2 && last2.every(t => t.exit === 'sl')) {
    out.state = 'REVENGE_RISK';
    out.warnings.push('🔴 Oxirgi 2 bitim — SL. Revenge trading xavfi.');
    out.advice = '🧘 Tanaffus oling. 1-2 soat charts\'dan uzoq turing.';
  }

  // Drawdown
  if (ST.todayR <= -3) {
    out.state = 'DRAWDOWN';
    out.warnings.push(`📉 Bugungi R: ${ST.todayR.toFixed(1)}R. Daily drawdown limit.`);
    out.advice = '🛑 Bugun savdoni to\'xtatish va ertaga toza boshlash tavsiya etiladi.';
  }

  // Overconfident streak
  const last3 = recent.slice(0, 3);
  if (last3.length === 3 && last3.every(t => t.exit === 'tp')) {
    if (out.state === 'NORMAL') {
      out.state = 'STREAK';
      out.warnings.push('🔥 Oxirgi 3 bitim — TP. Overconfidence xavfi.');
      out.advice = '⚠️ Risk standart darajada qoldiring. Lot oshirmang.';
    }
  }

  // Monday rule
  if (new Date().getUTCDay() === 1 && !CFG.mondayBlock) {
    out.warnings.push('📅 Monday — past range kun. TTrades qoidasi: kuzating.');
  }

  // Friday late
  const dow = new Date().getUTCDay();
  const utcH = new Date().getUTCHours();
  if (dow === 5 && utcH >= 16) {
    out.warnings.push('📅 Juma kechqurun — yopiq oxiri xavfli.');
  }

  return out;
}

// ─── PRE-ENTRY CHECKLIST ────────────────────────────────────────────
// Trade ochishdan oldin avtomatik tekshirilishi kerak savollar
function buildPsychChecklist() {
  const items = [];
  const riskState = detectRiskState();

  // 1) Risk state
  items.push({
    q: '🧠 Hozirgi psixologik holat?',
    answer: riskState.state,
    signal: riskState.state === 'NORMAL' ? 'good' : 'warn',
    detail: riskState.advice || 'Tanlangan savdoga tayyor',
  });

  // 2) Today's R
  items.push({
    q: '📊 Bugungi R',
    answer: `${ST.todayR >= 0 ? '+' : ''}${ST.todayR.toFixed(1)}R`,
    signal: ST.todayR > 0 ? 'good' : ST.todayR < -2 ? 'warn' : 'neutral',
    detail: ST.todayR < -3 ? 'Daily limit yetdi — to\'xtang' : 'davom eting',
  });

  // 3) Last 10 WR
  const recent10 = ST.history.slice(0, 10);
  const wins10 = recent10.filter(t => t.exit === 'tp').length;
  const closed10 = recent10.filter(t => ['tp', 'sl', 'be'].includes(t.exit)).length;
  if (closed10 > 0) {
    const wr = (wins10 / closed10 * 100).toFixed(0);
    items.push({
      q: '📈 Oxirgi 10 bitim WR',
      answer: `${wr}% (${wins10}/${closed10})`,
      signal: wr >= 50 ? 'good' : wr >= 30 ? 'neutral' : 'warn',
      detail: wr >= 50 ? 'Tizim ishlamoqda' : 'Filterlar kuchli emas',
    });
  }

  // 4) Risk per trade check
  const dailyLimitR = -5;
  const remainingRisk = Math.max(0, dailyLimitR - ST.todayR);
  items.push({
    q: '💰 Daily risk limit',
    answer: `${remainingRisk.toFixed(1)}R qoldi`,
    signal: remainingRisk > 2 ? 'good' : remainingRisk > 0 ? 'neutral' : 'warn',
    detail: 'Standard 1.0-1.5%/savdo',
  });

  // 5) Time of day quality
  if (typeof detectSession === 'function') {
    const sess = detectSession();
    items.push({
      q: '🕒 Sessia sifati',
      answer: `${sess.txt} (${(sess.quality * 100).toFixed(0)}%)`,
      signal: sess.quality >= 0.8 ? 'good' : sess.quality >= 0.5 ? 'neutral' : 'warn',
      detail: sess.quality < 0.5 ? 'Kam sifatli sessia — kutib turing' : '',
    });
  }

  return { items, warnings: riskState.warnings, advice: riskState.advice, state: riskState.state };
}

// ─── BLOCK ENTRY IN EXTREME PSYCHOLOGY STATE ───────────────────────
// Returns: {block: true/false, reason}
function checkPsychBlock() {
  if (!CFG.psychBlock) return { block: false, reason: '' };
  const state = detectRiskState();

  // Block entries in REVENGE or DRAWDOWN
  if (state.state === 'DRAWDOWN') {
    return { block: true, reason: `Daily drawdown ${ST.todayR.toFixed(1)}R — savdo bloklangan` };
  }
  if (state.state === 'REVENGE_RISK' && CFG.psychBlockStrict) {
    return { block: true, reason: 'Revenge risk — keyingi sessia kutib turing' };
  }
  return { block: false, reason: '' };
}

export { PSYCH_QUOTES, getPsychQuote, detectRiskState, buildPsychChecklist, checkPsychBlock };
