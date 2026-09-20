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

export type BotTimingPersonality = 'FAST' | 'CAREFUL' | 'BALANCED';

export interface BotMatchSession {
  botId: string;
  botName: string;
  baseAccuracy: number; // 0 to 100
  matchForm: number; // stable -5 to +5% for the whole match
  timingStyle: BotTimingPersonality;
  recentBotStreak: number;
  lastMissedCount: number;
}

export interface BotRoundDecision {
  selectedIndex: number;
  timeTakenMs: number;
  isCorrect: boolean;
  questionId: string;
}

/**
 * Calculates a dynamic, authentic bot opponent ability rating.
 * Ensures rivals have realistic unpredictability across the spectrum (50%, 60%, 80%, 90%)
 * so matches remain engaging and exciting without locking users into only low-tier bots.
 */
export function calculateCalibratedBotSkill(
  playerLP: number,
  playerStats?: { accuracyRate?: number; matchesPlayed?: number; pyqScore?: number } | null
): number {
  const isHighTier = playerLP >= 2500 || (playerStats?.accuracyRate && playerStats.accuracyRate >= 75);
  const roll = Math.random();

  let selectedAccuracy: number;

  if (isHighTier) {
    // High tier player distribution:
    // 15% Casual/Warmup: 52% - 62%
    // 35% Strong Contender: 68% - 78%
    // 35% High Ranker: 80% - 87%
    // 15% Apex Master / Topper: 88% - 93%
    if (roll < 0.15) {
      selectedAccuracy = Math.round(52 + Math.random() * 10);
    } else if (roll < 0.50) {
      selectedAccuracy = Math.round(68 + Math.random() * 10);
    } else if (roll < 0.85) {
      selectedAccuracy = Math.round(80 + Math.random() * 7);
    } else {
      selectedAccuracy = Math.round(88 + Math.random() * 5);
    }
  } else {
    // General / Beginner / Intermediate player distribution:
    // 25% Novice / Foundation Aspirant: 48% - 56% (~50%)
    // 35% Steady Competitor: 58% - 68% (~60%)
    // 25% Sharp Ranker: 76% - 84% (~80%)
    // 15% Topper / High-Scorer: 86% - 92% (~90%)
    if (roll < 0.25) {
      selectedAccuracy = Math.round(48 + Math.random() * 8);
    } else if (roll < 0.60) {
      selectedAccuracy = Math.round(58 + Math.random() * 10);
    } else if (roll < 0.85) {
      selectedAccuracy = Math.round(76 + Math.random() * 8);
    } else {
      selectedAccuracy = Math.round(86 + Math.random() * 6);
    }
  }

  // Safe clamping bounds: 45% to 93%
  return Math.max(45, Math.min(93, selectedAccuracy));
}

/**
 * Creates a stable match-level bot session with fixed form (-5% to +5%) and timing personality.
 */
export function createBotMatchSession(
  botProfile: PlayerProfile,
  playerLP: number,
  playerStats?: { accuracyRate?: number; matchesPlayed?: number; pyqScore?: number } | null
): BotMatchSession {
  const baseAccuracy = typeof botProfile.accuracyRate === 'number' && botProfile.accuracyRate > 0
    ? botProfile.accuracyRate
    : calculateCalibratedBotSkill(playerLP, playerStats);

  // Hidden match form: stable between -5% and +5% for the duration of this match
  const matchForm = Math.round((Math.random() * 10 - 5) * 10) / 10;

  // Stable timing personality for this rival:
  // 30% FAST, 25% CAREFUL, 45% BALANCED
  const timingRoll = Math.random();
  const timingStyle: BotTimingPersonality = timingRoll < 0.30
    ? 'FAST'
    : timingRoll < 0.55
      ? 'CAREFUL'
      : 'BALANCED';

  return {
    botId: botProfile.id,
    botName: botProfile.name,
    baseAccuracy,
    matchForm,
    timingStyle,
    recentBotStreak: 0,
    lastMissedCount: 0,
  };
}

export function generateMatchedOpponent(
  playerLP: number, 
  preferredExam: ExamType,
  playerStats?: { accuracyRate?: number; matchesPlayed?: number; pyqScore?: number } | null
): PlayerProfile {
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

  // Calibrate baseline accuracy to player's ability
  const calibratedAccuracy = calculateCalibratedBotSkill(playerLP, playerStats);

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
    accuracyRate: calibratedAccuracy,
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
  opponentAccuracyOrSession: number | BotMatchSession,
  maxTimeSec: number = 15,
  sessionState?: {
    recentBotStreak?: number;
    lastMissedCount?: number;
  }
): BotRoundDecision {
  const baseAccuracy: number = typeof opponentAccuracyOrSession === 'number'
    ? opponentAccuracyOrSession
    : opponentAccuracyOrSession.baseAccuracy;
  const matchForm: number = typeof opponentAccuracyOrSession === 'object' && opponentAccuracyOrSession !== null
    ? opponentAccuracyOrSession.matchForm
    : 0;
  const timingStyle: BotTimingPersonality = typeof opponentAccuracyOrSession === 'object' && opponentAccuracyOrSession !== null
    ? opponentAccuracyOrSession.timingStyle
    : 'BALANCED';

  const isSessionObj = typeof opponentAccuracyOrSession === 'object' && opponentAccuracyOrSession !== null;
  const recentStreak = sessionState?.recentBotStreak ?? (isSessionObj ? opponentAccuracyOrSession.recentBotStreak : 0);
  const lastMissed = sessionState?.lastMissedCount ?? (isSessionObj ? opponentAccuracyOrSession.lastMissedCount : 0);

  // 1. Base skill + stable match form + small question noise (±3%)
  const baseSkillFraction = baseAccuracy / 100;
  const matchFormFraction = matchForm / 100;
  const smallQuestionNoise = (Math.random() * 6 - 3) / 100;

  // 2. Question Difficulty Modifier
  let difficultyModifier = 0;
  if (question.difficulty === 'easy') {
    difficultyModifier = 0.12; // +12% accuracy boost
  } else if (question.difficulty === 'hard') {
    difficultyModifier = -0.15; // -15% accuracy penalty
  }

  // High-frequency PYQ concept boost
  let frequencyModifier = 0;
  if (question.importanceLevel === 'ultra-high' || (question.repeatCount && question.repeatCount >= 10)) {
    frequencyModifier = 0.03;
  }

  // 3. Natural Streak Confidence (tiny momentum effect)
  let streakModifier = 0;
  if (recentStreak >= 2) {
    streakModifier = 0.02; // Small confidence boost after 2 consecutive correct answers
  } else if (lastMissed >= 2) {
    streakModifier = -0.02; // Small hesitation after 2 consecutive wrong answers
  }

  // Effective accuracy clamped between 35% and 94%
  const effectiveAccuracy = Math.max(
    0.35,
    Math.min(0.94, baseSkillFraction + matchFormFraction + difficultyModifier + frequencyModifier + streakModifier + smallQuestionNoise)
  );

  const isCorrect = Math.random() < effectiveAccuracy;

  // 4. Contextual Response-Time Modeling
  // Determine probability weights across the 4 reaction profiles based on difficulty, yield, and correctness
  let wFast = 25;
  let wNormal = 50;
  let wHesitate = 20;
  let wStruggle = 5;

  if (question.difficulty === 'easy') {
    wFast += 18;
    wNormal += 0;
    wHesitate -= 14;
    wStruggle = 1;
  } else if (question.difficulty === 'hard') {
    wFast -= 14;
    wNormal -= 12;
    wHesitate += 18;
    wStruggle += 8;
  }

  if (question.importanceLevel === 'ultra-high' || (question.repeatCount && question.repeatCount >= 10)) {
    wFast += 8;
    wHesitate -= 6;
  }

  if (!isCorrect) {
    // When wrong, slightly higher hesitation/struggle or quick impulse error (15%)
    wFast = Math.max(12, Math.round(wFast * 0.7));
    wHesitate += 8;
    wStruggle += 4;
  }

  // Adjust for rival's timing personality
  if (timingStyle === 'FAST') {
    wFast += 15;
    wNormal += 5;
    wHesitate = Math.max(8, wHesitate - 12);
    wStruggle = Math.max(1, wStruggle - 4);
  } else if (timingStyle === 'CAREFUL') {
    wFast = Math.max(8, wFast - 12);
    wNormal += 0;
    wHesitate += 15;
    wStruggle += 5;
  }

  // Normalize weights to 1.0
  const totalWeight = Math.max(1, wFast + wNormal + wHesitate + wStruggle);
  const pFast = wFast / totalWeight;
  const pNormal = (wFast + wNormal) / totalWeight;
  const pHesitate = (wFast + wNormal + wHesitate) / totalWeight;

  const roll = Math.random();
  let timeTakenMs: number;

  if (roll < pFast) {
    // Fast recall: ~1.5s - 2.9s
    timeTakenMs = Math.round(1500 + Math.random() * 1400);
  } else if (roll < pNormal) {
    // Normal reading: ~2.7s - 5.1s
    timeTakenMs = Math.round(2700 + Math.random() * 2400);
  } else if (roll < pHesitate) {
    // Hesitation / deliberate check: ~4.8s - 7.6s
    timeTakenMs = Math.round(4800 + Math.random() * 2800);
  } else {
    // Struggle / freeze: ~8.5s - 13.2s
    timeTakenMs = Math.round(8500 + Math.random() * 4700);
  }

  // Micro-jitter to prevent repeating timestamps
  const jitter = Math.round(Math.random() * 200 - 100);
  let styleOffset = 0;
  if (timingStyle === 'FAST') styleOffset = -350;
  if (timingStyle === 'CAREFUL') styleOffset = 450;

  timeTakenMs += jitter + styleOffset;
  timeTakenMs = Math.min(maxTimeSec * 1000 - 500, Math.max(1350, timeTakenMs));

  // 5. Option Selection
  let selectedIndex: number;
  if (isCorrect) {
    selectedIndex = question.correctIndex;
  } else {
    // Pick from incorrect options, preferring plausible distractors if available
    const wrongIndices = [0, 1, 2, 3].filter(idx => idx !== question.correctIndex && idx < question.options.length);

    if (wrongIndices.length > 0) {
      if (question.optionDetails && question.optionDetails.length === question.options.length) {
        // If optionDetails exist, check for distractor clues
        const plausibleDistractors = wrongIndices.filter(idx => {
          const detail = question.optionDetails![idx];
          return detail && (detail.shortExplanation || detail.hindiMeaning);
        });
        if (plausibleDistractors.length > 0 && Math.random() < 0.6) {
          selectedIndex = plausibleDistractors[Math.floor(Math.random() * plausibleDistractors.length)];
        } else {
          selectedIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
        }
      } else {
        selectedIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      }
    } else {
      selectedIndex = (question.correctIndex + 1) % question.options.length;
    }
  }

  return { 
    selectedIndex, 
    timeTakenMs, 
    isCorrect, 
    questionId: question.id 
  };
}
