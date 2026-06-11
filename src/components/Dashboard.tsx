import { Header } from './Header';
import { StateBar } from './StateBar';
import { RecoBanner } from './RecoBanner';
import { ChartPanel } from './dashboard/ChartPanel';
import { ScoreCard } from './dashboard/ScoreCard';
import { TradeCard } from './dashboard/TradeCard';
import { FilterGrid } from './dashboard/FilterGrid';
import { StructureCard } from './dashboard/StructureCard';
import { CorrelationCard } from './dashboard/CorrelationCard';
import { IndicatorsCard } from './dashboard/IndicatorsCard';
import { AdaptiveCard } from './dashboard/AdaptiveCard';
import { StatsCard } from './dashboard/StatsCard';
import { NewsForecast, PastEvents } from './dashboard/NewsPanels';
import { V8TtCard, V8ChlCard, V8Checklist } from './dashboard/V8Panels';
import { V9DivCard, V9SmtCard, V9PsychList } from './dashboard/V9Panels';
import { V10PatternCard, V10IdmCard } from './dashboard/V10Panels';
import { V11Panel } from './dashboard/V11Panel';
import { BacktestPanel } from './dashboard/BacktestPanel';
import { HistoryTable } from './dashboard/HistoryTable';
import { LogPanel } from './dashboard/LogPanel';

export function Dashboard() {
  return (
    <div className="fade-in">
      <Header />
      <StateBar />
      <RecoBanner />
      <ChartPanel />

      <div className="grid grid-cols-12 gap-3">
        {/* Row 1: Score + Trade + Filters + Structure */}
        <ScoreCard />
        <TradeCard />
        <FilterGrid />
        <StructureCard />

        {/* Row 2: Correlation + Indicators + Adaptive */}
        <CorrelationCard />
        <IndicatorsCard />
        <AdaptiveCard />

        {/* Row 3: Stats + News Forecast + Past Events */}
        <StatsCard />
        <NewsForecast />
        <PastEvents />

        {/* Row 3.4: v8 PDF modules */}
        <V8TtCard />
        <V8ChlCard />
        <V8Checklist />

        {/* Row 3.45: v9 PDF modules */}
        <V9DivCard />
        <V9SmtCard />
        <V9PsychList />

        {/* Row 3.46: v10 PDF modules */}
        <V10PatternCard />
        <V10IdmCard />

        {/* Row 3.47: v11 News-Driven engine */}
        <V11Panel />

        {/* Row 3.5: Backtest */}
        <BacktestPanel />

        {/* Row 4: History + Log */}
        <HistoryTable />
        <LogPanel />
      </div>
    </div>
  );
}
