import { Card, CardTitle, StrucRow, Tag, StrucVal } from '../common/Card';
import { ChecklistGrid } from '../common/ChecklistGrid';
import { useSnapshot, st, cfg } from '../../app/hooks';
import { detectWeeklyNarrative } from '../../core/modules/dailyProfile.js';
import { buildDailyChecklist } from '../../core/modules/macroContext.js';

export function V8TtCard() {
  const snap = useSnapshot();
  const tt = snap.ttrades;
  const dp = snap.dailyProfileL?.profile || snap.dailyProfileS?.profile;

  let weekly = '—';
  if (st.candles && st.candles.length > 200) {
    weekly = detectWeeklyNarrative(st.candles).why || '—';
  }

  return (
    <Card col={6} color="gold">
      <CardTitle title="v8: TTrades + Daily Profile" acc="PDF'лардан" />
      <StrucRow name="TTrades Swing">
        {tt?.swing ? (
          <Tag kind={tt.dir > 0 ? 'tag-good' : 'tag-bad'}>
            {tt.dir > 0 ? '🟢↑' : '🔴↓'} {tt.swing.type}{' '}
            <small>({tt.swing._tf === 'HTF' ? 'HTF' : 'LTF'})</small>
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="✓ CISD">
        {tt?.cisd ? (
          <Tag kind={tt.cisd.confirmed ? 'tag-good' : 'tag-neut'}>
            {tt.cisd.confirmed ? `✓ ${tt.cisd.why}` : tt.cisd.why}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Target -2 / -4">
        <StrucVal>
          {tt?.targets?.t2 ? `${tt.targets.t2.toFixed(1)} / ${tt.targets.t4.toFixed(1)}` : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="London диапазон">
        <StrucVal>
          {dp?.londonRange
            ? `${dp.londonRange.low.toFixed(1)}-${dp.londonRange.high.toFixed(1)} (${dp.londonRange.rangeSize.toFixed(1)})`
            : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="Daily Profile">
        {dp ? (
          <Tag
            kind={
              dp.profile === 'LONDON_REVERSAL' || dp.profile === 'NY_REVERSAL'
                ? 'tag-good'
                : dp.profile === 'EXPANSION'
                  ? 'tag-bad'
                  : 'tag-neut'
            }
          >
            {dp.profile}
            {dp.dir > 0 ? ' ↑' : dp.dir < 0 ? ' ↓' : ''}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Hafta narrative">
        <StrucVal>{weekly}</StrucVal>
      </StrucRow>
    </Card>
  );
}

export function V8ChlCard() {
  const snap = useSnapshot();
  const chL = snap.chlL;
  const chS = snap.chlS;
  const comp = chL?.compression?.detected
    ? chL.compression
    : chS?.compression?.detected
      ? chS.compression
      : null;
  const hlq = chL?.hlq || chS?.hlq;
  const qmr = chL?.qmr?.detected ? chL.qmr : chS?.qmr?.detected ? chS.qmr : null;
  const macroAny = snap.macroL?.risk || snap.macroS?.risk;
  const mondayDow = new Date().getUTCDay() === 1;

  return (
    <Card col={6} color="purple">
      <CardTitle title="v8: Compression + HLQ + QMR + Macro" acc="SMC+Macro" />
      <StrucRow name="Compression">
        {comp ? <Tag kind={comp.dir > 0 ? 'tag-good' : 'tag-bad'}>{comp.why}</Tag> : <Tag>—</Tag>}
      </StrucRow>
      <StrucRow name="HLQ zones">
        <StrucVal>
          {hlq?.zones?.length
            ? `${hlq.zones.length} зона (${hlq.zones
                .map((z: any) => z.sources.join('+'))
                .slice(0, 2)
                .join(', ')})`
            : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="QMR pattern">
        {qmr ? <Tag kind={qmr.dir > 0 ? 'tag-good' : 'tag-bad'}>{qmr.why}</Tag> : <Tag>—</Tag>}
      </StrucRow>
      <StrucRow name="Risk Regime">
        {macroAny ? (
          <Tag
            kind={
              macroAny.regime === 'RISK_OFF'
                ? 'tag-good'
                : macroAny.regime === 'RISK_ON'
                  ? 'tag-bad'
                  : 'tag-neut'
            }
          >
            {macroAny.regime} ({macroAny.score.toFixed(2)})
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Macro bias">
        <StrucVal>{macroAny?.why || '—'}</StrucVal>
      </StrucRow>
      <StrucRow name="Monday rule">
        {mondayDow ? (
          <Tag kind={cfg.mondayBlock ? 'tag-bad' : 'tag-neut'}>
            {cfg.mondayBlock ? '🚫 АКТИВ (T2 блок)' : 'Monday — кузатинг'}
          </Tag>
        ) : (
          <Tag kind="tag-good">Monday эмас</Tag>
        )}
      </StrucRow>
    </Card>
  );
}

export function V8Checklist() {
  useSnapshot();
  let items: any[] = [];
  try {
    items = buildDailyChecklist();
  } catch {
    items = [];
  }
  const bull = items.filter((i) => i.signal === 'bull').length;
  const bear = items.filter((i) => i.signal === 'bear').length;
  const acc = `🟢${bull} 🔴${bear} ⚪${items.length - bull - bear}`;

  return (
    <Card col={12}>
      <CardTitle
        title="v8: Kunlik 10 ta tekshiruv (Kathy Lien + TTrades)"
        acc={items.length ? acc : '—'}
      />
      <ChecklistGrid items={items} placeholder="Tizim ишга tushgandан кейин avtomatik to'lади..." />
    </Card>
  );
}
