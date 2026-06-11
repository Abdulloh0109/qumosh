import { Card, CardTitle } from '../common/Card';
import { useSnapshot } from '../../app/hooks';
import { pct } from '../../core/utils.js';
import { cx } from '../../app/cx';

const COR_ROW =
  'flex justify-between items-center px-[10px] py-[7px] bg-white/[0.022] rounded-[7px] mb-[3.5px] text-[16px]';
const COR_NAME = 'text-dim text-[16px] tracking-[1.2px] uppercase font-bold';
const COR_VAL = 'font-bold text-[16px]';
const COR_ARR_BASE =
  'font-extrabold px-[7px] py-[2px] rounded-[4px] text-[16px] ml-[6px] tracking-[0.5px]';
const ARR: Record<string, string> = {
  up: 'bg-green/[0.15] text-green',
  dn: 'bg-red/[0.15] text-red',
  flat: 'bg-[#4a5a72]/[0.2] text-dim',
};
const VERDICT_BASE =
  'mt-[6px] px-[11px] py-[8px] rounded-[7px] text-[16px] font-bold text-center tracking-[0.5px]';
const VERDICT: Record<string, string> = {
  bull: 'bg-green/15 text-green border border-green/[0.3]',
  bear: 'bg-red/15 text-red border border-red/[0.3]',
  mix: 'bg-orange/[0.13] text-orange border border-orange/[0.3]',
  flat: 'bg-[#4a5a72]/[0.15] text-dim border border-white/[0.09]',
};

export function CorrelationCard() {
  const snap = useSnapshot();
  const corr = snap.corr;

  if (!corr) {
    return (
      <Card col={4}>
        <CardTitle title="КОРРЕЛЯЦИЯ" acc="мулти-актив" />
        <div className={cx(VERDICT_BASE, VERDICT.flat)}>МАЪЛУМОТ ЙИҒИЛМОҚДА</div>
      </Card>
    );
  }

  const arrCls = (dir: string, invert = false) => {
    const up = invert ? 'dn' : 'up';
    const dn = invert ? 'up' : 'dn';
    return dir === 'up' ? up : dir === 'dn' ? dn : 'flat';
  };

  return (
    <Card col={4}>
      <CardTitle title="КОРРЕЛЯЦИЯ" acc="мулти-актив" />
      <div className={COR_ROW}>
        <span className={COR_NAME}>DXY (synth)</span>
        <span>
          <span className={cx(COR_VAL, 'mono')}>{corr.dxy !== null ? pct(corr.dxy, 2) : '—'}</span>
          <span className={cx(COR_ARR_BASE, ARR[arrCls(corr.dxyDir, true)])}>
            {corr.dxyDir === 'up' ? '▲ USD' : corr.dxyDir === 'dn' ? '▼ USD' : '─'}
          </span>
        </span>
      </div>
      <div className={COR_ROW}>
        <span className={COR_NAME}>Risk index</span>
        <span>
          <span className={cx(COR_VAL, 'mono')}>
            {corr.risk !== null ? pct(corr.risk, 2) : '—'}
          </span>
          <span className={cx(COR_ARR_BASE, ARR[arrCls(corr.riskDir, true)])}>
            {corr.riskDir === 'up' ? 'RISK-ON' : corr.riskDir === 'dn' ? 'RISK-OFF' : '─'}
          </span>
        </span>
      </div>
      <div className={COR_ROW}>
        <span className={COR_NAME}>Safe haven</span>
        <span>
          <span className={cx(COR_VAL, 'mono')}>
            {corr.safe !== null ? pct(corr.safe, 2) : '—'}
          </span>
          <span className={cx(COR_ARR_BASE, ARR[arrCls(corr.safeDir)])}>
            {corr.safeDir === 'up' ? '▲ HAVEN' : corr.safeDir === 'dn' ? '▼ HAVEN' : '─'}
          </span>
        </span>
      </div>
      <div className={COR_ROW}>
        <span className={COR_NAME}>Yields proxy</span>
        <span>
          <span className={cx(COR_VAL, 'mono')}>
            {corr.yields !== null ? pct(corr.yields, 2) : '—'}
          </span>
          <span className={cx(COR_ARR_BASE, ARR[arrCls(corr.yieldsDir, true)])}>
            {corr.yieldsDir === 'up' ? '▲ YIELDS' : corr.yieldsDir === 'dn' ? '▼ YIELDS' : '─'}
          </span>
        </span>
      </div>
      <div className={cx(VERDICT_BASE, VERDICT[corr.verdict])}>{corr.verdictTxt}</div>
    </Card>
  );
}
