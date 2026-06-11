import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardTitle } from '../common/Card';
import { st } from '../../app/hooks';
import { useBacktestProgress } from '../../app/hooks';
import { FILTERS } from '../../core/state.js';
import { runBacktest, BT } from '../../core/backtest.js';
import { log } from '../../core/utils.js';
import { cx } from '../../app/cx';

const BT_BD = 'px-3 py-[10px] bg-black/25 rounded-[7px] border border-white/[0.09]';
const BT_BD_H = 'text-[16px] text-cyan tracking-[1.4px] uppercase font-extrabold mb-[7px]';
const BT_BD_T =
  'w-full text-[16px] font-mono ' +
  '[&_th]:text-left [&_th]:px-[7px] [&_th]:py-[5px] [&_th]:text-dim [&_th]:text-[16px] [&_th]:tracking-[1px] [&_th]:uppercase [&_th]:border-b [&_th]:border-white/[0.09] ' +
  '[&_td]:px-[7px] [&_td]:py-[5px] [&_td]:border-b [&_td]:border-white/[0.04] ' +
  '[&_td:first-child]:text-white [&_td:first-child]:uppercase [&_td:first-child]:text-[16px] [&_td:first-child]:font-semibold';

const BT_STAT =
  'px-[11px] py-[9px] bg-white/[0.025] rounded-[7px] border border-white/[0.09] text-center';
const BT_STAT_L = 'text-[16px] text-dim uppercase tracking-[1.2px] mb-1';
const BT_STAT_V = 'font-mono text-[18px] font-bold text-white';

const BT_WARN_BASE =
  'px-3 py-[9px] rounded-[7px] text-[16px] mb-[10px] leading-[1.5] [&_b]:font-bold';
const BT_WARN: Record<string, string> = {
  green: 'bg-green/[0.08] border-l-[3px] border-l-green text-[#bbf7d0]',
  yellow: 'bg-orange/[0.08] border-l-[3px] border-l-orange text-[#fde68a]',
  red: 'bg-red/[0.08] border-l-[3px] border-l-red text-[#fecaca]',
};

interface Bucket {
  n: number;
  wins: number;
  r: number;
}

function BreakdownTable({
  title,
  data,
  keys,
}: {
  title: string;
  data: Record<string, Bucket>;
  keys: string[];
}) {
  const rows = keys.map((k) => ({ k, d: data[k] })).filter((x) => x.d && x.d.n);
  if (!rows.length) return null;
  return (
    <div className={BT_BD}>
      <div className={BT_BD_H}>{title}</div>
      <table className={BT_BD_T}>
        <thead>
          <tr>
            <th></th>
            <th>N</th>
            <th>WR</th>
            <th>R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ k, d }) => {
            const wr = (d.wins / d.n) * 100;
            const wrColor = wr >= 55 ? 'var(--green)' : wr >= 45 ? 'var(--gold)' : 'var(--red)';
            const rColor = d.r > 0 ? 'var(--green)' : 'var(--red)';
            return (
              <tr key={k}>
                <td>{k}</td>
                <td>{d.n}</td>
                <td style={{ color: wrColor }}>{wr.toFixed(0)}%</td>
                <td style={{ color: rColor }}>
                  {d.r >= 0 ? '+' : ''}
                  {d.r.toFixed(2)}R
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Results({ r }: { r: any }) {
  const wrPct = (r.wr * 100).toFixed(1);
  const tp3Pct = (r.tp3Rate * 100).toFixed(1);
  const pf = r.pf > 99 ? '∞' : r.pf.toFixed(2);
  const exp = r.exp.toFixed(2);
  const wrColor = r.wr >= 0.55 ? 'var(--green)' : r.wr >= 0.45 ? 'var(--gold)' : 'var(--red)';
  const pfColor = r.pf >= 1.4 ? 'var(--green)' : r.pf >= 1.0 ? 'var(--gold)' : 'var(--red)';
  const rColor = r.rSum > 0 ? 'var(--green)' : 'var(--red)';
  const expColor = r.exp > 0.05 ? 'var(--green)' : r.exp > -0.05 ? 'var(--gold)' : 'var(--red)';

  const stat = (l: string, v: React.ReactNode, color?: string, small?: boolean) => (
    <div className={BT_STAT}>
      <div className={BT_STAT_L}>{l}</div>
      <div className={BT_STAT_V} style={{ color, fontSize: small ? 14 : undefined }}>
        {v}
      </div>
    </div>
  );

  // Interpretation
  const interp: React.ReactNode[] = [];
  if (r.total < 10) {
    interp.push(<div key="few">Кам битим — тахлил қилишга етмайди.</div>);
  } else {
    if (r.pf >= 1.4)
      interp.push(
        <div key="pf" className="text-[#bbf7d0]">
          ✅ Profit Factor {pf} — кучли. Тизим бу шароитда фойдали.
        </div>,
      );
    else if (r.pf >= 1.0)
      interp.push(
        <div key="pf" className="text-[#fde68a]">
          ⚠ Profit Factor {pf} — break-even атрофида.
        </div>,
      );
    else
      interp.push(
        <div key="pf" className="text-[#fecaca]">
          ❌ Profit Factor {pf} — ёмонатига чиқади. Параметрларни кўриб чиқинг.
        </div>,
      );

    if (r.exp > 0.1)
      interp.push(
        <div key="exp" className="text-[#bbf7d0]">
          ✅ Expectancy +{exp}R — ҳар битимдан фойда.
        </div>,
      );
    else if (r.exp >= -0.1)
      interp.push(
        <div key="exp" className="text-[#fde68a]">
          ⚠ Expectancy {r.exp >= 0 ? '+' : ''}
          {exp}R — нейтрал.
        </div>,
      );
    else
      interp.push(
        <div key="exp" className="text-[#fecaca]">
          ❌ Expectancy {exp}R — ҳар битим ўртача йўқотади.
        </div>,
      );

    const regimes = Object.entries<Bucket>(r.perRegime)
      .filter(([, v]) => v.n >= 3)
      .sort((a, b) => b[1].r - a[1].r);
    if (regimes.length > 0) {
      const best = regimes[0];
      const worst = regimes[regimes.length - 1];
      if (best[1].r > 0)
        interp.push(
          <div key="rb" className="text-[#bbf7d0]">
            ✅ Энг яхши режим: <b>{best[0]}</b> {best[1].r.toFixed(2)}R ({best[1].n} битим)
          </div>,
        );
      if (worst[1].r < -0.5 && worst[0] !== best[0])
        interp.push(
          <div key="rw" className="text-[#fecaca]">
            ❌ Энг ёмон режим: <b>{worst[0]}</b> {worst[1].r.toFixed(2)}R ({worst[1].n} битим)
          </div>,
        );
    }
    const badFilters = Object.entries<Bucket>(r.perFilter)
      .filter(([, v]) => v.n >= 5 && v.wins / v.n < 0.3)
      .sort((a, b) => a[1].r - b[1].r);
    if (badFilters.length > 0) {
      const f = badFilters[0];
      interp.push(
        <div key="bf" className="text-[#fecaca]">
          ❌ <b>{f[0].toUpperCase()}</b> филтри ёмон ишлайди:{' '}
          {((f[1].wins / f[1].n) * 100).toFixed(0)}% WR, {f[1].r.toFixed(1)}R ({f[1].n} битим).
        </div>,
      );
    }
    const sessions = Object.entries<Bucket>(r.perSession)
      .filter(([, v]) => v.n >= 3)
      .sort((a, b) => b[1].r - a[1].r);
    if (sessions.length > 0 && sessions[0][1].r > 0)
      interp.push(
        <div key="sb" className="text-[#bbf7d0]">
          ✅ Энг яхши сеанс: <b>{sessions[0][0]}</b> {sessions[0][1].r.toFixed(2)}R
        </div>,
      );
  }

  const topFilters = (FILTERS as string[])
    .map((f) => ({ f, ...(r.perFilter[f] as Bucket) }))
    .filter((x) => x.n >= 3)
    .sort((a, b) => b.wins / b.n - a.wins / a.n)
    .slice(0, 11);

  return (
    <div className="flex flex-col gap-[14px]" style={{ display: 'block' }}>
      <div className="grid grid-cols-8 gap-[7px] max-[1100px]:grid-cols-4">
        {stat('Жами битимлар', r.total)}
        {stat('Жами R', `${r.rSum >= 0 ? '+' : ''}${r.rSum.toFixed(2)}`, rColor)}
        {stat('WR (фойдали)', `${wrPct}%`, wrColor)}
        {stat('TP3 тўлиқ', `${tp3Pct}%`)}
        {stat('Profit Factor', pf, pfColor)}
        {stat('Expectancy/битим', `${r.exp >= 0 ? '+' : ''}${exp}R`, expColor)}
        {stat('Max DD', `-${r.maxDD.toFixed(2)}R`, 'var(--red)')}
        {stat(
          'TP3 / BE / SL / TO',
          `${r.tpFull}/${r.beHits}/${r.slLosses}/${r.timeouts}`,
          undefined,
          true,
        )}
      </div>

      {r.total < 30 ? (
        <div className={cx(BT_WARN_BASE, BT_WARN.red)}>
          ⚠️ <b>{r.total} битим — статистик кучсиз.</b> Хулоса учун камида 100+ битим керак.
        </div>
      ) : r.total < 100 ? (
        <div className={cx(BT_WARN_BASE, BT_WARN.yellow)}>
          ⚠️ <b>{r.total} битим — статистик ўрта.</b> 100+ битим тавсия қилинади.
        </div>
      ) : (
        <div className={cx(BT_WARN_BASE, BT_WARN.green)}>
          ✅ <b>{r.total} битим — статистик яхши.</b>
        </div>
      )}

      <div className="mb-[10px] rounded-[7px] border border-white/[0.09] bg-black/30 px-[13px] py-[11px] [&_b]:font-mono [&_b]:text-white [&>div]:py-1 [&>div]:text-[16px] [&>div]:leading-[1.5]">
        <div className="mb-[7px] text-[16px] font-extrabold tracking-[1.4px] text-cyan uppercase">
          📋 ҲУКМ:
        </div>
        {interp}
      </div>

      <div className="grid grid-cols-2 gap-[10px] max-[900px]:grid-cols-1">
        <BreakdownTable
          title="Режим бўйича"
          data={r.perRegime}
          keys={['TREND_UP', 'TREND_DN', 'RANGE', 'CHOP']}
        />
        <BreakdownTable title="Tier бўйича" data={r.perTier} keys={['T1', 'T2', 'T3']} />
        <BreakdownTable
          title="Сеанс бўйича"
          data={r.perSession}
          keys={[
            'LONDON',
            'NY',
            'OVERLAP',
            'NY_AFTER',
            'ASIA',
            'LUNCH',
            'FRI_LATE',
            'LATE',
            'OTHER',
          ]}
        />
        {topFilters.length > 0 && (
          <div className={BT_BD}>
            <div className={BT_BD_H}>Филтрлар бўйича (улар + бўлганда)</div>
            <table className={BT_BD_T}>
              <thead>
                <tr>
                  <th></th>
                  <th>N</th>
                  <th>WR</th>
                  <th>R</th>
                </tr>
              </thead>
              <tbody>
                {topFilters.map((x) => {
                  const wr = (x.wins / x.n) * 100;
                  const wrColor =
                    wr >= 55 ? 'var(--green)' : wr >= 45 ? 'var(--gold)' : 'var(--red)';
                  return (
                    <tr key={x.f}>
                      <td>{x.f}</td>
                      <td>{x.n}</td>
                      <td style={{ color: wrColor }}>{wr.toFixed(0)}%</td>
                      <td>
                        {x.r >= 0 ? '+' : ''}
                        {x.r.toFixed(1)}R
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function BacktestPanel() {
  const progress = useBacktestProgress();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Тайёр');
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (BT.running) {
      toast.warning('Аллақачон ишламоқда...');
      return;
    }
    if (!st.candles || st.candles.length < 250) {
      toast.warning('Маълумот етарли эмас. Бошида тизимни уланг ва ~5 минут кутинг.');
      return;
    }
    setRunning(true);
    setStatus('Бажарилмоқда...');
    setResult(null);
    try {
      const r: any = await runBacktest({});
      if (r) {
        setResult(r);
        setStatus(`✅ Тугатилди (${r.total} битим)`);
      } else {
        setStatus('⚠ Натижа йўқ');
      }
    } catch (e) {
      setStatus('❌ Хато: ' + (e as Error).message);
      log('BT', '❌ Backtest хато', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card col={12}>
      <CardTitle title="BACKTEST МОТОРИ" acc={status} />
      <div className="mb-[10px] flex items-center gap-2">
        <button
          className="rounded-lg border border-white/[0.09] bg-white/5 px-3 py-2 text-[16px] font-semibold text-[#cbd5e1] hover:bg-white/[0.09] disabled:opacity-50"
          disabled={running}
          onClick={run}
        >
          {running ? '⏳ Ҳисобланмоқда...' : '▶ Backtest бошлаш'}
        </button>
        <div className="relative h-6 flex-1 overflow-hidden rounded-md border border-white/[0.09] bg-black/40">
          <div
            className="flex h-full min-w-[40px] items-center justify-center bg-[linear-gradient(90deg,var(--color-cyan),var(--color-green))] text-[16px] font-extrabold text-[#0f172a] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          >
            {progress}%
          </div>
        </div>
      </div>
      {running && (
        <div
          className="mb-[10px] rounded-[7px] border border-dashed border-cyan bg-cyan/[0.06] px-[11px] py-[9px] text-[16px] leading-[1.5] text-[#cbd5e1]"
          style={{ display: 'block' }}
        >
          Юкланган шамлар бўйича сигналлар симуляция қилинади. Хулоса учун камида 100+ битим керак.
        </div>
      )}
      {result && <Results r={result} />}
    </Card>
  );
}
