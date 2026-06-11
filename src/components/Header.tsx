import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLive, cfg } from '../app/hooks';
import { changeTF, disconnect, exportData, importData } from '../app/controls';
import { copyLog } from '../core/utils.js';
import { cx } from '../app/cx';

const TFS: [number, string][] = [
  [60, 'M1'],
  [300, 'M5'],
  [900, 'M15'],
  [1800, 'M30'],
  [3600, 'H1'],
  [14400, 'H4'],
  [86400, 'D1'],
];

// .btn — shared icon/danger button base
const BTN =
  'bg-white/[0.05] border border-white/[0.09] rounded-[7px] text-[#cbd5e1] cursor-pointer text-[16px] font-semibold font-mono transition tracking-[0.5px] hover:bg-white/[0.09] hover:text-white hover:border-white/[0.16] hover:-translate-y-px';
// .btn.icon — overrides padding/size
const BTN_ICON = `${BTN} px-[9px] py-[7px] text-[16px]`;
// .btn.danger
const BTN_DANGER = `${BTN} px-3 py-[7px] text-[#fca5a5] border-red/25 hover:bg-red/10`;

// .live-px .chg.up / .dn / .flat — keyed on live.liveChgDir
const CHG: Record<string, string> = {
  up: 'text-green bg-green/15',
  dn: 'text-red bg-red/15',
  flat: 'text-dim bg-[rgba(74,90,114,0.2)]',
};

export function Header() {
  const live = useLive();
  const [activeTf, setActiveTf] = useState<number>(cfg.granularity);
  const fileRef = useRef<HTMLInputElement>(null);

  const onTf = (tf: number) => {
    changeTF(tf);
    setActiveTf(cfg.granularity);
  };

  return (
    <div className="mb-[11px] flex flex-wrap items-center justify-between gap-[14px] rounded-lg border border-[#2b3139] bg-bg2 px-4 py-[9px]">
      <div className="flex flex-shrink-0 items-baseline gap-[10px]">
        <div className="text-[16px] leading-none font-black tracking-[-0.5px] md:text-[19px]">
          <span className="text-cyan glow-cyan">QUMASH</span>{' '}
          <span className="text-gold glow-gold">ULTIMATE</span>
        </div>
        <span className="rounded-[5px] border border-white/[0.16] px-[7px] py-[3px] text-[16px] font-bold tracking-[1.6px] text-dim uppercase">
          v5 PRO
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-[9px] rounded-lg border border-gold/20 bg-gold/[0.06] px-[14px] py-1.5 font-mono text-[16px] font-bold text-gold md:text-[17px]">
          <span className="text-[16px] font-bold tracking-[0.5px] text-dim">XAUUSD</span>
          <span className="mono">{live.livePrice}</span>
          <span
            className={cx('rounded px-[7px] py-0.5 text-[16px] font-bold', CHG[live.liveChgDir])}
          >
            {live.liveChg}
          </span>
        </div>
        <div className="flex gap-0.5 rounded-lg border border-white/[0.09] bg-white/[0.04] p-[3px]">
          {TFS.map(([tf, label]) => (
            <button
              key={tf}
              className={cx(
                'cursor-pointer rounded-[5px] border-none bg-transparent px-[10px] py-[5px] font-mono text-[16px] font-bold tracking-[1.2px] text-dim transition hover:bg-white/[0.05] hover:text-[#cbd5e1] disabled:cursor-not-allowed disabled:opacity-40',
                activeTf === tf && 'bg-cyan/15 text-cyan',
              )}
              onClick={() => onTf(tf)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-[7px] rounded-[7px] border border-white/[0.09] bg-white/[0.04] px-[11px] py-1.5 text-[16px] font-semibold text-dim">
          <div
            className={cx(
              'h-2 w-2 rounded-full transition duration-300',
              live.connected ? 'animate-[pulse_2s_infinite] bg-green' : 'bg-mute',
            )}
          />
          <span>{live.connText}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button className={BTN_ICON} title="Logni nusxalash" onClick={() => copyLog()}>
          📋
        </button>
        <button
          className={BTN_ICON}
          title="Maʼlumotlarni saqlash (JSON yuklab olish)"
          onClick={() => exportData()}
        >
          💾
        </button>
        <button
          className={BTN_ICON}
          title="JSON fayldan import qilish"
          onClick={() => fileRef.current?.click()}
        >
          📥
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importData(file);
            e.target.value = '';
          }}
        />
        <button
          className={BTN_DANGER}
          onClick={() => {
            toast.warning('Uzishni tasdiqlaysizmi?', {
              duration: Infinity,
              action: { label: 'Ha, uz', onClick: () => disconnect() },
              cancel: { label: 'Yoʻq', onClick: () => {} },
            });
          }}
        >
          UZISH
        </button>
      </div>
    </div>
  );
}
