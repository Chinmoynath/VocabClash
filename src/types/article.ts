export type ArticleCategory = 
  | 'ssc'
  | 'banking'
  | 'defence'
  | 'vocabulary'
  | 'pyqs'
  | 'strategy'
  | 'general';

export type ArticleStatus = 'draft' | 'published';

export interface ArticleImage {
  url: string;
  alt: string;
  caption?: string;
}

export interface ArticleSeo {
  title: string;
  description: string;
  canonical?: string;
}

export interface RelatedPracticeConfig {
  type: string;
  route: string;
  label: string;
  subtitle?: string;
}

export interface ArticleAuthor {
  name: string;
  email?: string;
  role?: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Clean semantic HTML
  category: ArticleCategory;
  tags: string[];
  featuredImage: ArticleImage;
  seo: ArticleSeo;
  relatedPractice: RelatedPracticeConfig;
  status: ArticleStatus;
  publishedAt: string | null; // ISO 8601 string
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  author: ArticleAuthor;
  readingTimeMinutes: number;
  viewsCount?: number;
}

export type ArticleInput = Omit<Article, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export interface RelatedPracticePreset {
  id: string;
  label: string;
  category: string;
  route: string;
  subtitle: string;
}

export const RELATED_PRACTICE_PRESETS: RelatedPracticePreset[] = [
  {
    id: 'ssc_top100_synonyms',
    label: 'Practice Top 100 SSC Synonyms',
    category: 'SSC English',
    route: '/ssc-top-100-synonyms',
    subtitle: 'Master highest-frequency synonyms extracted from official SSC CGL/CHSL papers with 1v1 battle testing.'
  },
  {
    id: 'ssc_top100_antonyms',
    label: 'Practice Top 100 SSC Antonyms',
    category: 'SSC English',
    route: '/ssc-top-100-antonyms',
    subtitle: 'Test your grasp of exam opposites, confusing word pairs, and recurrent trap options.'
  },
  {
    id: 'ssc_top100_ows',
    label: 'Practice Top 100 One Word Substitution',
    category: 'SSC English',
    route: '/ssc-top-100-one-word-substitution',
    subtitle: 'High-yield definitions, phobias, manias, and government terms asked repeatedly across shifts.'
  },
  {
    id: 'ssc_top100_idioms',
    label: 'Practice Top 100 Idioms & Phrases',
    category: 'SSC English',
    route: '/ssc-top-100-idioms-and-phrases',
    subtitle: 'Origin stories, exam meanings, and real usage examples for 100 indispensable idioms.'
  },
  {
    id: 'ssc_vocab_hub',
    label: 'SSC Comprehensive Vocabulary Master Hub',
    category: 'SSC Guide',
    route: '/ssc-vocabulary',
    subtitle: 'Explore 24,000+ authentic questions organized by topic, tier, and exam family.'
  },
  {
    id: 'pyq_drill',
    label: 'Launch PYQ Endless Drill',
    category: 'Practice Mode',
    route: '/pyq-drill',
    subtitle: 'Timed question sessions with instant Hindi/English meanings, mnemonics, and mistake logging.'
  },
  {
    id: 'arena_1v1',
    label: 'Play Live 1v1 Battle Arena',
    category: 'Live Multiplayer',
    route: '/',
    subtitle: 'Challenge aspirants across India in real-time fast-paced 60-second vocabulary duels.'
  },
  {
    id: 'defence_drill',
    label: 'CDS / NDA Defence English Practice',
    category: 'Defence Exams',
    route: '/pyq-drill?exam=defence',
    subtitle: 'Specialized Defence exam vocabulary, idioms in context, and military exam sentence completions.'
  },
  {
    id: 'banking_drill',
    label: 'Banking & Insurance English PYQs',
    category: 'Banking Exams',
    route: '/pyq-drill?exam=banking',
    subtitle: 'Contextual banking vocabulary, tone detection, and reading comprehension vocabulary.'
  },
  {
    id: 'mistake_vault',
    label: 'Review Your Mistake Vault',
    category: 'Personalized Review',
    route: '/mistake-vault',
    subtitle: 'Spaced repetition flashcards and targeted drills on your past incorrect answers.'
  }
];
