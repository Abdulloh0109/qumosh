import { CFG, ST } from './state.js';
import { log } from './utils.js';
import { refreshNewsUI } from '../store/uiState.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Янгиликлар календари + чуқур таҳлил
// Globals: EVENT_INFO, getDeepEventInfo, buildAnalysisHtml, CAL, fetchRealCalendar
// ═══════════════════════════════════════════════════════════════════

// ─── CALENDAR / NEWS ENGINE (ForexFactory + fallback) ────────────────
const CAL = { events: [], past: [], lastFetch: 0, source: 'pattern' };

// Brief descriptions for common events + XAU-specific deep analysis
const EVENT_INFO = {
  nfp: {
    brief: 'Иш ўринлари (NFP)',
    full: 'Қишлоқ хўжалиги ва давлат ишчиларидан ташқари янги иш ўринлари сони. AQSh меҳнат бозорининг энг кучли индикатори — Fed бевосита шунга қарайди. Натижа кутилмадан 50K+ фарқли бўлса, бозор кескин реакция қилади.',
    xauHigh: '<b>XAU кескин тушади.</b> Strong economy → Fed hawkish → USD ва yields кучаяди → XAU учун 1:1 тескари.',
    xauLow: '<b>XAU кўтарилади.</b> Economy weakening → Fed dovish + recession fears → safe haven flow.',
    xauInline: 'Реакция кам ($3-7). Спред кенгаяди, фойда кам. Кутиш яхшироқ.',
    swing: '$15-30 (баъзан $40+)',
    timing: 'Биринчи 5-15 минут — энг катта ҳаракат. 1-2 соат тренд давом этади.',
  },
  cpi: {
    brief: 'Истеъмол нархлари (CPI)',
    full: 'Истеъмол товарлари ва хизматлари нархининг ой-сайин ўсиши. Fed айнан шуни бошқаришга интилади — мақсад 2%. CPI юқори бўлса, ставка узоқ ушлаб турилади.',
    xauHigh: '<b>XAU кескин тушади.</b> Юқори инфляция → Fed strict → real yields ўсади → XAU учун энг ёмон сценарий.',
    xauLow: '<b>XAU кўтарилади.</b> Disinflation → Fed dovish → USD↓ → XAU rally.',
    xauInline: 'Реакция бўлмаслиги ҳам мумкин. Лекин Core CPIдан фарқ бўлса — кейин ҳаракат бўлади.',
    swing: '$20-40 — энг катталардан',
    timing: '1-3 минутда катта спайк. 30-60 минут давом этади. Кечроқ — Powell нутқи бўлса яна давом.',
  },
  ppi: {
    brief: 'Ишлаб чиқарувчи нархлари (PPI)',
    full: 'Ишлаб чиқарувчилар нархи. CPI учун олдиндан кўрсаткич — товарлар саёҳати: PPI → CPI → инфляция. Fed диққатида.',
    xauHigh: '<b>XAU тушади.</b> CPI учун hawkish сигнал.',
    xauLow: '<b>XAU кўтарилади.</b> Disinflation сигнали.',
    xauInline: 'Кучсиз реакция — кўпинча CPI муҳимроқ деб баҳоланади.',
    swing: '$8-15',
    timing: '5-30 минут.',
  },
  fomc: {
    brief: 'Fed мажлиси (FOMC)',
    full: 'Statement + Rate Decision + Press Conference. AQSh монетар сиёсати белгиланади, йилида 8 та мажлис. Айниқса dot plot ва Powell нутқи муҳим.',
    xauHigh: '<b>Hawkish surprise → XAU кескин тушади.</b> Кутилмадан юқори ставка ёки келажак учун hawkish тил.',
    xauLow: '<b>Dovish surprise → XAU кескин кўтарилади.</b> Кутилмадан паст ставка, кесиш сигнали ёки QE ишораси.',
    xauInline: 'Statement-да dot plot ва Powell нутқидаги нюанслар қарор қилади. Initial reaction баъзан тескари бўлади.',
    swing: '$20-50 — энг катта ҳаракат',
    timing: 'Statement (18:00 UTC) → 5 мин спайк. Press conf (18:30) — Powell нутқи давомий 1-2 соат.',
  },
  fomcSpeak: {
    brief: 'Fed раҳбар нутқи',
    full: 'FOMC члени тематик нутқи. Voting members (Powell, Williams, Jefferson) муҳимроқ. Hawkish/dovish ишораси бозорга таъсир қилади.',
    xauHigh: '<b>Hawkish ишора → XAU тушади.</b> "Ставка узоқ ушлаш", "инфляция ҳалигача баланд" каби сўзлар.',
    xauLow: '<b>Dovish ишора → XAU кўтарилади.</b> "Кесишга яқинмиз", "иш бозори совумоқда" каби сўзлар.',
    xauInline: 'Кўп ҳолларда реакция кам. Non-voting members (Bowman, Goolsbee) кучсизроқ.',
    swing: '$5-15',
    timing: '15-30 минут.',
  },
  retailSales: {
    brief: 'Ритейл сотув',
    full: 'Истеъмолчи харжлари ўсиши. AQSh ЯИМ-нинг ~70% — истеъмолчилардан. Strong retail = strong economy.',
    xauHigh: '<b>XAU тушади.</b> Strong consumer → economy strong → Fed hawkish.',
    xauLow: '<b>XAU кўтарилади.</b> Weak consumer → recession fears → safe haven.',
    xauInline: 'Кучсиз реакция.',
    swing: '$8-15',
    timing: '15-45 минут.',
  },
  gdp: {
    brief: 'ЯИМ ўсиши',
    full: 'AQSh ЯИМ чорак-сайин ўсиш фоизи. Иқтисод соғлиги индикатори. Final GDP олдинги маълумот, лекин Advance/Prelim муҳим.',
    xauHigh: '<b>XAU тушади.</b> Strong growth → Fed hawkish.',
    xauLow: '<b>XAU кўтарилади.</b> Weak growth → recession → safe haven.',
    xauInline: 'Кутилгандек бўлса реакция кам.',
    swing: '$10-20',
    timing: '15-45 минут.',
  },
  ismManu: {
    brief: 'ISM Manufacturing PMI',
    full: 'AQSh ишлаб чиқариш индекси. >50 = ўсиш, <50 = қисқариш. Lead indicator манфаатидан, лекин manufacturing AQSh иқтисодининг ~12% — Servicesдан кам муҳим.',
    xauHigh: '<b>>52 → XAU тушади.</b> Manufacturing strong → economy good → USD↑.',
    xauLow: '<b><48 → XAU кўтарилади.</b> Manufacturing recession → Fed dovish.',
    xauInline: '50 атрофида — реакция кам.',
    swing: '$5-12',
    timing: '10-30 минут.',
  },
  ismServ: {
    brief: 'ISM Services PMI',
    full: 'AQSh хизматлар индекси. Services иқтисоднинг ~75%, шунинг учун Manufacturingдан муҳимроқ. >50 ўсиш, <50 қисқариш.',
    xauHigh: '<b>>54 → XAU тушади.</b> Services strong → economy expand → Fed hawkish.',
    xauLow: '<b><50 → XAU кўтарилади.</b> Services қисқариш → recession сигнали.',
    xauInline: 'Орадаги қийматда реакция кам.',
    swing: '$8-15',
    timing: '10-30 минут.',
  },
  unemploymentRate: {
    brief: 'Ишсизлик даражаси',
    full: 'AQSh иш топа олмаганлар фоизи. NFP билан бирга чиқади (12:30 UTC). Fed dual mandateнинг иккинчи қисми.',
    xauHigh: '<b>Юқори → XAU кўтарилади.</b> Ишсизлик ўсиши → economy weakening → Fed dovish.',
    xauLow: '<b>Паст → XAU тушади.</b> Иш бозори strong → wage pressure → Fed hawkish.',
    xauInline: 'Кутилгандек бўлса NFP реакцияси билан кечади.',
    swing: '$8-15',
    timing: 'NFP билан бирга — реакция йиғилади.',
  },
  earnings: {
    brief: 'Иш ҳақи ўсиши (AHE)',
    full: 'Average Hourly Earnings — ўртача соатлик иш ҳақи ўсиши. CPI учун олдин кўрсаткич — wage-price spiral муҳим. Fed диққатида.',
    xauHigh: '<b>XAU тушади.</b> Wage growth →  inflation → Fed hawkish.',
    xauLow: '<b>XAU кўтарилади.</b> Wage growth slowing → инфляция тушади → Fed dovish.',
    xauInline: 'NFP билан бирга чиқади — иккаласи биргаликда таҳлил қилинади.',
    swing: '$10-20',
    timing: 'NFP билан бирга — реакция йиғилади.',
  },
  jolts: {
    brief: 'JOLTS — очиқ иш ўринлари',
    full: 'Job Openings — очиқ иш ўринлари сони. Иш бозори tightnessи индикатори. Powell бу маълумотга алоҳида аҳамият беради.',
    xauHigh: '<b>Юқори → XAU тушади.</b> Tight labor market → wage pressure → Fed hawkish.',
    xauLow: '<b>Паст → XAU кўтарилади.</b> Labor market easing → Fed dovish сигнал.',
    xauInline: 'Кутилгандек бўлса кучсиз реакция.',
    swing: '$5-12',
    timing: '10-20 минут.',
  },
  adp: {
    brief: 'ADP — NFP-олди',
    full: 'Хусусий иш ўринлари (NFPдан 2 кун олдин). Илгари NFP учун яхши олди-кўрсаткич эди, лекин охирги йилларда корреляция сусайди.',
    xauHigh: '<b>Юқори → XAU кучсиз тушади.</b> NFP учун hawkish ишора.',
    xauLow: '<b>Паст → XAU кучсиз кўтарилади.</b>',
    xauInline: 'Кучсиз реакция. ADP-NFP корреляция охирги йилларда 0.4-0.5 атрофида.',
    swing: '$5-12',
    timing: '10-30 минут.',
  },
  jobless: {
    brief: 'Иш ўринсизлик аризалари',
    full: 'Initial Jobless Claims — янги ишсизлик аризалари. Ҳар Пайшанба чиқади, тенденция учун 4-week average муҳим.',
    xauHigh: '<b>Юқори → XAU кам кўтарилади.</b> Ишсизлик ўсиши.',
    xauLow: '<b>Паст → XAU кам тушади.</b> Иш бозори strong.',
    xauInline: 'Реакция кам, фақат катта ўзгариш бўлса',
    swing: '$3-8 (паст impact)',
    timing: '5-15 минут.',
  },
  uomSent: {
    brief: 'UoM Consumer Sentiment',
    full: 'Истеъмолчи иштиҳоси — Мичиган университетидан. Кейинги 6 ой Retail Sales учун предиктив.',
    xauHigh: '<b>Юқори → XAU тушади.</b> Confident consumer → strong economy.',
    xauLow: '<b>Паст → XAU кўтарилади.</b> Worried consumer → recession fear.',
    xauInline: 'Кучсиз реакция.',
    swing: '$5-10',
    timing: '5-15 минут.',
  },
  uomInfl: {
    brief: 'UoM Inflation Expectations',
    full: 'Истеъмолчиларнинг 1-yil ва 5-yil инфляция кутилмалари. Powell бу кўрсаткичга алоҳида эътибор беради — agar кутилмалар деакр бўлса, инфляция дам этмайди.',
    xauHigh: '<b>Юқори → XAU мураккаб реакция.</b> Аввал тушади (real yields), кейин кўтарилиши мумкин (inflation hedge).',
    xauLow: '<b>Паст → XAU тушади.</b> Real yields ўсади → XAU тушади.',
    xauInline: 'Кучсиз реакция.',
    swing: '$5-15',
    timing: '5-20 минут.',
  },
  rba: {
    brief: 'RBA — Cash Rate',
    full: 'Австралия Резерв Банки stavkа қарори. AUD ўзгариши орқали XAU га таъсир қилади.',
    xauHigh: '<b>Hawkish → AUD↑ → DXY↓ → XAU↑.</b> Лекин global hawkish ҳам мумкин.',
    xauLow: '<b>Dovish → AUD↓ → DXY↑ → XAU↓.</b>',
    xauInline: 'Реакция кам.',
    swing: '$3-8',
    timing: '15-30 минут.',
  },
  boc: {
    brief: 'BOC — Канада ставкаси',
    full: 'Канада Банки stavkа қарори ёки Macklem нутқи. CAD корреляция орқали XAU га кам таъсир.',
    xauHigh: '<b>Hawkish → CAD↑ → DXY кам ўзгаради.</b>',
    xauLow: '<b>Dovish → CAD↓ → DXY кам ўзгаради.</b>',
    xauInline: 'Реакция кам.',
    swing: '$3-8',
    timing: '10-20 минут.',
  },
  boe: {
    brief: 'BOE — England Банки',
    full: 'England Банки раҳбари нутқи ёки stavkа қарори. GBP орқали DXY ўзгариши XAU га таъсир.',
    xauHigh: '<b>Hawkish → GBP↑ → DXY↓ → XAU↑.</b>',
    xauLow: '<b>Dovish → GBP↓ → DXY↑ → XAU↓.</b>',
    xauInline: 'Аралаш бўлса реакция кучсиз.',
    swing: '$5-15',
    timing: '15-45 минут.',
  },
  ecb: {
    brief: 'ECB — Lagarde',
    full: 'Европа Маркази Банки. Lagarde нутқи ёки stavkа қарори. EUR орқали DXY ўзгариши XAU га катта таъсир (DXY-нинг ~58% EUR).',
    xauHigh: '<b>Hawkish → EUR↑ → DXY↓ → XAU↑.</b> DXY-да EURнинг улкан вазни сабабли таъсир катта.',
    xauLow: '<b>Dovish → EUR↓ → DXY↑ → XAU↓.</b>',
    xauInline: 'Аралаш сигнал бўлса реакция секин.',
    swing: '$5-15',
    timing: '15-60 минут.',
  },
  rbnz: {
    brief: 'RBNZ — Yangi Zelandia',
    full: 'Yangi Zelandia ставкаси. NZD ўзгаради, XAU га кам таъсир.',
    xauHigh: 'Реакция кучсиз.',
    xauLow: 'Реакция кучсиз.',
    xauInline: 'XAU учун муҳим эмас.',
    swing: '$2-5',
    timing: '10-20 минут.',
  },
  cadEmployment: {
    brief: 'Канада иш ўринлари',
    full: 'Канада иш ўринлари ўзгариши. NFP билан бирга чиқади, CAD корреляция орқали XAU га таъсир.',
    xauHigh: '<b>Strong → CAD↑ → USD/CAD↓ → DXY↓ → XAU↑.</b>',
    xauLow: '<b>Weak → CAD↓ → USD/CAD↑ → DXY↑ → XAU↓.</b>',
    xauInline: 'NFP реакцияси билан кечади.',
    swing: '$3-8',
    timing: 'NFP билан бирга.',
  },
  durable: {
    brief: 'Узоқ муддат товарлар',
    full: 'Durable Goods Orders — узоқ муддат фойдаланиладиган товарлар буюртмалари. Бизнес инвестиция кўрсаткичи.',
    xauHigh: '<b>XAU тушади.</b> Strong business investment → strong economy.',
    xauLow: '<b>XAU кўтарилади.</b> Weak investment → recession fears.',
    xauInline: 'Volатил кўрсаткич, реакция кам.',
    swing: '$5-12',
    timing: '10-30 минут.',
  },
  consumerConf: {
    brief: 'Истеъмолчи ишончи',
    full: 'Conference Board Consumer Confidence — UoMдан фарқли манба. Бозор иккаласини солиштиради.',
    xauHigh: '<b>Юқори → XAU тушади.</b>',
    xauLow: '<b>Паст → XAU кўтарилади.</b>',
    xauInline: 'Кучсиз реакция.',
    swing: '$3-8',
    timing: '5-15 минут.',
  },
};

function getDeepEventInfo(name) {
  const lower = (name || '').toLowerCase();
  if (/non-farm|nfp/.test(lower)) return EVENT_INFO.nfp;
  if (/cpi/.test(lower)) return EVENT_INFO.cpi;
  if (/ppi/.test(lower)) return EVENT_INFO.ppi;
  if (/fomc.*statement|fed funds rate|federal funds/.test(lower)) return EVENT_INFO.fomc;
  if (/fomc.*member|fomc.*speak/.test(lower)) return EVENT_INFO.fomcSpeak;
  if (/retail sales/.test(lower)) return EVENT_INFO.retailSales;
  if (/gdp/.test(lower)) return EVENT_INFO.gdp;
  if (/ism.*manufacturing|manufacturing pmi/.test(lower)) return EVENT_INFO.ismManu;
  if (/ism.*services|services pmi/.test(lower)) return EVENT_INFO.ismServ;
  if (/unemployment rate/.test(lower)) return EVENT_INFO.unemploymentRate;
  if (/hourly earnings|average earnings|wage/.test(lower)) return EVENT_INFO.earnings;
  if (/jolts/.test(lower)) return EVENT_INFO.jolts;
  if (/adp/.test(lower)) return EVENT_INFO.adp;
  if (/unemployment claims|jobless claims/.test(lower)) return EVENT_INFO.jobless;
  if (/uom.*sentiment|consumer sentiment/.test(lower)) return EVENT_INFO.uomSent;
  if (/uom.*inflation|inflation expectations/.test(lower)) return EVENT_INFO.uomInfl;
  if (/rba|cash rate.*aud|monetary policy.*aus/.test(lower)) return EVENT_INFO.rba;
  if (/boc|macklem/.test(lower)) return EVENT_INFO.boc;
  if (/boe|bailey/.test(lower)) return EVENT_INFO.boe;
  if (/lagarde|ecb president/.test(lower)) return EVENT_INFO.ecb;
  if (/rbnz|breman/.test(lower)) return EVENT_INFO.rbnz;
  if (/employment change/.test(lower)) return EVENT_INFO.cadEmployment;
  if (/durable goods/.test(lower)) return EVENT_INFO.durable;
  if (/conference.*confidence|consumer confidence/.test(lower)) return EVENT_INFO.consumerConf;
  return null;
}

function getEventInfo(name) {
  const deep = getDeepEventInfo(name);
  if (deep) return {desc: deep.brief};
  return {desc: ''};
}

function buildAnalysisHtml(ev) {
  const info = getDeepEventInfo(ev.name);
  // Compute momentum if numeric
  let momentumHtml = '';
  const f = parseFloat((ev.forecast || '').replace(/[^\d.\-]/g, ''));
  const p = parseFloat((ev.previous || '').replace(/[^\d.\-]/g, ''));
  if (!isNaN(f) && !isNaN(p) && (p !== 0 || f !== 0)) {
    const delta = f - p;
    const dir = delta > 0 ? '↑' : delta < 0 ? '↓' : '═';
    const trendCls = delta > 0 ? 'up' : delta < 0 ? 'dn' : 'flat';
    const trend = delta > 0 ? 'олдингидан ўсиш кутилмоқда' : delta < 0 ? 'олдингидан тушиш кутилмоқда' : 'ўзгармаслик';
    momentumHtml = `<div class="nd-section">
      <div class="nd-h">📊 ТЕНДЕНЦИЯ</div>
      <div class="nd-trend ${trendCls}"><b>${dir} ${ev.forecast}</b> vs <b>${ev.previous}</b> · ${trend} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})</div>
    </div>`;
  }
  if (!info) {
    return `<div class="news-detail">
      <div class="nd-section">
        <div class="nd-h">📊 ИВЕНТ ҲАҚИДА</div>
        <div class="nd-p">Бу ивент учун чуқур таҳлил тайёрланмаган. Қуйидаги маълумотлардан фойдаланинг:</div>
      </div>
      <div class="nd-section">
        <div class="nd-h">📈 ҚИЙМАТЛАР</div>
        <div class="nd-grid">
          <div><span class="nd-l">Импакт:</span> <b>${ev.impact.toUpperCase()}</b></div>
          <div><span class="nd-l">Валюта:</span> <b>${ev.currency}</b></div>
          <div><span class="nd-l">Прогноз:</span> <b>${ev.forecast || '—'}</b></div>
          <div><span class="nd-l">Олдинги:</span> <b>${ev.previous || '—'}</b></div>
        </div>
      </div>
      ${momentumHtml}
      <div class="nd-section">
        <div class="nd-h">🔮 УМУМИЙ ҚОИДА</div>
        <div class="nd-scen flat">${ev.impact === 'high' ? 'Юқори импакт ивент. Кутилмадан фарқлаш катта реакция келтириши мумкин ($10-25 swing).' : ev.impact === 'med' ? 'Ўрта импакт. Реакция кучсиз ($3-10 swing).' : 'Паст импакт. Реакция деярли йўқ.'}</div>
      </div>
    </div>`;
  }
  return `<div class="news-detail">
    <div class="nd-section">
      <div class="nd-h">📊 НИМА ЁЗИЛАДИ</div>
      <div class="nd-p">${info.full}</div>
    </div>
    <div class="nd-section">
      <div class="nd-h">📈 ҚИЙМАТЛАР</div>
      <div class="nd-grid">
        <div><span class="nd-l">Прогноз:</span> <b>${ev.forecast || '—'}</b></div>
        <div><span class="nd-l">Олдинги:</span> <b>${ev.previous || '—'}</b></div>
      </div>
    </div>
    ${momentumHtml}
    <div class="nd-section">
      <div class="nd-h">🔮 XAUUSD УЧУН СЕНАРИЙЛАР</div>
      <div class="nd-scen up">↑ <b>Натижа &gt; Прогноз:</b> ${info.xauHigh}</div>
      <div class="nd-scen flat">═ <b>Натижа = Прогноз:</b> ${info.xauInline}</div>
      <div class="nd-scen dn">↓ <b>Натижа &lt; Прогноз:</b> ${info.xauLow}</div>
    </div>
    <div class="nd-section">
      <div class="nd-h">⏱ ОДАТДАГИ ҲАРАКАТ</div>
      <div class="nd-stats">📏 Свинг: <b>${info.swing}</b><br>⏰ ${info.timing}</div>
    </div>
  </div>`;
}

// Detect US DST (rough)
function isUSDST(d) {
  const yr = d.getUTCFullYear();
  const mar = new Date(Date.UTC(yr, 2, 8)); // around 2nd Sunday of March
  const dstStart = Date.UTC(yr, 2, 8 + ((7 - mar.getUTCDay()) % 7), 7); // 2am EST
  const nov = new Date(Date.UTC(yr, 10, 1)); // 1st Sunday of November
  const dstEnd = Date.UTC(yr, 10, 1 + ((7 - nov.getUTCDay()) % 7), 6); // 2am EDT
  return d.getTime() >= dstStart && d.getTime() < dstEnd;
}

// Fetch real calendar from FairEconomy (ForexFactory feed) — with CORS proxy fallback
async function fetchRealCalendar() {
  const baseUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
  const baseUrl2 = 'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.xml';
  // Cache-buster to avoid stale 304 responses
  const bust = '?_=' + Date.now();
  // Try multiple proxies — one usually works
  const urls = [
    {url: baseUrl + bust, via: 'direct'},
    {url: baseUrl2 + bust, via: 'direct-cdn'},
    {url: 'https://corsproxy.io/?' + encodeURIComponent(baseUrl), via: 'corsproxy.io'},
    {url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(baseUrl), via: 'allorigins'},
    {url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(baseUrl), via: 'codetabs'},
    {url: 'https://api.cors.lol/?url=' + encodeURIComponent(baseUrl), via: 'cors.lol'},
    {url: 'https://corsproxy.org/?' + encodeURIComponent(baseUrl), via: 'corsproxy.org'},
    {url: 'https://thingproxy.freeboard.io/fetch/' + baseUrl, via: 'thingproxy'},
    {url: 'https://yacdn.org/proxy/' + baseUrl, via: 'yacdn'},
    {url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(baseUrl2), via: 'allorigins-cdn'},
  ];
  let lastError = '';
  for (const {url, via} of urls) {
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 8000); // 8s per proxy
      const res = await fetch(url, {cache: 'no-store', signal: ctrl.signal});
      clearTimeout(timeoutId);
      if (!res.ok) { lastError = `${via}:HTTP ${res.status}`; continue; }
      const xml = await res.text();
      if (!xml || xml.length < 500) { lastError = `${via}:бўш`; continue; }
      if (!xml.includes('<event>')) { lastError = `${via}:нотўғри XML`; continue; }
      const events = parseFFXml(xml);
      if (events.length > 0) {
        log('INFO', `✅ ${events.length} ивент юкланди (${via})`);
        return events;
      }
      lastError = `${via}:ивент йўқ`;
    } catch(e) {
      lastError = `${via}:${e.name === 'AbortError' ? 'timeout' : (e.message||'').slice(0,30)}`;
    }
  }
  log('WARN', `Янгиликлар юкланмади — охирги хато: ${lastError}`);
  return null;
}

function parseFFXml(xml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const events = [];
    doc.querySelectorAll('event').forEach(ev => {
      const get = (tag) => (ev.querySelector(tag)?.textContent || '').trim();
      const title = get('title');
      const country = get('country');
      const dateStr = get('date');
      const timeStr = get('time');
      const impactRaw = get('impact').toLowerCase();
      const forecast = get('forecast');
      const previous = get('previous');
      const actual = get('actual');  // ← ForexFactory релиздан кейин tо'lдиради
      // Filter to majors that move XAU
      if (!['USD','EUR','GBP','JPY','AUD','CHF','CAD','NZD'].includes(country)) return;
      // Skip Bank Holidays (low signal value)
      if (impactRaw === 'holiday') return;
      // Parse date: mm-dd-yyyy
      const dm = dateStr.match(/(\d+)-(\d+)-(\d+)/);
      if (!dm) return;
      const m = +dm[1], d = +dm[2], y = +dm[3];
      // Parse time: 8:30am / 12:30pm / "All Day" / "Tentative"
      let h = 12, min = 0, hasTime = false;
      const tm = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (tm) {
        h = +tm[1]; min = +tm[2];
        if (tm[3].toLowerCase() === 'pm' && h !== 12) h += 12;
        if (tm[3].toLowerCase() === 'am' && h === 12) h = 0;
        hasTime = true;
      } else if (/all day|tentative/i.test(timeStr)) {
        h = 12; min = 0; hasTime = false;
      }
      // ⚠ FF XML times are in GMT/UTC — NO timezone conversion needed
      const dt = new Date(Date.UTC(y, m-1, d, h, min));
      const info = getEventInfo(title);
      events.push({
        date: dt, name: title, currency: country,
        impact: impactRaw === 'high' ? 'high' : impactRaw === 'medium' ? 'med' : 'low',
        forecast, previous, actual,
        desc: info.desc,
        hasTime,
        source: 'forexfactory',
        auto: true,
      });
    });
    return events;
  } catch(e) {
    log('WARN', `XML parse: ${(e.message||'').slice(0,40)}`);
    return [];
  }
}

// Fallback hardcoded patterns (used if real fetch fails)
function buildFallbackCalendar() {
  const events = [];
  const now = new Date();
  for (let dDay = 0; dDay < CFG.newsForecastDays; dDay++) {
    const dt = new Date(now.getTime() + dDay * 86400000);
    const dow = dt.getUTCDay();
    const dom = dt.getUTCDate();
    const wom = Math.ceil(dom / 7);
    const yr = dt.getUTCFullYear(), mo = dt.getUTCMonth();
    // BLS rule: NFP on 1st Friday OF month, EXCEPT when 1st of month is Friday → push to 2nd Friday
    const firstDayOfMonth = new Date(Date.UTC(yr, mo, 1)).getUTCDay();
    const firstDayIsFriday = firstDayOfMonth === 5;
    const isNFP = (dow === 5) && (
      (wom === 1 && !firstDayIsFriday) ||
      (wom === 2 && firstDayIsFriday)
    );
    if (isNFP) {
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'Non-Farm Employment Change', impact:'high', currency:'USD', auto:true, desc:EVENT_INFO['NFP'].desc, forecast:'', previous:''});
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'Average Hourly Earnings m/m', impact:'high', currency:'USD', auto:true, desc:'Иш ҳақи ўсиши. Юқори → инфляция → Fed hawkish', forecast:'', previous:''});
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'Unemployment Rate', impact:'high', currency:'USD', auto:true, desc:EVENT_INFO['Unemployment'].desc, forecast:'', previous:''});
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'CAD Employment Change', impact:'high', currency:'CAD', auto:true, desc:'Канада иш ўринлари — NFP билан бирга чиқади', forecast:'', previous:''});
    }
    // CPI: 2nd Tuesday/Wednesday
    if ((dow === 2 || dow === 3) && wom === 2) events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:`US CPI (${dow===2?'Tue':'Wed'})`, impact:'high', currency:'USD', auto:true, desc:EVENT_INFO['CPI'].desc, forecast:'', previous:''});
    if (dow === 4 && (wom === 2 || wom === 3)) events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'US PPI', impact:'med', currency:'USD', auto:true, desc:EVENT_INFO['PPI'].desc, forecast:'', previous:''});
    if ((dow === 4 || dow === 5) && wom === 3) events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'US Retail Sales', impact:'med', currency:'USD', auto:true, desc:EVENT_INFO['Retail Sales'].desc, forecast:'', previous:''});
    if (dom <= 3 && (dow >= 1 && dow <= 5)) events.push({date:new Date(Date.UTC(yr,mo,dom,14,0)), name:'US ISM PMI', impact:'med', currency:'USD', auto:true, desc:EVENT_INFO['ISM'].desc, forecast:'', previous:''});
    if (dow === 4) events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'US Unemployment Claims', impact:'med', currency:'USD', auto:true, desc:EVENT_INFO['Jobless Claims'].desc, forecast:'', previous:''});
  }
  return events;
}

async function buildCalendar() {
  let events = await fetchRealCalendar();
  if (events && events.length > 0) {
    CAL.source = 'forexfactory';
  } else {
    events = buildFallbackCalendar();
    CAL.source = 'pattern';
    log('INFO', '📅 ForexFactory улаб бўлмади — паттерн режим');
  }
  // Add user custom events
  try {
    const custom = JSON.parse(localStorage.getItem('qumash_custom_events') || '[]');
    for (const e of custom) events.push({...e, date:new Date(e.date), auto:false, source:'custom'});
  } catch(_) {}
  // Filter out events more than 2h in the past
  const cutoff = Date.now() - 2 * 3600 * 1000;
  CAL.events = events.filter(e => e.date.getTime() > cutoff).sort((a,b) => a.date - b.date);
  CAL.lastFetch = Date.now();
  // Load past impacts
  try { CAL.past = JSON.parse(localStorage.getItem('qumash_past_impacts') || '[]'); } catch(_) { CAL.past = []; }
}

// Track price impact after each event
function trackPastImpacts() {
  const now = Date.now();
  for (const ev of CAL.events) {
    const evMs = ev.date.getTime();
    // 30 min after event passed
    if (now > evMs + 30*60*1000 && now < evMs + 35*60*1000) {
      // Check if already recorded
      if (CAL.past.find(p => Math.abs(p.dateMs - evMs) < 60000 && p.name === ev.name)) continue;
      // Find candles in event window
      const startT = Math.floor(evMs / 1000);
      const endT = startT + 30 * 60;
      const inWin = ST.candles.filter(c => c.epoch >= startT - 60 && c.epoch <= endT);
      if (inWin.length < 2) continue;
      const startPrice = inWin[0].o;
      const high = Math.max(...inWin.map(c => c.h));
      const low = Math.min(...inWin.map(c => c.l));
      const endPrice = inWin[inWin.length-1].c;
      const swingUp = high - startPrice;
      const swingDn = startPrice - low;
      const totalSwing = Math.max(swingUp, swingDn);
      const direction = endPrice > startPrice + 0.5 ? 'up' : endPrice < startPrice - 0.5 ? 'dn' : 'flat';
      const rec = {
        dateMs: evMs,
        dateTxt: ev.date.toISOString().slice(5,10).replace('-','/'),
        name: ev.name,
        impact: ev.impact,
        currency: ev.currency,
        startPrice, endPrice, high, low,
        swing: totalSwing,
        netMove: endPrice - startPrice,
        direction,
      };
      CAL.past.unshift(rec);
      if (CAL.past.length > 30) CAL.past.pop();
      try { localStorage.setItem('qumash_past_impacts', JSON.stringify(CAL.past)); } catch(_) {}
      log('INFO', `📊 Ивент ёзилди: ${ev.name}`, `swing $${totalSwing.toFixed(2)} ${direction.toUpperCase()}`);
    }
  }
}

function addCustomEvent(ev) {
  try {
    const custom = JSON.parse(localStorage.getItem('qumash_custom_events') || '[]');
    custom.push(ev);
    localStorage.setItem('qumash_custom_events', JSON.stringify(custom));
    buildCalendar();
    refreshNewsUI();
  } catch(e) { log('ERR', 'Ивент сақланмади', e.message); }
}

export { CAL, EVENT_INFO, getDeepEventInfo, getEventInfo, buildAnalysisHtml, isUSDST, fetchRealCalendar, parseFFXml, buildFallbackCalendar, buildCalendar, trackPastImpacts, addCustomEvent };
