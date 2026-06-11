import { Card, CardTitle } from '../common/Card';
import { useSnapshot, st } from '../../app/hooks';
import { fmtPx } from '../../core/utils.js';
import type { TradeRow } from '../../types/app';
import { cx } from '../../app/cx';

const HIST_TABLE =
  'w-full border-collapse text-[16px] font-mono ' +
  '[&_th]:text-left [&_th]:text-dim [&_th]:px-2 [&_th]:py-[7px] [&_th]:font-bold [&_th]:text-[16px] [&_th]:tracking-[1.2px] [&_th]:uppercase [&_th]:border-b [&_th]:border-white/[0.09] [&_th]:sticky [&_th]:top-0 [&_th]:bg-[linear-gradient(180deg,var(--color-bg2),var(--color-bg3))] ' +
  '[&_td]:px-2 [&_td]:py-[7px] [&_td]:border-b [&_td]:border-white/[0.04] [&_td]:text-[#cbd5e1] ' +
  '[&_tr:hover_td]:bg-white/[0.025]';

const CHIP_BASE = 'font-extrabold px-[7px] py-[2px] rounded-[4px] text-[16px] tracking-[0.5px]';
const SIDE: Record<string, string> = {
  B: 'bg-green/[0.18] text-green',
  S: 'bg-red/[0.18] text-red',
};
const OUT: Record<string, string> = {
  tp: 'bg-green/[0.18] text-green',
  sl: 'bg-red/[0.18] text-red',
  be: 'bg-orange/[0.18] text-orange',
  live: 'bg-cyan/[0.18] text-cyan animate-[pulse_1.6s_infinite]',
};

export function HistoryTable() {
  useSnapshot(); // re-render on tick
  const history = st.history as TradeRow[];

  return (
    <Card col={8}>
      <CardTitle title="SAVDO TARIXI" acc={`${history.length} ta`} />
      <div className="max-h-[240px] overflow-y-auto">
        <table className={HIST_TABLE}>
          <thead>
            <tr>
              <th>#</th>
              <th>Vaqt</th>
              <th>YO</th>
              <th>Ball/T</th>
              <th>Kirish</th>
              <th>SL</th>
              <th>TP3</th>
              <th>Chiqish</th>
              <th>R</th>
              <th>Regim</th>
              <th>SMC</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', color: 'var(--mute)', padding: 18 }}>
                  Bitimlar boʻsh
                </td>
              </tr>
            ) : (
              history.slice(0, 12).map((h, i) => {
                const sideCls = h.side === 'L' ? 'B' : 'S';
                const sideTxt = h.side === 'L' ? 'BUY' : 'SELL';
                const exitCls =
                  h.exit === 'tp' ? 'tp' : h.exit === 'sl' ? 'sl' : h.exit === 'be' ? 'be' : 'live';
                const exitTxt =
                  h.exit === 'tp'
                    ? '🏆 TP'
                    : h.exit === 'sl'
                      ? '✗ SL'
                      : h.exit === 'be'
                        ? '🛡 BE'
                        : '⏳';
                const rColor = h.r > 0 ? 'var(--green)' : h.r < 0 ? 'var(--red)' : 'var(--orange)';
                return (
                  <tr key={`${h.epoch}-${i}`}>
                    <td style={{ color: 'var(--mute)' }}>{history.length - i}</td>
                    <td>{h.ts}</td>
                    <td>
                      <span className={cx(CHIP_BASE, SIDE[sideCls])}>{sideTxt}</span>
                    </td>
                    <td>
                      {h.score} {h.tier}
                    </td>
                    <td style={{ color: 'var(--orange)' }}>{fmtPx(h.entry)}</td>
                    <td style={{ color: 'var(--red)' }}>{fmtPx(h.sl)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmtPx(h.tp3)}</td>
                    <td>
                      <span className={cx(CHIP_BASE, OUT[exitCls])}>{exitTxt}</span>
                    </td>
                    <td style={{ color: rColor, fontWeight: 700 }}>
                      {(h.r >= 0 ? '+' : '') + h.r.toFixed(1)}R
                    </td>
                    <td style={{ fontSize: 14, color: 'var(--dim)' }}>{h.regime || '-'}</td>
                    <td style={{ fontSize: 14, color: 'var(--purple)' }}>{h.structEvent || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
