import { Card, CardTitle, StrucRow, Tag, StrucVal } from '../common/Card';
import { useSnapshot } from '../../app/hooks';

export function V10PatternCard() {
  const snap = useSnapshot();
  const cpAll = [...(snap.cpL?.matching || []), ...(snap.cpS?.matching || [])];
  const firstWithDir = cpAll.find((p: any) => p.dir !== 0);
  const p = firstWithDir || cpAll[0];
  const fib = snap.fibL?.fib || snap.fibS?.fib;
  const zone = snap.fibL?.activeZone || snap.fibS?.activeZone;
  const ext = snap.fibL?.nearestExt || snap.fibS?.nearestExt;

  return (
    <Card col={6} color="gold">
      <CardTitle title="v10: График шакллар + Фибоначчи" acc="Классик TA" />
      <StrucRow name="График шакл">
        {cpAll.length ? (
          (() => {
            const types = [...new Set(cpAll.map((x: any) => x.type))];
            const dir = firstWithDir?.dir || 0;
            return (
              <Tag kind={dir > 0 ? 'tag-good' : dir < 0 ? 'tag-bad' : 'tag-neut'}>
                {types.join(', ')}
              </Tag>
            );
          })()
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Кириш/SL/Мақсад">
        <StrucVal>
          {p && p.entry != null && p.target != null
            ? `E:${p.entry.toFixed(1)} SL:${p.sl ? p.sl.toFixed(1) : '—'} TP:${p.target.toFixed(1)}`
            : '—'}
        </StrucVal>
      </StrucRow>
      <StrucRow name="Fib зонаси">
        {fib && zone ? (
          <Tag kind={zone.pct >= 50 && zone.pct <= 78.6 ? 'tag-good' : 'tag-neut'}>
            {zone.pct.toFixed(1)}% @ {zone.price.toFixed(1)}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Fib кенгайтма">
        <StrucVal>{ext ? `${ext.pct.toFixed(1)}% → ${ext.price.toFixed(1)}` : '—'}</StrucVal>
      </StrucRow>
    </Card>
  );
}

export function V10IdmCard() {
  const snap = useSnapshot();
  const algo = snap.idmL?.algoCandle || snap.idmS?.algoCandle;
  const idm = snap.idmL?.inducement || snap.idmS?.inducement;
  const lScore = (snap.cpL?.score || 0) + (snap.fibL?.score || 0) + (snap.idmL?.score || 0);
  const sScore = (snap.cpS?.score || 0) + (snap.fibS?.score || 0) + (snap.idmS?.score || 0);

  return (
    <Card col={6} color="purple">
      <CardTitle title="v10: Inducement + Algo Candle" acc="David Woods" />
      <StrucRow name="Algo Candle">
        {algo ? (
          <Tag kind={algo.dir > 0 ? 'tag-good' : 'tag-bad'}>
            {algo.type} {algo.grabsLiq ? '+liq' : ''}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="Inducement (IDM)">
        {idm ? (
          <Tag kind={idm.dir > 0 ? 'tag-good' : 'tag-bad'}>
            {idm.type} @{idm.idmLevel.toFixed(1)}
          </Tag>
        ) : (
          <Tag>—</Tag>
        )}
      </StrucRow>
      <StrucRow name="v10 LONG балл">
        <StrucVal>{lScore.toFixed(0)}</StrucVal>
      </StrucRow>
      <StrucRow name="v10 SHORT балл">
        <StrucVal>{sScore.toFixed(0)}</StrucVal>
      </StrucRow>
    </Card>
  );
}
