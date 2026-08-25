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
      SSC_CGL: 'SSC CGL 2026 (GST / IT Inspector)',
      SSC_CHSL: 'SSC CHSL 10+2 Ranker',
      SSC_CPO: 'SSC CPO Sub-Inspector (Delhi Police)',
      SSC_MTS: 'SSC MTS Top Ranker',
      RRB_NTPC: 'RRB NTPC Commercial Apprentice',
      RRB_GROUP_D: 'RRB Railway Aspirant',
      BANK_PO: 'SBI / IBPS PO Specialist',
      CDS_NDA: 'CDS / NDA Officer Cadet',
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

export function getTierTitle(tier: PlayerProfile['tier']): string {
  switch (tier) {
    case 'Apex_Officer': return '👑 Apex Cadre Officer (Level 14+)';
    case 'Gazetted_Officer': return '🎖️ Gazetted Officer (Group A / 5400 GP)';
    case 'GST_IT_Inspector': return '💎 GST / IT Inspector (4600 GP)';
    case 'Auditor_Accountant': return '🥇 Auditor / Accountant (2800 GP)';
    case 'Clerk_Assistant': return '🥈 Assistant / Clerk (2400 GP)';
    case 'Aspirant': return '🥉 Govt Job Aspirant';
  }
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
  maxTimeSec: number
): { selectedIndex: number; timeTakenMs: number; isCorrect: boolean } {
  // Accuracy check adjusted by question difficulty
  let effectiveAccuracy = opponentAccuracy / 100;
  if (question.difficulty === 'hard') effectiveAccuracy *= 0.8;
  if (question.difficulty === 'easy') effectiveAccuracy = Math.min(0.96, effectiveAccuracy * 1.15);

  const isCorrect = Math.random() < effectiveAccuracy;

  // Realistic human reaction time (1.6s to 8.5s)
  const baseTime = 1600 + Math.random() * (maxTimeSec * 650);
  const timeTakenMs = Math.min(maxTimeSec * 1000 - 500, Math.max(1200, Math.floor(baseTime)));

  let selectedIndex: number;
  if (isCorrect) {
    selectedIndex = question.correctIndex;
  } else {
    // Pick wrong option
    const wrongOptions = [0, 1, 2, 3].filter(idx => idx !== question.correctIndex);
    selectedIndex = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
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
