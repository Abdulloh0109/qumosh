import { CFG, ST } from './state.js';
import { log } from './utils.js';
import { refreshNewsUI } from '../store/uiState.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Yangiliklar kalendari + chuqur tahlil
// Globals: EVENT_INFO, getDeepEventInfo, buildAnalysisHtml, CAL, fetchRealCalendar
// ═══════════════════════════════════════════════════════════════════

// ─── CALENDAR / NEWS ENGINE (ForexFactory + fallback) ────────────────
const CAL = { events: [], past: [], lastFetch: 0, source: 'pattern' };

// Brief descriptions for common events + XAU-specific deep analysis
const EVENT_INFO = {
  nfp: {
    brief: 'Ish oʻrinlari (NFP)',
    full: 'Qishloq xoʻjaligi va davlat ishchilaridan tashqari yangi ish oʻrinlari soni. AQSh mehnat bozorining eng kuchli indikatori — Fed bevosita shunga qaraydi. Natija kutilmadan 50K+ farqli boʻlsa, bozor keskin reaktsiya qiladi.',
    xauHigh: '<b>XAU keskin tushadi.</b> Strong economy → Fed hawkish → USD va yields kuchayadi → XAU uchun 1:1 teskari.',
    xauLow: '<b>XAU koʻtariladi.</b> Economy weakening → Fed dovish + recession fears → safe haven flow.',
    xauInline: 'Reaktsiya kam ($3-7). Spred kengayadi, foyda kam. Kutish yaxshiroq.',
    swing: '$15-30 (baʼzan $40+)',
    timing: 'Birinchi 5-15 minut — eng katta harakat. 1-2 soat trend davom etadi.',
  },
  cpi: {
    brief: 'Isteʼmol narxlari (CPI)',
    full: 'Isteʼmol tovarlari va xizmatlari narxining oy-sayin oʻsishi. Fed aynan shuni boshqarishga intiladi — maqsad 2%. CPI yuqori boʻlsa, stavka uzoq ushlab turiladi.',
    xauHigh: '<b>XAU keskin tushadi.</b> Yuqori inflyatsiya → Fed strict → real yields oʻsadi → XAU uchun eng yomon stsenariy.',
    xauLow: '<b>XAU koʻtariladi.</b> Disinflation → Fed dovish → USD↓ → XAU rally.',
    xauInline: 'Reaktsiya boʻlmasligi ham mumkin. Lekin Core CPIdan farq boʻlsa — keyin harakat boʻladi.',
    swing: '$20-40 — eng kattalardan',
    timing: '1-3 minutda katta spayk. 30-60 minut davom etadi. Kechroq — Powell nutqi boʻlsa yana davom.',
  },
  ppi: {
    brief: 'Ishlab chiqaruvchi narxlari (PPI)',
    full: 'Ishlab chiqaruvchilar narxi. CPI uchun oldindan koʻrsatkich — tovarlar sayohati: PPI → CPI → inflyatsiya. Fed diqqatida.',
    xauHigh: '<b>XAU tushadi.</b> CPI uchun hawkish signal.',
    xauLow: '<b>XAU koʻtariladi.</b> Disinflation signali.',
    xauInline: 'Kuchsiz reaktsiya — koʻpincha CPI muhimroq deb baholanadi.',
    swing: '$8-15',
    timing: '5-30 minut.',
  },
  fomc: {
    brief: 'Fed majlisi (FOMC)',
    full: 'Statement + Rate Decision + Press Conference. AQSh monetar siyosati belgilanadi, yilida 8 ta majlis. Ayniqsa dot plot va Powell nutqi muhim.',
    xauHigh: '<b>Hawkish surprise → XAU keskin tushadi.</b> Kutilmadan yuqori stavka yoki kelajak uchun hawkish til.',
    xauLow: '<b>Dovish surprise → XAU keskin koʻtariladi.</b> Kutilmadan past stavka, kesish signali yoki QE ishorasi.',
    xauInline: 'Statement-da dot plot va Powell nutqidagi nyuanslar qaror qiladi. Initial reaction baʼzan teskari boʻladi.',
    swing: '$20-50 — eng katta harakat',
    timing: 'Statement (18:00 UTC) → 5 min spayk. Press conf (18:30) — Powell nutqi davomiy 1-2 soat.',
  },
  fomcSpeak: {
    brief: 'Fed rahbar nutqi',
    full: 'FOMC chleni tematik nutqi. Voting members (Powell, Williams, Jefferson) muhimroq. Hawkish/dovish ishorasi bozorga taʼsir qiladi.',
    xauHigh: '<b>Hawkish ishora → XAU tushadi.</b> "Stavka uzoq ushlash", "inflyatsiya haligacha baland" kabi soʻzlar.',
    xauLow: '<b>Dovish ishora → XAU koʻtariladi.</b> "Kesishga yaqinmiz", "ish bozori sovumoqda" kabi soʻzlar.',
    xauInline: 'Koʻp hollarda reaktsiya kam. Non-voting members (Bowman, Goolsbee) kuchsizroq.',
    swing: '$5-15',
    timing: '15-30 minut.',
  },
  retailSales: {
    brief: 'Riteyl sotuv',
    full: 'Isteʼmolchi xarjlari oʻsishi. AQSh YAIM-ning ~70% — isteʼmolchilardan. Strong retail = strong economy.',
    xauHigh: '<b>XAU tushadi.</b> Strong consumer → economy strong → Fed hawkish.',
    xauLow: '<b>XAU koʻtariladi.</b> Weak consumer → recession fears → safe haven.',
    xauInline: 'Kuchsiz reaktsiya.',
    swing: '$8-15',
    timing: '15-45 minut.',
  },
  gdp: {
    brief: 'YAIM oʻsishi',
    full: 'AQSh YAIM chorak-sayin oʻsish foizi. Iqtisod sogʻligi indikatori. Final GDP oldingi maʼlumot, lekin Advance/Prelim muhim.',
    xauHigh: '<b>XAU tushadi.</b> Strong growth → Fed hawkish.',
    xauLow: '<b>XAU koʻtariladi.</b> Weak growth → recession → safe haven.',
    xauInline: 'Kutilgandek boʻlsa reaktsiya kam.',
    swing: '$10-20',
    timing: '15-45 minut.',
  },
  ismManu: {
    brief: 'ISM Manufacturing PMI',
    full: 'AQSh ishlab chiqarish indeksi. >50 = oʻsish, <50 = qisqarish. Lead indicator manfaatidan, lekin manufacturing AQSh iqtisodining ~12% — Servicesdan kam muhim.',
    xauHigh: '<b>>52 → XAU tushadi.</b> Manufacturing strong → economy good → USD↑.',
    xauLow: '<b><48 → XAU koʻtariladi.</b> Manufacturing recession → Fed dovish.',
    xauInline: '50 atrofida — reaktsiya kam.',
    swing: '$5-12',
    timing: '10-30 minut.',
  },
  ismServ: {
    brief: 'ISM Services PMI',
    full: 'AQSh xizmatlar indeksi. Services iqtisodning ~75%, shuning uchun Manufacturingdan muhimroq. >50 oʻsish, <50 qisqarish.',
    xauHigh: '<b>>54 → XAU tushadi.</b> Services strong → economy expand → Fed hawkish.',
    xauLow: '<b><50 → XAU koʻtariladi.</b> Services qisqarish → recession signali.',
    xauInline: 'Oradagi qiymatda reaktsiya kam.',
    swing: '$8-15',
    timing: '10-30 minut.',
  },
  unemploymentRate: {
    brief: 'Ishsizlik darajasi',
    full: 'AQSh ish topa olmaganlar foizi. NFP bilan birga chiqadi (12:30 UTC). Fed dual mandatening ikkinchi qismi.',
    xauHigh: '<b>Yuqori → XAU koʻtariladi.</b> Ishsizlik oʻsishi → economy weakening → Fed dovish.',
    xauLow: '<b>Past → XAU tushadi.</b> Ish bozori strong → wage pressure → Fed hawkish.',
    xauInline: 'Kutilgandek boʻlsa NFP reaktsiyasi bilan kechadi.',
    swing: '$8-15',
    timing: 'NFP bilan birga — reaktsiya yigʻiladi.',
  },
  earnings: {
    brief: 'Ish haqi oʻsishi (AHE)',
    full: 'Average Hourly Earnings — oʻrtacha soatlik ish haqi oʻsishi. CPI uchun oldin koʻrsatkich — wage-price spiral muhim. Fed diqqatida.',
    xauHigh: '<b>XAU tushadi.</b> Wage growth →  inflation → Fed hawkish.',
    xauLow: '<b>XAU koʻtariladi.</b> Wage growth slowing → inflyatsiya tushadi → Fed dovish.',
    xauInline: 'NFP bilan birga chiqadi — ikkalasi birgalikda tahlil qilinadi.',
    swing: '$10-20',
    timing: 'NFP bilan birga — reaktsiya yigʻiladi.',
  },
  jolts: {
    brief: 'JOLTS — ochiq ish oʻrinlari',
    full: 'Job Openings — ochiq ish oʻrinlari soni. Ish bozori tightnessi indikatori. Powell bu maʼlumotga alohida ahamiyat beradi.',
    xauHigh: '<b>Yuqori → XAU tushadi.</b> Tight labor market → wage pressure → Fed hawkish.',
    xauLow: '<b>Past → XAU koʻtariladi.</b> Labor market easing → Fed dovish signal.',
    xauInline: 'Kutilgandek boʻlsa kuchsiz reaktsiya.',
    swing: '$5-12',
    timing: '10-20 minut.',
  },
  adp: {
    brief: 'ADP — NFP-oldi',
    full: 'Xususiy ish oʻrinlari (NFPdan 2 kun oldin). Ilgari NFP uchun yaxshi oldi-koʻrsatkich edi, lekin oxirgi yillarda korrelyatsiya susaydi.',
    xauHigh: '<b>Yuqori → XAU kuchsiz tushadi.</b> NFP uchun hawkish ishora.',
    xauLow: '<b>Past → XAU kuchsiz koʻtariladi.</b>',
    xauInline: 'Kuchsiz reaktsiya. ADP-NFP korrelyatsiya oxirgi yillarda 0.4-0.5 atrofida.',
    swing: '$5-12',
    timing: '10-30 minut.',
  },
  jobless: {
    brief: 'Ish oʻrinsizlik arizalari',
    full: 'Initial Jobless Claims — yangi ishsizlik arizalari. Har Payshanba chiqadi, tendentsiya uchun 4-week average muhim.',
    xauHigh: '<b>Yuqori → XAU kam koʻtariladi.</b> Ishsizlik oʻsishi.',
    xauLow: '<b>Past → XAU kam tushadi.</b> Ish bozori strong.',
    xauInline: 'Reaktsiya kam, faqat katta oʻzgarish boʻlsa',
    swing: '$3-8 (past impact)',
    timing: '5-15 minut.',
  },
  uomSent: {
    brief: 'UoM Consumer Sentiment',
    full: 'Isteʼmolchi ishtihosi — Michigan universitetidan. Keyingi 6 oy Retail Sales uchun prediktiv.',
    xauHigh: '<b>Yuqori → XAU tushadi.</b> Confident consumer → strong economy.',
    xauLow: '<b>Past → XAU koʻtariladi.</b> Worried consumer → recession fear.',
    xauInline: 'Kuchsiz reaktsiya.',
    swing: '$5-10',
    timing: '5-15 minut.',
  },
  uomInfl: {
    brief: 'UoM Inflation Expectations',
    full: 'Isteʼmolchilarning 1-yil va 5-yil inflyatsiya kutilmalari. Powell bu koʻrsatkichga alohida eʼtibor beradi — agar kutilmalar deakr boʻlsa, inflyatsiya dam etmaydi.',
    xauHigh: '<b>Yuqori → XAU murakkab reaktsiya.</b> Avval tushadi (real yields), keyin koʻtarilishi mumkin (inflation hedge).',
    xauLow: '<b>Past → XAU tushadi.</b> Real yields oʻsadi → XAU tushadi.',
    xauInline: 'Kuchsiz reaktsiya.',
    swing: '$5-15',
    timing: '5-20 minut.',
  },
  rba: {
    brief: 'RBA — Cash Rate',
    full: 'Avstraliya Rezerv Banki stavka qarori. AUD oʻzgarishi orqali XAU ga taʼsir qiladi.',
    xauHigh: '<b>Hawkish → AUD↑ → DXY↓ → XAU↑.</b> Lekin global hawkish ham mumkin.',
    xauLow: '<b>Dovish → AUD↓ → DXY↑ → XAU↓.</b>',
    xauInline: 'Reaktsiya kam.',
    swing: '$3-8',
    timing: '15-30 minut.',
  },
  boc: {
    brief: 'BOC — Kanada stavkasi',
    full: 'Kanada Banki stavka qarori yoki Macklem nutqi. CAD korrelyatsiya orqali XAU ga kam taʼsir.',
    xauHigh: '<b>Hawkish → CAD↑ → DXY kam oʻzgaradi.</b>',
    xauLow: '<b>Dovish → CAD↓ → DXY kam oʻzgaradi.</b>',
    xauInline: 'Reaktsiya kam.',
    swing: '$3-8',
    timing: '10-20 minut.',
  },
  boe: {
    brief: 'BOE — England Banki',
    full: 'England Banki rahbari nutqi yoki stavka qarori. GBP orqali DXY oʻzgarishi XAU ga taʼsir.',
    xauHigh: '<b>Hawkish → GBP↑ → DXY↓ → XAU↑.</b>',
    xauLow: '<b>Dovish → GBP↓ → DXY↑ → XAU↓.</b>',
    xauInline: 'Aralash boʻlsa reaktsiya kuchsiz.',
    swing: '$5-15',
    timing: '15-45 minut.',
  },
  ecb: {
    brief: 'ECB — Lagarde',
    full: 'Evropa Markazi Banki. Lagarde nutqi yoki stavka qarori. EUR orqali DXY oʻzgarishi XAU ga katta taʼsir (DXY-ning ~58% EUR).',
    xauHigh: '<b>Hawkish → EUR↑ → DXY↓ → XAU↑.</b> DXY-da EURning ulkan vazni sababli taʼsir katta.',
    xauLow: '<b>Dovish → EUR↓ → DXY↑ → XAU↓.</b>',
    xauInline: 'Aralash signal boʻlsa reaktsiya sekin.',
    swing: '$5-15',
    timing: '15-60 minut.',
  },
  rbnz: {
    brief: 'RBNZ — Yangi Zelandia',
    full: 'Yangi Zelandia stavkasi. NZD oʻzgaradi, XAU ga kam taʼsir.',
    xauHigh: 'Reaktsiya kuchsiz.',
    xauLow: 'Reaktsiya kuchsiz.',
    xauInline: 'XAU uchun muhim emas.',
    swing: '$2-5',
    timing: '10-20 minut.',
  },
  cadEmployment: {
    brief: 'Kanada ish oʻrinlari',
    full: 'Kanada ish oʻrinlari oʻzgarishi. NFP bilan birga chiqadi, CAD korrelyatsiya orqali XAU ga taʼsir.',
    xauHigh: '<b>Strong → CAD↑ → USD/CAD↓ → DXY↓ → XAU↑.</b>',
    xauLow: '<b>Weak → CAD↓ → USD/CAD↑ → DXY↑ → XAU↓.</b>',
    xauInline: 'NFP reaktsiyasi bilan kechadi.',
    swing: '$3-8',
    timing: 'NFP bilan birga.',
  },
  durable: {
    brief: 'Uzoq muddat tovarlar',
    full: 'Durable Goods Orders — uzoq muddat foydalaniladigan tovarlar buyurtmalari. Biznes investitsiya koʻrsatkichi.',
    xauHigh: '<b>XAU tushadi.</b> Strong business investment → strong economy.',
    xauLow: '<b>XAU koʻtariladi.</b> Weak investment → recession fears.',
    xauInline: 'Volatil koʻrsatkich, reaktsiya kam.',
    swing: '$5-12',
    timing: '10-30 minut.',
  },
  consumerConf: {
    brief: 'Isteʼmolchi ishonchi',
    full: 'Conference Board Consumer Confidence — UoMdan farqli manba. Bozor ikkalasini solishtiradi.',
    xauHigh: '<b>Yuqori → XAU tushadi.</b>',
    xauLow: '<b>Past → XAU koʻtariladi.</b>',
    xauInline: 'Kuchsiz reaktsiya.',
    swing: '$3-8',
    timing: '5-15 minut.',
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
    const trend = delta > 0 ? 'oldingidan oʻsish kutilmoqda' : delta < 0 ? 'oldingidan tushish kutilmoqda' : 'oʻzgarmaslik';
    momentumHtml = `<div class="nd-section">
      <div class="nd-h">📊 TENDENTSIYA</div>
      <div class="nd-trend ${trendCls}"><b>${dir} ${ev.forecast}</b> vs <b>${ev.previous}</b> · ${trend} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})</div>
    </div>`;
  }
  if (!info) {
    return `<div class="news-detail">
      <div class="nd-section">
        <div class="nd-h">📊 IVENT HAQIDA</div>
        <div class="nd-p">Bu ivent uchun chuqur tahlil tayyorlanmagan. Quyidagi maʼlumotlardan foydalaning:</div>
      </div>
      <div class="nd-section">
        <div class="nd-h">📈 QIYMATLAR</div>
        <div class="nd-grid">
          <div><span class="nd-l">Impakt:</span> <b>${ev.impact.toUpperCase()}</b></div>
          <div><span class="nd-l">Valyuta:</span> <b>${ev.currency}</b></div>
          <div><span class="nd-l">Prognoz:</span> <b>${ev.forecast || '—'}</b></div>
          <div><span class="nd-l">Oldingi:</span> <b>${ev.previous || '—'}</b></div>
        </div>
      </div>
      ${momentumHtml}
      <div class="nd-section">
        <div class="nd-h">🔮 UMUMIY QOIDA</div>
        <div class="nd-scen flat">${ev.impact === 'high' ? 'Yuqori impakt ivent. Kutilmadan farqlash katta reaktsiya keltirishi mumkin ($10-25 swing).' : ev.impact === 'med' ? 'Oʻrta impakt. Reaktsiya kuchsiz ($3-10 swing).' : 'Past impakt. Reaktsiya deyarli yoʻq.'}</div>
      </div>
    </div>`;
  }
  return `<div class="news-detail">
    <div class="nd-section">
      <div class="nd-h">📊 NIMA YOZILADI</div>
      <div class="nd-p">${info.full}</div>
    </div>
    <div class="nd-section">
      <div class="nd-h">📈 QIYMATLAR</div>
      <div class="nd-grid">
        <div><span class="nd-l">Prognoz:</span> <b>${ev.forecast || '—'}</b></div>
        <div><span class="nd-l">Oldingi:</span> <b>${ev.previous || '—'}</b></div>
      </div>
    </div>
    ${momentumHtml}
    <div class="nd-section">
      <div class="nd-h">🔮 XAUUSD UCHUN SENARIYLAR</div>
      <div class="nd-scen up">↑ <b>Natija &gt; Prognoz:</b> ${info.xauHigh}</div>
      <div class="nd-scen flat">═ <b>Natija = Prognoz:</b> ${info.xauInline}</div>
      <div class="nd-scen dn">↓ <b>Natija &lt; Prognoz:</b> ${info.xauLow}</div>
    </div>
    <div class="nd-section">
      <div class="nd-h">⏱ ODATDAGI HARAKAT</div>
      <div class="nd-stats">📏 Sving: <b>${info.swing}</b><br>⏰ ${info.timing}</div>
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
      if (!xml || xml.length < 500) { lastError = `${via}:boʻsh`; continue; }
      if (!xml.includes('<event>')) { lastError = `${via}:notoʻgʻri XML`; continue; }
      const events = parseFFXml(xml);
      if (events.length > 0) {
        log('INFO', `✅ ${events.length} ivent yuklandi (${via})`);
        return events;
      }
      lastError = `${via}:ivent yoʻq`;
    } catch(e) {
      lastError = `${via}:${e.name === 'AbortError' ? 'timeout' : (e.message||'').slice(0,30)}`;
    }
  }
  log('WARN', `Yangiliklar yuklanmadi — oxirgi xato: ${lastError}`);
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
      const actual = get('actual');  // ← ForexFactory relizdan keyin to'ldiradi
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
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'Average Hourly Earnings m/m', impact:'high', currency:'USD', auto:true, desc:'Ish haqi oʻsishi. Yuqori → inflyatsiya → Fed hawkish', forecast:'', previous:''});
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'Unemployment Rate', impact:'high', currency:'USD', auto:true, desc:EVENT_INFO['Unemployment'].desc, forecast:'', previous:''});
      events.push({date:new Date(Date.UTC(yr,mo,dom,12,30)), name:'CAD Employment Change', impact:'high', currency:'CAD', auto:true, desc:'Kanada ish oʻrinlari — NFP bilan birga chiqadi', forecast:'', previous:''});
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
    log('INFO', '📅 ForexFactory ulab boʻlmadi — pattern rejim');
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
      log('INFO', `📊 Ivent yozildi: ${ev.name}`, `swing $${totalSwing.toFixed(2)} ${direction.toUpperCase()}`);
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
  } catch(e) { log('ERR', 'Ivent saqlanmadi', e.message); }
}

export { CAL, EVENT_INFO, getDeepEventInfo, getEventInfo, buildAnalysisHtml, isUSDST, fetchRealCalendar, parseFFXml, buildFallbackCalendar, buildCalendar, trackPastImpacts, addCustomEvent };
