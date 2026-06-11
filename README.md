# QUMASH — REVERSAL HUNTER (XAUUSD)

A real-time XAUUSD (gold) reversal-signal dashboard. A 14-layer scoring engine
plus a dozen "PDF model" modules (TTrades CISD, ICT levels, divergence, SMT/AMD,
chart patterns, Fibonacci, inducement, news-driven, M5 intraday, override
hierarchy…) evaluate live Deriv candles and surface tiered LONG/SHORT setups with
smart SL/TP, an adaptive per-regime weighting system, a backtester, and a
ForexFactory news calendar.

> Migrated from a vanilla-JS app to **React + Vite + TypeScript** without changing
> the trading logic. See **[Architecture](#architecture)** and
> **[Migration notes](#migration-notes)**.

## Quick start

```bash
npm install
npm run dev        # Vite dev server on http://localhost:4001
```

Open the app, configure the settings panel, and click **DERIV'ГА УЛАНИШ ВА БОШЛАШ**
to connect to the public Deriv WebSocket feed and start the dashboard.

## Scripts

| Script                 | What it does                             |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start the Vite dev server                |
| `npm run build`        | Type-check (`tsc -b`) + production build |
| `npm run preview`      | Preview the production build             |
| `npm run type-check`   | `tsc -b --noEmit` over the whole project |
| `npm run lint`         | ESLint (flat config)                     |
| `npm run lint:fix`     | ESLint with `--fix`                      |
| `npm run format`       | Prettier write over `src`                |
| `npm run format:check` | Prettier check (CI gate)                 |

A Husky **pre-commit** hook runs `lint-staged` (eslint + prettier on staged
files); a **pre-push** hook runs `type-check`.

## Architecture

The app is split into a framework-agnostic trading **core** and a thin React
**UI** layer, connected by a tiny pub/sub store.

```
src/
  core/            ← preserved trading logic (plain JS ES modules)
    state.js          CFG / ST / SYMBOLS / FILTERS / REGIMES singletons
    indicators.js     IND — ATR/RSI/EMA/MACD/SuperTrend math
    filters.js        regime, sweep, correlation, OB/OTE, FVG, candlesticks, adaptive weights
    calendar.js       ForexFactory calendar + fallback
    newsEngine.js     news surprise scoring
    engine.js         14-layer Eureka score + signal state machine
    backtest.js       historical simulation
    modules/          v8–v12 "PDF" models (TTrades, ICT, divergence, SMT/AMD, …)
  services/        ← side-effectful I/O (plain JS, except the chart wrapper)
    feed.js           Deriv WebSocket feed → ST.candles
    chart.js          lightweight-charts wrapper (candles, price lines, markers)
    telegram.js       Telegram alerts
    macro.js          Yahoo macro feeds
  store/           ← JS ↔ React bridge
    uiBus.js          topic-based pub/sub (emit / subscribe / getVersion)
    uiState.js        DOM-write replacements: setConnUI / updateLivePriceUI / refreshDashboardUI …
    engine.ts         typed facade over CFG / ST / snapshot
    live.ts           typed view of the live header/connection state
    useTopic.ts       React useSyncExternalStore hook
  app/             ← React glue (TypeScript)
    hooks.ts          useSnapshot / useLive / useLogs / useView / useBacktestProgress
    settings.ts       settings model (load/apply, mirrors loadCfgFromUI/Storage)
    controls.ts       changeTF / connect / disconnect / export / import / timers
  components/      ← React UI
    SettingsPanel, Dashboard, Header, StateBar, RecoBanner
    common/           Card, inputs, ChecklistGrid (reusable primitives)
    dashboard/        ScoreCard, TradeCard, FilterGrid, StructureCard, Correlation,
                      Indicators, Adaptive, Stats, News, V8/V9/V10/V11 panels,
                      Backtest, History, Log, Chart
```

### Data flow

```
Deriv WS ─▶ services/feed ─▶ ST.candles ─▶ core/engine.runSignalEvaluation()
                                              │ builds _lastSnapshot + ST.snap
                                              ▼
                                   store/uiState.refreshDashboardUI() ─▶ uiBus.emit('snapshot')
                                              ▼
                          React components (useSnapshot) re-render from the snapshot
```

The engine used to write directly to ~150 DOM ids. In the React port it instead
calls the same-named **sink** functions in `store/uiState.js`, which mutate plain
singletons and emit a bus topic. Components subscribe to only the topics they need
via `useTopic`, so a tick re-renders just the affected panels.

## Migration notes

**Goal:** move to React + Vite + TypeScript **without altering the battle-tuned
trading logic.**

- **Core kept as JS, byte-identical.** The 24 logic files were ported from the
  original `js/NN-*.js` by adding only `import`/`export` lines — the function
  bodies are unchanged. They live in `src/core` / `src/services` and are
  **excluded from Prettier** (see `.prettierignore`) so they stay verbatim.
  `tsc` runs with `allowJs` + `checkJs: false`, so the core is trusted and
  imported as loosely-typed; only the new React UI is strictly typed.
- **Globals → module singletons.** `CFG`, `ST`, `CAL`, `BT`, `IND`, `MACRO`,
  `M5_STATE`, `NEWS_REACTIONS`, etc. became exported objects. Because they are the
  same object references everywhere, the original cross-module mutation semantics
  are preserved exactly.
- **DOM → store.** `10-ui.js` (imperative DOM updates) and `11-boot.js` (event
  wiring) were not ported; their behavior was reimplemented as React components +
  `app/controls.ts`, reading from the engine snapshot.
- **Two behavior-preserving cleanups:**
  - The original `index.html` never loaded `27-trendline.js`, `28-volume.js`,
    `29-weekend-gap.js`, or `30-mtv-zone.js`, so the engine's
    `typeof scoreTrendline === 'function'` guards always failed. Those paths are
    kept as inert `{ score: 0 }` placeholders (identical runtime result), and the
    four unused files were not ported.
  - `CFG.minScoreDiff` was declared twice in the original config; JS keeps the last
    value (`3`). The dead earlier `minScoreDiff: 0` was removed — effective value
    unchanged.
- **Verification:** `lint` + `type-check` + `build` all pass, and the ported core
  was runtime-smoke-tested in Node (indicators / regime / structure / FVG over
  synthetic candles) to confirm parity.

The original `js/`, `css/`, and pre-migration `index.html` are left in place for
reference; they are excluded from the build, linting, and formatting.

## Stack

React 18 · Vite 6 · TypeScript 5.6 · lightweight-charts 4.1 · ESLint 9 (flat) ·
Prettier 3 · Husky 9 + lint-staged.
