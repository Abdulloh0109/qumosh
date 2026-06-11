import { Card, CardTitle } from '../common/Card';
import { useSnapshot, st } from '../../app/hooks';
import { fmtPx } from '../../core/utils.js';
import { cx } from '../../app/cx';

const ROW_BASE =
  'flex items-center justify-between px-3 py-2 mb-1 bg-white/[0.022] rounded-lg border-l-[3px] border-l-mute transition-all duration-200 text-[16px]';
const LBL = 'flex items-center gap-1.5 text-[16px] text-dim tracking-[1.4px] uppercase font-bold';
const VAL_BASE = 'text-[16px] font-bold';
const PCT =
  'ml-1.5 px-[5px] py-px text-[16px] text-dim tracking-[1px] bg-white/[0.04] rounded-[3px]';

const ROW_ENTRY = 'border-l-orange bg-orange/[0.04]';
const ROW_SL = 'border-l-red bg-red/[0.04]';
const ROW_TP = 'border-l-green';
const ROW_HIT = 'bg-green/[0.13] border-l-green';

export function TradeCard() {
  useSnapshot(); // re-render on tick
  const snap = st.snap;
  const cond = Math.abs(st.condition as number);
  const has = !!snap;

  const v = (n: number | undefined) => (has ? fmtPx(n) : '—');

  return (
    <Card col={3} color="orange">
      <CardTitle title="AKTIV SAVDO" acc={has ? `${st.barsSinceEntry} bar` : '—'} />
      <div>
        <div className={cx(ROW_BASE, ROW_ENTRY)}>
          <span className={LBL}>◆ Kirish</span>
          <span className={cx(VAL_BASE, 'text-orange', 'mono')}>{v(snap?.entry)}</span>
        </div>
        <div className={cx(ROW_BASE, ROW_SL)}>
          <span className={LBL}>✗ SL</span>
          <span className={cx(VAL_BASE, 'text-red', 'mono')}>{has ? fmtPx(st.slLine) : '—'}</span>
        </div>
        <div className={cx(ROW_BASE, ROW_TP, has && cond >= 1.1 && ROW_HIT)}>
          <span className={LBL}>
            🎯 TP1<span className={PCT}>50%</span>
          </span>
          <span className={cx(VAL_BASE, 'text-green', 'mono')}>{v(snap?.tp1)}</span>
        </div>
        <div className={cx(ROW_BASE, ROW_TP, has && cond >= 1.2 && ROW_HIT)}>
          <span className={LBL}>
            🎯 TP2<span className={PCT}>30%</span>
          </span>
          <span className={cx(VAL_BASE, 'text-green', 'mono')}>{v(snap?.tp2)}</span>
        </div>
        <div className={cx(ROW_BASE, ROW_TP, has && cond >= 1.3 && ROW_HIT)}>
          <span className={LBL}>
            🏆 TP3<span className={PCT}>20%</span>
          </span>
          <span className={cx(VAL_BASE, 'text-green', 'mono')}>{v(snap?.tp3)}</span>
        </div>
      </div>
    </Card>
  );
}
