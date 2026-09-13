import React, { useState, useEffect, useMemo } from 'react';
import { 
  Swords, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  UserPlus, 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  BarChart3, 
  Filter, 
  Flame, 
  Zap, 
  Award, 
  Download, 
  Activity, 
  ChevronRight, 
  WifiOff, 
  ShieldAlert,
  Bot,
  Sparkles,
  ArrowDownRight,
  PieChart
} from 'lucide-react';
import { 
  BattleAnalyticsSummary, 
  BattleAnalyticsEvent, 
  getBattleAnalyticsSummary, 
  subscribeToBattleAnalytics, 
  getRecentBattleEvents,
  INITIAL_BATTLE_SUMMARY 
} from '../../services/battleAnalyticsService';
import { soundManager } from '../../utils/audio';

interface BattleAnalyticsDashboardProps {
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const BattleAnalyticsDashboard: React.FC<BattleAnalyticsDashboardProps> = ({
  onClose,
  isEmbedded = false,
}) => {
  const [summary, setSummary] = useState<BattleAnalyticsSummary>(INITIAL_BATTLE_SUMMARY);
  const [recentEvents, setRecentEvents] = useState<BattleAnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedEventFilter, setSelectedEventFilter] = useState<'all' | 'completed' | 'abandoned' | 'signups'>('all');
  const [activeTimeframe, setActiveTimeframe] = useState<'all' | 'today' | '7d'>('all');

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [sum, events] = await Promise.all([
        getBattleAnalyticsSummary(),
        getRecentBattleEvents(35),
      ]);
      setSummary(sum);
      setRecentEvents(events);
    } catch (err) {
      console.error('Failed to load battle analytics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to real-time live updates
    const unsubscribe = subscribeToBattleAnalytics((updated) => {
      setSummary(updated);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualRefresh = () => {
    soundManager.playTap();
    loadData();
  };

  // Filtered recent events
  const filteredEvents = useMemo(() => {
    if (selectedEventFilter === 'all') return recentEvents;
    if (selectedEventFilter === 'completed') return recentEvents.filter(e => e.type === 'battle_completed');
    if (selectedEventFilter === 'abandoned') return recentEvents.filter(e => e.type === 'battle_abandoned');
    if (selectedEventFilter === 'signups') return recentEvents.filter(e => e.type === 'post_battle_signup');
    return recentEvents;
  }, [recentEvents, selectedEventFilter]);

  // Export analytics summary as JSON
  const handleExportJson = () => {
    soundManager.playTap();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      summary,
      recentEvents,
      exportedAt: new Date().toISOString(),
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vocabclash-1v1-analytics-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatSecToMin = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    if (mins === 0) return `${remainder}s`;
    return `${mins}m ${remainder}s`;
  };

  const totalDropoffs = useMemo(() => {
    return Object.values(summary.abandonReasons).reduce((a, b) => a + b, 0);
  }, [summary.abandonReasons]);

  return (
    <div className={`w-full ${isEmbedded ? '' : 'p-4 sm:p-6'} space-y-6 text-slate-100`}>
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-md p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                1v1 Battle Arena Analytics
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Firestore Stream
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Real-time match completion rates, mid-game abandonment, and post-duel signup conversions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-200 text-xs font-semibold border border-slate-700 transition disabled:opacity-60"
            title="Refresh metrics from Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* 4 Main Hero Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Matches Started */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Total Duels Started</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Swords className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {summary.totalMatchesStarted.toLocaleString()}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Real Opponents: <b>{summary.opponentTypeBreakdown.real.started}</b></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Bot className="w-3 h-3 text-slate-400" />
              <span>Bots: <b>{summary.opponentTypeBreakdown.bot.started}</b></span>
            </div>
          </div>
        </div>

        {/* Card 2: Completed Matches */}
        <div className="bg-slate-900/90 border border-emerald-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Completed Matches</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-white tracking-tight">
              {summary.totalMatchesCompleted.toLocaleString()}
            </div>
            <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              {summary.completionRate}%
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Avg Duration: <b>{formatSecToMin(summary.avgMatchDurationSec)}</b></span>
            </div>
            <span>Questions: <b>{summary.totalQuestionsAnsweredInBattles.toLocaleString()}</b></span>
          </div>
        </div>

        {/* Card 3: Ended In Between / Abandoned */}
        <div className="bg-slate-900/90 border border-rose-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-rose-500/40 transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Ended In Between</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-white tracking-tight">
              {summary.totalMatchesAbandoned.toLocaleString()}
            </div>
            <span className="text-sm font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
              {summary.abandonmentRate}%
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Forfeits: <b>{summary.abandonReasons.forfeit}</b></span>
            <span>Disconnects: <b>{summary.abandonReasons.disconnect}</b></span>
            <span>Other: <b>{summary.abandonReasons.window_close + summary.abandonReasons.other}</b></span>
          </div>
        </div>

        {/* Card 4: Post-Match Signup Conversion */}
        <div className="bg-slate-900/90 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Post-Duel Signups</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-white tracking-tight">
              {summary.postMatchSignupsCompleted.toLocaleString()}
            </div>
            <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
              {summary.signupConversionRate}% conv.
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Guest Matches: <b>{summary.guestMatchesCompleted}</b></span>
            <span>Prompts Shown: <b>{summary.postMatchSignupPromptsShown}</b></span>
          </div>
        </div>
      </div>

      {/* Conversion Funnel Visualization & Abandonment Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 1v1 Signup Conversion Funnel (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/85 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">1v1 Player Conversion Funnel</h2>
                <p className="text-xs text-slate-400">Lifecycle drop-off from match initiation to new user sign up</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 border border-slate-700">
              End-to-End Retention
            </span>
          </div>

          {/* Funnel Steps */}
          <div className="space-y-3.5">
            {/* Step 1: Matches Started */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold">1</span>
                  Matches Initiated
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  {summary.totalMatchesStarted.toLocaleString()} <span className="text-xs text-slate-400 font-normal">(100%)</span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full w-full" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Guest: {summary.guestMatchesStarted} ({summary.totalMatchesStarted > 0 ? Math.round((summary.guestMatchesStarted / summary.totalMatchesStarted) * 100) : 0}%)</span>
                <span>Registered: {summary.authMatchesStarted} ({summary.totalMatchesStarted > 0 ? Math.round((summary.authMatchesStarted / summary.totalMatchesStarted) * 100) : 0}%)</span>
              </div>
            </div>

            {/* Step 2: Matches Completed */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">2</span>
                  Completed Matches
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {summary.totalMatchesCompleted.toLocaleString()} <span className="text-xs text-slate-400 font-normal">({summary.completionRate}%)</span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, summary.completionRate))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Guest Completed: {summary.guestMatchesCompleted}</span>
                <span className="text-rose-400">Mid-match dropoff: {summary.totalMatchesAbandoned} ({summary.abandonmentRate}%)</span>
              </div>
            </div>

            {/* Step 3: Post-Match Prompt Shown */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">3</span>
                  Post-Match Review / Signup Prompt Shown
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {summary.postMatchSignupPromptsShown.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${summary.guestMatchesCompleted > 0 ? Math.min(100, (summary.postMatchSignupPromptsShown / summary.guestMatchesCompleted) * 100) : 0}%` 
                  }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Shown to guests immediately on duel conclusion and mistake review
              </div>
            </div>

            {/* Step 4: Registered Just After Match */}
            <div className="bg-gradient-to-br from-amber-950/20 to-slate-950/80 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black">4</span>
                  Signups Completed Just After Duel
                </span>
                <span className="font-mono font-black text-amber-300 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {summary.postMatchSignupsCompleted.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500 shadow-lg shadow-amber-500/30" 
                  style={{ width: `${Math.min(100, Math.max(5, summary.signupConversionRate))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-amber-400 font-semibold">
                  Conversion Rate: {summary.signupConversionRate}%
                </span>
                <span className="text-slate-400">
                  Within 15-min post-battle conversion window
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Abandonment & Drop-off Root Cause Breakdown (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/85 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Mid-Match Exit Breakdown</h2>
              <p className="text-xs text-slate-400">Why and when players left during an active duel</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Abandon Reasons List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-200 font-medium">Manual Forfeit / Leave Button</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {summary.abandonReasons.forfeit} <span className="text-[11px] text-slate-400">({totalDropoffs > 0 ? Math.round((summary.abandonReasons.forfeit / totalDropoffs) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-200 font-medium">Network Disconnect Timeout (30s)</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {summary.abandonReasons.disconnect} <span className="text-[11px] text-slate-400">({totalDropoffs > 0 ? Math.round((summary.abandonReasons.disconnect / totalDropoffs) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="text-slate-200 font-medium">Opponent Surrendered / Left</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {summary.abandonReasons.opponent_left} <span className="text-[11px] text-slate-400">({totalDropoffs > 0 ? Math.round((summary.abandonReasons.opponent_left / totalDropoffs) * 100) : 0}%)</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-slate-200 font-medium">Browser / Tab Closed Mid-Game</span>
                </div>
                <span className="font-mono font-bold text-white">
                  {summary.abandonReasons.window_close + summary.abandonReasons.other} <span className="text-[11px] text-slate-400">({totalDropoffs > 0 ? Math.round(((summary.abandonReasons.window_close + summary.abandonReasons.other) / Math.max(1, totalDropoffs)) * 100) : 0}%)</span>
                </span>
              </div>
            </div>

            {/* Question Dropoff Index Insights */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Drop-off Question Index</span>
                <span className="text-[11px] font-normal text-slate-400">Where exits happen</span>
              </div>
              
              {Object.keys(summary.abandonQuestionDropoff).length > 0 ? (
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {Object.entries(summary.abandonQuestionDropoff)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .slice(0, 5)
                    .map(([qIdx, count]) => (
                      <div key={qIdx} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Q{Number(qIdx) + 1}</div>
                        <div className="text-xs font-bold text-rose-300 font-mono mt-0.5">{count}</div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-slate-500">
                  No mid-round dropoffs recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Distribution & Match Outcomes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Ranked 1v1 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5" />
              1v1 Ranked Duels
            </span>
            <span className="text-xs font-bold text-white font-mono">
              {summary.modeBreakdown['1v1_ranked'].started} starts
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-400 text-[11px]">Completed</div>
              <div className="text-base font-bold text-emerald-400 font-mono">
                {summary.modeBreakdown['1v1_ranked'].completed}
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-400 text-[11px]">Abandoned</div>
              <div className="text-base font-bold text-rose-400 font-mono">
                {summary.modeBreakdown['1v1_ranked'].abandoned}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Duel / Speed Blitz */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Speed Blitz (10Q)
            </span>
            <span className="text-xs font-bold text-white font-mono">
              {summary.modeBreakdown['quick_duel'].started} starts
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-400 text-[11px]">Completed</div>
              <div className="text-base font-bold text-emerald-400 font-mono">
                {summary.modeBreakdown['quick_duel'].completed}
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-400 text-[11px]">Abandoned</div>
              <div className="text-base font-bold text-rose-400 font-mono">
                {summary.modeBreakdown['quick_duel'].abandoned}
              </div>
            </div>
          </div>
        </div>

        {/* Friend Custom Lobby */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Friend Custom Lobbies
            </span>
            <span className="text-xs font-bold text-white font-mono">
              {summary.modeBreakdown['friend_lobby'].started} starts
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-400 text-[11px]">Completed</div>
              <div className="text-base font-bold text-emerald-400 font-mono">
                {summary.modeBreakdown['friend_lobby'].completed}
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
              <div className="text-slate-400 text-[11px]">Abandoned</div>
              <div className="text-base font-bold text-rose-400 font-mono">
                {summary.modeBreakdown['friend_lobby'].abandoned}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Recent Match Activity Feed */}
      <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Live Battle & Conversion Stream</h2>
              <p className="text-xs text-slate-400">Real-time match events with completion and signup status</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedEventFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${selectedEventFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              All ({recentEvents.length})
            </button>
            <button
              onClick={() => setSelectedEventFilter('completed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${selectedEventFilter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Completed
            </button>
            <button
              onClick={() => setSelectedEventFilter('abandoned')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${selectedEventFilter === 'abandoned' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Abandoned
            </button>
            <button
              onClick={() => setSelectedEventFilter('signups')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${selectedEventFilter === 'signups' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Signups
            </button>
          </div>
        </div>

        {/* Events Table / List */}
        <div className="overflow-hidden border border-slate-800/80 rounded-xl bg-slate-950/40 divide-y divide-slate-800/60">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((ev) => {
              const isCompleted = ev.type === 'battle_completed';
              const isAbandoned = ev.type === 'battle_abandoned';
              const isSignup = ev.type === 'post_battle_signup';
              const isStart = ev.type === 'battle_started';

              return (
                <div key={ev.id} className="p-3.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-900/50 transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCompleted ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      isAbandoned ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                      isSignup ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                      'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    }`}>
                      {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                      {isAbandoned && <XCircle className="w-4 h-4" />}
                      {isSignup && <Sparkles className="w-4 h-4" />}
                      {isStart && <Swords className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {isCompleted && 'Duel Completed'}
                          {isAbandoned && `Match Abandoned (${ev.abandonReason || 'Forfeit'})`}
                          {isSignup && 'New Account Created Post-Duel!'}
                          {isStart && 'Match Started'}
                        </span>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          ev.isGuest ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {ev.isGuest ? 'Guest' : 'Authenticated'}
                        </span>

                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {ev.mode.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        {isCompleted && (
                          <span>Score: <b className="text-slate-200">{ev.playerScore ?? 0}</b> vs <b className="text-slate-200">{ev.opponentScore ?? 0}</b> ({ev.outcome}) • Duration: {ev.matchDurationSec ? formatSecToMin(ev.matchDurationSec) : 'N/A'}</span>
                        )}
                        {isAbandoned && (
                          <span className="text-rose-300/90">Dropped at Q{((ev.dropoffQuestionIndex ?? 0) + 1)} • Answered {ev.questionsAnswered ?? 0} questions</span>
                        )}
                        {isSignup && (
                          <span className="text-amber-300/90">Converted in {ev.timeAfterMatchSec ?? 0}s after 1v1 battle ({ev.authProvider || 'Google'})</span>
                        )}
                        {isStart && (
                          <span>{ev.roundCount || 10} Questions • {ev.isRealPlayer ? 'Real Player' : 'Aspirant Bot'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono sm:text-right shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No battle events match the selected filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
