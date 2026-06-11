import { useEffect, useRef, useState } from 'react';
import { SelectField, SessChk, TextField, Toggle } from './common/inputs';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type RegimeKey,
  type Settings,
  type SessionKey,
} from '../app/settings';
import { connect, shouldAutoReconnect } from '../app/controls';
import { cx } from '../app/cx';
import gbFlag from 'flag-icons/flags/4x3/gb.svg';
import usFlag from 'flag-icons/flags/4x3/us.svg';
import jpFlag from 'flag-icons/flags/4x3/jp.svg';

/** Only the flags we actually use — bundling the full flag-icons CSS would pull in ~260 SVGs. */
const FLAG_SRC: Record<string, string> = { gb: gbFlag, us: usFlag, jp: jpFlag };

const SECTION_H =
  "mt-5 mb-[11px] flex items-center gap-2 border-b border-white/[0.05] pb-1.5 text-[16px] font-semibold uppercase tracking-[1px] text-dim before:h-[11px] before:w-[3px] before:rounded-[2px] before:bg-cyan before:content-['']";

const TF_OPTIONS = [
  { value: 60, label: 'M1 (skalp)' },
  { value: 300, label: 'M5 (skalp)' },
  { value: 900, label: 'M15 (tavsiya)' },
  { value: 1800, label: 'M30' },
  { value: 3600, label: 'H1' },
  { value: 14400, label: 'H4 (sving)' },
  { value: 86400, label: 'D1 (kontekst)' },
];
const HTF_OPTIONS = [
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x (M15→H1)' },
  { value: 6, label: '6x' },
];
const DIR_OPTIONS = [
  { value: 'BOTH', label: 'BOTH' },
  { value: 'LONG', label: 'FAQAT LONG' },
  { value: 'SHORT', label: 'FAQAT SHORT' },
];

interface RegimeMeta {
  key: RegimeKey;
  icon: string;
  name: string;
  hint: string;
}
const REGIMES: RegimeMeta[] = [
  { key: 'TREND_UP', icon: '📈', name: 'TREND UP', hint: '(yuqori)' },
  { key: 'TREND_DN', icon: '📉', name: 'TREND DN', hint: '(pastga)' },
  { key: 'RANGE', icon: '═', name: 'RANGE', hint: '(chegarada)' },
  { key: 'CHOP', icon: '⊿', name: 'CHOP', hint: '(chalkash)' },
];

type SessionQuality = 'best' | 'good' | 'neutral' | 'warn';
interface SessionMeta {
  key: SessionKey;
  /** ISO 3166-1 alpha-2 codes → flag-icons SVG (real flags; emoji flags don't render on Windows). */
  cc?: string[];
  /** Fallback icon for non-country sessions (lunch / Friday / late). */
  emoji?: string;
  name: string;
  time?: string;
  tz?: string;
  quality: SessionQuality;
  note?: string;
}
const SESSIONS: SessionMeta[] = [
  { key: 'LONDON', cc: ['gb'], name: 'London', time: '12:00–15:00', tz: 'UZT', quality: 'good' },
  {
    key: 'OVERLAP',
    cc: ['gb', 'us'],
    name: 'London+Nyu-York',
    time: '17:30–20:30',
    tz: 'UZT',
    quality: 'best',
  },
  { key: 'NY', cc: ['us'], name: 'Nyu-York', time: '20:30–22:00', tz: 'UZT', quality: 'good' },
  {
    key: 'NY_AFTER',
    cc: ['us'],
    name: 'Nyu-York keyin',
    time: '22:00+',
    tz: 'UZT',
    quality: 'warn',
    note: '-7R',
  },
  { key: 'ASIA', cc: ['jp'], name: 'Osiyo', time: '05:00–12:00', tz: 'UZT', quality: 'neutral' },
  {
    key: 'LUNCH',
    emoji: '🍽',
    name: 'Tush',
    time: '15:00–17:30',
    tz: 'UZT',
    quality: 'warn',
    note: '-4R',
  },
  { key: 'FRI_LATE', emoji: '📅', name: 'Juma oxiri', quality: 'warn', note: 'risk' },
  { key: 'LATE', emoji: '🌙', name: 'Kech', time: '22:00–05:00', tz: 'UZT', quality: 'neutral' },
];

/** Quality → visual accent (Binance-yellow theme: best=gold⭐, good=green✓, warn=red⚠). */
const SESS_Q: Record<
  SessionQuality,
  { bar: string; badge: string; badgeCls: string; active: string; box: string }
> = {
  best: {
    bar: 'bg-gold',
    badge: '⭐',
    badgeCls: 'bg-gold/20 text-gold',
    active: 'border-gold/55 bg-gold/[0.08] shadow-[0_0_18px_-8px_var(--color-gold)]',
    box: 'border-gold bg-gold',
  },
  good: {
    bar: 'bg-green',
    badge: '✓',
    badgeCls: 'bg-green/[0.18] text-green',
    active: 'border-green/50 bg-green/[0.07]',
    box: 'border-green bg-green',
  },
  neutral: {
    bar: 'bg-mute',
    badge: '',
    badgeCls: '',
    active: 'border-cyan/50 bg-cyan/[0.07]',
    box: 'border-cyan bg-cyan',
  },
  warn: {
    bar: 'bg-red',
    badge: '⚠',
    badgeCls: 'bg-red/[0.18] text-red',
    active: 'border-red/45 bg-red/[0.06]',
    box: 'border-red bg-red',
  },
};

/** Rich, colour-coded trading-session toggle: flag + name + quality badge on
    top, clock + time + timezone (and any risk note) below. State-driven by `checked`. */
function SessionCard({
  ss,
  checked,
  onChange,
}: {
  ss: SessionMeta;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const q = SESS_Q[ss.quality];
  return (
    <label
      className={cx(
        'group relative flex cursor-pointer flex-col gap-1.5 overflow-hidden rounded-md border py-2.5 pr-2.5 pl-3.5 transition',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan/40',
        checked ? q.active : 'border-[#2b3139] bg-bg3/40 hover:border-[#383f49] hover:bg-bg3/70',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {/* quality accent bar */}
      <span
        className={cx(
          'absolute top-0 left-0 h-full w-[3px] transition-opacity',
          q.bar,
          checked ? 'opacity-100' : 'opacity-40',
        )}
      />
      {/* row 1: checkbox · flag · name · quality badge */}
      <div className="flex items-center gap-2">
        <span
          className={cx(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border text-[12px] font-black transition',
            checked ? cx(q.box, 'text-bg1') : 'border-[#383f49] bg-white/[0.03] text-transparent',
          )}
        >
          ✓
        </span>
        <span
          className={cx(
            'flex shrink-0 items-center gap-0.5 transition',
            checked ? 'opacity-100 grayscale-0' : 'opacity-70 grayscale-[0.55]',
          )}
        >
          {ss.cc ? (
            ss.cc.map((c) => (
              <img
                key={c}
                src={FLAG_SRC[c]}
                alt={c.toUpperCase()}
                className="h-[15px] w-[20px] rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              />
            ))
          ) : (
            <span className="text-[17px] leading-none">{ss.emoji}</span>
          )}
        </span>
        <span
          className={cx(
            'text-[15px] font-semibold transition',
            checked ? 'text-text' : 'text-text2',
          )}
        >
          {ss.name}
        </span>
        {q.badge && (
          <span
            className={cx(
              'ml-auto rounded px-1.5 py-[2px] text-[12px] leading-none font-bold',
              q.badgeCls,
            )}
          >
            {q.badge}
          </span>
        )}
      </div>
      {/* row 2: clock · time · timezone · risk note */}
      <div className="flex items-center gap-1.5 pl-[26px] font-mono text-[12.5px] leading-none">
        {ss.time ? (
          <>
            <span className="text-[12px] opacity-60">🕐</span>
            <span className={checked ? 'text-text2' : 'text-dim'}>{ss.time}</span>
            {ss.tz && <span className="text-[11px] text-mute">{ss.tz}</span>}
          </>
        ) : (
          <span className="text-[12px] text-mute">hafta yakuni</span>
        )}
        {ss.note && (
          <span className="ml-auto rounded bg-red/10 px-1.5 py-[2px] text-[11.5px] font-bold text-red">
            {ss.note}
          </span>
        )}
      </div>
    </label>
  );
}

export function SettingsPanel() {
  const [s, setS] = useState<Settings>(loadSettings);
  const autoTried = useRef(false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));
  const setRegime = (key: RegimeKey, value: boolean) =>
    setS((prev) => ({ ...prev, regimes: { ...prev.regimes, [key]: value } }));
  const setSession = (key: SessionKey, value: boolean) =>
    setS((prev) => ({ ...prev, sessions: { ...prev.sessions, [key]: value } }));

  // Auto-reconnect on load if the user was connected previously (ported from boot.js).
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    if (shouldAutoReconnect()) {
      const t = setTimeout(() => connect(loadSettings()), 800);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div
      id="settingsPanel"
      className="mb-6 w-full rounded-lg border border-[#2b3139] bg-bg2 px-[34px] py-[30px] max-md:mx-auto max-md:my-3 max-md:px-4 max-md:py-[22px]"
    >
      <h1 className="mb-1.5 text-[30px] leading-[1.1] font-black tracking-[-0.7px]">
        <span className="text-cyan glow-cyan">QUMASH</span>{' '}
        <span className="text-gold glow-gold">REVERSAL HUNTER</span>{' '}
        <span className="ml-2 inline-block rounded bg-cyan px-2 py-[3px] align-middle text-[10px] font-extrabold tracking-[1.4px] text-bg1">
          v7
        </span>
      </h1>
      <div className="mt-[9px] mb-[22px] text-[16px] leading-[1.55] text-dim [&_b]:font-semibold [&_b]:text-cyan">
        <b>
          14 qatlamli filtr + Burilish triggerlari (Sweep / FVG / CHoCH / MSS) + Avto-yangilik
          rejimi
        </b>
        <br />
        Bitta mukammal sozlangan rejim. Smart SL — FVG/OB chetiga; min R:R 1:3. T1 (≥60), T2 (≥45 +
        burilish). Signallar muhim yangiliklarda ham avtomatik ishlaydi.
      </div>

      <div className={SECTION_H}>MAʼLUMOT MANBASI</div>
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
        <SelectField
          label="Taymfreym"
          value={s.tf}
          options={TF_OPTIONS}
          onChange={(v) => set('tf', +v)}
        />
        <SelectField
          label="HTF multiplikator"
          value={s.htf}
          options={HTF_OPTIONS}
          onChange={(v) => set('htf', +v)}
        />
        <SelectField
          label="Yoʻnalish"
          value={s.dir}
          options={DIR_OPTIONS}
          onChange={(v) => set('dir', v as Settings['dir'])}
        />
      </div>

      <div className={SECTION_H}>TELEGRAM</div>

      <div className="grid grid-cols-3 items-end gap-2.5 max-md:grid-cols-1">
        <div className="mb-[11px]">
          <Toggle
            id="setTgEnabled"
            label="Telegram alertlar"
            checked={s.tgEnabled}
            onChange={(v) => set('tgEnabled', v)}
          />
        </div>
        <TextField
          label="Bot Token"
          type="password"
          value={s.tgToken}
          placeholder="123456:ABC..."
          onChange={(v) => set('tgToken', v)}
        />
        <TextField
          label="Chat ID"
          value={s.tgChat}
          placeholder="-1001234567890"
          onChange={(v) => set('tgChat', v)}
        />
      </div>

      <div className={SECTION_H}>ISHLASH REJIMI</div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-2">
        <Toggle
          id="setNewsBlock"
          label="Yangilik bloki (yuqori taʼsirli voqealar)"
          checked={s.newsBlock}
          onChange={(v) => set('newsBlock', v)}
        />
        <Toggle
          id="setSessionFilter"
          label="Kam sifatli seansni bloklash"
          checked={s.sessionFilter}
          onChange={(v) => set('sessionFilter', v)}
        />
        <Toggle
          id="setAdaptive"
          label="Moslashuvchan baholash (oʻz-oʻzini rivojlantirish)"
          checked={s.adaptive}
          onChange={(v) => set('adaptive', v)}
        />
      </div>

      <div className={SECTION_H}>QAYSI REJIMDA SIGNAL QABUL QILISH</div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))] gap-1.5">
        {REGIMES.map((r) => (
          <SessChk key={r.key} checked={s.regimes[r.key]} onChange={(v) => setRegime(r.key, v)}>
            {r.icon} {r.name} <small className="text-[16px]">{r.hint}</small>
          </SessChk>
        ))}
      </div>
      <div className="py-[5px] text-[16px] leading-[1.5] text-dim">
        💡 XAU oʻsuvchi trendda — TREND_DN rejimdagi SHORT signallar koʻpincha yolgʻon. Backtest
        boʻyicha qarshi rejimni oʻchiring.
      </div>

      <div className={SECTION_H}>QAYSI SEANSDA SIGNAL QABUL QILISH</div>
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
        {SESSIONS.map((ss) => (
          <SessionCard
            key={ss.key}
            ss={ss}
            checked={s.sessions[ss.key]}
            onChange={(v) => setSession(ss.key, v)}
          />
        ))}
      </div>
      <div className="py-[5px] text-[16px] leading-[1.5] text-dim">
        💡 Toshkent vaqtida (UTC+5). Eng yaxshi: <b className="text-green">17:30-22:00</b>{' '}
        (London+Nyu-York kesishuvi + Nyu-York).
      </div>

      <div className={SECTION_H}>v8: PDF MODULLAR (TTrades, Hanzo, 5SOP, Kathy Lien)</div>
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
        <Toggle
          id="setTTrades"
          label="🎯 TTrades CISD (C2/C3 sving + proektsiyalar)"
          checked={s.ttrades}
          onChange={(v) => set('ttrades', v)}
        />
        <Toggle
          id="setDailyProfile"
          label="🇬🇧🇺🇸 Kunlik profil (London/New York burilishi)"
          checked={s.dailyProfile}
          onChange={(v) => set('dailyProfile', v)}
        />
        <Toggle
          id="setMondayBlock"
          label="🚫 Dushanba qoidasi (T2'ni dushanbada blok)"
          checked={s.mondayBlock}
          onChange={(v) => set('mondayBlock', v)}
        />
        <Toggle
          id="setCompression"
          label="🌀 Siqilish (Hanzo Shadow Codes)"
          checked={s.compression}
          onChange={(v) => set('compression', v)}
        />
        <Toggle
          id="setHLQ"
          label="🔥 HLQ uygʻunligi (OB+FVG+EQ)"
          checked={s.hlq}
          onChange={(v) => set('hlq', v)}
        />
        <Toggle
          id="setQMR"
          label="📐 QMR paterni (Quasimodo Reversal)"
          checked={s.qmr}
          onChange={(v) => set('qmr', v)}
        />
        <Toggle
          id="setMacro"
          label="🌍 Makro kontekst (Risk-Off/On rejimi)"
          checked={s.macro}
          onChange={(v) => set('macro', v)}
        />
      </div>

      <div className={SECTION_H}>v9: ICT BIBLE + DIVERGENTSIYA + MMXM + PSIXOLOGIYA</div>
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
        <Toggle
          id="setDivergence"
          label="🔥 Divergentsiya mexanizmi (RSI/MACD T1+T2+Stinger)"
          checked={s.divergence}
          onChange={(v) => set('divergence', v)}
        />
        <Toggle
          id="setKeyLevels"
          label="📍 ICT asosiy darajalar (PDH/PDL/PWH/PWL+Midnight Open)"
          checked={s.keyLevels}
          onChange={(v) => set('keyLevels', v)}
        />
        <Toggle
          id="setSMT"
          label="📊 SMT divergentsiyasi (XAU vs AUD/EUR)"
          checked={s.smt}
          onChange={(v) => set('smt', v)}
        />
        <Toggle
          id="setAMD"
          label="⚡ AMD Power of 3 (Osiyo/London/New York)"
          checked={s.amd}
          onChange={(v) => set('amd', v)}
        />
        <Toggle
          id="setICTBlocks"
          label="📦 ICT bloklari (Breaker + Rejection)"
          checked={s.ictBlocks}
          onChange={(v) => set('ictBlocks', v)}
        />
        <Toggle
          id="setPsychBlock"
          label="🧠 Psixologiya bloki (drawdown'da kirish oʻchiriladi)"
          checked={s.psychBlock}
          onChange={(v) => set('psychBlock', v)}
        />
      </div>

      <div className={SECTION_H}>v10: GRAFIK SHAKLLAR + FIBONACHCHI + INDUCEMENT</div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-2">
        <Toggle
          id="setChartPatterns"
          label="📐 Klassik grafik shakllar (H&S, Double Top/Bot, Wedge, Triangle, Flag)"
          checked={s.chartPatterns}
          onChange={(v) => set('chartPatterns', v)}
        />
        <Toggle
          id="setFibonacci"
          label="📏 Toʻliq Fibonachchi tizimi (retracement + extension)"
          checked={s.fibonacci}
          onChange={(v) => set('fibonacci', v)}
        />
        <Toggle
          id="setInducement"
          label="🎯 Inducement + Algo Candle (sifatli kirish filtri)"
          checked={s.inducement}
          onChange={(v) => set('inducement', v)}
        />
      </div>

      <div className={SECTION_H}>v11–v12: YANGILIK SAVDOSI + M5 KUN ICHI + USTUNLIK</div>
      <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
        <Toggle
          id="setNewsDriven"
          label="📰 Yangilik asosida savdo rejimi (5 min kutib yangilik+texnik tahlil)"
          checked={s.newsDriven}
          onChange={(v) => set('newsDriven', v)}
        />
        <Toggle
          id="setM5"
          label="⚡ M5 kun ichi burilishni aniqlash (mikro-CHoCH/sweep/FVG)"
          checked={s.m5}
          onChange={(v) => set('m5', v)}
        />
        <Toggle
          id="setOverride"
          label="🟢 Ustunlik ierarxiyasi (kuchli model triggeri zaif filtrni bosib oʻtadi)"
          checked={s.override}
          onChange={(v) => set('override', v)}
        />
      </div>

      <button
        className="mt-3.5 w-full cursor-pointer rounded-lg bg-cyan p-3.5 font-sans text-[15px] font-extrabold tracking-[1.2px] text-bg1 transition duration-200 hover:bg-gold hover:brightness-105"
        onClick={() => connect(s)}
      >
        DERIV'GA ULANISH VA BOSHLASH
      </button>

      <div className="mt-3.5 rounded-[10px] border border-red/20 bg-red/[0.06] px-[13px] py-[11px] text-[16px] leading-[1.55] text-[#fca5a5] [&_b]:text-[#fecaca]">
        <b>⚠️ Ogohlantirish</b>
        <br />
        Signallar tahlil maqsadida. Tizim oʻz filtr vaznlarini vaqt oʻtishi bilan oʻzgartiradi.
        Maʼlumotlarni saqlash/import qilish — dashbord'ning oʻng burchagidagi <b>💾</b> va <b>📥</b>{' '}
        tugmalari orqali.
      </div>

      <button
        type="button"
        className="mt-2 cursor-pointer border-none bg-none text-[16px] text-dim"
        onClick={() => setS(structuredClone(DEFAULT_SETTINGS))}
      >
        ↺ Standart sozlamalar
      </button>
    </div>
  );
}
