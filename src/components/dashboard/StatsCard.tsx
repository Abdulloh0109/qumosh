import { Card, CardTitle } from '../common/Card';
import { useSnapshot, st } from '../../app/hooks';
import { cx } from '../../app/cx';

const STAT_GRID = 'grid grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-2 gap-[6px]';
const STAT_CELL =
  'px-[11px] py-[9px] bg-white/[0.022] rounded-[8px] border border-white/[0.05] transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.09]';
const STAT_LBL = 'text-[16px] text-dim tracking-[1.2px] uppercase font-bold mb-[3px]';
const STAT_VAL_BASE = 'text-[17px] font-extrabold leading-[1.1]';
const STAT: Record<string, string> = {
  good: 'text-green',
  bad: 'text-red',
  neut: 'text-gold',
};

function Cell({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className={STAT_CELL}>
      <div className={STAT_LBL}>{label}</div>
      <div className={cx(STAT_VAL_BASE, 'mono', cls && STAT[cls])}>{value}</div>
    </div>
  );
}

export function StatsCard() {
  useSnapshot(); // re-render on tick
  const closed = st.tpWins + st.beHits + st.slLosses;
  const trueWR = closed ? (st.tpWins / closed) * 100 : null;
  const beRate = closed ? (st.beHits / closed) * 100 : null;
  const lr = closed ? (st.slLosses / closed) * 100 : null;
  const avgW = st.rWinCount ? st.rWinSum / st.rWinCount : null;
  const avgL = st.rLossCount ? st.rLossSum / st.rLossCount : null;
  const exp = closed ? st.rSum / closed : null;

  const expCls = exp === null ? '' : exp > 0.1 ? 'good' : exp < -0.1 ? 'bad' : 'neut';
  const todayCls = st.todayR > 0 ? 'good' : st.todayR < 0 ? 'bad' : 'neut';
  const expTag = exp !== null ? `${exp >= 0 ? '+' : ''}${exp.toFixed(2)}R` : '—';

  return (
    <Card col={5} color="green">
      <CardTitle title="STATISTIKA (HALOL)" acc={expTag} />
      <div className={STAT_GRID}>
        <Cell label="Jami" value={String(st.total)} />
        <Cell
          label="Haqiqiy WR"
          value={trueWR !== null ? `${trueWR.toFixed(0)}%` : '—'}
          cls="neut"
        />
        <Cell label="BE darajasi" value={beRate !== null ? `${beRate.toFixed(0)}%` : '—'} />
        <Cell label="Zarar darajasi" value={lr !== null ? `${lr.toFixed(0)}%` : '—'} cls="bad" />
        <Cell label="Oʻrt. yutuq" value={avgW !== null ? `+${avgW.toFixed(2)}R` : '—'} cls="good" />
        <Cell label="Oʻrt. zarar" value={avgL !== null ? `-${avgL.toFixed(2)}R` : '—'} cls="bad" />
        <Cell label="Kutilma" value={expTag} cls={expCls} />
        <Cell
          label="Bugun"
          value={`${st.todayR >= 0 ? '+' : ''}${st.todayR.toFixed(1)}R`}
          cls={todayCls}
        />
      </div>
    </Card>
  );
}
