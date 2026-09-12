import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlayerProfile, 
  DailyStreakState, 
  SavedWord, 
  Question, 
  ExamType,
  MentorPeriod,
  MentorAiReport
} from '../types';
import { soundManager } from '../utils/audio';
import { 
  calculateMentorAnalytics 
} from '../services/mentorAnalyticsService';
import { 
  getVocabMentorReport, 
  buildWeakAreasDrillQuestions 
} from '../services/aiMentorCoachingService';
import { MentorDiagnosticsView } from './MentorDiagnosticsView';
import { Sparkles } from 'lucide-react';

export interface AiTutorTabProps {
  player?: PlayerProfile;
  streak?: DailyStreakState;
  savedWords?: SavedWord[];
  subscription?: { isPremium?: boolean };
  onStartTargetedPractice?: (questions: Question[], title: string) => void;
  onOpenUpgradeModal?: () => void;
  onBookmarkQuestion?: (question: Question) => void;
}

const DEFAULT_PLAYER_FALLBACK: PlayerProfile = {
  id: 'guest-aspirant',
  name: 'Aspirant',
  avatar: '👨‍🎓',
  country: 'India',
  countryCode: 'IN',
  targetExam: 'SSC CGL',
  tier: 'Aspirant',
  tierTitle: 'Aspirant',
  rankPoints: 1200,
  pyqScore: 0,
  level: 1,
  matchesPlayed: 0,
  matchesWon: 0,
  winStreak: 0,
  accuracyRate: 0,
  bestCategory: 'synonyms',
  badges: [],
};

export const AiTutorTab: React.FC<AiTutorTabProps> = ({
  player = DEFAULT_PLAYER_FALLBACK,
  streak,
  savedWords = [],
  onStartTargetedPractice,
}) => {
  // Diagnostics State (Week / Month / All-time)
  const [selectedPeriod, setSelectedPeriod] = useState<MentorPeriod>('week');
  const analytics = useMemo(() => {
    return calculateMentorAnalytics(
      selectedPeriod,
      player,
      streak || { currentStreak: 0, longestStreak: 0, lastActiveDate: '', lastActiveTimestamp: 0, claimedToday: false, totalDaysActive: 0, history: {} },
      savedWords
    );
  }, [selectedPeriod, player, streak, savedWords]);

  const [mentorReport, setMentorReport] = useState<MentorAiReport | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [isPreparingDrill, setIsPreparingDrill] = useState<boolean>(false);

  // Load diagnostics report on mount and period change
  useEffect(() => {
    let isMounted = true;
    const loadReport = async () => {
      setReportLoading(true);
      try {
        const report = await getVocabMentorReport(analytics, false);
        if (isMounted) setMentorReport(report);
      } catch (err) {
        console.warn('Failed to load mentor report:', err);
      } finally {
        if (isMounted) setReportLoading(false);
      }
    };
    loadReport();
    return () => { isMounted = false; };
  }, [selectedPeriod, analytics.totalAttempted]);

  const handleRefreshReport = async () => {
    soundManager.playTap();
    setReportLoading(true);
    try {
      const fresh = await getVocabMentorReport(analytics, true);
      setMentorReport(fresh);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // Targeted Practice Drill for weak areas
  const handleLaunchWeakAreasDrill = () => {
    soundManager.playTap();
    if (!onStartTargetedPractice) return;
    setIsPreparingDrill(true);
    try {
      const exam = (player.targetExam as ExamType) || 'SSC_CGL';
      const drillQuestions = buildWeakAreasDrillQuestions(analytics, exam, 10);
      const weakName = analytics.weakestCategory
        ? analytics.categoryStats[analytics.weakestCategory]?.name
        : 'Priority Vocab';
      onStartTargetedPractice(drillQuestions, `Weak Areas Drill · ${weakName}`);
    } catch (e) {
      console.error('Error starting targeted practice:', e);
    } finally {
      setIsPreparingDrill(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 pb-20 max-w-5xl mx-auto w-full">
      {/* 1. Header: Sleek, compact 1-line layout on both mobile and laptop */}
      <div className="flex items-center gap-2.5 px-1 py-1">
        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-sm">
          <Sparkles className="w-4 h-4" />
        </div>
        <h1 className="text-base sm:text-lg font-black text-slate-100 tracking-tight whitespace-nowrap">
          AI Vocab Mentor
        </h1>
      </div>

      {/* 2. Performance Diagnostics Page */}
      <MentorDiagnosticsView
        analytics={analytics}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        mentorReport={mentorReport}
        reportLoading={reportLoading}
        onRefreshReport={handleRefreshReport}
        onLaunchDrill={handleLaunchWeakAreasDrill}
        isPreparingDrill={isPreparingDrill}
        player={player}
        savedWords={savedWords}
      />
    </div>
  );
};
