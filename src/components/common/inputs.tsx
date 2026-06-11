import type { ReactNode } from 'react';

const FIELD_INPUT =
  'w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 font-mono text-[16px] text-text transition focus:border-cyan/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan/20';
const FIELD_LABEL = 'mb-[5px] block text-[16px] font-bold uppercase tracking-[0.5px] text-dim';

interface ToggleProps {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled row with a sliding on/off switch. */
export function Toggle({ id, label, checked, onChange }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3.5 py-[11px] transition hover:border-cyan/30 hover:bg-white/[0.05]"
    >
      <span className="text-[16px] text-[#cbd5e1]">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-[22px] w-[40px] rounded-full bg-white/[0.12] transition-colors duration-200 peer-checked:bg-[linear-gradient(135deg,var(--color-cyan),var(--color-blue))] peer-focus-visible:ring-2 peer-focus-visible:ring-cyan/40" />
        <span className="pointer-events-none absolute top-1/2 left-[3px] h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-[18px]" />
      </span>
    </label>
  );
}

interface Option {
  value: string | number;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string | number;
  options: Option[];
  onChange: (value: string) => void;
}

/** A labelled `<select>`. */
export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <div className="mb-[11px]">
      <label className={FIELD_LABEL}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_INPUT}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  placeholder?: string;
}

/** A labelled text/password input. */
export function TextField({ label, value, onChange, type = 'text', placeholder }: TextFieldProps) {
  return (
    <div className="mb-[11px]">
      <label className={FIELD_LABEL}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT}
      />
    </div>
  );
}

interface SessChkProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/** A checkbox chip used in the regime/session grids. */
export function SessChk({ checked, onChange, children }: SessChkProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.025] px-2.5 py-[7px] transition hover:border-cyan/30 hover:bg-cyan/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer m-0 cursor-pointer"
      />
      <span className="peer-checked:text-cyan">{children}</span>
    </label>
  );
}
