import { useEffect, useRef } from 'react';
import {
  attachChart,
  detachChart,
  initChart,
  seedChartData,
  toggleFullscreen,
} from '../../services/chart.js';
import { useLive, cfg } from '../../app/hooks';
import { tfLabel } from '../../app/controls';
import { cx } from '../../app/cx';

const CHART_MINI =
  'rounded-[5px] border border-white/[0.09] bg-white/[0.04] px-2 py-[3px] font-mono text-[16px] font-semibold text-dim [&_b]:font-bold [&_b]:text-[#e2e8f0]';
const DIR: Record<string, string> = {
  up: '[&_b]:text-green',
  dn: '[&_b]:text-red',
};

export function ChartPanel() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const live = useLive();

  useEffect(() => {
    attachChart({ container: containerRef.current, wrap: wrapRef.current });
    initChart();
    seedChartData();
    return () => detachChart();
  }, []);

  const ohlc = live.chartOHLC;
  return (
    <div className="chart-wrap" ref={wrapRef}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-[7px] text-[16px] font-extrabold tracking-[2px] text-dim uppercase before:h-[11px] before:w-[3px] before:rounded-[2px] before:bg-cyan before:content-['']">
          YAPONCHA SHAMLAR · <span className="text-cyan">{tfLabel(cfg.granularity)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={CHART_MINI}>
            O <b>{ohlc?.o ?? '—'}</b>
          </div>
          <div className={cx(CHART_MINI, DIR.up)}>
            H <b>{ohlc?.h ?? '—'}</b>
          </div>
          <div className={cx(CHART_MINI, DIR.dn)}>
            L <b>{ohlc?.l ?? '—'}</b>
          </div>
          <div className={CHART_MINI}>
            C <b>{ohlc?.c ?? '—'}</b>
          </div>
          <div className={cx(CHART_MINI, ohlc?.dDir && DIR[ohlc.dDir])}>
            Δ <b>{ohlc?.dStr ?? '—'}</b>
          </div>
        </div>
      </div>
      <div className="mb-[7px] flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.05] bg-black/[0.18] px-2 py-1.5">
        <button
          className="flex items-center gap-[5px] rounded-md border border-white/[0.09] bg-white/[0.04] px-[9px] py-[5px] font-sans text-[16px] font-bold tracking-[0.7px] text-dim uppercase transition duration-150 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
          title="Toʻliq ekran (ESC chiqish)"
          onClick={() => toggleFullscreen()}
        >
          <span className="[font-family:sans-serif] text-[16px] leading-none">⛶</span>Ekran
        </button>
      </div>
      <div className="chart-area">
        <div id="chartContainer" ref={containerRef} />
      </div>
    </div>
  );
}
