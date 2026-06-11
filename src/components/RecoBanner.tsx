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
        <b>Тавсия:</b> Сигналларни <b style={{ color: 'var(--cyan)' }}>M15 таймфреймда</b> қабул
        қилинг — кунига <b>1-3 та сифатли сигнал</b> оласиз. Энг яхши вақт:{' '}
        <b style={{ color: 'var(--green)' }}>Лондон сеанси</b> (12:00-15:00 UZT) ва{' '}
        <b style={{ color: 'var(--green)' }}>NY сеанси</b> (17:30-20:00 UZT). Тизим backtest бўйича
        PF 1.29 кўрсатди.
      </span>
      <button
        className="cursor-pointer border-none bg-none px-1.5 py-0 text-[18px] text-dim opacity-60 transition hover:text-red hover:opacity-100"
        title="Ёпиш"
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
