// ═══════════════════════════════════════════════════════════════════
// QUMASH v5 PRO — Япон шамлар графиги + чизма инструментлари
// Globals: chart, candleSeries, drawCanvas, DRAW, activePriceLines
// ═══════════════════════════════════════════════════════════════════

// ─── CANDLESTICK CHART ───────────────────────────────────────────────
let chart = null, candleSeries = null;
let drawCanvas = null, drawCtx = null;

// Drawing state
const DRAW = {
  tool: null,                  // 'trendline' | 'rect' | 'hline' | null
  pendingPoints: [],           // {time, price, x, y}
  shapes: [],                  // saved shapes
  hoverX: null, hoverY: null,  // for preview
  dragging: null,              // {idx, mode, startX, startY, original}
  hoverShapeIdx: -1,           // for cursor change
};

const SHAPE_COLORS = ['#22d3ee', '#fbbf24', '#10b981', '#ef4444', '#a78bfa', '#ec4899'];
let shapeColorIdx = 0;
function nextShapeColor() {
  const c = SHAPE_COLORS[shapeColorIdx % SHAPE_COLORS.length];
  shapeColorIdx++;
  return c;
}

function initChart() {
  if (chart || typeof LightweightCharts === 'undefined') return;
  const container = $('chartContainer');
  if (!container) return;
  try {
    chart = LightweightCharts.createChart(container, {
      autoSize: true,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#94a3b8',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      timeScale: {
        timeVisible: true, secondsVisible: false,
        borderColor: 'rgba(255,255,255,0.1)',
        // Show X-axis labels in user's LOCAL time (not UTC)
        tickMarkFormatter: (time, tickMarkType) => {
          const d = new Date(time * 1000);
          if (tickMarkType === 0) return String(d.getFullYear());
          if (tickMarkType === 1) {
            const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
            return months[d.getMonth()];
          }
          if (tickMarkType === 2) return String(d.getDate());
          // Hour/minute (LOCAL time)
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        },
      },
      // Crosshair tooltip — also LOCAL time
      localization: {
        timeFormatter: (time) => {
          const d = new Date(time * 1000);
          const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
          const day = String(d.getDate()).padStart(2, '0');
          const mon = months[d.getMonth()];
          const yr = String(d.getFullYear()).slice(2);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${day} ${mon} '${yr}  ${hh}:${mm}`;
        },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(34,211,238,0.4)', width: 1, style: 2, labelBackgroundColor: '#22d3ee' },
        horzLine: { color: 'rgba(34,211,238,0.4)', width: 1, style: 2, labelBackgroundColor: '#22d3ee' },
      },
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderUpColor: '#10b981', borderDownColor: '#ef4444',
      wickUpColor: '#10b981', wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    // Drawing canvas REMOVED — was causing chart freeze. Use price lines instead.
    drawCanvas = null;
    drawCtx = null;

    // Subscribe to chart events for redraw
    chart.timeScale().subscribeVisibleTimeRangeChange(() => redrawOverlay());

    // Load saved shapes
    loadShapes();
    log('INFO', '📈 График ишга тушди');
  } catch(e) {
    log('WARN', `⚠️ График фейл: ${e.message?.slice(0, 60)}`);
  }
}

function resizeDrawCanvas() {
  if (!drawCanvas) return;
  const container = $('chartContainer');
  if (!container) return;
  const r = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  drawCanvas.width = r.width * dpr;
  drawCanvas.height = r.height * dpr;
  drawCanvas.style.width = r.width + 'px';
  drawCanvas.style.height = r.height + 'px';
  if (drawCtx) {
    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawCtx.scale(dpr, dpr);
  }
}

function seedChartData() {
  if (!candleSeries || !ST.candles.length) return;
  const data = ST.candles.map(c => ({
    time: c.epoch, open: c.o, high: c.h, low: c.l, close: c.c
  }));
  const seen = new Set();
  const clean = data.filter(d => { if (seen.has(d.time)) return false; seen.add(d.time); return true; })
                    .sort((a,b) => a.time - b.time);
  candleSeries.setData(clean);
  chart.timeScale().fitContent();
  updateChartOHLC();
  redrawOverlay();
  // Restore signal markers + active trade lines
  refreshChartMarkers();
  if (ST.condition !== 0) setActiveTradeLines();
}

function pushChartUpdate(c) {
  if (!candleSeries) return;
  try {
    candleSeries.update({ time: c.epoch, open: c.o, high: c.h, low: c.l, close: c.c });
  } catch(_) {}
  updateChartOHLC();
}

function resetChartForTF() {
  if (!chart || !candleSeries) return;
  candleSeries.setData([]);
  // Don't reset shapes here — user might want them across TF (they get re-projected by time/price)
  redrawOverlay();
}

// ─── SIGNAL VISUALIZATION ON CHART ───────────────────────────────────
let activePriceLines = [];

function clearActivePriceLines() {
  if (!candleSeries) return;
  for (const line of activePriceLines) {
    try { candleSeries.removePriceLine(line); } catch(_) {}
  }
  activePriceLines = [];
}

function setActiveTradeLines() {
  clearActivePriceLines();
  if (!ST.snap || !candleSeries) return;
  const s = ST.snap;
  const isLong = s.isLong;
  const sideTxt = isLong ? 'BUY' : 'SELL';
  const cond = Math.abs(ST.condition);

  // LineStyle: 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted

  // Entry — solid orange, prominent
  activePriceLines.push(candleSeries.createPriceLine({
    price: s.entry, color: '#f59e0b', lineWidth: 2, lineStyle: 0,
    axisLabelVisible: true, title: `◆ ${sideTxt} ${s.tier}`,
  }));

  // SL — red dashed (or dotted+yellow if BE)
  const slIsBE = ST.tradeReachedTP1 && Math.abs(s.entry - ST.slLine) < s.entry * 0.001;
  activePriceLines.push(candleSeries.createPriceLine({
    price: ST.slLine,
    color: slIsBE ? '#fbbf24' : '#ef4444',
    lineWidth: 2, lineStyle: slIsBE ? 1 : 2,
    axisLabelVisible: true, title: slIsBE ? '🛡 BE' : '✗ SL',
  }));

  // TP1 — green dashed (thinner if hit)
  activePriceLines.push(candleSeries.createPriceLine({
    price: s.tp1, color: '#10b981',
    lineWidth: cond >= 1.1 ? 1 : 2, lineStyle: cond >= 1.1 ? 4 : 2,
    axisLabelVisible: true, title: cond >= 1.1 ? '✓ TP1' : '🎯 TP1',
  }));
  // TP2 — green dashed (thinner if hit)
  activePriceLines.push(candleSeries.createPriceLine({
    price: s.tp2, color: '#10b981',
    lineWidth: cond >= 1.2 ? 1 : 2, lineStyle: cond >= 1.2 ? 4 : 2,
    axisLabelVisible: true, title: cond >= 1.2 ? '✓ TP2' : '🎯 TP2',
  }));
  // TP3 — green dashed (always emphasized)
  activePriceLines.push(candleSeries.createPriceLine({
    price: s.tp3, color: '#10b981', lineWidth: 2, lineStyle: 2,
    axisLabelVisible: true, title: '🏆 TP3',
  }));
}

function refreshChartMarkers() {
  if (!candleSeries) return;
  // Only show signals from the CURRENT TF (don't bleed across TFs)
  const items = ST.history
    .filter(h => !h.tf || h.tf === CFG.granularity)  // legacy entries (no tf) shown by default
    .slice(0, 30).reverse();
  const markers = [];
  for (const h of items) {
    if (!h.epoch) continue;
    const isLong = h.side === 'L';
    markers.push({
      time: h.epoch,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isLong ? '#10b981' : '#ef4444',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: `${isLong ? 'BUY' : 'SELL'} ${h.tier}`,
    });
    if (h.exit !== 'live' && h.exitEpoch) {
      let color = '#94a3b8', text = '?';
      if (h.exit === 'tp') { color = '#10b981'; text = '✓'; }
      else if (h.exit === 'sl') { color = '#ef4444'; text = '✗'; }
      else if (h.exit === 'be') { color = '#fbbf24'; text = '='; }
      markers.push({
        time: h.exitEpoch,
        position: isLong ? 'aboveBar' : 'belowBar',
        color,
        shape: 'circle',
        text,
      });
    }
  }
  // Sort by time ASC (Lightweight Charts requires this)
  markers.sort((a, b) => a.time - b.time);
  // Dedupe (rare but safe — same time = merge text)
  const uniq = [];
  let lastKey = null;
  for (const m of markers) {
    const k = m.time + '_' + m.position;
    if (k !== lastKey) { uniq.push(m); lastKey = k; }
  }
  try { candleSeries.setMarkers(uniq); } catch(e) { log('WARN', 'Marker xato: ' + e.message?.slice(0,30)); }
}

function updateChartOHLC() {
  if (!ST.candles.length) return;
  const c = ST.candles[ST.candles.length - 1];
  const prev = ST.candles[ST.candles.length - 2];
  const $o = $('chartO'), $h = $('chartH'), $l = $('chartL'), $cc = $('chartC'), $chg = $('chartChg');
  if (!$o) return;
  $o.textContent = c.o.toFixed(3);
  $h.textContent = c.h.toFixed(3);
  $l.textContent = c.l.toFixed(3);
  $cc.textContent = c.c.toFixed(3);
  if (prev) {
    const d = c.c - prev.c;
    const dpct = (d / prev.c) * 100;
    $chg.classList.remove('up','dn');
    $chg.classList.add(d >= 0 ? 'up' : 'dn');
    $chg.querySelector('b').textContent = (d >= 0 ? '+' : '') + d.toFixed(3) + ' (' + (d >= 0 ? '+' : '') + dpct.toFixed(2) + '%)';
  }
}

// ─── DRAWING TOOLS ───────────────────────────────────────────────────
function setTool(tool) {
  if (DRAW.tool === tool) {
    // Same tool clicked → deactivate
    DRAW.tool = null;
    DRAW.pendingPoints = [];
  } else {
    DRAW.tool = tool;
    DRAW.pendingPoints = [];
  }
  // UI update
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === DRAW.tool);
  });
  if (drawCanvas) drawCanvas.classList.toggle('active', !!DRAW.tool);
  const hint = $('toolHint');
  if (hint) {
    if (DRAW.tool === 'trendline') hint.textContent = 'Биринчи нуқтани босинг';
    else if (DRAW.tool === 'rect') hint.textContent = 'Биринчи бурчакни босинг';
    else if (DRAW.tool === 'hline') hint.textContent = 'Даражани босинг';
    else hint.textContent = '';
    hint.classList.toggle('show', !!DRAW.tool);
  }
  redrawOverlay();
}

function onCanvasClick(e) {
  if (!DRAW.tool || !chart || !candleSeries) return;
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const time = chart.timeScale().coordinateToTime(x);
  const price = candleSeries.coordinateToPrice(y);
  if (time === null || price === null) return;
  
  if (DRAW.tool === 'hline') {
    DRAW.shapes.push({type:'hline', price, color: nextShapeColor()});
    DRAW.tool = null;
    DRAW.pendingPoints = [];
  } else {
    // trendline or rect — needs 2 clicks
    DRAW.pendingPoints.push({time, price});
    const hint = $('toolHint');
    if (DRAW.pendingPoints.length === 1) {
      if (hint) hint.textContent = DRAW.tool === 'trendline' ? 'Иккинчи нуқтани босинг' : 'Қарши бурчакни босинг';
    } else if (DRAW.pendingPoints.length === 2) {
      const [p1, p2] = DRAW.pendingPoints;
      DRAW.shapes.push({
        type: DRAW.tool, p1, p2, color: nextShapeColor(),
      });
      DRAW.tool = null;
      DRAW.pendingPoints = [];
    }
  }
  
  // If tool deactivated, update UI
  if (!DRAW.tool) {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    drawCanvas.classList.remove('active');
    const hint = $('toolHint');
    if (hint) hint.classList.remove('show');
  }
  
  saveShapes();
  redrawOverlay();
}

function onCanvasMove(e) {
  if (!DRAW.tool || DRAW.pendingPoints.length === 0) return;
  const rect = drawCanvas.getBoundingClientRect();
  DRAW.hoverX = e.clientX - rect.left;
  DRAW.hoverY = e.clientY - rect.top;
  redrawOverlay();
}

// ─── DRAG / HOVER SUPPORT ────────────────────────────────────────────
const HIT_PIXELS = 8;

function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(px-x1, py-y1);
  let t = ((px-x1)*dx + (py-y1)*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}

function findShapeAt(x, y) {
  if (!chart || !candleSeries) return null;
  for (let i = DRAW.shapes.length - 1; i >= 0; i--) {
    const s = DRAW.shapes[i];
    if (s.type === 'hline') {
      const sy = candleSeries.priceToCoordinate(s.price);
      if (sy !== null && Math.abs(y - sy) <= HIT_PIXELS) return {idx: i, mode: 'whole'};
    } else if (s.type === 'trendline') {
      const x1 = chart.timeScale().timeToCoordinate(s.p1.time);
      const y1 = candleSeries.priceToCoordinate(s.p1.price);
      const x2 = chart.timeScale().timeToCoordinate(s.p2.time);
      const y2 = candleSeries.priceToCoordinate(s.p2.price);
      if (x1==null||y1==null||x2==null||y2==null) continue;
      if (Math.hypot(x-x1, y-y1) <= HIT_PIXELS) return {idx: i, mode: 'p1'};
      if (Math.hypot(x-x2, y-y2) <= HIT_PIXELS) return {idx: i, mode: 'p2'};
      if (pointToLineDistance(x, y, x1, y1, x2, y2) <= HIT_PIXELS) return {idx: i, mode: 'whole'};
    } else if (s.type === 'rect') {
      const x1 = chart.timeScale().timeToCoordinate(s.p1.time);
      const y1 = candleSeries.priceToCoordinate(s.p1.price);
      const x2 = chart.timeScale().timeToCoordinate(s.p2.time);
      const y2 = candleSeries.priceToCoordinate(s.p2.price);
      if (x1==null||y1==null||x2==null||y2==null) continue;
      if (Math.hypot(x-x1, y-y1) <= HIT_PIXELS) return {idx: i, mode: 'p1'};
      if (Math.hypot(x-x2, y-y2) <= HIT_PIXELS) return {idx: i, mode: 'p2'};
      if (Math.hypot(x-x2, y-y1) <= HIT_PIXELS) return {idx: i, mode: 'p1y'};
      if (Math.hypot(x-x1, y-y2) <= HIT_PIXELS) return {idx: i, mode: 'p2y'};
      const xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
      const yMin = Math.min(y1, y2), yMax = Math.max(y1, y2);
      // Check edges (not full body — keep chart click-through inside box)
      const onEdge = (Math.abs(y - yMin) <= HIT_PIXELS && x >= xMin && x <= xMax)
                  || (Math.abs(y - yMax) <= HIT_PIXELS && x >= xMin && x <= xMax)
                  || (Math.abs(x - xMin) <= HIT_PIXELS && y >= yMin && y <= yMax)
                  || (Math.abs(x - xMax) <= HIT_PIXELS && y >= yMin && y <= yMax);
      if (onEdge) return {idx: i, mode: 'whole'};
    }
  }
  return null;
}

function onContainerMove(e) {
  if (DRAW.tool || DRAW.dragging) return;  // tool active or dragging — skip
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
  const hit = findShapeAt(x, y);
  if (hit) {
    drawCanvas.style.pointerEvents = 'auto';
    drawCanvas.style.cursor = (hit.mode === 'whole') ? 'grab'
                            : (hit.mode === 'p1' || hit.mode === 'p2y' ? 'nwse-resize' : 'nesw-resize');
    DRAW.hoverShapeIdx = hit.idx;
  } else {
    drawCanvas.style.pointerEvents = '';  // back to CSS default (none)
    drawCanvas.style.cursor = '';
    DRAW.hoverShapeIdx = -1;
  }
}

function onCanvasMouseDown(e) {
  if (DRAW.tool) return;  // drawing — handled by click
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const hit = findShapeAt(x, y);
  if (!hit) return;
  e.preventDefault();
  DRAW.dragging = {
    idx: hit.idx,
    mode: hit.mode,
    startX: x, startY: y,
    original: JSON.parse(JSON.stringify(DRAW.shapes[hit.idx])),
  };
  drawCanvas.style.cursor = (hit.mode === 'whole') ? 'grabbing' : 'crosshair';
}

function onDocumentMove(e) {
  if (!DRAW.dragging || !chart || !candleSeries) return;
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = x - DRAW.dragging.startX;
  const dy = y - DRAW.dragging.startY;
  const shape = DRAW.shapes[DRAW.dragging.idx];
  const orig = DRAW.dragging.original;

  const ts = chart.timeScale();
  const movePoint = (origP, deltaX, deltaY) => {
    const x0 = ts.timeToCoordinate(origP.time);
    const y0 = candleSeries.priceToCoordinate(origP.price);
    if (x0 === null || y0 === null) return origP;
    const newTime = ts.coordinateToTime(x0 + deltaX);
    const newPrice = candleSeries.coordinateToPrice(y0 + deltaY);
    return {time: newTime ?? origP.time, price: newPrice ?? origP.price};
  };

  if (shape.type === 'hline') {
    const yOrig = candleSeries.priceToCoordinate(orig.price);
    if (yOrig !== null) {
      const newPrice = candleSeries.coordinateToPrice(yOrig + dy);
      if (newPrice !== null) shape.price = newPrice;
    }
  } else if (shape.type === 'trendline' || shape.type === 'rect') {
    if (DRAW.dragging.mode === 'whole') {
      shape.p1 = movePoint(orig.p1, dx, dy);
      shape.p2 = movePoint(orig.p2, dx, dy);
    } else if (DRAW.dragging.mode === 'p1') {
      shape.p1 = movePoint(orig.p1, dx, dy);
    } else if (DRAW.dragging.mode === 'p2') {
      shape.p2 = movePoint(orig.p2, dx, dy);
    } else if (DRAW.dragging.mode === 'p1y' && shape.type === 'rect') {
      // Top-right corner of rect: x of p2 + y of p1
      const np1 = movePoint(orig.p1, 0, dy);
      const np2 = movePoint(orig.p2, dx, 0);
      shape.p1 = {time: shape.p1.time, price: np1.price};
      shape.p2 = {time: np2.time, price: shape.p2.price};
    } else if (DRAW.dragging.mode === 'p2y' && shape.type === 'rect') {
      // Bottom-left: x of p1 + y of p2
      const np1 = movePoint(orig.p1, dx, 0);
      const np2 = movePoint(orig.p2, 0, dy);
      shape.p1 = {time: np1.time, price: shape.p1.price};
      shape.p2 = {time: shape.p2.time, price: np2.price};
    }
  }
  redrawOverlay();
}

function onDocumentMouseUp() {
  if (!DRAW.dragging) return;
  DRAW.dragging = null;
  drawCanvas.style.cursor = '';
  drawCanvas.style.pointerEvents = '';
  saveShapes();
  redrawOverlay();
}

function redrawOverlay() {
  if (!drawCtx || !drawCanvas) return;
  const w = drawCanvas.width / (window.devicePixelRatio || 1);
  const h = drawCanvas.height / (window.devicePixelRatio || 1);
  drawCtx.clearRect(0, 0, w, h);
  if (!chart || !candleSeries) return;
  
  drawCtx.font = '11px IBM Plex Mono, monospace';
  
  // Draw saved shapes
  for (let i = 0; i < DRAW.shapes.length; i++) {
    drawShape(DRAW.shapes[i], false, w, h);
  }
  
  // Draw preview (pending shape with hover)
  if (DRAW.tool && DRAW.pendingPoints.length === 1 && DRAW.hoverX !== null) {
    const p1 = DRAW.pendingPoints[0];
    const x1 = chart.timeScale().timeToCoordinate(p1.time);
    const y1 = candleSeries.priceToCoordinate(p1.price);
    if (x1 !== null && y1 !== null) {
      const preview = {
        type: DRAW.tool,
        p1: p1,
        p2: {time: chart.timeScale().coordinateToTime(DRAW.hoverX), price: candleSeries.coordinateToPrice(DRAW.hoverY)},
        color: '#22d3ee',
      };
      // For rect/trendline, we have the 2nd point as hover
      if (preview.p2.time !== null && preview.p2.price !== null) drawShape(preview, true, w, h);
    }
  }
}

function drawShape(s, isPreview, w, h) {
  drawCtx.save();
  drawCtx.globalAlpha = isPreview ? 0.55 : 1.0;
  
  if (s.type === 'hline') {
    const y = candleSeries.priceToCoordinate(s.price);
    if (y === null) { drawCtx.restore(); return; }
    drawCtx.strokeStyle = s.color;
    drawCtx.lineWidth = 1.5;
    drawCtx.setLineDash([6, 4]);
    drawCtx.beginPath();
    drawCtx.moveTo(0, y);
    drawCtx.lineTo(w, y);
    drawCtx.stroke();
    drawCtx.setLineDash([]);
    // Price label
    const txt = s.price.toFixed(3);
    drawCtx.fillStyle = s.color;
    drawCtx.fillRect(w - 56, y - 8, 52, 16);
    drawCtx.fillStyle = '#000';
    drawCtx.fillText(txt, w - 51, y + 4);
  } else if (s.type === 'trendline') {
    const x1 = chart.timeScale().timeToCoordinate(s.p1.time);
    const y1 = candleSeries.priceToCoordinate(s.p1.price);
    const x2 = chart.timeScale().timeToCoordinate(s.p2.time);
    const y2 = candleSeries.priceToCoordinate(s.p2.price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) { drawCtx.restore(); return; }
    drawCtx.strokeStyle = s.color;
    drawCtx.lineWidth = 2;
    drawCtx.beginPath();
    drawCtx.moveTo(x1, y1);
    drawCtx.lineTo(x2, y2);
    drawCtx.stroke();
    if (!isPreview) {
      // Endpoints
      drawCtx.fillStyle = s.color;
      drawCtx.beginPath(); drawCtx.arc(x1, y1, 3, 0, Math.PI*2); drawCtx.fill();
      drawCtx.beginPath(); drawCtx.arc(x2, y2, 3, 0, Math.PI*2); drawCtx.fill();
    }
  } else if (s.type === 'rect') {
    const x1 = chart.timeScale().timeToCoordinate(s.p1.time);
    const y1 = candleSeries.priceToCoordinate(s.p1.price);
    const x2 = chart.timeScale().timeToCoordinate(s.p2.time);
    const y2 = candleSeries.priceToCoordinate(s.p2.price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) { drawCtx.restore(); return; }
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
    // Fill
    drawCtx.fillStyle = s.color + '22';
    drawCtx.fillRect(x, y, rw, rh);
    // Border
    drawCtx.strokeStyle = s.color;
    drawCtx.lineWidth = 1.5;
    drawCtx.strokeRect(x, y, rw, rh);
    // Price labels at top/bottom
    if (!isPreview) {
      drawCtx.fillStyle = s.color;
      drawCtx.font = '10px IBM Plex Mono';
      const topPrice = Math.max(s.p1.price, s.p2.price).toFixed(3);
      const botPrice = Math.min(s.p1.price, s.p2.price).toFixed(3);
      drawCtx.fillText(topPrice, x + 4, y - 3);
      drawCtx.fillText(botPrice, x + 4, y + rh + 11);
    }
  }
  drawCtx.restore();
}

function undoLastShape() {
  if (!DRAW.shapes.length) return;
  DRAW.shapes.pop();
  saveShapes();
  redrawOverlay();
  log('INFO', '↶ Охирги фигура ўчирилди');
}

function resetChart() {
  DRAW.shapes = [];
  DRAW.pendingPoints = [];
  DRAW.tool = null;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
  if (drawCanvas) drawCanvas.classList.remove('active');
  const hint = $('toolHint');
  if (hint) hint.classList.remove('show');
  saveShapes();
  redrawOverlay();
  if (chart) chart.timeScale().fitContent();
  log('INFO', '🗑 График тозаланди');
}

function saveShapes() {
  try { localStorage.setItem('qumash_v5_shapes', JSON.stringify(DRAW.shapes)); } catch(_) {}
}
function loadShapes() {
  try {
    const s = JSON.parse(localStorage.getItem('qumash_v5_shapes') || '[]');
    if (Array.isArray(s)) DRAW.shapes = s;
  } catch(_) { DRAW.shapes = []; }
}

// ─── FULLSCREEN ──────────────────────────────────────────────────────
async function toggleFullscreen() {
  const wrap = $('chartWrap');
  if (!wrap) return;
  if (document.fullscreenElement === wrap) {
    try { await document.exitFullscreen(); } catch(_) {}
    return;
  }
  if (wrap.classList.contains('fs-fallback')) {
    wrap.classList.remove('fs-fallback');
    setTimeout(() => { resizeDrawCanvas(); redrawOverlay(); }, 50);
    return;
  }
  // Try native fullscreen first
  try {
    await wrap.requestFullscreen();
  } catch(e) {
    // Fallback: CSS fullscreen
    wrap.classList.add('fs-fallback');
    setTimeout(() => { resizeDrawCanvas(); redrawOverlay(); }, 50);
    log('INFO', '⛶ Тўлиқ экран (fallback) — ESC учун қайта босинг');
    // ESC handler
    const escHandler = (ev) => {
      if (ev.key === 'Escape') {
        wrap.classList.remove('fs-fallback');
        document.removeEventListener('keydown', escHandler);
        setTimeout(() => { resizeDrawCanvas(); redrawOverlay(); }, 50);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
}

document.addEventListener('fullscreenchange', () => {
  setTimeout(() => { resizeDrawCanvas(); redrawOverlay(); }, 100);
});
