export type QuestionCategory = 'synonyms' | 'antonyms' | 'ows' | 'idioms';

export type ExamType = 
  | 'ALL'
  | 'SSC_CGL'
  | 'SSC_CHSL'
  | 'SSC_CPO'
  | 'SSC_MTS'
  | 'RRB_NTPC'
  | 'RRB_GROUP_D'
  | 'BANK_PO'
  | 'CDS_NDA';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ImportanceLevel = 'high' | 'very-high' | 'ultra-high';

export interface Question {
  id: string;
  category: QuestionCategory;
  wordOrPhrase: string; // The core word, idiom, or description for OWS
  instruction?: string; // e.g. "Select the most appropriate ANTONYM of the given word"
  options: string[];
  correctIndex: number;
  meaning: string;
  hindiMeaning: string;
  exampleSentence: string;
  mnemonic: string; // Memory trick / Hinglish hook
  rootWordInfo?: string; // Etymology / Prefix / Suffix breakdown
  examHistory: string[]; // e.g. ["SSC CGL 2023 Tier-1", "SSC CPO 2022", "RRB NTPC 2021"]
  repeatCount: number; // e.g. 14
  importanceLevel: ImportanceLevel;
  difficulty: Difficulty;
}

export type RankTier = 
  | 'Aspirant' 
  | 'Clerk_Assistant' 
  | 'Auditor_Accountant' 
  | 'GST_IT_Inspector' 
  | 'Gazetted_Officer'
  | 'Apex_Officer';

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
  photoURL?: string;
  email?: string;
  country: string;
  countryCode: string;
  targetExam: string;
  rankPoints: number; // LP
  pyqScore: number; // Persistent PYQ drill score (+10 correct, -2 wrong)
  tier: RankTier;
  tierTitle: string;
  level: number;
  matchesPlayed: number;
  matchesWon: number;
  winStreak: number;
  accuracyRate: number;
  bestCategory: QuestionCategory;
  badges: string[];
}

export interface PlayerAnswerRecord {
  questionId: string;
  selectedIndex: number;
  timeTakenMs: number;
  isCorrect: boolean;
  scoreGained: number;
}

export interface MatchState {
  matchId: string;
  isRealPlayer?: boolean;
  realRoomId?: string;
  mode: '1v1_ranked' | 'quick_duel' | 'daily_challenge' | 'exam_sprint';
  categoryFilter: QuestionCategory | 'mixed';
  examFilter: ExamType;
  opponent: PlayerProfile;
  questions: Question[];
  currentQuestionIndex: number;
  playerScore: number;
  opponentScore: number;
  playerAnswers: PlayerAnswerRecord[];
  opponentAnswers: PlayerAnswerRecord[];
  status: 'matching' | 'ready' | 'in_round' | 'round_feedback' | 'finished';
  questionStartTime: number;
  timeRemainingSec: number;
  comboStreak: number;
  opponentCombo: number;
  activeEmotes: {
    sender: 'player' | 'opponent';
    emoji: string;
    text?: string;
    timestamp: number;
  }[];
  powerups: {
    fiftyFiftyUsed: boolean;
    freezeTimeUsed: boolean;
    hintUsed: boolean;
  };
  eliminatedOptionIndices: number[];
  isTimeFrozen: boolean;
  hintRevealed: boolean;
  finalResult?: {
    winnerId: string;
    loserId: string;
    player1FinalScore: number;
    player2FinalScore: number;
    player1LPChange: number;
    player2LPChange: number;
    finalised: boolean;
  };
}

export interface SavedWord {
  question: Question;
  savedAt: number;
  mistakeCount: number;
  correctCount: number;
  isBookmarked: boolean;
  isUserSaved?: boolean;
  lastReviewedAt?: number;
}

export interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  countryCode: string;
  targetExam: string;
  rankPoints: number;
  tierTitle: string;
  winRate: number;
  winStreak: number;
  isCurrentUser?: boolean;
}

export type SubscriptionPlanId = 'monthly' | 'quarterly' | 'six_months' | 'annual' | 'lifetime';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  price: number;
  displayPrice: string;
  perMonthPrice: string;
  badge?: string;
  periodDurationDays?: number;
  periodLabel: string;
}

export interface UserSubscription {
  isPremium: boolean;
  planId?: SubscriptionPlanId;
  planName?: string;
  subscribedAt?: number;
  renewalDate?: string;
  autoRenew: boolean;
}

export interface DailyStreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  lastActiveTimestamp: number;
  claimedToday: boolean;
  totalDaysActive: number;
  history: Record<string, boolean>; // { "2026-08-14": true }
  streakBrokenNotice?: boolean;
}

