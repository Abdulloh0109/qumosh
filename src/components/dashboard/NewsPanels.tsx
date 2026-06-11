import { useState } from 'react';
import { Card, CardTitle } from '../common/Card';
import { useTopic } from '../../store/useTopic';
import { CAL, buildCalendar, buildAnalysisHtml } from '../../core/calendar.js';
import { refreshNewsUI } from '../../store/uiState.js';
import { cx } from '../../app/cx';

const NEWS_LIST = 'flex flex-col gap-1 max-h-[380px] overflow-y-auto';
const NEWS_EMPTY = 'py-2 text-center text-[16px] text-mute';

const NEWS_ROW_BASE =
  'flex flex-col px-[10px] py-2 bg-white/[0.022] rounded-[7px] border-l-[3px] border-l-mute transition-all duration-150 cursor-pointer hover:bg-white/[0.04]';
const IMPACT: Record<string, string> = {
  high: 'border-l-red',
  med: 'border-l-orange',
  low: 'border-l-mute',
};
const STATE: Record<string, string> = {
  imminent: 'bg-red/[0.08] animate-[pulse-alert_2s_infinite]',
  passed: 'opacity-[0.55]',
  expanded: 'bg-cyan/[0.06] border-l-cyan border-l-4',
};

const NEWS_IMPACT_BASE =
  'px-[5px] py-[1.5px] rounded-[3px] text-[16px] font-extrabold tracking-[1px] shrink-0';
const NEWS_IMPACT: Record<string, string> = {
  high: 'bg-red/[0.18] text-red',
  med: 'bg-orange/[0.18] text-orange',
  low: 'bg-[#4a5a72]/[0.25] text-dim',
};

const IMP_ROW_BASE =
  'flex items-center gap-[9px] px-[10px] py-[7px] bg-white/[0.022] rounded-[7px] border-l-[3px] border-l-mute';
const IMP_DIR: Record<string, string> = {
  up: 'border-l-green',
  dn: 'border-l-red',
  flat: 'border-l-dim',
};
const IMP_SWING_BASE = 'font-mono text-[16px] font-extrabold px-[6px] py-[2px] rounded-[4px]';
const IMP_SWING_DIR: Record<string, string> = {
  up: 'text-green bg-green/10',
  dn: 'text-red bg-red/10',
  flat: 'text-dim bg-[#4a5a72]/[0.15]',
};

function formatWhen(ms: number): string {
  if (ms < 0) {
    const m = Math.floor(-ms / 60000);
    return m < 60 ? `${m}min oldin` : `${Math.floor(m / 60)}s oldin`;
  }
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return hrs > 0 ? `${hrs}s ${mins}m` : `${mins}min keyin`;
}

export function NewsForecast() {
  useTopic('news');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const now = Date.now();
  const today = new Date();
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const todayEnd = todayStart + 86400000;
  const events = (CAL.events as any[]).filter((e) => {
    const t = e.date.getTime();
    return t >= todayStart && t < todayEnd;
  });

  const srcLabel =
    CAL.source === 'forexfactory' ? `🟢 FF · ${events.length}` : `🟡 pattern · ${events.length}`;

  const refresh = async () => {
    setLoading(true);
    await buildCalendar();
    refreshNewsUI();
    setLoading(false);
  };

  return (
    <Card col={4} color="red">
      <CardTitle title="YANGILIKLAR PROGNOZI" acc={srcLabel} />
      <div className={NEWS_LIST}>
        {events.length === 0 ? (
          <div className={NEWS_EMPTY}>
            Bugun voqea yoʻq
            {CAL.source === 'pattern' ? ' (pattern rejim — 🔄 bosib sinab koʻring)' : ''}
          </div>
        ) : (
          events.map((ev) => {
            const ms = ev.date.getTime() - now;
            const past = ms < 0;
            const imminent = ms > 0 && ms < 30 * 60 * 1000;
            const cls = imminent ? 'imminent' : past ? 'passed' : '';
            const tm = ev.date.toISOString().slice(11, 16);
            const key = `${ev.name}_${ev.date.getTime()}`;
            const isExpanded = expandedKey === key;
            return (
              <div
                key={key}
                className={cx(
                  NEWS_ROW_BASE,
                  IMPACT[ev.impact],
                  cls && STATE[cls],
                  isExpanded && STATE.expanded,
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.news-detail')) return;
                  setExpandedKey(isExpanded ? null : key);
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="w-[62px] shrink-0 font-mono text-[16px] leading-[1.3] text-dim">
                    <span className="block text-[16px] font-bold text-cyan">{formatWhen(ms)}</span>
                    {tm} UTC
                  </div>
                  <div className="flex-1 text-[16px] leading-[1.35] font-semibold text-[#e2e8f0]">
                    <div>
                      {ev.name}
                      <span className="ml-[5px] font-mono text-[16px] tracking-[1px] text-mute">
                        {ev.currency}
                      </span>{' '}
                      <span style={{ color: 'var(--cyan)', fontSize: 14, marginLeft: 4 }}>
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>
                    {ev.desc && (
                      <div className="mt-[3px] text-[16px] leading-[1.35] font-normal text-dim">
                        {ev.desc}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-[10px] font-mono text-[16px] text-mute [&_b]:font-bold [&_b]:text-cyan">
                      <span>
                        Prognoz: <b>{ev.forecast || '—'}</b>
                      </span>
                      <span>
                        Oldingi: <b>{ev.previous || '—'}</b>
                      </span>
                    </div>
                  </div>
                  <div className={cx(NEWS_IMPACT_BASE, NEWS_IMPACT[ev.impact])}>
                    {ev.impact.toUpperCase()}
                  </div>
                </div>
                {isExpanded && <div dangerouslySetInnerHTML={{ __html: buildAnalysisHtml(ev) }} />}
              </div>
            );
          })
        )}
      </div>
      <div
        className="mt-[7px] cursor-pointer rounded-[7px] border border-dashed border-cyan/25 bg-cyan/[0.05] p-[7px] text-center text-[16px] font-bold tracking-[1px] text-cyan transition-all duration-150 hover:bg-cyan/10"
        title="ForexFactory'dan qayta yuklash"
        onClick={refresh}
      >
        {loading ? '⏳ Yuklanmoqda...' : '🔄 Yangiliklarni yangilash'}
      </div>
    </Card>
  );
}

export function PastEvents() {
  useTopic('news');
  const past = CAL.past as any[];
  return (
    <Card col={3}>
      <CardTitle title="OʻTGAN VOQEALAR" acc={past.length} />
      <div className={NEWS_LIST}>
        {past.length === 0 ? (
          <div className={NEWS_EMPTY}>Voqea kutilmoqda</div>
        ) : (
          past.slice(0, 8).map((p, i) => {
            const dirIcon = p.direction === 'up' ? '↑' : p.direction === 'dn' ? '↓' : '═';
            return (
              <div key={i} className={cx(IMP_ROW_BASE, IMP_DIR[p.direction])}>
                <div className="w-[48px] shrink-0 font-mono text-[16px] text-dim">{p.dateTxt}</div>
                <div className="flex-1 text-[16px] font-semibold text-[#cbd5e1]">{p.name}</div>
                <div className={cx(IMP_SWING_BASE, IMP_SWING_DIR[p.direction])}>
                  {dirIcon}±${p.swing.toFixed(1)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
