import { Card, CardTitle } from '../common/Card';
import { useSnapshot } from '../../app/hooks';
import { tierFor } from '../../core/engine.js';
import { cx } from '../../app/cx';

const TIER: Record<string, string> = {
  'tier-T1': 'bg-green/[0.2] text-green',
  'tier-T2': 'bg-[#76ff03]/[0.18] text-[#a3e635]',
  'tier-T3': 'bg-orange/[0.18] text-orange',
  'tier-T4': 'bg-[#4a5a72]/[0.3] text-dim',
};

export function ScoreCard() {
  const snap = useSnapshot();
  const scoreL = snap.scoreL ?? { score: 0 };
  const scoreS = snap.scoreS ?? { score: 0 };
  const reversalL = snap.reversalL ?? [];
  const reversalS = snap.reversalS ?? [];

  const tL = tierFor(scoreL.score, reversalL.length > 0) ?? { tier: '—', risk: 0 };
  const tS = tierFor(scoreS.score, reversalS.length > 0) ?? { tier: '—', risk: 0 };
  const bestSide = scoreL.score >= scoreS.score ? 'LONG' : 'SHORT';
  const bestScore = Math.max(scoreL.score, scoreS.score);
  const bestTier = bestSide === 'LONG' ? tL : tS;

  const sideBase =
    'flex flex-col gap-[3px] px-[11px] py-[10px] rounded-[9px] bg-white/[0.025] border border-white/[0.05] transition-all duration-200';
  const lblBase = 'text-[16px] tracking-[0.5px] uppercase font-extrabold';
  const valBase = 'text-[30px] font-extrabold leading-none my-0.5';
  const tierBase = 'self-start px-2 py-[2.5px] rounded text-[16px] font-extrabold tracking-[1px]';
  const barBase = 'h-1 mt-[5px] bg-white/[0.08] rounded-[3px] overflow-hidden';

  return (
    <Card col={3} color="gold">
      <CardTitle title="BALL" acc={`${bestSide} ${bestScore.toFixed(0)} (${bestTier.tier})`} />
      <div className="grid grid-cols-2 gap-[7px]">
        <div className={cx(sideBase, bestSide === 'LONG' && 'border-cyan')}>
          <div className={lblBase} style={{ color: 'var(--green)' }}>
            LONG
          </div>
          <div className={cx(valBase, 'mono')} style={{ color: 'var(--green)' }}>
            {scoreL.score.toFixed(0)}
          </div>
          <div className={cx(tierBase, TIER[`tier-${tL.tier}`])}>{tL.tier}</div>
          <div className={barBase}>
            <div
              className="h-full transition-[width] duration-[0.4s]"
              style={{ width: `${scoreL.score}%`, background: 'var(--green)' }}
            />
          </div>
        </div>
        <div className={cx(sideBase, bestSide === 'SHORT' && 'border-cyan')}>
          <div className={lblBase} style={{ color: 'var(--red)' }}>
            SHORT
          </div>
          <div className={cx(valBase, 'mono')} style={{ color: 'var(--red)' }}>
            {scoreS.score.toFixed(0)}
          </div>
          <div className={cx(tierBase, TIER[`tier-${tS.tier}`])}>{tS.tier}</div>
          <div className={barBase}>
            <div
              className="h-full transition-[width] duration-[0.4s]"
              style={{ width: `${scoreS.score}%`, background: 'var(--red)' }}
            />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.02] px-[11px] py-2 text-[16px]">
        <span className="text-[16px] font-bold tracking-[1.2px] text-dim uppercase">
          Tavsiya riski
        </span>
        <span className={cx('text-[16px] font-extrabold text-purple', 'mono')}>
          {bestTier.risk.toFixed(1)}%
        </span>
      </div>
    </Card>
  );
}
