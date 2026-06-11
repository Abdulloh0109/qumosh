import { Card, CardTitle, StrucRow, Tag, StrucVal } from '../common/Card';
import { useSnapshot } from '../../app/hooks';
import { cx } from '../../app/cx';

const TAG: Record<string, string> = {
  'tag-up': 'bg-green/[0.18] text-green',
  'tag-dn': 'bg-red/[0.18] text-red',
  'tag-neut': 'bg-mute/25 text-dim',
};

export function StructureCard() {
  const snap = useSnapshot();
  const struct = snap.struct;
  const ob = snap.ob;
  const ote = snap.ote;

  if (!struct || !ob || !ote) {
    return (
      <Card col={3} color="purple">
        <CardTitle title="SMC TUZILMA" acc="—" />
        <div className="py-2 text-center text-[16px] text-mute">Maʼlumot yigʻilmoqda…</div>
      </Card>
    );
  }

  const biasTxt =
    struct.bias === 'up'
      ? '⬆ OʻSISH'
      : struct.bias === 'dn'
        ? '⬇ TUSHISH'
        : struct.bias === 'mixed'
          ? '↔ ARALASH'
          : '—';
  const biasCls = struct.bias === 'up' ? 'tag-up' : struct.bias === 'dn' ? 'tag-dn' : 'tag-neut';
  const lastCls = struct.event
    ? struct.event.startsWith('BOS')
      ? 'tag-bos'
      : struct.event.startsWith('CHoCH')
        ? 'tag-choch'
        : 'tag-mix'
    : 'tag-neut';

  // MTF (dominant side)
  const mtfL = snap.mtfLong;
  const mtfS = snap.mtfShort;
  let mtfTxt = '—';
  let mtfCls = 'tag-neut';
  let mtfTitle = '';
  if (mtfL && mtfS) {
    const lScore = snap.scoreL?.score ?? 0;
    const sScore = snap.scoreS?.score ?? 0;
    const dominant = lScore >= sScore ? mtfL : mtfS;
    const side = lScore >= sScore ? 'LONG' : 'SHORT';
    mtfTxt = `${dominant.aligned ? '✓' : '✗'} ${(dominant.score * 100).toFixed(0)}%${dominant.reason ? ` · ${dominant.reason.slice(0, 30)}` : ''}`;
    mtfCls = dominant.aligned ? 'tag-up' : 'tag-dn';
    mtfTitle = `${side}: ${dominant.reason}`;
  }

  return (
    <Card col={3} color="purple">
      <CardTitle title="SMC TUZILMA" acc={struct.event || '—'} />
      <StrucRow name="Moyillik">
        <Tag kind={biasCls}>{biasTxt}</Tag>
      </StrucRow>
      <StrucRow name="Soʻnggi voqea">
        <Tag kind={lastCls}>{struct.event || '—'}</Tag>
      </StrucRow>
      <StrucRow name="OB Bull">
        <StrucVal>
          {ob.activeBull ? `${ob.activeBull.bot.toFixed(2)}-${ob.activeBull.top.toFixed(2)}` : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="OB Bear">
        <StrucVal>
          {ob.activeBear ? `${ob.activeBear.bot.toFixed(2)}-${ob.activeBear.top.toFixed(2)}` : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="OTE zonasi">
        <StrucVal>
          {ote.oteLow !== null && ote.oteHigh !== null
            ? `${ote.oteLow.toFixed(2)}-${ote.oteHigh.toFixed(2)}`
            : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="✓ OTE ichidami?">
        <Tag kind={ote.inOTE ? 'tag-up' : 'tag-neut'}>{ote.inOTE ? '✓ HA' : '✗ YOʻQ'}</Tag>
      </StrucRow>
      <StrucRow name="MTF (HTF)">
        <span
          title={mtfTitle}
          className={cx(
            'rounded px-[7px] py-0.5 text-[16px] font-extrabold tracking-[1px]',
            TAG[mtfCls] ?? TAG['tag-neut'],
          )}
        >
          {mtfTxt}
        </span>
      </StrucRow>
    </Card>
  );
}
