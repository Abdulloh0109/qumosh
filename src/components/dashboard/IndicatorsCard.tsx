import { Card, CardTitle } from '../common/Card';
import { useSnapshot } from '../../app/hooks';
import { fmt } from '../../core/utils.js';
import { cx } from '../../app/cx';

const IND_CELL =
  'px-[10px] py-[7px] bg-white/[0.022] rounded-[7px] flex justify-between items-center';
const IND_NAME = 'text-[16px] text-dim tracking-[1px] uppercase font-bold';
const IND_VAL = 'text-[16px] font-bold';

function Cell({ name, value }: { name: string; value: string }) {
  return (
    <div className={IND_CELL}>
      <span className={IND_NAME}>{name}</span>
      <span className={cx(IND_VAL, 'mono')}>{value}</span>
    </div>
  );
}

export function IndicatorsCard() {
  const snap = useSnapshot();
  const ind = snap.ind;
  const regime = snap.regime;
  const htf = snap.htf;

  if (!ind || !regime) {
    return (
      <Card col={4}>
        <CardTitle title="ИНДИКАТОРЛАР" />
        <div className="py-2 text-center text-[16px] text-mute">Маълумот йиғилмоқда…</div>
      </Card>
    );
  }

  return (
    <Card col={4}>
      <CardTitle title="ИНДИКАТОРЛАР" />
      <div className="grid grid-cols-2 gap-[4px]">
        <Cell name="ATR" value={fmt(ind.atr, 3)} />
        <Cell name="ATR pct" value={`${(regime.atrPct * 100).toFixed(0)}%`} />
        <Cell name="RSI" value={ind.rsi !== null ? ind.rsi.toFixed(1) : '—'} />
        <Cell name="Hurst" value={regime.hurst.toFixed(2)} />
        <Cell name="EMA200" value={ind.close > ind.ema200 ? 'ABOVE 🟢' : 'BELOW 🔴'} />
        <Cell
          name="MACD"
          value={
            ind.macdHist !== null ? `${ind.macdHist > 0 ? '+' : ''}${ind.macdHist.toFixed(2)}` : '—'
          }
        />
        <Cell name="ALMA" value={ind.closeMA > ind.openMA ? '🟢 BULL' : '🔴 BEAR'} />
        <Cell name="HA-ST" value={ind.stTrend === 1 ? '🟢 UP' : '🔴 DN'} />
        <Cell name="FVG" value={ind.fvgBull ? '🟢 Bull' : ind.fvgBear ? '🔴 Bear' : '—'} />
        <Cell name="HTF Bias" value={htf?.txt ?? '—'} />
      </div>
    </Card>
  );
}
