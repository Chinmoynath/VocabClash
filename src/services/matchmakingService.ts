import { Question, PlayerProfile, QuestionCategory, ExamType, LeaderboardUser } from '../types';
import { OPPONENT_POOL } from '../data/mockQuestions';
import { questionBankEngine } from './questionBankEngine';

export function getFilteredQuestions(
  category: QuestionCategory | 'mixed',
  exam: ExamType,
  count: number = 20
): Question[] {
  return questionBankEngine.getUniqueQuestionsForMatch(category, exam, count);
}

export function getFirstMatchQuestions(exam: ExamType = 'SSC_CGL'): Question[] {
  return questionBankEngine.getFirstMatchQuestions(exam);
}

export function getSpeedBlitzSessionQuestions(
  category: QuestionCategory | 'mixed' = 'mixed',
  exam: ExamType = 'ALL',
  count: number = 10
): Question[] {
  return questionBankEngine.getSpeedBlitzSessionQuestions(category, exam, count);
}

export function deduplicateAndEnsureCount(
  questions: Question[] | undefined | null,
  category: QuestionCategory | 'mixed' = 'mixed',
  exam: ExamType = 'ALL',
  targetCount: number = 10
): Question[] {
  return questionBankEngine.deduplicateAndEnsureCount(questions, category, exam, targetCount);
}

export function getNextDrillQuestion(
  category: QuestionCategory | 'mixed',
  exam: ExamType,
  recentWordsHistory: string[] = []
): Question {
  return questionBankEngine.getNextDrillQuestion(category, exam, recentWordsHistory);
}

export function getCategoryQuestionCount(category: QuestionCategory | 'mixed'): number {
  return questionBankEngine.getCategoryCount(category);
}

let recentOpponentNames: string[] = [];

export function generateMatchedOpponent(playerLP: number, preferredExam: ExamType): PlayerProfile {
  // Filter out recently faced opponents so matches always feel fresh and varied
  let candidatePool = OPPONENT_POOL.filter(opp => !recentOpponentNames.includes(opp.name));
  if (candidatePool.length === 0) {
    recentOpponentNames = [];
    candidatePool = [...OPPONENT_POOL];
  }

  // Pick random candidate from unencountered pool
  const randomOpponent = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  recentOpponentNames.push(randomOpponent.name);
  if (recentOpponentNames.length > 15) {
    recentOpponentNames.shift();
  }

  const lpVariance = Math.floor(Math.random() * 140) - 70;
  const simulatedLP = Math.max(100, playerLP + lpVariance);

  let targetExam = randomOpponent.targetExam;
  if (preferredExam !== 'ALL') {
    const examNames: Record<string, string> = {
      SSC: 'SSC Aspirant (CGL / CHSL)',
      SSC_CGL: 'SSC CGL 2026 (GST / IT Inspector)',
      SSC_CHSL: 'SSC CHSL 10+2 Ranker',
      SSC_CPO: 'SSC CPO Sub-Inspector (Delhi Police)',
      SSC_MTS: 'SSC MTS Top Ranker',
      SSC_STENO: 'SSC Stenographer Aspirant',
      DSSSB: 'DSSSB Aspirant (Delhi Govt)',
      DSSSB_ASO: 'DSSSB ASO / DASS Grade-II',
      DSSSB_DASS_G2: 'DSSSB DASS Grade-II Aspirant',
      DSSSB_JA: 'DSSSB Junior Assistant (JA / Steno)',
      DSSSB_MTS: 'DSSSB MTS Aspirant',
      DSSSB_UDC_SSA: 'DSSSB UDC / SSA Aspirant',
      DSSSB_PGT_TGT: 'DSSSB Teaching (TGT/PGT/PRT)',
      DSSSB_OTHER: 'DSSSB Delhi Govt Candidate',
      BANKING: 'Banking Aspirant (SBI / IBPS)',
      BANK_SBI_PO: 'SBI PO Aspirant',
      BANK_IBPS_PO: 'IBPS PO Aspirant',
      BANK_SBI_CLERK: 'SBI Clerk Ranker',
      BANK_IBPS_CLERK: 'IBPS Clerk Candidate',
      BANK_RRB_RBI: 'RRB & RBI Officer Aspirant',
      BANK_PO: 'SBI / IBPS PO Specialist',
      DEFENCE: 'Defence Officer Aspirant (CDS / AFCAT / NDA)',
      DEF_CDS: 'CDS Officer Cadet (IMA/OTA)',
      DEF_AFCAT: 'AFCAT Flying Officer Aspirant',
      DEF_NDA: 'NDA Cadet (Khadakwasla)',
      DEF_CAPF: 'CAPF Assistant Commandant Aspirant',
      CDS_NDA: 'CDS / NDA Officer Cadet',
      RRB_NTPC: 'RRB NTPC Commercial Apprentice',
      RRB_GROUP_D: 'RRB Railway Aspirant',
    };
    targetExam = examNames[preferredExam] || targetExam;
  }

  const simulatedTier = getTierFromLP(simulatedLP);
  const simulatedTierTitle = getTierTitle(simulatedTier);

  return {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: randomOpponent.name,
    avatar: randomOpponent.avatar,
    country: 'India',
    countryCode: 'IN',
    targetExam: targetExam,
    rankPoints: simulatedLP,
    pyqScore: Math.floor(simulatedLP * 1.5),
    tier: simulatedTier,
    tierTitle: simulatedTierTitle,
    level: Math.max(1, Math.floor(simulatedLP / 180) + 1),
    matchesPlayed: Math.floor(Math.random() * 180) + 30,
    matchesWon: Math.floor(Math.random() * 120) + 20,
    winStreak: randomOpponent.winStreak,
    accuracyRate: randomOpponent.winRate,
    bestCategory: 'synonyms',
    badges: ['Govt Aspirant', 'PYQ Veteran'],
  };
}

export function getTierFromLP(lp: number): PlayerProfile['tier'] {
  if (lp >= 4500) return 'Apex_Officer';
  if (lp >= 3000) return 'Gazetted_Officer';
  if (lp >= 2000) return 'GST_IT_Inspector';
  if (lp >= 1200) return 'Auditor_Accountant';
  if (lp >= 600) return 'Clerk_Assistant';
  return 'Aspirant';
}

import { getCategoryTierTitle } from '../utils/cadreCategoryService';

export function getTierTitle(tier: PlayerProfile['tier'], targetExam?: string | null): string {
  return getCategoryTierTitle(tier, targetExam);
}

export function calculateScore(isCorrect: boolean, timeRemainingSec: number, maxTimeSec: number, combo: number): number {
  if (!isCorrect) {
    return -40; // Negative marking penalty like real SSC / Govt exams!
  }

  const fractionLeft = timeRemainingSec / maxTimeSec;
  let baseScore = 100;

  if (fractionLeft > 0.75) {
    baseScore = 150; // Speed demon bonus
  } else if (fractionLeft > 0.5) {
    baseScore = 125;
  } else if (fractionLeft > 0.25) {
    baseScore = 100;
  } else {
    baseScore = 75;
  }

  // Combo multiplier: +15% per combo point above 1 (max +50%)
  const comboBonus = combo > 1 ? Math.min(0.5, (combo - 1) * 0.15) : 0;
  return Math.round(baseScore * (1 + comboBonus));
}

export function simulateOpponentAnswer(
  question: Question,
  opponentAccuracy: number,
  maxTimeSec: number = 15
): { selectedIndex: number; timeTakenMs: number; isCorrect: boolean } {
  // Base accuracy with natural per-question noise (±8%)
  const accuracyNoise = Math.random() * 16 - 8;
  let effectiveAccuracy = Math.min(0.95, Math.max(0.45, (opponentAccuracy + accuracyNoise) / 100));

  if (question.difficulty === 'hard') effectiveAccuracy *= 0.82;
  if (question.difficulty === 'easy') effectiveAccuracy = Math.min(0.96, effectiveAccuracy * 1.12);

  // Even strong bots sometimes misread or slip on a question
  const isCorrect = Math.random() < effectiveAccuracy;

  // Realistic human reaction time profiles:
  // Profile 1 (Fast instinct): ~1.5s - 3.0s (30% of rounds)
  // Profile 2 (Normal reading & deliberation): ~2.6s - 5.0s (50% of rounds)
  // Profile 3 (Careful double-check / hesitation): ~4.8s - 7.5s (16% of rounds)
  // Profile 4 (Brain-freeze / slow response): ~9.5s - 13.5s (4% of rounds)
  const profileRoll = Math.random();
  let timeTakenMs: number;
  if (profileRoll < 0.30) {
    timeTakenMs = Math.round(1500 + Math.random() * 1500); // 1.5s - 3.0s
  } else if (profileRoll < 0.80) {
    timeTakenMs = Math.round(2600 + Math.random() * 2400); // 2.6s - 5.0s
  } else if (profileRoll < 0.96) {
    timeTakenMs = Math.round(4800 + Math.random() * 2700); // 4.8s - 7.5s
  } else {
    timeTakenMs = Math.round(9500 + Math.random() * 4000); // 9.5s - 13.5s
  }

  // Ensure time taken is safely bounded within round time
  timeTakenMs = Math.min(maxTimeSec * 1000 - 400, Math.max(1300, timeTakenMs));

  let selectedIndex: number;
  if (isCorrect) {
    selectedIndex = question.correctIndex;
  } else {
    // Pick wrong option from available options (0..3)
    const wrongOptions = [0, 1, 2, 3].filter(idx => idx !== question.correctIndex && idx < question.options.length);
    selectedIndex = wrongOptions.length > 0
      ? wrongOptions[Math.floor(Math.random() * wrongOptions.length)]
      : (question.correctIndex + 1) % question.options.length;
  }

  return { selectedIndex, timeTakenMs, isCorrect };
}

export function generateRandomOpponentEmote(): { emoji: string; text?: string } {
  const emotes = [
    { emoji: '🔥', text: 'Speed run!' },
    { emoji: '⚡', text: 'PYQ pattern master!' },
    { emoji: '👏', text: 'Good answer!' },
    { emoji: '🤯', text: 'Tricky question!' },
    { emoji: '💪', text: 'Targeting CGL 2026!' },
    { emoji: '🎯', text: 'Spot on!' },
    { emoji: '😎', text: 'Revised this yesterday!' },
  ];
  return emotes[Math.floor(Math.random() * emotes.length)];
}
