import { useState } from 'react';

const KEY = 'qumash_reco_hidden';

export function RecoBanner() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  return (
    <div className="mx-4 my-[10px] flex items-center gap-[14px] rounded-lg border border-cyan/20 bg-cyan/[0.06] px-[18px] py-[11px] text-[16px] leading-[1.5]">
      <span className="flex-shrink-0 text-[18px]">💡</span>
      <span className="flex-1 text-[#cbd5e1] [&_b]:font-bold [&_b]:text-white">
        <b>Tavsiya:</b> Signallarni <b style={{ color: 'var(--cyan)' }}>M15 taymfreymda</b> qabul
        qiling — kuniga <b>1-3 ta sifatli signal</b> olasiz. Eng yaxshi vaqt:{' '}
        <b style={{ color: 'var(--green)' }}>London seansi</b> (12:00-15:00 UZT) va{' '}
        <b style={{ color: 'var(--green)' }}>NY seansi</b> (17:30-20:00 UZT). Tizim backtest
        boʻyicha PF 1.29 koʻrsatdi.
      </span>
      <button
        className="cursor-pointer border-none bg-none px-1.5 py-0 text-[18px] text-dim opacity-60 transition hover:text-red hover:opacity-100"
        title="Yopish"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* noop */
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
