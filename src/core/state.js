// ═══════════════════════════════════════════════════════════════════
// QUMASH v7 REVERSAL HUNTER — Konfiguratsiya va holat
// Globals: SYMBOLS, CFG, ST, FILTERS
// Bitta optimal rejim: small SL + wide TP + reversal triggers
// ═══════════════════════════════════════════════════════════════════

const SYMBOLS = {
  primary: 'frxXAUUSD',
  htf: 'frxXAUUSD',
  feeds: {
    EURUSD:'frxEURUSD', USDJPY:'frxUSDJPY', GBPUSD:'frxGBPUSD',
    USDCAD:'frxUSDCAD', USDCHF:'frxUSDCHF', AUDUSD:'frxAUDUSD',
    AUDJPY:'frxAUDJPY', EURJPY:'frxEURJPY',
  }
};

// ═══════════════════════════════════════════════════════════════════
// QUMASH v7 — REVERSAL HUNTER (bitta rejim, mukammal tuning)
// ═══════════════════════════════════════════════════════════════════
// Falsafa: kichik SL (FVG/OB edge'da) + keng TP (ATR×8 gacha) + razvorot
// triggerlar majburiy (Sweep / CHoCH / FVG'dan kamida bittasi). Trend
// davomidagi setup'lar faqat T1 darajasida qabul qilinadi.
// ═══════════════════════════════════════════════════════════════════
const CFG = {
  granularity: 900, htfMult: 4, count: 5000, countCorr: 1000,
  direction: 'BOTH',
  basisType: 'EMA', basisLen: 2,
  almaSigma: 5, almaOffset: 0.85,
  stPeriods: 14, stMult: 1.6, stSens: 2.3,
  atrLen: 14, rsiLen: 14, ema200Len: 200,

  // ── REVERSAL TP/SL ──────────────────────────────────────────────
  // SL = ATR×1.0 fallback (fallback only); Smart SL — FVG/OB edge → ~ATR×0.3-0.6
  // TP — keng: TP1=2R, TP2=4R, TP3=8R (oʻrtacha R:R = 1:5+)
  slATR: 1.0, tp1ATR: 2.0, tp2ATR: 4.0, tp3ATR: 8.0,
  qtyTP1: 40, qtyTP2: 30, qtyTP3: 30,
  beAfter: 'TP1', beBuffer: 0.03,            // TP1'da tezroq BE
  trailAfter: 'TP2', trailATR: 1.5,          // kengroq trail — katta harakatni ushlash
  blockReversal: true, cooldownBars: 2, minHoldBars: 2,
  swingLen: 7, equalLevelTolATR: 0.25, sweepCloseBackTolATR: 0.3,
  premiumDiscountFib: 0.5, swingLookback: 60, hurstWindow: 50,
  obDisplacementATR: 1.2, obLookback: 30,
  oteLow: 0.62, oteHigh: 0.79,

  // ── YAGONA TIER SISTEMASI (soft/medium/hard YOʻQ) ─────────────────
  // Reversal trigger majburiy — score chegaralar shuni hisobga olib tuning qilindi
  tier1: 50, tier1Risk: 1.5,    // 60 → 50 — eng kuchli setup
  tier2: 35, tier2Risk: 1.0,    // 45 → 35 — qabul qilish minimumi (yumshatilgan)
  // T3 va T4 OLIB TASHLANDI — past balli setup'lar umuman ochilmaydi
  // ─── BACKTEST/SIGNAL THRESHOLDS — yumshatilgan (v12.2) ───────────
  minRR: 1.5,                    // 3.0 → 1.5 (TP1=2R, 1.5R minimum)
  // NOTE: `minScoreDiff` was declared twice in the original config; JS keeps the
  // last value (3, see below). The earlier `minScoreDiff: 0` was a dead override
  // and has been removed — effective runtime value is unchanged.
  // Reversal Hunter mode (meros — mavjudligini belgilash)
  reversalMode: true,

  // ── FILTER WEIGHTS (max 100 score) ──────────────────────────────
  // Reversal'ning yadrosi: Sweep + FVG + MSS + Pattern oʻrni
  wRegime: 14, wSweep: 16, wDXY: 12, wPremium: 12,
  wSession: 6, wLiquidity: 8, wAlmaSt: 10, wMomentum: 5,
  wMSS: 16, wOB: 12, wOTE: 10,
  wCandlestick: 14,
  wFVG: 16,
  wHtfEng: 8,

  // FVG settings
  fvgLookback: 100, fvgMaxAge: 50,
  fvgMinSizeATR: 0.15, fvgMaxSizeATR: 3.0,

  // Smart SL — MAJBURIY (faqat fallback ATR×1.0 sifatida xizmat qiladi)
  smartSLenabled: true, smartSLbuffer: 0.20, smartSLminATR: 0.4,

  // ── NEWS MODE ───────────────────────────────────────────────────
  // 'auto' = hamma muhim yangilikda avtomatik: 10 min oldin blok,
  // eʼlondan 3 min keyin ochiladi va news+tech sinergiyasiga oʻtadi
  newsMode: 'auto',
  newsActiveMinAgoMin: 3,         // eʼlondan 3 min keyin ochiladi (tez)
  newsActiveMaxAgoMin: 45,        // 45 min gacha news kontekst aktiv
  newsConfidenceMin: 25,          // news score min (past esa tech hal qiladi)
  newsBlockBefore: 10,            // eʼlondan 10 min oldin blok
  newsBlockAfter: 3,              // eʼlondan 3 min ichida (initial spike) blok
  newsSplitNews: 0.5, newsSplitTech: 0.5,  // 50/50 — tech setup news bilan mos
  newsAlignmentRequired: true,    // tech yo'nalishi news yo'nalishi bilan mos kelishi kerak
  newsForecastDays: 7,

  // Adaptive
  adaptiveEnabled: true, adaptMinSamples: 10, adaptMaxFactor: 1.6, adaptMinFactor: 0.3,

  // Score-diff (long vs short)
  minScoreDiff: 3,

  // Volatility — real XAU M15 diapazon hisobga olindi
  atrPctMin: 0.02,   // 0.04 → 0.02 (mualbore tinch vaqtlarni ham passuv)
  atrPctMax: 1.20,   // 0.85 → 1.20 (katta news vaqtini ham tatbiq kuchaytiradi)

  // ═══════ v8 — PDF'lardan yangi modullar ══════════════════════════
  // TTrades Model (CISD, candle 2/3 swing)
  ttradesEnabled: true,
  wTTrades: 12,                         // CISD swing'ning max contribution score
  // Daily Profile (London/NY Reversal)
  dailyProfileEnabled: true,
  wDailyProfile: 6,                     // confluence bonus
  // Monday rule (TTrades qoidasi)
  mondayBlock: false,                   // true: Monday'da T2 signal'lar blok (T1 qoladi)
  // Compression (Hanzo Shadow Codes)
  compressionEnabled: true,
  wCompression: 6,
  // HLQ confluence
  hlqEnabled: true,
  wHLQ: 8,
  // QMR pattern
  qmrEnabled: true,
  wQMR: 8,
  // Macro context (risk regime)
  macroContextEnabled: true,
  wMacro: 4,
  // Trail SL TTrades style (to opposing candle's swing)
  ttradesTrailEnabled: false,           // experimental — opposing candle trail

  // ═══════ v9 — Yangi PDF modullar (ICT Bible, Divergence, MMXM, etc.) ═══
  // Divergence Engine (RSI/MACD T1/T2 + Stinger)
  divergenceEnabled: true,
  wDivergence: 12,                      // Stinger eng kuchli (+10), T1·RSI (+6)
  // ICT Key Levels (PDH/PDL/PWH/PWL/PMH/PML + Midnight Open + Judas)
  keyLevelsEnabled: true,
  wKeyLevels: 14,                       // toplam: HTF level (+5), MO bias (+2), Judas (+10)
  wJudas: 10,                           // Judas swing — alohida vazn (reversal trigger ham)
  // SMT Divergence + AMD Power of 3
  smtEnabled: true,
  amdEnabled: true,
  wSMTandAMD: 10,                       // SMT (+4-7) + AMD (+3-5)
  // ICT Blocks (Breaker + Rejection)
  ictBlocksEnabled: true,
  wICTBlocks: 8,                        // Breaker (+6) + Rejection (+4)
  // Psychology / Discipline
  psychEnabled: true,
  psychBlock: false,                    // true: drawdown'da entry'ni blok
  psychBlockStrict: false,              // true: REVENGE'da ham blok

  // ═══════ v10 — Yangi PDF modullar (Chart Patterns, Fibonacci, Inducement) ═══
  // Classical chart patterns (Double Top/Bot, H&S, Wedge, Triangle, Flag, Rectangle)
  chartPatternsEnabled: true,
  wChartPatterns: 10,                   // H&S confirmed (+8), Double Top (+6), etc.
  // Full Fibonacci system (retracement + extension)
  fibonacciEnabled: true,
  wFibonacci: 10,                       // golden zone (50-78.6%) = +8
  // Inducement + Algo Candle
  inducementEnabled: true,
  wInducement: 8,                       // algo (+5) + liq grab (+2) + IDM (+4)

  // ═══════ v11 — News-Driven Signal Engine ═══
  // Post-news (T+5..T+45 min) reaction reading + Fibonacci retracement entry
  // Triggers on 🔴 High impact USD news (NFP, CPI, FOMC, GDP, Powell, etc.)
  newsDrivenEnabled: true,
  wNewsDriven: 20,                      // STRONG reaction +20, MILD +12 (highest single bonus)
  newsDrivenWindowMin: 5,               // T+5 min — when to read reaction
  newsDrivenExpireMin: 45,              // T+45 min — setup expires
  newsDrivenStrongAtrMult: 2.0,         // reaction >= 2×ATR = STRONG
  newsDrivenMildAtrMult: 1.0,           // reaction >= 1×ATR = MILD
  newsDrivenFibLow: 0.5,                // retracement entry zone start
  newsDrivenFibHigh: 0.618,             // retracement entry zone end

  // ═══════ v12 — M5 Intraday + Override Hierarchy ═══
  // M5 timeframe parallel evaluation (kichik intraday reversal'lar)
  m5Enabled: true,
  m5MinScore: 55,                       // M5 signal threshold (sig'ar pastroq M15 dan)
  m5RiskMult: 0.6,                      // M5 signal risk multiplier (1.5% × 0.6 = 0.9%)
  // Override Hierarchy — strong model triggers can pass weak filter conflicts
  overrideEnabled: true,
  overrideShowLevel: true,              // Telegram'da override level ko'rsatish

  // Mode flags
  strict: false, newsBlock: true, sessionFilter: true,
  // Sessiya — faqat sifatlilari (London/NY/Overlap)
  allowedSessions: {LONDON:true, NY:true, OVERLAP:true, NY_AFTER:true, ASIA:true, LUNCH:true, FRI_LATE:false, LATE:false, OTHER:true},
  // Revers ovchi — CHOP rejimida ham ishlaydi (razvorot'lar nay ko'p CHOP'da!)
  allowedRegimes: {TREND_UP:true, TREND_DN:true, RANGE:true, CHOP:true},
  // TG
  tgEnabled: false, tgToken: '', tgChat: '',
};

const ST = {
  ws: null, reqId: 1, _reqType: {},
  pendingHistory: new Set(), subIds: {}, feedSubs: {},
  candles: [], candlesHTF: [], feeds: {},
  lastPrice: null, prevClose: null,
  connected: false, warmedUp: false,
  // Signal state
  condition: 0, prevCondition: 0,
  barsSinceEntry: 9999, barsSinceSL: 9999, tradeReachedTP1: false,
  snap: null, slLine: 0,
  // Adaptive scoring — tracks each filter's contribution + outcome
  // Each entry: {filter:'regime', dir:'L'/'S', value:+1/-1/0, won:true/false, r:number, ts:Date}
  adaptHistory: [],
  adaptWeights: {}, // filter → multiplier
  // Stats
  total: 0, tpWins: 0, beHits: 0, slLosses: 0,
  rSum: 0, rWinSum: 0, rLossSum: 0, rWinCount: 0, rLossCount: 0,
  todayR: 0, lastDay: -1, maxR: 0, minR: 0,
  // History
  history: [],
  // Logs
  logs: [],
};

const LOG_MAX = 500;
const HIST_MAX = 50;
const FILTERS = ['regime','sweep','dxy','premium','session','liquidity','almast','momentum','mss','ob','ote','candlestick','fvg','htf_eng'];
const REGIMES = ['TREND_UP','TREND_DN','RANGE','CHOP'];
// Initialize per-regime adapt weights: ST.adaptWeights[regime][filter] = 1.0
REGIMES.forEach(r => {
  ST.adaptWeights[r] = {};
  FILTERS.forEach(f => ST.adaptWeights[r][f] = 1.0);
});

export { SYMBOLS, CFG, ST, LOG_MAX, HIST_MAX, FILTERS, REGIMES };
