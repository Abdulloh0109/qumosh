import { useSnapshot, st } from '../app/hooks';
import { cx } from '../app/cx';

const ITEM =
  'px-[14px] py-[13px] rounded-[11px] text-center text-[16px] font-extrabold tracking-[1.7px] bg-white/[0.025] border-2 border-transparent text-mute transition uppercase';

const ON: Record<string, string> = {
  // .state-item.on.w
  w: 'text-white border-cyan bg-cyan/10',
  // .state-item.on.l
  l: 'text-white border-green bg-green/10',
  // .state-item.on.s
  s: 'text-white border-red bg-red/10',
};

const STAGE = 'text-[16px] opacity-80 block mt-1 tracking-[1.3px] font-semibold';

function stageText(cond: number): string {
  const a = Math.abs(cond);
  if (a === 1.0) return '0/3 — TP1 kutilmoqda';
  if (a === 1.1) return '1/3 — BE himoyada';
  if (a === 1.2) return '2/3 — Trailing';
  return '3/3 — Tugadi';
}

export function StateBar() {
  useSnapshot(); // re-render on each evaluation tick
  const cond = st.condition as number;
  const isWait = cond === 0;
  const isLong = cond > 0;
  const isShort = cond < 0;
  const stage = isWait ? '' : stageText(cond);

  return (
    <div className="mb-[10px] grid grid-cols-3 gap-1.5 max-md:grid-cols-1">
      <div className={cx(ITEM, isWait && ON.w)}>
        KUTILMOQDA<span className={STAGE}>{isWait ? 'signal izlayapti' : '—'}</span>
      </div>
      <div className={cx(ITEM, isLong && ON.l)}>
        LONG OCHIQ<span className={STAGE}>{isLong ? stage : '—'}</span>
      </div>
      <div className={cx(ITEM, isShort && ON.s)}>
        SHORT OCHIQ<span className={STAGE}>{isShort ? stage : '—'}</span>
      </div>
    </div>
  );
}
