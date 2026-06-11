import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../app/cx';

type CardColor = '' | 'gold' | 'orange' | 'purple' | 'green' | 'red';

const BAR: Record<string, string> = {
  '': 'bg-cyan',
  gold: 'bg-gold',
  orange: 'bg-orange',
  purple: 'bg-purple',
  green: 'bg-green',
  red: 'bg-red',
};

/** Per-card top sheen — a soft, muted accent hairline (depth, not neon). */
const SHEEN: Record<string, string> = {
  '': 'before:via-white/[0.07]',
  gold: 'before:via-gold/25',
  orange: 'before:via-orange/25',
  purple: 'before:via-purple/25',
  green: 'before:via-green/25',
  red: 'before:via-red/25',
};

/** Desktop col span → responsive Tailwind spans (full width on mobile, halving
    on tablet, exact span on xl). */
const COL_SPAN: Record<number, string> = {
  12: 'col-span-12',
  8: 'col-span-12 xl:col-span-8',
  6: 'col-span-12 lg:col-span-6',
  5: 'col-span-12 md:col-span-6 xl:col-span-5',
  4: 'col-span-12 md:col-span-6 xl:col-span-4',
  3: 'col-span-12 md:col-span-6 xl:col-span-3',
};

interface CardProps {
  /** Desktop grid span (1–12); collapses responsively on smaller screens. */
  col: number;
  color?: CardColor;
  children: ReactNode;
  padStyle?: CSSProperties;
}

/** Frosted-glass dashboard panel with soft depth and a muted accent hairline. */
export function Card({ col, color = '', children, padStyle }: CardProps) {
  return (
    <div
      className={cx(
        COL_SPAN[col] ?? 'col-span-12',
        'relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl',
        'shadow-[0_10px_34px_-16px_rgba(0,0,0,0.75)] transition-colors duration-200',
        'hover:border-white/[0.12] hover:bg-white/[0.035]',
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:to-transparent before:content-['']",
        SHEEN[color] ?? SHEEN[''],
      )}
    >
      <div className="px-4 py-3.5" style={padStyle}>
        {children}
      </div>
    </div>
  );
}

interface CardTitleProps {
  title: ReactNode;
  acc?: ReactNode;
  /** Accent-bar color (matches the card color). */
  color?: CardColor;
}

/** Card header: a slim accent pill + a refined label, optional meta chip. */
export function CardTitle({ title, acc, color = '' }: CardTitleProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 text-[16px] font-semibold tracking-[0.6px] text-text2 uppercase">
      <span className="flex items-center gap-2">
        <span className={cx('h-3.5 w-[3px] rounded-full', BAR[color] ?? 'bg-cyan')} />
        {title}
      </span>
      {acc !== undefined && (
        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium tracking-normal text-dim normal-case">
          {acc}
        </span>
      )}
    </div>
  );
}

/** A structure-card row: name on the left, value/tag on the right. */
export function StrucRow({ name, children }: { name: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-[16px]">
      <span className="flex items-center gap-1.5 text-[13px] font-medium tracking-[0.3px] text-dim uppercase">
        {name}
      </span>
      {children}
    </div>
  );
}

const TAG_STYLES: Record<string, string> = {
  'tag-up': 'bg-green/15 text-green',
  'tag-good': 'bg-green/15 text-green',
  'tag-dn': 'bg-red/15 text-red',
  'tag-bad': 'bg-red/15 text-red',
  'tag-mix': 'bg-orange/15 text-orange',
  'tag-warn': 'bg-orange/15 text-orange',
  'tag-neut': 'bg-white/[0.06] text-dim',
  'tag-bos': 'bg-cyan/15 text-cyan',
  'tag-choch': 'bg-purple/15 text-purple',
};

/** A small status chip. `kind` is one of the tag-* keys (default neutral). */
export function Tag({ kind, children }: { kind?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'rounded-md px-2 py-0.5 text-[13px] font-semibold tracking-[0.2px]',
        TAG_STYLES[kind ?? 'tag-neut'] ?? TAG_STYLES['tag-neut'],
      )}
    >
      {children}
    </span>
  );
}

/** Right-aligned mono value used inside StrucRow. */
export function StrucVal({ children }: { children: ReactNode }) {
  return (
    <span className="text-right font-mono text-[16px] font-semibold text-text">{children}</span>
  );
}
