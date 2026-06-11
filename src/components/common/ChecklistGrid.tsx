export interface ChecklistItem {
  q: string;
  answer: string;
  detail?: string;
  signal: string; // 'bull' | 'bear' | 'good' | 'warn' | neutral
}

const colorFor = (signal: string) =>
  signal === 'bull' || signal === 'good'
    ? 'text-green'
    : signal === 'bear' || signal === 'warn'
      ? 'text-red'
      : 'text-mute';

const iconFor = (signal: string) =>
  signal === 'bull'
    ? '🟢'
    : signal === 'bear'
      ? '🔴'
      : signal === 'good'
        ? '✅'
        : signal === 'warn'
          ? '⚠️'
          : '⚪';

/** Renders the 10-question daily / pre-entry checklist grids (v8 & v9). */
export function ChecklistGrid({
  items,
  placeholder,
}: {
  items: ChecklistItem[];
  placeholder?: string;
}) {
  return (
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] gap-1.5 text-[16px]">
      {items.length === 0 ? (
        <div className="col-span-full p-2 text-mute">{placeholder ?? 'Kutilmoqda...'}</div>
      ) : (
        items.map((it, i) => (
          <div
            key={i}
            className="rounded-md border border-white/[0.09] bg-white/[0.03] px-2 py-1.5"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-[16px] font-semibold text-text">{it.q}</span>
              <span className="text-[16px]">{iconFor(it.signal)}</span>
            </div>
            <div className={`mt-0.5 text-[16px] font-semibold ${colorFor(it.signal)}`}>
              {it.answer}
            </div>
            <div className="mt-0.5 text-[14px] text-dim">{it.detail || ''}</div>
          </div>
        ))
      )}
    </div>
  );
}
