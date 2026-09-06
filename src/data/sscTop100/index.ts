import { Question, QuestionCategory } from '../../types';
import { getRankedSscTop100Synonyms } from './top100Synonyms';
import { getRankedSscTop100Antonyms } from './top100Antonyms';
import { getRankedSscTop100OWS } from './top100Ows';
import { getRankedSscTop100Idioms } from './top100Idioms';
import { balanceAndRandomizeQuestions } from './randomizer';

export { balanceAndRandomizeQuestions } from './randomizer';

export type SscTop100Category = 'synonyms' | 'antonyms' | 'ows' | 'idioms';

export interface SscTop100CategoryInfo {
  id: SscTop100Category;
  category: QuestionCategory;
  title: string;
  hindiTitle: string;
  subtitle: string;
  badge: string;
  icon: string;
  description: string;
  targetCount: number;
}

export const SSC_TOP_100_CATEGORIES: SscTop100CategoryInfo[] = [
  {
    id: 'synonyms',
    category: 'synonyms',
    title: 'Top 100 Synonyms',
    hindiTitle: 'पर्यायवाची शब्द',
    subtitle: 'Most Repeated in SSC CGL, CHSL, CPO & MTS',
    badge: 'High Frequency',
    icon: '🔥',
    description: 'Master the 100 most asked synonyms with Hindi meanings, mnemonics, and all 4 option explanations.',
    targetCount: 100,
  },
  {
    id: 'antonyms',
    category: 'antonyms',
    title: 'Top 100 Antonyms',
    hindiTitle: 'विलोम शब्द',
    subtitle: 'Highest Repetition Rate in SSC Exams',
    badge: 'High Frequency',
    icon: '⚡',
    description: 'Conquer the 100 most frequent antonyms that regularly appear across SSC Tier-1 & Tier-2 shifts.',
    targetCount: 100,
  },
  {
    id: 'ows',
    category: 'ows',
    title: 'Top 100 One Word Substitutions',
    hindiTitle: 'अनेक शब्दों के लिए एक शब्द',
    subtitle: 'Core Repeated OWS Bank (TCS/SSC)',
    badge: 'High Frequency',
    icon: '🎯',
    description: 'Learn the definitive 100 One Word Substitutions with roots (biblio, somna, omni) and distractors.',
    targetCount: 100,
  },
  {
    id: 'idioms',
    category: 'idioms',
    title: 'Top 100 Idioms & Phrases',
    hindiTitle: 'मुहावरे एवं लोकोक्तियां',
    subtitle: 'Must-Know SSC Idioms with Origins',
    badge: 'High Frequency',
    icon: '💡',
    description: '100 most repeated English idioms with authentic meanings, Hinglish tricks, and exam appearances.',
    targetCount: 100,
  },
];

export function getAuthoritativeSscTop100Questions(cat: SscTop100Category): Question[] {
  let list: Question[] = [];
  switch (cat) {
    case 'synonyms':
      list = getRankedSscTop100Synonyms();
      break;
    case 'antonyms':
      list = getRankedSscTop100Antonyms();
      break;
    case 'ows':
      list = getRankedSscTop100OWS();
      break;
    case 'idioms':
      list = getRankedSscTop100Idioms();
      break;
    default:
      return [];
  }
  return balanceAndRandomizeQuestions(list);
}

export const getTop100Questions = getAuthoritativeSscTop100Questions;

export const SSC_TOP_100_META: Record<SscTop100Category, SscTop100CategoryInfo> = {
  synonyms: SSC_TOP_100_CATEGORIES[0],
  antonyms: SSC_TOP_100_CATEGORIES[1],
  ows: SSC_TOP_100_CATEGORIES[2],
  idioms: SSC_TOP_100_CATEGORIES[3],
};

