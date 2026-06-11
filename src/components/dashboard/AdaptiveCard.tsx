import { Card, CardTitle } from '../common/Card';
import { useSnapshot, st } from '../../app/hooks';
import { FILTERS } from '../../core/state.js';
import { getFilterRecentWR, getRegimeStats } from '../../core/filters.js';
import { cx } from '../../app/cx';

const ADAPT_HEADER =
  'flex justify-between items-center px-[9px] py-[6px] mb-[6px] bg-cyan/[0.05] rounded-[6px] border border-cyan/[0.2] text-[16px]';
const ADAPT_REGIME_LABEL = 'text-[#cbd5e1] tracking-[1px]';
const ADAPT_REGIME_N = 'text-dim font-mono text-[16px]';
const ADAPT_ROW =
  'flex items-center gap-[8px] px-[10px] py-[6px] bg-white/[0.022] rounded-[6px] mb-[3.5px] text-[16px]';
const ADAPT_NAME = 'text-dim text-[16px] tracking-[1px] uppercase font-bold min-w-[70px]';
const ADAPT_BAR_WRAP = 'flex-1 h-[6px] bg-white/[0.05] rounded-[4px] overflow-hidden relative';
const ADAPT_BAR = 'h-full transition-[width] duration-[0.4s] rounded-[4px]';
const ADAPT_WR = 'text-[16px] font-bold min-w-[36px] text-right text-[#cbd5e1]';
const ADAPT_TAG_BASE =
  'text-[16px] font-extrabold px-[5px] py-[1px] rounded-[3px] tracking-[0.5px] min-w-[34px] text-center';
const TAG: Record<string, string> = {
  'adapt-up': 'bg-green/[0.18] text-green',
  'adapt-dn': 'bg-red/[0.18] text-red',
  'adapt-eq': 'bg-[#4a5a72]/[0.25] text-dim',
};

const F_LABELS: Record<string, string> = {
  regime: 'Регим',
  sweep: 'Sweep',
  dxy: 'DXY',
  premium: 'Prem/Disc',
  session: 'Сеанс',
  liquidity: 'Liq Mag',
  almast: 'ALMA+ST',
  momentum: 'Momentum',
  mss: 'MSS/BOS',
  ob: 'OrderBlk',
  ote: 'OTE',
  candlestick: 'Шамча',
  fvg: 'FVG',
  htf_eng: 'HTF Eng',
};
const REGIME_LABELS: Record<string, string> = {
  TREND_UP: '📈 TREND UP',
  TREND_DN: '📉 TREND DN',
  RANGE: '═ RANGE',
  CHOP: '⊿ CHOP',
};

export function AdaptiveCard() {
  const snap = useSnapshot();
  const activeRegime = snap.regime?.kind || 'CHOP';
  const W = st.adaptWeights[activeRegime] || st.adaptWeights.CHOP;

  const items = (FILTERS as string[]).map((f) => {
    const wr = getFilterRecentWR(f, activeRegime);
    const w = W && typeof W[f] === 'number' ? W[f] : 1.0;
    const trend = w > 1.05 ? 'up' : w < 0.95 ? 'dn' : 'eq';
    return { f, wr, weight: w, trend };
  });
  const visible = items.filter((x) => x.wr || Math.abs(x.weight - 1.0) > 0.05);
  const regimeStats = getRegimeStats(activeRegime);
  const regimeLabel = REGIME_LABELS[activeRegime] || activeRegime;

  return (
    <Card col={4} color="purple">
      <CardTitle title="МОСЛАШУВЧАН ВАЗНЛАР" acc="ўз-ўзини ўрганиш" />
      <div>
        <div className={ADAPT_HEADER}>
          <span className={ADAPT_REGIME_LABEL}>
            Ҳозирги: <b className="font-mono text-cyan">{regimeLabel}</b>
          </span>
          <span className={ADAPT_REGIME_N}>
            {regimeStats.n} битим
            {regimeStats.n > 0 ? ` · WR ${(regimeStats.wr * 100).toFixed(0)}%` : ''}
          </span>
        </div>
        {visible.length === 0 ? (
          <div className="py-2 text-center text-[16px] text-mute">
            Ушбу режимда 8+ битимдан кейин ишлайди
          </div>
        ) : (
          visible.map((x) => {
            const wr = x.wr ? Math.round(x.wr.wr * 100) : null;
            const wrTxt = wr !== null ? `${wr}%` : '—';
            const wrColor =
              wr === null
                ? 'var(--dim)'
                : wr >= 60
                  ? 'var(--green)'
                  : wr >= 40
                    ? 'var(--gold)'
                    : 'var(--red)';
            const barW = Math.min(100, x.weight * 60);
            const barColor =
              x.trend === 'up' ? 'var(--green)' : x.trend === 'dn' ? 'var(--red)' : 'var(--mute)';
            const tagCls =
              x.trend === 'up' ? 'adapt-up' : x.trend === 'dn' ? 'adapt-dn' : 'adapt-eq';
            const tagSym = x.trend === 'up' ? '▲' : x.trend === 'dn' ? '▼' : '═';
            return (
              <div className={ADAPT_ROW} key={x.f}>
                <span className={ADAPT_NAME}>{F_LABELS[x.f] || x.f}</span>
                <div className={ADAPT_BAR_WRAP}>
                  <div className={ADAPT_BAR} style={{ width: `${barW}%`, background: barColor }} />
                </div>
                <span className={cx(ADAPT_WR, 'mono')} style={{ color: wrColor }}>
                  {wrTxt}
                </span>
                <span className={cx(ADAPT_TAG_BASE, TAG[tagCls])}>
                  {tagSym}
                  {x.weight.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
