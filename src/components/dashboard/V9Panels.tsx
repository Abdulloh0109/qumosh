import { Card, CardTitle, StrucRow, Tag, StrucVal } from '../common/Card';
import { ChecklistGrid } from '../common/ChecklistGrid';
import { useSnapshot } from '../../app/hooks';
import {
  detectRiskState,
  getPsychQuote,
  buildPsychChecklist,
} from '../../core/modules/psychology.js';

export function V9DivCard() {
  const snap = useSnapshot();
  const divL = snap.divL;
  const divS = snap.divS;
  const allDivs = [...(divL?.divergences || []), ...(divS?.divergences || [])];
  const stinger = divL?.stinger || divS?.stinger;
  const levels = snap.klL?.levels || snap.klS?.levels;
  const judas = snap.klL?.judas?.detected
    ? snap.klL.judas
    : snap.klS?.judas?.detected
      ? snap.klS.judas
      : null;
  const cur = snap.ind?.close;

  return (
    <Card col={6} color="gold">
      <CardTitle title="v9: Divergence + Key Levels" acc="ICT Bible" />
      <StrucRow name="Divergence">
        {allDivs.length ? (
          (() => {
            const types = [
              ...new Set(allDivs.map((d: any) => d.type.replace('_RSI', '').replace('_MACD', ''))),
            ];
            const dir = allDivs[0].dir;
            return (
              <Tag kind={dir > 0 ? 'tag-good' : 'tag-bad'}>
                {dir > 0 ? '🟢' : '🔴'} {types.join(', ')}
              </Tag>
            );
          })()
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Stinger">
        {stinger ? (
          <Tag kind={stinger.dir > 0 ? 'tag-good' : 'tag-bad'}>🐝 {stinger.type}</Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="PDH/PDL">
        <StrucVal>
          {levels?.pdh && levels?.pdl ? `${levels.pdh.toFixed(1)} / ${levels.pdl.toFixed(1)}` : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="PWH/PWL">
        <StrucVal>
          {levels?.pwh && levels?.pwl ? `${levels.pwh.toFixed(1)} / ${levels.pwl.toFixed(1)}` : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="Midnight Open">
        <StrucVal>
          {levels?.midnightOpen ? (
            <span style={{ color: cur > levels.midnightOpen ? 'var(--green)' : 'var(--red)' }}>
              {levels.midnightOpen.toFixed(1)} {cur > levels.midnightOpen ? '↑' : '↓'}
            </span>
          ) : (
            '—'
          )}
        </StrucVal>
      </StrucRow>
      <StrucRow name="Judas Swing">
        {judas?.detected ? (
          <Tag kind={judas.dir > 0 ? 'tag-good' : 'tag-bad'}>
            ⚔️ {judas.sweptLevel?.name || ''} {judas.dir > 0 ? '↑' : '↓'}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
    </Card>
  );
}

export function V9SmtCard() {
  const snap = useSnapshot();
  const smt = snap.smtAmdL?.smt?.divergences?.length
    ? snap.smtAmdL.smt
    : snap.smtAmdS?.smt?.divergences?.length
      ? snap.smtAmdS.smt
      : null;
  const amd = snap.smtAmdL?.amd || snap.smtAmdS?.amd;
  const blocksL = snap.blocksL;
  const blocksS = snap.blocksS;
  const breaker = blocksL?.breakers?.activeBull || blocksS?.breakers?.activeBear;
  const breakerIsBull = !!blocksL?.breakers?.activeBull;
  const rejL = blocksL?.rejections?.bullishRejections || [];
  const rejS = blocksS?.rejections?.bearishRejections || [];
  const recentRej = [
    ...rejL.filter((r: any) => r.age <= 3),
    ...rejS.filter((r: any) => r.age <= 3),
  ];
  const rejIsBull = rejL.length > 0;

  const riskState = snap.ind ? detectRiskState() : null;
  const quote = snap.ind ? getPsychQuote() : null;

  return (
    <Card col={6} color="purple">
      <CardTitle title="v9: SMT + AMD + Blocks + 🧠" acc="ICT + Psych" />
      <StrucRow name="SMT Divergence">
        {smt?.strongest ? (
          <Tag kind={smt.strongest.dir > 0 ? 'tag-good' : 'tag-bad'}>
            {smt.strongest.pair}: {smt.strongest.dir > 0 ? '↑' : '↓'}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="AMD Day Type">
        {amd ? (
          <Tag kind={amd.dir > 0 ? 'tag-good' : amd.dir < 0 ? 'tag-bad' : 'tag-neut'}>
            {amd.day || '—'}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Breaker Block">
        {breaker ? (
          <Tag kind={breakerIsBull ? 'tag-good' : 'tag-bad'}>
            📦 {breakerIsBull ? 'BULL' : 'BEAR'} {breaker.top.toFixed(1)}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Rejection Block">
        {recentRej.length ? (
          <Tag kind={rejIsBull ? 'tag-good' : 'tag-bad'}>🕯 {rejIsBull ? 'BULL' : 'BEAR'} wick</Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Psych State">
        {riskState ? (
          <Tag
            kind={
              riskState.state === 'NORMAL'
                ? 'tag-good'
                : ['REVENGE_RISK', 'DRAWDOWN'].includes(riskState.state)
                  ? 'tag-bad'
                  : 'tag-neut'
            }
          >
            {riskState.state}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Quote">
        <span
          className="text-right font-mono text-[16px] font-bold"
          style={{ fontSize: 14, fontStyle: 'italic' }}
        >
          {quote ? `"${quote.en}" — ${quote.author}` : '—'}
        </span>
      </StrucRow>
    </Card>
  );
}

export function V9PsychList() {
  useSnapshot();
  let data: { items: any[]; warnings: string[]; state: string } = {
    items: [],
    warnings: [],
    state: '—',
  };
  try {
    data = buildPsychChecklist();
  } catch {
    /* not ready */
  }
  return (
    <Card col={12}>
      <CardTitle title="v9: Pre-Entry Checklist (Mark Douglas + Falcon FX)" acc={data.state} />
      {data.warnings.length > 0 && (
        <div
          style={{
            background: '#7a2f2f',
            color: '#fff',
            padding: 8,
            borderRadius: 6,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          {data.warnings.join(' · ')}
        </div>
      )}
      <ChecklistGrid items={data.items} placeholder="Битимлар бошлangach to'lади..." />
    </Card>
  );
}
