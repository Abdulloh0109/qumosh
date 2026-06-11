// Settings model — the React-controlled equivalent of the original
// loadCfgFromUI() / loadCfgFromStorage() in js/11-boot.js. The persisted
// localStorage shape ('qumash_v5_cfg') is kept identical so snapshot
// export/import stays compatible across the migration.
import { cfg } from '../store/engine';

export const SESSION_KEYS = [
  'LONDON',
  'OVERLAP',
  'NY',
  'NY_AFTER',
  'ASIA',
  'LUNCH',
  'FRI_LATE',
  'LATE',
] as const;
export const REGIME_KEYS = ['TREND_UP', 'TREND_DN', 'RANGE', 'CHOP'] as const;

export type SessionKey = (typeof SESSION_KEYS)[number];
export type RegimeKey = (typeof REGIME_KEYS)[number];
export type Direction = 'BOTH' | 'LONG' | 'SHORT';

export interface Settings {
  tf: number;
  htf: number;
  dir: Direction;
  tgEnabled: boolean;
  tgToken: string;
  tgChat: string;
  newsBlock: boolean;
  sessionFilter: boolean;
  adaptive: boolean;
  regimes: Record<RegimeKey, boolean>;
  sessions: Record<SessionKey, boolean>;
  // v8
  ttrades: boolean;
  dailyProfile: boolean;
  mondayBlock: boolean;
  compression: boolean;
  hlq: boolean;
  qmr: boolean;
  macro: boolean;
  // v9
  divergence: boolean;
  keyLevels: boolean;
  smt: boolean;
  amd: boolean;
  ictBlocks: boolean;
  psychBlock: boolean;
  // v10
  chartPatterns: boolean;
  fibonacci: boolean;
  inducement: boolean;
  // v11 / v12
  newsDriven: boolean;
  m5: boolean;
  override: boolean;
}

/** Defaults mirror the `checked`/`selected` attributes in the original index.html. */
export const DEFAULT_SETTINGS: Settings = {
  tf: 900,
  htf: 4,
  dir: 'BOTH',
  tgEnabled: false,
  tgToken: '',
  tgChat: '',
  newsBlock: true,
  sessionFilter: false,
  adaptive: true,
  regimes: { TREND_UP: true, TREND_DN: true, RANGE: true, CHOP: true },
  sessions: {
    LONDON: true,
    OVERLAP: true,
    NY: true,
    NY_AFTER: false,
    ASIA: false,
    LUNCH: false,
    FRI_LATE: false,
    LATE: false,
  },
  ttrades: true,
  dailyProfile: true,
  mondayBlock: false,
  compression: true,
  hlq: true,
  qmr: true,
  macro: true,
  divergence: true,
  keyLevels: true,
  smt: true,
  amd: true,
  ictBlocks: true,
  psychBlock: false,
  chartPatterns: true,
  fibonacci: true,
  inducement: true,
  newsDriven: true,
  m5: true,
  override: true,
};

const STORAGE_KEY = 'qumash_v5_cfg';

/** Load persisted settings (merged over defaults). Mirrors loadCfgFromStorage(). */
export function loadSettings(): Settings {
  const s = structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return s;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.tf) s.tf = Number(o.tf);
    if (o.htf) s.htf = Number(o.htf);
    if (o.dir) s.dir = o.dir as Direction;
    s.tgEnabled = !!o.tg;
    s.tgToken = (o.token as string) || '';
    s.tgChat = (o.chat as string) || '';
    s.newsBlock = o.news !== false;
    s.sessionFilter = !!o.session;
    s.adaptive = o.adaptive !== false;
    if (o.sessions && typeof o.sessions === 'object') {
      Object.assign(s.sessions, o.sessions);
    }
    if (o.regimes && typeof o.regimes === 'object') {
      Object.assign(s.regimes, o.regimes);
    }
    const flag = (key: string, cur: boolean): boolean => (o[key] !== undefined ? !!o[key] : cur);
    s.ttrades = flag('ttrades', s.ttrades);
    s.dailyProfile = flag('dailyProfile', s.dailyProfile);
    s.mondayBlock = flag('mondayBlock', s.mondayBlock);
    s.compression = flag('compression', s.compression);
    s.hlq = flag('hlq', s.hlq);
    s.qmr = flag('qmr', s.qmr);
    s.macro = flag('macro', s.macro);
    s.divergence = flag('divergence', s.divergence);
    s.keyLevels = flag('keyLevels', s.keyLevels);
    s.smt = flag('smt', s.smt);
    s.amd = flag('amd', s.amd);
    s.ictBlocks = flag('ictBlocks', s.ictBlocks);
    s.psychBlock = flag('psychBlock', s.psychBlock);
    s.chartPatterns = flag('chartPatterns', s.chartPatterns);
    s.fibonacci = flag('fibonacci', s.fibonacci);
    s.inducement = flag('inducement', s.inducement);
    s.newsDriven = flag('newsDriven', s.newsDriven);
    s.m5 = flag('m5', s.m5);
    s.override = flag('override', s.override);
  } catch {
    /* fall back to defaults */
  }
  return s;
}

/** Apply settings to CFG and persist. Mirrors loadCfgFromUI(). */
export function applySettings(s: Settings): void {
  cfg.granularity = s.tf;
  cfg.htfMult = s.htf;
  cfg.direction = s.dir;
  cfg.tgEnabled = s.tgEnabled;
  cfg.tgToken = s.tgToken.trim();
  cfg.tgChat = s.tgChat.trim();
  cfg.newsBlock = s.newsBlock;
  cfg.sessionFilter = s.sessionFilter;
  cfg.adaptiveEnabled = s.adaptive;
  cfg.ttradesEnabled = s.ttrades;
  cfg.dailyProfileEnabled = s.dailyProfile;
  cfg.mondayBlock = s.mondayBlock;
  cfg.compressionEnabled = s.compression;
  cfg.hlqEnabled = s.hlq;
  cfg.qmrEnabled = s.qmr;
  cfg.macroContextEnabled = s.macro;
  cfg.divergenceEnabled = s.divergence;
  cfg.keyLevelsEnabled = s.keyLevels;
  cfg.smtEnabled = s.smt;
  cfg.amdEnabled = s.amd;
  cfg.ictBlocksEnabled = s.ictBlocks;
  cfg.psychBlock = s.psychBlock;
  cfg.chartPatternsEnabled = s.chartPatterns;
  cfg.fibonacciEnabled = s.fibonacci;
  cfg.inducementEnabled = s.inducement;
  cfg.newsDrivenEnabled = s.newsDriven;
  cfg.m5Enabled = s.m5;
  cfg.overrideEnabled = s.override;
  cfg.allowedSessions = { ...cfg.allowedSessions, ...s.sessions };
  cfg.allowedRegimes = { ...cfg.allowedRegimes, ...s.regimes };

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tf: cfg.granularity,
        htf: cfg.htfMult,
        dir: cfg.direction,
        tg: cfg.tgEnabled,
        token: cfg.tgToken,
        chat: cfg.tgChat,
        news: cfg.newsBlock,
        session: cfg.sessionFilter,
        adaptive: cfg.adaptiveEnabled,
        sessions: cfg.allowedSessions,
        regimes: cfg.allowedRegimes,
        ttrades: cfg.ttradesEnabled,
        dailyProfile: cfg.dailyProfileEnabled,
        mondayBlock: cfg.mondayBlock,
        compression: cfg.compressionEnabled,
        hlq: cfg.hlqEnabled,
        qmr: cfg.qmrEnabled,
        macro: cfg.macroContextEnabled,
        divergence: cfg.divergenceEnabled,
        keyLevels: cfg.keyLevelsEnabled,
        smt: cfg.smtEnabled,
        amd: cfg.amdEnabled,
        ictBlocks: cfg.ictBlocksEnabled,
        psychBlock: cfg.psychBlock,
        chartPatterns: cfg.chartPatternsEnabled,
        fibonacci: cfg.fibonacciEnabled,
        inducement: cfg.inducementEnabled,
        trendline: undefined,
        volume: undefined,
        gap: undefined,
        mtv: undefined,
        newsDriven: cfg.newsDrivenEnabled,
        m5: cfg.m5Enabled,
        override: cfg.overrideEnabled,
      }),
    );
  } catch {
    /* ignore quota errors */
  }
}
