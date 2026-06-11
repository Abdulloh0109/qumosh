import { useEffect, useRef } from 'react';
import { Card, CardTitle } from '../common/Card';
import { useLogs } from '../../app/hooks';

// Muted log-type accents (match the fintech theme tokens).
const COLORS: Record<string, string> = {
  SIG: '#3ad29a',
  ERR: '#f06a72',
  WS: '#56bce0',
  INFO: '#7f8a9e',
  FILT: '#9a8cf5',
  TG: '#56bce0',
  EXIT: '#e0a23b',
  WARN: '#e0a23b',
  ADAPT: '#e25fa0',
  NEWS: '#56bce0',
  MTF: '#9a8cf5',
  BT: '#7f8a9e',
};

export function LogPanel() {
  const logs = useLogs();
  const paneRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines (was el.scrollTop = el.scrollHeight).
  useEffect(() => {
    const el = paneRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <Card col={4}>
      <CardTitle title="LOG" acc={logs.length} />
      <div
        className="h-60 overflow-y-auto rounded-lg border border-white/[0.05] bg-black/[0.18] px-3 py-2 font-mono text-[16px] leading-[1.55]"
        ref={paneRef}
      >
        {logs.map((l, i) => (
          <div key={i} className="py-[1.5px] text-text2">
            <span className="text-mute">[{l.ts}]</span>{' '}
            <span className="font-bold" style={{ color: COLORS[l.typ] || '#7f8a9e' }}>
              [{l.typ}]
            </span>{' '}
            {l.msg}
            {l.extra ? <span className="text-mute"> {l.extra}</span> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
