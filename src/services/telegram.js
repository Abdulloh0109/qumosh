import { CFG, ST } from '../core/state.js';
import { fmtPx, log } from '../core/utils.js';
import { PATTERN_NAMES } from '../core/filters.js';

// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Telegram алертлар
// Globals: tgSend, tgSendEntry, tgSendTP, tgSendSL
// ═══════════════════════════════════════════════════════════════════

// ─── TELEGRAM ────────────────────────────────────────────────────────
async function tgSend(text) {
  if (!CFG.tgEnabled || !CFG.tgToken || !CFG.tgChat) return;
  try {
    await fetch(`https://api.telegram.org/bot${CFG.tgToken}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:CFG.tgChat, text, parse_mode:'HTML'}),
    });
    log('TG', '📤 юборилди');
  } catch (e) { log('ERR', '❌ TG', e.message || ''); }
}

function tgSendEntry() {
  if (!ST.snap) return;
  const s = ST.snap;
  const dir = s.isLong ? '🟢 BUY' : '🔴 SELL';

  // News mode special header
  if (s.newsMode) {
    const nm = s.newsMode;
    const eventName = nm.event ? nm.event.name : 'News Event';
    const actual = nm.event?.actual || '?';
    const forecast = nm.event?.forecast || '?';
    const surprise = nm.event ? '' : '';
    const newsTxt = `📰⚡ <b>NEWS-DRIVEN ${dir}</b> XAUUSD — ${s.tier}
━━━━━━━━━━━━
📰 <b>${eventName}</b>
📊 Actual: <b>${actual}</b> vs Forecast: <b>${forecast}</b>
🎯 Surprise: ${nm.newsScore > 0 ? '🟢' : '🔴'} ${nm.newsScore.toFixed(0)} (${nm.newsScore > 0 ? 'BULLISH' : 'BEARISH'} XAU)
━━━━━━━━━━━━
📊 Combined Score: <b>${nm.combined}/100</b>
├─ News (50%): ${nm.newsComponent}
└─ Tech (50%): ${nm.techComponent}
💰 Риск: <b>${s.risk}%</b>
🌀 Регим: ${s.regime}
⚖️ ${s.pdZone} (${(s.pdPos*100).toFixed(0)}%)
━━━━━━━━━━━━
🎯 Entry: <code>${fmtPx(s.entry)}</code>
🔴 SL: <code>${fmtPx(s.sl)}</code>
🟢 TP1: <code>${fmtPx(s.tp1)}</code> (${CFG.qtyTP1}%)
🟢 TP2: <code>${fmtPx(s.tp2)}</code> (${CFG.qtyTP2}%)
🟢 TP3: <code>${fmtPx(s.tp3)}</code> (${CFG.qtyTP3}%)
━━━━━━━━━━━━
⚠ <i>News mode — кенг spread кутинг</i>
🤖 QUMASH v7 NEWS`;
    tgSend(newsTxt);
    return;
  }

  // Normal mode
  const patLine = s.candlestickPattern && typeof PATTERN_NAMES !== 'undefined'
    ? `\n🕯 Pattern: ${PATTERN_NAMES[s.candlestickPattern] || s.candlestickPattern}` : '';
  const fvgLine = s.fvgInfo
    ? `\n📦 FVG ${s.fvgInfo.type === 'bull' ? '🟢' : '🔴'}: ${fmtPx(s.fvgInfo.bot)}-${fmtPx(s.fvgInfo.top)}` : '';
  const htfLine = (s.htfEngBull && s.isLong) || (s.htfEngBear && !s.isLong)
    ? `\n🔄 HTF Engulfing: ✓ tasdiq` : '';
  const rrLine = s.rrEffective ? `\n📐 R:R = 1:${s.rrEffective} (${s.slType})` : '';
  const trigLine = s.triggers && s.triggers.length ? `\n⚡ Triggers: <b>${s.triggers.join(' + ')}</b>` : '';
  // ⭐ v8 metadata line
  let v8Line = '';
  if (s.v8) {
    const parts = [];
    if (s.v8.ttradesSwing) parts.push(`TTrades ${s.v8.ttradesSwing}${s.v8.cisdConfirmed ? '✓CISD' : ''}`);
    if (s.v8.dailyProfile && s.v8.dailyProfile !== 'PENDING') parts.push(s.v8.dailyProfile);
    if (s.v8.compression) parts.push('Compression');
    if (s.v8.qmr) parts.push('QMR');
    if (s.v8.hlqStrength > 0) parts.push(`HLQ×${s.v8.hlqStrength}`);
    if (s.v8.riskRegime && s.v8.riskRegime !== 'NEUTRAL') parts.push(s.v8.riskRegime);
    if (parts.length) v8Line = `\n🎯 v8: ${parts.join(' · ')}`;
  }
  // ⭐ v9 metadata line (ICT Bible + Divergence + SMT + AMD + Blocks)
  let v9Line = '';
  if (s.v9) {
    const parts = [];
    if (s.v9.divergence && s.v9.divergence.length) parts.push(`Div ${s.v9.divergence.join('+')}`);
    if (s.v9.stinger) parts.push(`🐝 ${s.v9.stinger}`);
    if (s.v9.atKeyLevel) parts.push(`@${s.v9.atKeyLevel}`);
    if (s.v9.judas) parts.push(`⚔️ Judas·${s.v9.judasSwept || ''}`);
    if (s.v9.smtPairs && s.v9.smtPairs.length) parts.push(`SMT ${s.v9.smtPairs.join('+')}`);
    if (s.v9.amdDay) parts.push(`AMD ${s.v9.amdDay}`);
    if (s.v9.breaker) parts.push(`Breaker`);
    if (parts.length) v9Line = `\n🔥 v9: ${parts.join(' · ')}`;
  }
  // ⭐ v10 metadata line (Chart Patterns + Fibonacci + Inducement)
  let v10Line = '';
  if (s.v10) {
    const parts = [];
    if (s.v10.chartPatterns && s.v10.chartPatterns.length) parts.push(`📐 ${s.v10.chartPatterns.join('+')}`);
    if (s.v10.fibZone != null) parts.push(`📏 Fib ${s.v10.fibZone.toFixed(0)}%`);
    if (s.v10.fibTarget != null) parts.push(`→${s.v10.fibTarget.toFixed(0)}%`);
    if (s.v10.algoCandle) parts.push(`🎯 ${s.v10.algoCandle}`);
    if (s.v10.idm) parts.push(`⚡ ${s.v10.idm}`);
    if (parts.length) v10Line = `\n📐 v10: ${parts.join(' · ')}`;
  }
  // ⭐ v11 metadata line (Trendline + Volume + Gap + MTV)
  let v11Line = '';
  if (s.v11) {
    // News-Driven signal — most prominent line
    const parts = [];
    if (s.v11.eventName) parts.push(`📰 ${s.v11.eventName}`);
    if (s.v11.strength) parts.push(s.v11.strength);
    if (s.v11.retracePct != null) parts.push(`Fib ${s.v11.retracePct}%`);
    if (s.v11.bonus != null) parts.push(`+${s.v11.bonus}`);
    if (parts.length) v11Line = `\n🔥📰 v11 NEWS-DRIVEN: ${parts.join(' · ')}`;
  }
  // ⭐ v12: Override hierarchy info + News phase
  let v12Line = '';
  const v12Parts = [];
  if (s.overrideApplied && CFG.overrideShowLevel) {
    v12Parts.push(`🟢 OVERRIDE L${s.overrideApplied.level}: ${s.overrideApplied.why} (was: ${s.overrideApplied.originalGate})`);
  }
  if (s.newsPhase === 2) {
    v12Parts.push(`📰 Phase 2 (T+5..T+15) — faqat NEWS_DRIVEN`);
  } else if (s.newsPhase === 3) {
    v12Parts.push(`📰 Phase 3 (T+15..T+45) — news+tech ҳаммаси`);
  }
  if (v12Parts.length) v12Line = '\n' + v12Parts.map(p => '🟢 v12: ' + p).join('\n');
  const tpSrcLine = s.tpSource && s.tpSource !== 'ATR' ? `\n🎯 TP манбаси: ${s.tpSource}` : '';
  const txt = `${dir} <b>XAUUSD</b> — ${s.tier}
━━━━━━━━━━━━
📊 Score: <b>${s.score.toFixed(0)}/100</b>
💰 Риск: <b>${s.risk}%</b>${trigLine}
🌀 Регим: ${s.regime}
🔄 SMC: ${s.structEvent}
📦 OB: ${s.obActive}
📐 OTE: ${s.inOTE}
💧 ${s.sweep}
📊 DXY: ${s.corrVerdict}
⚖️ ${s.pdZone} (${(s.pdPos*100).toFixed(0)}%)${patLine}${fvgLine}${htfLine}${rrLine}${v8Line}${v9Line}${v10Line}${v11Line}${v12Line}${tpSrcLine}
━━━━━━━━━━━━
🎯 Entry: <code>${fmtPx(s.entry)}</code>
🔴 SL: <code>${fmtPx(s.sl)}</code>
🟢 TP1: <code>${fmtPx(s.tp1)}</code> (${CFG.qtyTP1}%)
🟢 TP2: <code>${fmtPx(s.tp2)}</code> (${CFG.qtyTP2}%)
🟢 TP3: <code>${fmtPx(s.tp3)}</code> (${CFG.qtyTP3}%)
━━━━━━━━━━━━
🤖 QUMASH v7 REVERSAL HUNTER`;
  tgSend(txt);
}

function tgSendTP(n, price) {
  const txt = `✅ <b>TP${n} урилди!</b>\n🎯 ${fmtPx(price)}\n${n===1?'🛡 BE':n===2?'↗ Trail':'🏆 ТЎЛИҚ'}\n🤖 QUMASH`;
  tgSend(txt);
}
function tgSendSL(price, wasBE) {
  const txt = wasBE ? `🛡 <b>BE SL</b>\n🎯 ${fmtPx(price)}\n🤖 QUMASH` : `🛑 <b>STOP LOSS</b>\n🎯 ${fmtPx(price)}\n🤖 QUMASH`;
  tgSend(txt);
}

export { tgSend, tgSendEntry, tgSendTP, tgSendSL };
