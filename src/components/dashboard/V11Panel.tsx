import { Card, CardTitle, StrucRow, Tag, StrucVal } from '../common/Card';
import { useSnapshot } from '../../app/hooks';
import { NEWS_REACTIONS } from '../../core/modules/newsDriven.js';

export function V11Panel() {
  const snap = useSnapshot();
  const activeList: any[] = NEWS_REACTIONS?.active || [];
  const ndL = snap.ndL;
  const ndS = snap.ndS;

  // Status badge
  let statusText = '—';
  let statusKind = 'tag-neut';
  if (activeList.length > 0) {
    if ((ndL?.score || 0) > 0 || (ndS?.score || 0) > 0) {
      statusText = `ФАОЛ ${ndL?.active ? '↑' : ''}${ndS?.active ? '↓' : ''}`;
      statusKind = (ndL?.score || 0) > 0 ? 'tag-good' : 'tag-bad';
    } else {
      statusText = `${activeList.length} кутинг`;
      statusKind = 'tag-warn';
    }
  }

  const nd = ndL?.active ? ndL : ndS?.active ? ndS : null;
  const r = nd?.retracement;
  const bonusText =
    (ndL?.score || 0) > 0 ? `+${ndL.score}↑` : (ndS?.score || 0) > 0 ? `+${ndS.score}↓` : '—';
  const bonusKind =
    (ndL?.score || 0) > 0 ? 'tag-good' : (ndS?.score || 0) > 0 ? 'tag-bad' : 'tag-neut';

  return (
    <Card col={12} padStyle={{ border: '2px solid var(--gold)' }}>
      <CardTitle
        title="v11: ЯНГИЛИК АСОСИДА СИГНАЛ"
        acc={<Tag kind={statusKind}>{statusText}</Tag>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
        <div>
          <div style={{ fontSize: 14, color: 'var(--mute)', marginBottom: 4 }}>
            ⏳ ФАОЛ ЯНГИЛИК РЕАКЦИЯЛАРИ:
          </div>
          <div style={{ minHeight: 40 }}>
            {activeList.length === 0 ? (
              <div style={{ color: 'var(--mute)', fontSize: 14, padding: 4 }}>
                Кучли янгилик кутилмоқда...
              </div>
            ) : (
              activeList.map((a, i) => {
                const evName = (a.event.name || a.event.title || 'News').slice(0, 18);
                const ageMin = Math.floor(
                  (Date.now() - new Date(a.event.dateTime || a.event.time).getTime()) / 60000,
                );
                return (
                  <div
                    key={i}
                    style={{
                      padding: '4px 6px',
                      background: 'var(--bg2)',
                      borderRadius: 4,
                      margin: '2px 0',
                      fontSize: 14,
                    }}
                  >
                    {evName} ({a.strength.slice(0, 6)}, {ageMin}m, {a.direction > 0 ? '↑' : '↓'})
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div>
          <StrucRow name="Retracement">
            {r ? (
              <Tag kind={r.ready ? 'tag-good' : 'tag-warn'}>
                {r.ready ? `READY ${r.currentRetracePct}%` : `${r.currentRetracePct}%`}
              </Tag>
            ) : (
              <Tag>—</Tag>
            )}
          </StrucRow>
          <StrucRow name="Fib 50/61.8 даражалари">
            <StrucVal>
              {r ? `Fib50 ${r.fib50.toFixed(1)} · Fib618 ${r.fib618.toFixed(1)}` : '—'}
            </StrucVal>
          </StrucRow>
          <StrucRow name="Янгилик бонуси">
            <Tag kind={bonusKind}>{bonusText}</Tag>
          </StrucRow>
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          padding: 6,
          background: 'var(--bg2)',
          borderRadius: 4,
          fontSize: 14,
          color: 'var(--mute)',
          lineHeight: 1.5,
        }}
      >
        🔄 <b>Жараён:</b> 🔴 USD янгилиги чиқади → 5 мин кутамиз → реакция кучи (ATR×2 = STRONG) →
        50-61.8% Fib retracement'да кириш → T+45 мин сетап эскиради.
        <br />
        🎁 STRONG реакция = <b>+20 балл бонус</b>, MILD реакция = +12.
      </div>
    </Card>
  );
}
