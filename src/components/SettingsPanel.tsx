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
import { LangToggle } from '../app/lang';

const SECTION_H =
  "mt-5 mb-[11px] flex items-center gap-2 border-b border-white/[0.05] pb-1.5 text-[16px] font-semibold uppercase tracking-[1px] text-dim before:h-[11px] before:w-[3px] before:rounded-[2px] before:bg-cyan before:content-['']";

const TF_OPTIONS = [
  { value: 60, label: 'M1 (скалп)' },
  { value: 300, label: 'M5 (скалп)' },
  { value: 900, label: 'M15 (тавсия)' },
  { value: 1800, label: 'M30' },
  { value: 3600, label: 'H1' },
  { value: 14400, label: 'H4 (свинг)' },
  { value: 86400, label: 'D1 (контекст)' },
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
  { key: 'TREND_DN', icon: '📉', name: 'TREND DN', hint: '(пастка)' },
  { key: 'RANGE', icon: '═', name: 'RANGE', hint: '(чегарада)' },
  { key: 'CHOP', icon: '⊿', name: 'CHOP', hint: '(чалкаш)' },
];

interface SessionMeta {
  key: SessionKey;
  label: string;
  hint: string;
}
const SESSIONS: SessionMeta[] = [
  { key: 'LONDON', label: '🇬🇧 Лондон', hint: '12:00-15:00 UZT ✅' },
  { key: 'OVERLAP', label: '🌍 Лондон+NY', hint: '17:30-20:30 UZT ⭐' },
  { key: 'NY', label: '🇺🇸 NY', hint: '20:30-22:00 UZT ✅' },
  { key: 'NY_AFTER', label: 'NY кейин', hint: '22:00+ ⚠ -7R' },
  { key: 'ASIA', label: '🇯🇵 Осиё', hint: '05:00-12:00 UZT' },
  { key: 'LUNCH', label: '🍽 Туш', hint: '15:00-17:30 ⚠ -4R' },
  { key: 'FRI_LATE', label: 'Жума охири', hint: '⚠ риск' },
  { key: 'LATE', label: 'Кеч', hint: '22:00-05:00 UZT' },
];

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
      className="mb-6 w-full rounded-[18px] border border-white/[0.09] bg-white/[0.04] px-[34px] py-[30px] backdrop-blur-[14px] max-md:mx-auto max-md:my-3 max-md:px-4 max-md:py-[22px]"
    >
      <div className="mb-3 flex justify-end">
        <LangToggle />
      </div>
      <h1 className="mb-1.5 text-[30px] leading-[1.1] font-black tracking-[-0.7px]">
        <span className="text-cyan glow-cyan">QUMASH</span>{' '}
        <span className="text-gold glow-gold">REVERSAL HUNTER</span>{' '}
        <span className="ml-2 inline-block rounded bg-[linear-gradient(135deg,var(--color-cyan),var(--color-blue))] px-2 py-[3px] align-middle text-[10px] font-extrabold tracking-[1.4px] text-white">
          v7
        </span>
      </h1>
      <div className="mt-[9px] mb-[22px] text-[16px] leading-[1.55] text-dim [&_b]:font-semibold [&_b]:text-cyan">
        <b>14 қатламли филтр + Reversal triggers (Sweep / FVG / CHoCH / MSS) + Auto News Mode</b>
        <br />
        Битта мукаммал тунинг қилинган режим. Smart SL — FVG/OB edge'ига; min R:R 1:3. T1 (≥60), T2
        (≥45 + reversal). Sигналлар муҳим янгиликларда ҳам автоматик ишлайди.
      </div>

      <div className={SECTION_H}>МАЪЛУМОТ МАНБАСИ</div>
      <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
        <SelectField
          label="Таймфрейм"
          value={s.tf}
          options={TF_OPTIONS}
          onChange={(v) => set('tf', +v)}
        />
        <SelectField
          label="HTF мултипликатор"
          value={s.htf}
          options={HTF_OPTIONS}
          onChange={(v) => set('htf', +v)}
        />
        <SelectField
          label="Йўналиш"
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
            label="Telegram алертлар"
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

      <div className={SECTION_H}>ИШЛАШ РЕЖИМИ</div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-2">
        <Toggle
          id="setNewsBlock"
          label="Янгилик blackout (high-impact ивентлар)"
          checked={s.newsBlock}
          onChange={(v) => set('newsBlock', v)}
        />
        <Toggle
          id="setSessionFilter"
          label="Кам сифатли сеанс блокировка"
          checked={s.sessionFilter}
          onChange={(v) => set('sessionFilter', v)}
        />
        <Toggle
          id="setAdaptive"
          label="Adaptive scoring (ўз-ўзини ривожлантириш)"
          checked={s.adaptive}
          onChange={(v) => set('adaptive', v)}
        />
      </div>

      <div className={SECTION_H}>ҚАЙСИ РЕЖИМДА СИГНАЛ ҚАБУЛ ҚИЛИШ</div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))] gap-1.5">
        {REGIMES.map((r) => (
          <SessChk key={r.key} checked={s.regimes[r.key]} onChange={(v) => setRegime(r.key, v)}>
            {r.icon} {r.name} <small className="text-[16px]">{r.hint}</small>
          </SessChk>
        ))}
      </div>
      <div className="py-[5px] text-[16px] leading-[1.5] text-dim">
        💡 XAU bullish трендда — TREND_DN режимдаги SHORT сигналлар кўпинча ёлғон. Backtest'дан
        қарши режимни ўчиринг.
      </div>

      <div className={SECTION_H}>ҚАЙСИ СЕАНСДА СИГНАЛ ҚАБУЛ ҚИЛИШ</div>
      <div className="grid grid-cols-4 gap-1.5 max-md:grid-cols-2">
        {SESSIONS.map((ss) => (
          <SessChk
            key={ss.key}
            checked={s.sessions[ss.key]}
            onChange={(v) => setSession(ss.key, v)}
          >
            {ss.label} <small className="text-[16px]">{ss.hint}</small>
          </SessChk>
        ))}
      </div>
      <div className="py-[5px] text-[16px] leading-[1.5] text-dim">
        💡 Тошкент вақтида (UTC+5). Энг яхши: <b className="text-green">17:30-22:00</b> (Лондон+NY
        overlap + NY).
      </div>

      <div className={SECTION_H}>v8: PDF МОДУЛЛАР (TTrades, Hanzo, 5SOP, Kathy Lien)</div>
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
        <Toggle
          id="setTTrades"
          label="🎯 TTrades CISD (C2/C3 swing + projections)"
          checked={s.ttrades}
          onChange={(v) => set('ttrades', v)}
        />
        <Toggle
          id="setDailyProfile"
          label="🇬🇧🇺🇸 Daily Profile (London/NY Reversal)"
          checked={s.dailyProfile}
          onChange={(v) => set('dailyProfile', v)}
        />
        <Toggle
          id="setMondayBlock"
          label="🚫 Monday rule (T2'ни Monday'да блок)"
          checked={s.mondayBlock}
          onChange={(v) => set('mondayBlock', v)}
        />
        <Toggle
          id="setCompression"
          label="🌀 Compression (Hanzo Shadow Codes)"
          checked={s.compression}
          onChange={(v) => set('compression', v)}
        />
        <Toggle
          id="setHLQ"
          label="🔥 HLQ Confluence (OB+FVG+EQ)"
          checked={s.hlq}
          onChange={(v) => set('hlq', v)}
        />
        <Toggle
          id="setQMR"
          label="📐 QMR Pattern (Quasimodo Reversal)"
          checked={s.qmr}
          onChange={(v) => set('qmr', v)}
        />
        <Toggle
          id="setMacro"
          label="🌍 Macro Context (Risk-Off/On regime)"
          checked={s.macro}
          onChange={(v) => set('macro', v)}
        />
      </div>

      <div className={SECTION_H}>v9: ICT BIBLE + DIVERGENCE + MMXM + PSYCHOLOGY</div>
      <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
        <Toggle
          id="setDivergence"
          label="🔥 Divergence Engine (RSI/MACD T1+T2+Stinger)"
          checked={s.divergence}
          onChange={(v) => set('divergence', v)}
        />
        <Toggle
          id="setKeyLevels"
          label="📍 ICT Key Levels (PDH/PDL/PWH/PWL+Midnight Open)"
          checked={s.keyLevels}
          onChange={(v) => set('keyLevels', v)}
        />
        <Toggle
          id="setSMT"
          label="📊 SMT Divergence (XAU vs AUD/EUR)"
          checked={s.smt}
          onChange={(v) => set('smt', v)}
        />
        <Toggle
          id="setAMD"
          label="⚡ AMD Power of 3 (Asia/London/NY)"
          checked={s.amd}
          onChange={(v) => set('amd', v)}
        />
        <Toggle
          id="setICTBlocks"
          label="📦 ICT Blocks (Breaker + Rejection)"
          checked={s.ictBlocks}
          onChange={(v) => set('ictBlocks', v)}
        />
        <Toggle
          id="setPsychBlock"
          label="🧠 Psychology Block (drawdown'да entry ўчирилади)"
          checked={s.psychBlock}
          onChange={(v) => set('psychBlock', v)}
        />
      </div>

      <div className={SECTION_H}>v10: CHART PATTERNS + FIBONACCI + INDUCEMENT</div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-2">
        <Toggle
          id="setChartPatterns"
          label="📐 Classical Chart Patterns (H&S, Double Top/Bot, Wedge, Triangle, Flag)"
          checked={s.chartPatterns}
          onChange={(v) => set('chartPatterns', v)}
        />
        <Toggle
          id="setFibonacci"
          label="📏 Full Fibonacci System (retracement + extension)"
          checked={s.fibonacci}
          onChange={(v) => set('fibonacci', v)}
        />
        <Toggle
          id="setInducement"
          label="🎯 Inducement + Algo Candle (sifatли entry filter)"
          checked={s.inducement}
          onChange={(v) => set('inducement', v)}
        />
      </div>

      <div className={SECTION_H}>v11–v12: NEWS-DRIVEN + M5 INTRADAY + OVERRIDE</div>
      <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
        <Toggle
          id="setNewsDriven"
          label="📰 News-Driven Trade Mode (5 мин кутиб news+тех анализ)"
          checked={s.newsDriven}
          onChange={(v) => set('newsDriven', v)}
        />
        <Toggle
          id="setM5"
          label="⚡ M5 Intraday Reversal Detection (микро-CHoCH/sweep/FVG)"
          checked={s.m5}
          onChange={(v) => set('m5', v)}
        />
        <Toggle
          id="setOverride"
          label="🟢 Override Hierarchy (кучли модел trigger weak filter'ни bosib o'tadi)"
          checked={s.override}
          onChange={(v) => set('override', v)}
        />
      </div>

      <button
        className="mt-3.5 w-full cursor-pointer rounded-xl bg-[linear-gradient(135deg,var(--color-cyan),var(--color-blue))] p-3.5 font-sans text-[15px] font-extrabold tracking-[1.2px] text-white transition duration-200 hover:-translate-y-px hover:brightness-[1.18]"
        onClick={() => connect(s)}
      >
        DERIV'ГА УЛАНИШ ВА БОШЛАШ
      </button>

      <div className="mt-3.5 rounded-[10px] border border-red/20 bg-red/[0.06] px-[13px] py-[11px] text-[16px] leading-[1.55] text-[#fca5a5] [&_b]:text-[#fecaca]">
        <b>⚠️ Огоҳлантириш</b>
        <br />
        Сигналлар таҳлил мақсадида. Тизим ўз филтр вазнларини вақт ўтиши билан ўзгартиради.
        Маълумотларни сақлаш/импорт қилиш — дашборд'нинг ўнг бурчагидаги <b>💾</b> ва <b>📥</b>{' '}
        тугмалари орқали.
      </div>

      <button
        type="button"
        className="mt-2 cursor-pointer border-none bg-none text-[16px] text-dim"
        onClick={() => setS(structuredClone(DEFAULT_SETTINGS))}
      >
        ↺ Default sozlamalar
      </button>
    </div>
  );
}
