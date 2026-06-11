import { Card, CardTitle } from '../common/Card';
import { useSnapshot, st } from '../../app/hooks';
import {
  detectCandlestickPatterns,
  detectFVGs,
  detectHTFEngulfing,
  PATTERN_NAMES,
} from '../../core/filters.js';
import { cx } from '../../app/cx';

const STATUS: Record<FilterRow['status'], string> = {
  pass: 'border-l-green bg-green/[0.04]',
  warn: 'border-l-orange bg-orange/[0.04]',
  fail: 'border-l-red bg-red/[0.04]',
  neut: 'border-l-mute',
};

interface FilterRow {
  f: string;
  icon: string;
  name: string;
  val: string;
  status: 'pass' | 'warn' | 'fail' | 'neut';
}

export function FilterGrid() {
  const snap = useSnapshot();
  if (!snap.ind) {
    return (
      <Card col={3}>
        <CardTitle title="АКТИВ ФИЛТРЛАР" acc="0/10" />
        <div className="py-2 text-center text-[16px] text-mute">Маълумот йиғилмоқда…</div>
      </Card>
    );
  }
  const { ind, regime, sweep, corr, pd, ses, news, magnets } = snap;

  // Candlestick pattern (live)
  let curPat: { buy: any[]; sell: any[] } = { buy: [], sell: [] };
  if (st.candles && st.candles.length >= 3) curPat = detectCandlestickPatterns(st.candles);
  const allPat = [...curPat.buy, ...curPat.sell];
  let patVal = 'йўқ';
  let patStatus: FilterRow['status'] = 'neut';
  if (allPat.length > 0) {
    const strong = allPat.reduce((m, p) => (p.score > m.score ? p : m), allPat[0]);
    patVal = (PATTERN_NAMES as Record<string, string>)[strong.name] || strong.name;
    patStatus = strong.score >= 10 ? 'pass' : 'warn';
  }

  // FVG (live)
  let fvgVal = 'йўқ';
  let fvgStatus: FilterRow['status'] = 'neut';
  if (st.candles) {
    const fvgs = detectFVGs(st.candles, ind.atr);
    if (fvgs.length > 0) {
      const bull = fvgs.filter(
        (f: any) => f.type === 'bull' && ind.close >= f.bot && ind.close <= f.top,
      );
      const bear = fvgs.filter(
        (f: any) => f.type === 'bear' && ind.close >= f.bot && ind.close <= f.top,
      );
      if (bull.length > 0) {
        fvgVal = `🟢 ${bull[0].bot.toFixed(1)}-${bull[0].top.toFixed(1)}`;
        fvgStatus = 'pass';
      } else if (bear.length > 0) {
        fvgVal = `🔴 ${bear[0].bot.toFixed(1)}-${bear[0].top.toFixed(1)}`;
        fvgStatus = 'pass';
      } else {
        fvgVal = `${fvgs.length} faol`;
        fvgStatus = 'warn';
      }
    }
  }

  // HTF Engulfing (live)
  let htfEngVal = 'йўқ';
  let htfEngStatus: FilterRow['status'] = 'neut';
  if (st.candlesHTF && st.candlesHTF.length >= 2) {
    const hte = detectHTFEngulfing(st.candlesHTF);
    if (hte.bull) {
      htfEngVal = '🟢 BULL';
      htfEngStatus = 'pass';
    } else if (hte.bear) {
      htfEngVal = '🔴 BEAR';
      htfEngStatus = 'pass';
    }
  }

  const filters: FilterRow[] = [
    {
      f: 'regime',
      icon: '🌀',
      name: 'Регим',
      val: `${regime.kind} (${(regime.confidence * 100).toFixed(0)}%)`,
      status: regime.kind === 'CHOP' ? 'fail' : regime.confidence > 0.5 ? 'pass' : 'warn',
    },
    {
      f: 'sweep',
      icon: '💧',
      name: 'Sweep',
      val: sweep.detected ? sweep.why : 'йўқ',
      status: sweep.detected ? 'pass' : 'neut',
    },
    {
      f: 'dxy',
      icon: '📊',
      name: 'DXY',
      val: corr.verdictTxt,
      status: corr.verdict === 'mix' || corr.verdict === 'flat' ? 'warn' : 'pass',
    },
    {
      f: 'premium',
      icon: '⚖️',
      name: 'Prem/Disc',
      val: `${pd.zone.toUpperCase()} (${(pd.pos * 100).toFixed(0)}%)`,
      status: pd.zone === 'mid' ? 'neut' : 'pass',
    },
    {
      f: 'session',
      icon: '🕒',
      name: 'Сеанс',
      val: ses.txt,
      status: ses.quality >= 0.7 ? 'pass' : ses.quality >= 0.4 ? 'warn' : 'fail',
    },
    { f: 'news', icon: '📰', name: 'Янгилик', val: news.txt, status: news.clear ? 'pass' : 'fail' },
    {
      f: 'liquidity',
      icon: '🧲',
      name: 'Liq Magnet',
      val: magnets.nearestAbove
        ? `↑${magnets.nearestAbove.price.toFixed(2)}`
        : magnets.nearestBelow
          ? `↓${magnets.nearestBelow.price.toFixed(2)}`
          : 'йўқ',
      status:
        magnets.nearestAbove?.count >= 2 || magnets.nearestBelow?.count >= 2 ? 'pass' : 'neut',
    },
    { f: 'candlestick', icon: '🕯', name: 'Шамча', val: patVal, status: patStatus },
    { f: 'fvg', icon: '📦', name: 'FVG Gap', val: fvgVal, status: fvgStatus },
    { f: 'htf_eng', icon: '🔄', name: 'HTF Eng', val: htfEngVal, status: htfEngStatus },
  ];
  const passes = filters.filter((x) => x.status === 'pass').length;

  return (
    <Card col={3}>
      <CardTitle title="АКТИВ ФИЛТРЛАР" acc={`${passes}/10`} />
      <div className="flex flex-col gap-[3.5px]">
        {filters.map((row) => (
          <div
            key={row.f}
            className={cx(
              'flex items-center gap-2 rounded-md border-l-[3px] border-l-mute bg-white/[0.022] px-[10px] py-[7px] text-[16px] transition-all duration-150 hover:bg-white/[0.04]',
              STATUS[row.status],
            )}
            data-f={row.f}
          >
            <span className="w-4 shrink-0 text-center text-[16px]">{row.icon}</span>
            <span className="min-w-[70px] text-[16px] font-bold tracking-[1px] text-dim uppercase">
              {row.name}
            </span>
            <span className={cx('flex-1 text-right text-[16px] text-[#e2e8f0]', 'mono')}>
              {row.val}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
