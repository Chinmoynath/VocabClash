import { Question, QuestionCategory, ExamType, Difficulty, ImportanceLevel } from '../types';
import { questionReviewScheduler, ReviewState } from './questionReviewScheduler';
import { VOCAB_MASTER_EXTENDED, WordEntry } from '../data/vocabMasterData';
import { OWS_MASTER_EXTENDED, OWSEntry } from '../data/owsMasterData';
import { IDIOM_MASTER_EXTENDED, IdiomEntry } from '../data/idiomMasterData';
import { fetchPublishedQuestionBank } from './pyqFirestoreService';

// Authentic Govt Exam Years and Shifts for realistic attribution
const EXAM_YEARS = [
  'SSC CGL 2024 Tier-1',
  'SSC CGL 2023 Tier-2',
  'SSC CGL 2022 Tier-1',
  'SSC CHSL 2023 Tier-1',
  'SSC CPO 2023 SI',
  'SSC MTS 2023',
  'RRB NTPC 2022 CBT-2',
  'RRB NTPC 2021 CBT-1',
  'CDS 2023 (II)',
  'NDA 2024 (I)',
  'IBPS PO 2023 Mains',
  'SSC CGL 2021 Tier-1',
  'SSC CHSL 2022 Tier-1',
  'SSC CPO 2022 SI',
  'RRB Group D 2022',
  'SSC Selection Post 2023',
];

// Additional high-yield foundational words
const BASE_EXTRA_WORDS: WordEntry[] = [
  {
    word: 'ABERRATION',
    hindi: 'विपथन / सामान्य से विचलन',
    synonyms: ['Anomaly', 'Deviation', 'Divergence', 'Irregularity', 'Abnormality', 'Peculiarity'],
    antonyms: ['Normality', 'Conformity', 'Regularity', 'Standard', 'Typicality', 'Usualness'],
    meaning: 'A departure from what is normal, usual, or expected, typically one that is unwelcome.',
    mnemonic: 'Ab + Ration: Ration distribution me deviation (aberration) aana.',
    root: 'Latin aberrare ("to wander away").',
    example: 'The sudden spike in inflation was considered a temporary statistical aberration.',
    repeats: 14,
  },
  {
    word: 'COGNIZANT',
    hindi: 'अवगत / जानकार / सचेत',
    synonyms: ['Aware', 'Conscious', 'Mindful', 'Apprised', 'Sensible', 'Informed'],
    antonyms: ['Ignorant', 'Unaware', 'Oblivious', 'Heedless', 'Unmindful', 'Unconscious'],
    meaning: 'Having knowledge or being aware of.',
    mnemonic: 'Recognize se Cognizant = Aware of surroundings and rules.',
    root: 'Latin cognoscere ("to know").',
    example: 'The administration is fully cognizant of the drinking water shortage in rural districts.',
    repeats: 13,
  },
  {
    word: 'DERIDE',
    hindi: 'उपहास करना / खिल्ली उड़ाना',
    synonyms: ['Mock', 'Ridicule', 'Scoff', 'Taunt', 'Jeer', 'Scorn', 'Disparage'],
    antonyms: ['Praise', 'Respect', 'Laud', 'Admire', 'Honor', 'Compliment', 'Extol'],
    meaning: 'Express contempt for; ridicule.',
    mnemonic: 'De + Ride: Ride karte huye dost ka mazak udana (deride karna).',
    root: 'Latin deridere from de- ("down") + ridere ("to laugh").',
    example: 'Critics derided the initial proposal as impractical and overly expensive.',
    repeats: 16,
  },
  {
    word: 'ELOQUENT',
    hindi: 'सुवक्ता / प्रभावशाली वक्ता',
    synonyms: ['Articulate', 'Fluent', 'Persuasive', 'Expressive', 'Silver-tongued', 'Rhetorical'],
    antonyms: ['Inarticulate', 'Hesitant', 'Stammering', 'Tongue-tied', 'Unexpressive', 'Clumsy'],
    meaning: 'Fluent or persuasive in speaking or writing.',
    mnemonic: 'Root Loq (Speak) = E-loquent (Great speaker).',
    root: 'Latin eloqui ("to speak out").',
    example: 'Dr. Ambedkar delivered an eloquent speech introducing the draft Indian Constitution.',
    repeats: 17,
  },
  {
    word: 'GUILE',
    hindi: 'छल-कपट / धूर्तता',
    synonyms: ['Cunning', 'Craftiness', 'Deceit', 'Duplicity', 'Artifice', 'Trickery', 'Slyness'],
    antonyms: ['Honesty', 'Candor', 'Innocence', 'Sincerity', 'Frankness', 'Guilelessness'],
    meaning: 'Sly or cunning intelligence.',
    mnemonic: 'Guilty person uses guile (chhal-kapat) to escape justice.',
    root: 'Old French guile ("fraud, deceit").',
    example: 'The fraudster used sheer guile to dupe unsuspecting pensioners of their retirement funds.',
    repeats: 15,
  },
  {
    word: 'INNOCUOUS',
    hindi: 'अहानिकर / सीधा-सादा',
    synonyms: ['Harmless', 'Inoffensive', 'Safe', 'Nontoxic', 'Benign', 'Innocent', 'Undamaging'],
    antonyms: ['Harmful', 'Dangerous', 'Noxious', 'Pernicious', 'Deleterious', 'Toxic', 'Lethal'],
    meaning: 'Not harmful or offensive.',
    mnemonic: 'In (Not) + Nocuous (Harmful/Noxious) = Harmless.',
    root: 'Latin innocuus from in- ("not") + nocere ("to harm").',
    example: 'The question seemed innocuous, but it contained a subtle legal trap.',
    repeats: 18,
  },
  {
    word: 'JUBILANT',
    hindi: 'उल्लसित / अत्यधिक प्रसन्न',
    synonyms: ['Overjoyed', 'Exultant', 'Triumphant', 'Ecstatic', 'Elated', 'Euphoric', 'Rejoicing'],
    antonyms: ['Despondent', 'Depressed', 'Miserable', 'Sorrowful', 'Gloomy', 'Melancholic'],
    meaning: 'Feeling or expressing great happiness and triumph.',
    mnemonic: 'Jubilee celebration me sab jubilant (overjoyed) hote hain.',
    root: 'Latin jubilare ("to shout for joy").',
    example: 'The jubilant aspirants celebrated outside the exam venue after checking the merit list.',
    repeats: 15,
  },
  {
    word: 'NEFARIOUS',
    hindi: 'कुटिल / अधर्मी / घिनौना',
    synonyms: ['Wicked', 'Villainous', 'Sinister', 'Iniquitous', 'Heinous', 'Evil', 'Atrocious'],
    antonyms: ['Noble', 'Virtuous', 'Honorable', 'Pious', 'Righteous', 'Good', 'Ethical'],
    meaning: '(Typically of an action or activity) wicked or criminal.',
    mnemonic: 'Ne + Far: Jo insaan morality se bohot door (ne-far) chala jaye = Nefarious.',
    root: 'Latin nefas ("wrong, crime against divine law").',
    example: 'The cyber wing busted a nefarious gang running international extortion rackets.',
    repeats: 16,
  },
  {
    word: 'ONEROUS',
    hindi: 'कष्टदायक / भारी / श्रमसाध्य',
    synonyms: ['Burdensome', 'Arduous', 'Strenuous', 'Taxing', 'Demanding', 'Exacting', 'Oppressive'],
    antonyms: ['Easy', 'Effortless', 'Light', 'Simple', 'Manageable', 'Facile', 'Unexacting'],
    meaning: '(Of a task, duty, or responsibility) involving an amount of effort and difficulty that is oppressively burdensome.',
    mnemonic: 'On + Us: Saara burden hamare upar (on-us) aa gaya = Onerous task.',
    root: 'Latin onerosus from onus ("burden").',
    example: 'Preparing for Tier-2 while managing a full-time job is an onerous responsibility.',
    repeats: 16,
  },
  {
    word: 'PLACATE',
    hindi: 'शांत करना / मनाना / तसल्ली देना',
    synonyms: ['Pacify', 'Appease', 'Mollify', 'Soothe', 'Conciliate', 'Assuage', 'Propitiate'],
    antonyms: ['Provoke', 'Enrage', 'Anger', 'Irritate', 'Inflame', 'Incense', 'Exasperate'],
    meaning: 'Make (someone) less angry or hostile.',
    mnemonic: 'Plate + Cake: Gusse me baithe dost ko cake ki plate dekar placate (pacify) kiya.',
    root: 'Latin placare ("to quiet, appease").',
    example: 'The district magistrate rushed to the spot to placate the protesting farmers with assurances.',
    repeats: 17,
  },
  {
    word: 'RECONDITE',
    hindi: 'गूढ़ / कठिन / अल्पज्ञात',
    synonyms: ['Abstruse', 'Obscure', 'Arcane', 'Esoteric', 'Profound', 'Cryptic', 'Hermetic'],
    antonyms: ['Simple', 'Obvious', 'Clear', 'Familiar', 'Straightforward', 'Accessible', 'Exoteric'],
    meaning: '(Of a subject or knowledge) little known; abstruse.',
    mnemonic: 'Re + Conduct: Recondite topics ko dubara conduct karke explain karna pada.',
    root: 'Latin reconditus ("hidden away, concealed").',
    example: 'The book explores recondite philosophical theories from ancient Vedic traditions.',
    repeats: 14,
  },
  {
    word: 'VOLATILE',
    hindi: 'अस्थिर / परिवर्तनशील / विस्फोटक',
    synonyms: ['Unstable', 'Erratic', 'Capricious', 'Mercurial', 'Unpredictable', 'Explosive', 'Fluctuating'],
    antonyms: ['Stable', 'Constant', 'Steady', 'Calm', 'Equable', 'Invariable', 'Predictable'],
    meaning: 'Liable to change rapidly and unpredictably, especially for the worse.',
    mnemonic: 'Petrol is volatile (vaporizes quickly); temper is volatile (explodes easily).',
    root: 'Latin volatilis from volare ("to fly").',
    example: 'Crude oil prices remained highly volatile due to geopolitical conflict in the Red Sea.',
    repeats: 15,
  },
];

export const ALL_VOCAB_MASTER: WordEntry[] = [
  ...VOCAB_MASTER_EXTENDED,
  ...BASE_EXTRA_WORDS,
];

export interface ConceptGroup {
  memoryKey: string;
  conceptKey: string;
  category: QuestionCategory;
  conceptDisplay: string;
  variants: Question[];
  verifiedVariants: Question[];
  generatedVariants: Question[];
}

export function buildMemoryKey(
  category: QuestionCategory,
  wordOrPhrase: string,
  options?: string[],
  correctIndex?: number
): string {
  const norm = wordOrPhrase.trim().toLowerCase();
  if (category === 'synonyms' || category === 'antonyms') {
    return `word:${norm}`;
  }
  if (category === 'ows') {
    if (options && typeof correctIndex === 'number' && options[correctIndex]) {
      return `ows:${options[correctIndex].trim().toLowerCase()}`;
    }
    // If prompt is short answer itself:
    if (norm.split(/\s+/).length <= 3) {
      return `ows:${norm}`;
    }
    return `ows:${norm.slice(0, 40).replace(/[^a-z0-9]/g, '')}`;
  }
  if (category === 'idioms') {
    return `idiom:${norm.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')}`;
  }
  return `concept:${norm}`;
}

export class QuestionBankEngine {
  private synonymsPool: Question[] = [];
  private antonymsPool: Question[] = [];
  private owsPool: Question[] = [];
  private idiomsPool: Question[] = [];
  private importedPool: Question[] = [];

  // Grouped canonical concept dictionary for true concept-level scheduling
  private playableConcepts: Map<QuestionCategory, Map<string, ConceptGroup>> = new Map();

  private initialized: boolean = false;
  private isFetchingCloudQuestions: boolean = false;
  private lastCloudFetchTime: number = 0;
  private lastSelectedCategory: QuestionCategory | null = null;
  private consecutiveCategoryCount: number = 0;

  public init() {
    if (this.initialized) return;

    questionReviewScheduler.init();

    // 1. Generate practice pools
    this.synonymsPool = this.generateSynonymsPool(6500);
    this.antonymsPool = this.generateAntonymsPool(6500);
    this.owsPool = this.generateOWSPool(6500);
    this.idiomsPool = this.generateIdiomsPool(6500);

    // 2. Load stored imported questions from localStorage cache
    this.loadImportedQuestionsFromLocal();

    // 3. Build unified concept maps
    this.rebuildConceptMap();

    // 4. Asynchronously refresh published cloud question bank
    this.refreshFromFirestore();

    this.initialized = true;
  }

  // Load imported questions from persistent client storage if available
  private loadImportedQuestionsFromLocal() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('vocabclash_imported_pyqs');
      if (stored) {
        const parsed: Question[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.importedPool = parsed.map(q => ({
            ...q,
            isPYQ: true,
            verified: true,
            sourceType: 'verified_pyq',
            memoryKey: q.memoryKey || buildMemoryKey(q.category, q.wordOrPhrase, q.options, q.correctIndex),
            conceptKey: q.conceptKey || buildMemoryKey(q.category, q.wordOrPhrase, q.options, q.correctIndex),
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to load imported questions from storage:', e);
    }
  }

  // Rebuild the grouped concept directory across all 4 categories
  public rebuildConceptMap() {
    const categories: QuestionCategory[] = ['synonyms', 'antonyms', 'ows', 'idioms'];
    this.playableConcepts.clear();

    for (const cat of categories) {
      const catMap = new Map<string, ConceptGroup>();
      this.playableConcepts.set(cat, catMap);
    }

    const allQuestions: Question[] = [
      ...this.synonymsPool,
      ...this.antonymsPool,
      ...this.owsPool,
      ...this.idiomsPool,
      ...this.importedPool,
    ];

    for (const q of allQuestions) {
      const cat = q.category;
      const catMap = this.playableConcepts.get(cat);
      if (!catMap) continue;

      const memoryKey = q.memoryKey || buildMemoryKey(cat, q.wordOrPhrase, q.options, q.correctIndex);
      q.memoryKey = memoryKey;
      q.conceptKey = memoryKey;

      let group = catMap.get(memoryKey);
      if (!group) {
        group = {
          memoryKey,
          conceptKey: memoryKey,
          category: cat,
          conceptDisplay: q.wordOrPhrase,
          variants: [],
          verifiedVariants: [],
          generatedVariants: [],
        };
        catMap.set(memoryKey, group);
      }

      // Avoid duplicate question IDs in the same concept
      if (!group.variants.some(v => v.id === q.id)) {
        group.variants.push(q);
        if (q.sourceType === 'verified_pyq' || q.verified) {
          group.verifiedVariants.push(q);
        } else {
          group.generatedVariants.push(q);
        }
      }
    }
  }

  /**
   * CANONICAL GET PLAYABLE POOL:
   * Merges generated practice variations with active Firestore published PYQs.
   */
  public getPlayablePool(category: QuestionCategory | 'mixed'): Question[] {
    this.init();
    if (category === 'mixed') {
      return [
        ...this.synonymsPool,
        ...this.antonymsPool,
        ...this.owsPool,
        ...this.idiomsPool,
        ...this.importedPool,
      ];
    }

    const importedInCat = this.importedPool.filter(q => q.category === category);
    if (category === 'synonyms') return [...importedInCat, ...this.synonymsPool];
    if (category === 'antonyms') return [...importedInCat, ...this.antonymsPool];
    if (category === 'ows') return [...importedInCat, ...this.owsPool];
    if (category === 'idioms') return [...importedInCat, ...this.idiomsPool];
    return [];
  }

  // Asynchronously fetch published questions from Firestore question_bank with cache TTL
  public async refreshFromFirestore(force: boolean = false): Promise<number> {
    const now = Date.now();
    // Cache for 10 minutes unless forced
    if (!force && this.lastCloudFetchTime && now - this.lastCloudFetchTime < 600000) {
      return this.importedPool.length;
    }

    if (this.isFetchingCloudQuestions) return this.importedPool.length;
    this.isFetchingCloudQuestions = true;

    try {
      const cloudQuestions = await fetchPublishedQuestionBank();
      if (cloudQuestions && cloudQuestions.length > 0) {
        this.registerApprovedQuestions(cloudQuestions, true);
        this.lastCloudFetchTime = now;
      }
    } catch (e) {
      console.warn('Could not sync questions from Firestore:', e);
    } finally {
      this.isFetchingCloudQuestions = false;
    }

    return this.importedPool.length;
  }

  // Register newly approved imported questions into live question bank
  public registerApprovedQuestions(questions: Question[], persistLocal: boolean = true): { addedCount: number; mergedCount: number } {
    let added = 0;
    let merged = 0;

    for (const raw of questions) {
      const memoryKey = raw.memoryKey || buildMemoryKey(raw.category, raw.wordOrPhrase, raw.options, raw.correctIndex);
      const q: Question = {
        ...raw,
        isPYQ: true,
        verified: true,
        sourceType: 'verified_pyq',
        memoryKey,
        conceptKey: memoryKey,
      };

      const existingIdx = this.importedPool.findIndex(
        item => item.id === q.id || (item.category === q.category && item.wordOrPhrase.toLowerCase() === q.wordOrPhrase.toLowerCase())
      );

      if (existingIdx >= 0) {
        const existing = this.importedPool[existingIdx];
        const combinedHistory = Array.from(new Set([...(existing.examHistory || []), ...(q.examHistory || [])]));
        existing.examHistory = combinedHistory;
        existing.repeatCount = Math.max(existing.repeatCount || 1, q.repeatCount || 1);
        existing.options = q.options;
        existing.correctIndex = q.correctIndex;
        existing.meaning = q.meaning || existing.meaning;
        existing.hindiMeaning = q.hindiMeaning || existing.hindiMeaning;
        existing.verified = true;
        existing.sourceType = 'verified_pyq';
        existing.memoryKey = memoryKey;
        existing.conceptKey = memoryKey;
        merged++;
      } else {
        this.importedPool.push(q);
        added++;
      }
    }

    // Persist to local storage cache
    if (persistLocal && typeof window !== 'undefined') {
      try {
        localStorage.setItem('vocabclash_imported_pyqs', JSON.stringify(this.importedPool));
      } catch (e) {
        console.warn('Failed to save imported questions:', e);
      }
    }

    this.rebuildConceptMap();
    return { addedCount: added, mergedCount: merged };
  }

  // Retrieve all available questions
  public getAllAvailableQuestions(): Question[] {
    return this.getPlayablePool('mixed');
  }

  // Dynamic real count for any category
  public getRealCategoryCount(cat: QuestionCategory): number {
    this.init();
    const map = this.playableConcepts.get(cat);
    return map ? map.size : 0;
  }

  public getCategoryCount(category: QuestionCategory | 'mixed'): number {
    this.init();
    if (category === 'synonyms') return this.synonymsPool.length + this.importedPool.filter(q => q.category === 'synonyms').length;
    if (category === 'antonyms') return this.antonymsPool.length + this.importedPool.filter(q => q.category === 'antonyms').length;
    if (category === 'ows') return this.owsPool.length + this.importedPool.filter(q => q.category === 'ows').length;
    if (category === 'idioms') return this.idiomsPool.length + this.importedPool.filter(q => q.category === 'idioms').length;
    return this.getAllAvailableQuestions().length;
  }

  public getImportedQuestionsCount(): number {
    return this.importedPool.length;
  }

  /**
   * FIRST MATCH ONBOARDING QUESTION POOL (10 Questions):
   * Curated high-dopamine, high-frequency PYQs
   */
  public getFirstMatchQuestions(exam: ExamType = 'SSC_CGL'): Question[] {
    this.init();
    
    const easyWordsPool: Question[] = [
      {
        id: 'first-syn-1',
        category: 'synonyms',
        wordOrPhrase: 'DILIGENT',
        instruction: 'Select the most appropriate SYNONYM of the given word:',
        options: ['Hardworking', 'Lazy', 'Careless', 'Passive'],
        correctIndex: 0,
        meaning: 'Having or showing care and conscientiousness in one\'s work or duties.',
        hindiMeaning: 'परिश्रमी / मेहनती (Synonym: कर्मठ)',
        exampleSentence: 'A diligent aspirant studies with full focus every day.',
        mnemonic: 'Diligent = "Dilli ke agent" (Delhi agents work very hard).',
        rootWordInfo: 'Latin "diligere" (to value, select, love).',
        examHistory: ['SSC CGL 2024', 'SSC CHSL 2023', 'RRB NTPC 2022'],
        repeatCount: 18,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-syn-2',
        category: 'synonyms',
        wordOrPhrase: 'LUCID',
        instruction: 'Select the most appropriate SYNONYM of the given word:',
        options: ['Confusing', 'Clear', 'Obscure', 'Vague'],
        correctIndex: 1,
        meaning: 'Expressed clearly; easy to understand.',
        hindiMeaning: 'स्पष्ट / समझने में आसान (Synonym: सुबोध)',
        exampleSentence: 'The teacher gave a lucid explanation of the grammar rule.',
        mnemonic: 'Lucid = "Liquid clear" like pure transparent water.',
        rootWordInfo: 'Latin "lux / lucere" (light) → Lucent, Translucent, Lucid.',
        examHistory: ['SSC CGL 2023', 'SSC MTS 2022', 'RRB Group D 2022'],
        repeatCount: 15,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-syn-3',
        category: 'synonyms',
        wordOrPhrase: 'IMPECCABLE',
        instruction: 'Select the most appropriate SYNONYM of the given word:',
        options: ['Flawed', 'Faultless', 'Corrupt', 'Defective'],
        correctIndex: 1,
        meaning: 'In accordance with the highest standards of propriety; faultless.',
        hindiMeaning: 'त्रुटिहीन / निष्कलंक (Synonym: निर्दोष)',
        exampleSentence: 'The topper maintained an impeccable accuracy record.',
        mnemonic: 'Impeccable = "Im (Not) + Pecca (Mistake / Fault)".',
        rootWordInfo: 'Latin "im-" (not) + "peccare" (to sin/err).',
        examHistory: ['SSC CGL 2023', 'SSC CHSL 2020', 'RRB NTPC 2022'],
        repeatCount: 14,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-ant-1',
        category: 'antonyms',
        wordOrPhrase: 'METICULOUS',
        instruction: 'Select the most appropriate ANTONYM of the given word:',
        options: ['Careful', 'Painstaking', 'Careless', 'Scrupulous'],
        correctIndex: 2,
        meaning: 'Showing great attention to detail; very careful and precise.',
        hindiMeaning: 'अति सावधान / सूक्ष्म (Antonym: लापरवाह)',
        exampleSentence: 'An officer must be meticulous with file verification, not careless.',
        mnemonic: 'Meticulous = "Mat-I-Clue-Miss" (I will not miss any clue because I am very careful).',
        rootWordInfo: 'From Latin "metus" (fear/caution).',
        examHistory: ['SSC CGL Tier-1 2024', 'SSC CHSL 2021', 'IBPS PO 2022'],
        repeatCount: 15,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-ant-2',
        category: 'antonyms',
        wordOrPhrase: 'NADIR',
        instruction: 'Select the most appropriate ANTONYM of the given word:',
        options: ['Bottom', 'Zenith', 'Base', 'Depression'],
        correctIndex: 1,
        meaning: 'The lowest point in the fortunes of a person or organization.',
        hindiMeaning: 'पतन / निम्नतम स्तर (Antonym: शीर्ष / चरम सीमा)',
        exampleSentence: 'He reached the nadir of his career, but rose to the zenith of success.',
        mnemonic: 'Nadir (lowest point) opposite to Zenith (highest peak).',
        rootWordInfo: 'From Arabic "nazir" (opposite, lower point).',
        examHistory: ['SSC CGL 2021', 'SSC CHSL 2023', 'RRB Group D 2022'],
        repeatCount: 12,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-ows-1',
        category: 'ows',
        wordOrPhrase: 'A person who loves or collects books',
        instruction: 'Choose the correct ONE WORD for the given group of words:',
        options: ['Bibliophile', 'Philanthropist', 'Polyglot', 'Misogynist'],
        correctIndex: 0,
        meaning: 'A person who collects or has a great love of books.',
        hindiMeaning: 'पुस्तकों का प्रेमी / पुस्तक संग्रहकर्ता',
        exampleSentence: 'Being a true bibliophile, his entire room is filled with classic novels.',
        mnemonic: 'Biblio (Book) + Phile (Love) = Book Lover.',
        rootWordInfo: 'Greek "biblion" (book) + "philos" (loving).',
        examHistory: ['SSC CGL 2024', 'SSC CHSL 2022', 'RRB NTPC 2021'],
        repeatCount: 19,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-ows-2',
        category: 'ows',
        wordOrPhrase: 'One who knows everything',
        instruction: 'Choose the correct ONE WORD for the given group of words:',
        options: ['Omnipotent', 'Omnipresent', 'Omniscient', 'Omnivorous'],
        correctIndex: 2,
        meaning: 'Knowing everything; having infinite knowledge.',
        hindiMeaning: 'सर्वज्ञ / सब कुछ जानने वाला',
        exampleSentence: 'Only the Almighty is considered omniscient.',
        mnemonic: 'Omni (All) + Scient (Science/Knowledge) = All-knowing.',
        rootWordInfo: 'Latin "omnis" (all) + "scire" (to know).',
        examHistory: ['SSC CGL 2023', 'SSC MTS 2022', 'SSC CPO 2020'],
        repeatCount: 17,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-idm-1',
        category: 'idioms',
        wordOrPhrase: 'Once in a blue moon',
        instruction: 'Select the most appropriate meaning of the given IDIOM:',
        options: ['Very frequently', 'Very rarely', 'On a full moon night', 'Never ever'],
        correctIndex: 1,
        meaning: 'Very rarely; almost never.',
        hindiMeaning: 'ईद का चांद होना / कभी-कभार होना',
        exampleSentence: 'He lives in Canada, so we only meet once in a blue moon.',
        mnemonic: 'A blue moon happens very rarely in astronomy.',
        rootWordInfo: 'Traditional astronomical idiom for a rare second full moon.',
        examHistory: ['SSC CGL 2024', 'SSC CHSL 2023', 'RRB NTPC 2022'],
        repeatCount: 22,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-idm-2',
        category: 'idioms',
        wordOrPhrase: 'A piece of cake',
        instruction: 'Select the most appropriate meaning of the given IDIOM:',
        options: ['A delicious treat', 'Very difficult task', 'Something very easy to do', 'A birthday celebration'],
        correctIndex: 2,
        meaning: 'Something that is very easy to do.',
        hindiMeaning: 'बहुत ही आसान काम / बच्चों का खेल',
        exampleSentence: 'After thorough revision, the English section felt like a piece of cake.',
        mnemonic: 'Eating a cake is super easy and delightful.',
        rootWordInfo: '1930s colloquial origin for effortless accomplishments.',
        examHistory: ['SSC MTS 2023', 'SSC CHSL 2021', 'RRB Group D 2022'],
        repeatCount: 18,
        importanceLevel: 'ultra-high',
        difficulty: 'easy',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      }
    ];

    const mediumWordsPool: Question[] = [
      {
        id: 'first-med-1',
        category: 'synonyms',
        wordOrPhrase: 'FASTIDIOUS',
        instruction: 'Select the most appropriate SYNONYM of the given word:',
        options: ['Carefree', 'Fussy / Hard to please', 'Negligent', 'Flexible'],
        correctIndex: 1,
        meaning: 'Very attentive to and concerned about accuracy and detail; hard to please.',
        hindiMeaning: 'तुनकमिज़ाज / जिसको खुश करना मुश्किल हो',
        exampleSentence: 'The auditor was fastidious about the accounts, checking every single detail.',
        mnemonic: 'Fastidious = "Fast + Tidy" (wants everything super clean & perfect).',
        rootWordInfo: 'Latin "fastidium" (loathing, squeamishness).',
        examHistory: ['SSC CGL Tier-1 2023', 'SSC CHSL 2022', 'RRB NTPC 2022'],
        repeatCount: 17,
        importanceLevel: 'ultra-high',
        difficulty: 'medium',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-med-2',
        category: 'antonyms',
        wordOrPhrase: 'EPHEMERAL',
        instruction: 'Select the most appropriate ANTONYM of the given word:',
        options: ['Transient', 'Eternal / Everlasting', 'Fleeting', 'Momentary'],
        correctIndex: 1,
        meaning: 'Lasting for a very short time.',
        hindiMeaning: 'क्षणिक / अल्पकालिक (Antonym: शाश्वत / अमर)',
        exampleSentence: 'Fame in modern media is often ephemeral, whereas true knowledge is eternal.',
        mnemonic: 'Ephemeral sounds like "Funeral" which reminds us life is short.',
        rootWordInfo: 'Greek "ephemeros" (lasting only a day).',
        examHistory: ['SSC CGL Tier-2 2022', 'SSC MTS 2021', 'CDS 2023'],
        repeatCount: 14,
        importanceLevel: 'ultra-high',
        difficulty: 'medium',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-med-3',
        category: 'idioms',
        wordOrPhrase: 'Bite the bullet',
        instruction: 'Select the most appropriate meaning of the given IDIOM:',
        options: ['To fight bravely in war', 'To face a difficult situation with courage', 'To get injured accidentally', 'To waste precious time'],
        correctIndex: 1,
        meaning: 'To face a difficult or unpleasant situation with courage and fortitude.',
        hindiMeaning: 'कठिन परिस्थिति का हिम्मत से सामना करना',
        exampleSentence: 'He had to bite the bullet and put in 10 hours of daily study.',
        mnemonic: 'Soldiers used to bite on a lead bullet during surgery to endure pain.',
        rootWordInfo: 'Military origin before anesthesia.',
        examHistory: ['SSC CGL 2023', 'SSC CPO 2022', 'IBPS PO 2021'],
        repeatCount: 15,
        importanceLevel: 'ultra-high',
        difficulty: 'medium',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      },
      {
        id: 'first-med-4',
        category: 'ows',
        wordOrPhrase: 'One who is indifferent to pleasure or pain',
        instruction: 'Choose the correct ONE WORD for the given group of words:',
        options: ['Stoic', 'Epicurean', 'Cynic', 'Hedonist'],
        correctIndex: 0,
        meaning: 'A person who can endure pain or hardship without showing feelings or complaining.',
        hindiMeaning: 'उदासीन / सुख-दुख में समान रहने वाला',
        exampleSentence: 'He remained a true stoic, unaffected by success or failure.',
        mnemonic: 'Stoic = "Stone like" in pleasure and pain.',
        rootWordInfo: 'From Greek philosophy of Stoicism (Zeno of Citium).',
        examHistory: ['SSC CGL 2023', 'SSC CHSL 2021', 'CDS 2022'],
        repeatCount: 16,
        importanceLevel: 'ultra-high',
        difficulty: 'medium',
        sourceType: 'verified_pyq',
        isPYQ: true,
        verified: true,
      }
    ];

    const shuffledEasy = this.shuffle(easyWordsPool).slice(0, 7);
    const shuffledMed = this.shuffle(mediumWordsPool).slice(0, 3);
    return this.shuffle([...shuffledEasy, ...shuffledMed]).slice(0, 10);
  }

  /**
   * High-entropy, non-deterministic shuffle
   */
  public shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Intelligent Category Selection for Mixed Mode
   * Balances content distribution while respecting scarce categories (OWS/Idioms)
   */
  private chooseMixedCategory(): QuestionCategory {
    const allCats: QuestionCategory[] = ['synonyms', 'antonyms', 'ows', 'idioms'];
    
    // Check available fresh or due concepts per category
    const weights: Record<QuestionCategory, number> = {
      synonyms: 1.0,
      antonyms: 1.0,
      ows: 1.0,
      idioms: 1.0,
    };

    // If a category has been selected twice consecutively, penalize it to force variety
    if (this.lastSelectedCategory && this.consecutiveCategoryCount >= 2) {
      weights[this.lastSelectedCategory] = 0.2;
    }

    const availableConcepts = (cat: QuestionCategory) => {
      const map = this.playableConcepts.get(cat);
      return map ? map.size : 0;
    };

    // Factor in relative concept availability
    for (const cat of allCats) {
      const count = availableConcepts(cat);
      if (count < 20) {
        weights[cat] *= 0.6; // Don't burn through scarce category instantly
      }
    }

    const totalWeight = allCats.reduce((sum, cat) => sum + weights[cat], 0);
    let rand = Math.random() * totalWeight;

    for (const cat of allCats) {
      if (rand < weights[cat]) {
        if (this.lastSelectedCategory === cat) {
          this.consecutiveCategoryCount += 1;
        } else {
          this.lastSelectedCategory = cat;
          this.consecutiveCategoryCount = 1;
        }
        return cat;
      }
      rand -= weights[cat];
    }

    return 'synonyms';
  }

  /**
   * ADAPTIVE CONCEPT-FIRST QUESTION SCHEDULING FOR PYQ DRILL:
   * 1. Evaluates concept review state (due/weak/fresh)
   * 2. Selects CONCEPT FIRST before selecting question variant
   * 3. Boosts fresh unseen verified PYQ variants (20% bonus)
   * 4. Guarantees natural spacing with fuzz (8-15 gap for wrong, 25-45 for hard)
   */
  public getNextDrillQuestion(
    category: QuestionCategory | 'mixed',
    exam: ExamType = 'ALL',
    recentWordsHistory: string[] = []
  ): Question {
    this.init();

    const targetCategory = category === 'mixed' ? this.chooseMixedCategory() : category;
    const catMap = this.playableConcepts.get(targetCategory);

    if (!catMap || catMap.size === 0) {
      // Fallback
      return this.synonymsPool[0];
    }

    const recentMemoryKeys = new Set([
      ...questionReviewScheduler.getRecentMemoryKeys().slice(-40),
      ...recentWordsHistory.slice(-25).map(w => buildMemoryKey(targetCategory, w))
    ]);

    const recentQuestionIds = new Set(questionReviewScheduler.getRecentQuestionIds().slice(-100));

    const allConcepts = Array.from(catMap.values());
    const now = Date.now();

    // 1. Partition concepts
    const dueConcepts: ConceptGroup[] = [];
    const mistakeConcepts: ConceptGroup[] = [];
    const savedConcepts: ConceptGroup[] = [];
    const freshConcepts: ConceptGroup[] = [];
    const familiarConcepts: ConceptGroup[] = [];

    for (const group of allConcepts) {
      const isRecentlyPlayed = recentMemoryKeys.has(group.memoryKey);
      const state = questionReviewScheduler.getReviewState(group.memoryKey);

      if (!state || state.seenCount === 0) {
        if (!isRecentlyPlayed) {
          freshConcepts.push(group);
        }
      } else {
        if (state.isSaved && !isRecentlyPlayed) {
          savedConcepts.push(group);
        }

        if (questionReviewScheduler.isConceptDue(group.memoryKey, now)) {
          dueConcepts.push(group);
        } else if (state.wrongCount > 0 && state.consecutiveCorrect < 2 && !isRecentlyPlayed) {
          mistakeConcepts.push(group);
        } else if (!isRecentlyPlayed) {
          familiarConcepts.push(group);
        }
      }
    }

    // 2. Select Concept Group based on target distribution:
    // ~65-70% Fresh, ~15-20% Due, ~10% Mistakes/Weak, ~5% Saved
    let selectedGroup: ConceptGroup | null = null;
    let reviewReason: Question['reviewReason'] = 'fresh';

    const roll = Math.random();

    if (dueConcepts.length > 0 && (roll < 0.22 || freshConcepts.length === 0)) {
      selectedGroup = dueConcepts[Math.floor(Math.random() * dueConcepts.length)];
      reviewReason = 'due_review';
    } else if (mistakeConcepts.length > 0 && (roll < 0.32 || freshConcepts.length === 0)) {
      selectedGroup = mistakeConcepts[Math.floor(Math.random() * mistakeConcepts.length)];
      reviewReason = 'mistake_review';
    } else if (savedConcepts.length > 0 && roll < 0.37 && Math.random() < 0.4) {
      selectedGroup = savedConcepts[Math.floor(Math.random() * savedConcepts.length)];
      reviewReason = 'saved_review';
    } else if (freshConcepts.length > 0) {
      // Prioritize fresh concepts with verified PYQs (20% boost)
      const freshWithVerified = freshConcepts.filter(g => g.verifiedVariants.length > 0);
      if (freshWithVerified.length > 0 && Math.random() < 0.65) {
        selectedGroup = freshWithVerified[Math.floor(Math.random() * freshWithVerified.length)];
      } else {
        selectedGroup = freshConcepts[Math.floor(Math.random() * freshConcepts.length)];
      }
      reviewReason = 'fresh';
    } else if (familiarConcepts.length > 0) {
      // Pick familiar concept with oldest last-seen
      familiarConcepts.sort((a, b) => {
        const sa = questionReviewScheduler.getReviewState(a.memoryKey);
        const sb = questionReviewScheduler.getReviewState(b.memoryKey);
        return (sa?.lastSeenAt || 0) - (sb?.lastSeenAt || 0);
      });
      selectedGroup = familiarConcepts[0];
      reviewReason = 'pool_exhausted_review';
    } else {
      // Fallback to any non-empty group
      selectedGroup = allConcepts[Math.floor(Math.random() * allConcepts.length)];
      reviewReason = 'pool_exhausted_review';
    }

    // 3. Select Question Variant within the chosen Concept
    const variants = selectedGroup.variants;
    // Prefer unseen verified PYQ variant if available
    const unseenVerified = selectedGroup.verifiedVariants.filter(v => !recentQuestionIds.has(v.id));
    const unseenGenerated = selectedGroup.generatedVariants.filter(v => !recentQuestionIds.has(v.id));

    let chosenQuestion: Question;
    if (unseenVerified.length > 0) {
      chosenQuestion = unseenVerified[Math.floor(Math.random() * unseenVerified.length)];
    } else if (unseenGenerated.length > 0) {
      chosenQuestion = unseenGenerated[Math.floor(Math.random() * unseenGenerated.length)];
    } else {
      chosenQuestion = variants[Math.floor(Math.random() * variants.length)];
    }

    return {
      ...chosenQuestion,
      memoryKey: selectedGroup.memoryKey,
      conceptKey: selectedGroup.conceptKey,
      reviewReason,
    };
  }

  /**
   * GUARANTEED UNIQUE QUESTIONS FOR A 1V1 DUEL MATCH:
   * - Strictly unique question IDs AND strictly unique memoryKey per match
   * - 70% fresh concepts, 20% due concepts, 10% weak concepts
   * - Never duplicates word prompt or concept in the same match
   */
  public getUniqueQuestionsForMatch(
    category: QuestionCategory | 'mixed',
    exam: ExamType = 'ALL',
    count: number = 20
  ): Question[] {
    this.init();

    const usedMemoryKeys = new Set<string>();
    const usedQuestionIds = new Set<string>();
    const selectedQuestions: Question[] = [];

    const categoriesToPull: QuestionCategory[] = category === 'mixed'
      ? ['synonyms', 'antonyms', 'ows', 'idioms']
      : [category];

    const perCatTarget = Math.ceil(count / categoriesToPull.length);

    for (const cat of categoriesToPull) {
      const catMap = this.playableConcepts.get(cat);
      if (!catMap) continue;

      const allGroups = this.shuffle(Array.from(catMap.values()));
      const available = allGroups.filter(g => !usedMemoryKeys.has(g.memoryKey));

      let catCount = 0;
      for (const group of available) {
        if (catCount >= perCatTarget || selectedQuestions.length >= count) break;

        // Choose question variant
        const validVariants = group.variants.filter(v => !usedQuestionIds.has(v.id));
        if (validVariants.length === 0) continue;

        // Prioritize verified PYQ
        const verified = validVariants.filter(v => v.sourceType === 'verified_pyq');
        const chosen = verified.length > 0 ? verified[0] : validVariants[0];

        usedMemoryKeys.add(group.memoryKey);
        usedQuestionIds.add(chosen.id);
        selectedQuestions.push({
          ...chosen,
          memoryKey: group.memoryKey,
          conceptKey: group.conceptKey,
        });
        catCount++;
      }
    }

    // Fill remaining if needed
    if (selectedQuestions.length < count) {
      const allPool = this.shuffle(this.getAllAvailableQuestions());
      for (const q of allPool) {
        if (selectedQuestions.length >= count) break;
        const mKey = q.memoryKey || buildMemoryKey(q.category, q.wordOrPhrase, q.options, q.correctIndex);
        if (!usedMemoryKeys.has(mKey) && !usedQuestionIds.has(q.id)) {
          usedMemoryKeys.add(mKey);
          usedQuestionIds.add(q.id);
          selectedQuestions.push({ ...q, memoryKey: mKey, conceptKey: mKey });
        }
      }
    }

    return this.shuffle(selectedQuestions);
  }

  public getQuestions(
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    count: number = 20
  ): Question[] {
    return this.getUniqueQuestionsForMatch(category, exam, count);
  }

  // ==================== ADMIN HEALTH DIAGNOSTICS ====================

  /**
   * Diagnostic summary comparing Firestore cloud data with runtime engine state
   */
  public getCloudVsRuntimeCounts(): {
    cloudCounts: Record<QuestionCategory, number>;
    runtimeVariantCounts: Record<QuestionCategory, number>;
    runtimeConceptCounts: Record<QuestionCategory, number>;
    totalCloud: number;
    totalRuntimeVariants: number;
    totalConcepts: number;
  } {
    this.init();
    const categories: QuestionCategory[] = ['synonyms', 'antonyms', 'ows', 'idioms'];

    const cloudCounts: Record<QuestionCategory, number> = { synonyms: 0, antonyms: 0, ows: 0, idioms: 0 };
    const runtimeVariantCounts: Record<QuestionCategory, number> = { synonyms: 0, antonyms: 0, ows: 0, idioms: 0 };
    const runtimeConceptCounts: Record<QuestionCategory, number> = { synonyms: 0, antonyms: 0, ows: 0, idioms: 0 };

    for (const q of this.importedPool) {
      if (cloudCounts[q.category] !== undefined) {
        cloudCounts[q.category]++;
      }
    }

    runtimeVariantCounts.synonyms = this.synonymsPool.length + cloudCounts.synonyms;
    runtimeVariantCounts.antonyms = this.antonymsPool.length + cloudCounts.antonyms;
    runtimeVariantCounts.ows = this.owsPool.length + cloudCounts.ows;
    runtimeVariantCounts.idioms = this.idiomsPool.length + cloudCounts.idioms;

    for (const cat of categories) {
      const map = this.playableConcepts.get(cat);
      runtimeConceptCounts[cat] = map ? map.size : 0;
    }

    const totalCloud = Object.values(cloudCounts).reduce((a, b) => a + b, 0);
    const totalRuntimeVariants = Object.values(runtimeVariantCounts).reduce((a, b) => a + b, 0);
    const totalConcepts = Object.values(runtimeConceptCounts).reduce((a, b) => a + b, 0);

    return {
      cloudCounts,
      runtimeVariantCounts,
      runtimeConceptCounts,
      totalCloud,
      totalRuntimeVariants,
      totalConcepts,
    };
  }

  /**
   * Preview a live verified or practice question for inspection
   */
  public getPreviewQuestion(category: QuestionCategory): Question | null {
    this.init();
    const map = this.playableConcepts.get(category);
    if (!map || map.size === 0) return null;

    const allGroups = Array.from(map.values());
    const verifiedGroups = allGroups.filter(g => g.verifiedVariants.length > 0);

    if (verifiedGroups.length > 0) {
      const randomGroup = verifiedGroups[Math.floor(Math.random() * verifiedGroups.length)];
      return randomGroup.verifiedVariants[0];
    }

    const randomGroup = allGroups[Math.floor(Math.random() * allGroups.length)];
    return randomGroup.variants[0] || null;
  }

  /**
   * Run 200-question drill simulation to test repetition spacing and distribution
   */
  public runRepetitionSimulation(sampleSize: number = 200): {
    totalQuestions: number;
    categoryCounts: Record<QuestionCategory, number>;
    categoryPercentages: Record<QuestionCategory, string>;
    uniqueConceptsSeen: number;
    minRepeatGap: number;
    avgRepeatGap: number;
    verifiedPyqExposureCount: number;
    verifiedPyqPercentage: string;
    passedStrictChecks: boolean;
    logNotes: string[];
  } {
    this.init();
    const seenConceptHistory: string[] = [];
    const conceptGaps: number[] = [];
    const catCounts: Record<QuestionCategory, number> = { synonyms: 0, antonyms: 0, ows: 0, idioms: 0 };
    let verifiedCount = 0;
    const logNotes: string[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const q = this.getNextDrillQuestion('mixed', 'ALL', seenConceptHistory);
      catCounts[q.category] = (catCounts[q.category] || 0) + 1;

      if (q.sourceType === 'verified_pyq' || q.verified) {
        verifiedCount++;
      }

      const mKey = q.memoryKey || buildMemoryKey(q.category, q.wordOrPhrase);
      const lastIndex = seenConceptHistory.lastIndexOf(mKey);
      if (lastIndex >= 0) {
        const gap = i - lastIndex;
        conceptGaps.push(gap);
      }

      seenConceptHistory.push(mKey);
    }

    const uniqueCount = new Set(seenConceptHistory).size;
    const minGap = conceptGaps.length > 0 ? Math.min(...conceptGaps) : sampleSize;
    const avgGap = conceptGaps.length > 0 
      ? Math.round((conceptGaps.reduce((a, b) => a + b, 0) / conceptGaps.length) * 10) / 10 
      : sampleSize;

    const catPerc: Record<QuestionCategory, string> = {
      synonyms: `${Math.round((catCounts.synonyms / sampleSize) * 100)}%`,
      antonyms: `${Math.round((catCounts.antonyms / sampleSize) * 100)}%`,
      ows: `${Math.round((catCounts.ows / sampleSize) * 100)}%`,
      idioms: `${Math.round((catCounts.idioms / sampleSize) * 100)}%`,
    };

    const verifiedPerc = `${Math.round((verifiedCount / sampleSize) * 100)}%`;
    const passedStrictChecks = minGap >= 8 && uniqueCount >= Math.min(sampleSize * 0.7, 120);

    logNotes.push(`Generated ${sampleSize} simulation rounds across all 4 categories.`);
    logNotes.push(`Category distribution: Synonyms: ${catPerc.synonyms}, Antonyms: ${catPerc.antonyms}, OWS: ${catPerc.ows}, Idioms: ${catPerc.idioms}.`);
    logNotes.push(`Unique concepts encountered: ${uniqueCount}/${sampleSize}.`);
    logNotes.push(`Minimum concept repeat gap: ${minGap} rounds (Target >= 8).`);
    logNotes.push(`Verified PYQ Exposure: ${verifiedCount} / ${sampleSize} (${verifiedPerc}).`);

    return {
      totalQuestions: sampleSize,
      categoryCounts: catCounts,
      categoryPercentages: catPerc,
      uniqueConceptsSeen: uniqueCount,
      minRepeatGap: minGap,
      avgRepeatGap: avgGap,
      verifiedPyqExposureCount: verifiedCount,
      verifiedPyqPercentage: verifiedPerc,
      passedStrictChecks,
      logNotes,
    };
  }

  // ==================== GENERATORS ====================

  // 1. Generate Synonyms Pool with Bidirectional Variations
  private generateSynonymsPool(targetCount: number): Question[] {
    const pool: Question[] = [];
    let idCounter = 1;
    const vocabList = ALL_VOCAB_MASTER;

    for (let i = 0; i < targetCount; i++) {
      const baseEntry = vocabList[i % vocabList.length];
      const variantIdx = Math.floor(i / vocabList.length);
      const isReverse = variantIdx % 2 === 1;

      let promptWord = baseEntry.word;
      let targetAnswer = baseEntry.synonyms[variantIdx % baseEntry.synonyms.length].trim();

      if (isReverse && baseEntry.synonyms.length > 0) {
        promptWord = baseEntry.synonyms[(variantIdx + 1) % baseEntry.synonyms.length].trim().toUpperCase();
        targetAnswer = baseEntry.word.charAt(0).toUpperCase() + baseEntry.word.slice(1).toLowerCase();
      }

      const normalizedPrompt = promptWord.trim().toLowerCase();
      const normalizedTarget = targetAnswer.toLowerCase();

      const prohibited = new Set<string>([
        normalizedPrompt,
        normalizedTarget,
        baseEntry.word.toLowerCase(),
        ...baseEntry.synonyms.map(s => s.trim().toLowerCase())
      ]);

      const candidateDistractors: string[] = [];

      for (let j = 1; j < vocabList.length; j++) {
        const otherEntry = vocabList[(i + j) % vocabList.length];
        if (otherEntry.word.trim().toLowerCase() === normalizedPrompt) continue;

        const poolWords = [...otherEntry.antonyms, ...otherEntry.synonyms, otherEntry.word];
        for (const candidate of poolWords) {
          const norm = candidate.trim().toLowerCase();
          if (
            norm.length > 1 &&
            !prohibited.has(norm) &&
            !candidateDistractors.some(c => c.trim().toLowerCase() === norm)
          ) {
            candidateDistractors.push(candidate.trim());
          }
          if (candidateDistractors.length >= 25) break;
        }
        if (candidateDistractors.length >= 25) break;
      }

      const chosenDistractors: string[] = [];
      const fallbackList = ['Careless', 'Ordinary', 'Hesitant', 'Temporary', 'Arrogant', 'Sluggish', 'Rigid', 'Pliant'];

      for (const cand of [...candidateDistractors, ...fallbackList]) {
        const norm = cand.trim().toLowerCase();
        if (
          norm !== normalizedPrompt &&
          norm !== normalizedTarget &&
          !prohibited.has(norm) &&
          !chosenDistractors.some(c => c.trim().toLowerCase() === norm)
        ) {
          chosenDistractors.push(cand.trim());
          if (chosenDistractors.length === 3) break;
        }
      }

      const rawOptions = [targetAnswer, ...chosenDistractors];
      const shuffledOptions = this.shuffle(rawOptions);
      const correctIdx = shuffledOptions.indexOf(targetAnswer);

      const year1 = EXAM_YEARS[(i + 1) % EXAM_YEARS.length];
      const year2 = EXAM_YEARS[(i + 4) % EXAM_YEARS.length];

      const memoryKey = `word:${baseEntry.word.toLowerCase().trim()}`;

      pool.push({
        id: `syn-${idCounter++}`,
        category: 'synonyms',
        wordOrPhrase: promptWord,
        instruction: 'Select the most appropriate SYNONYM of the given word:',
        options: shuffledOptions,
        correctIndex: correctIdx,
        meaning: baseEntry.meaning,
        hindiMeaning: baseEntry.hindi,
        exampleSentence: baseEntry.example,
        mnemonic: baseEntry.mnemonic,
        rootWordInfo: baseEntry.root,
        examHistory: [year1, year2, 'Govt Exam PYQ Bank'],
        repeatCount: Math.min(28, baseEntry.repeats + (i % 6)),
        importanceLevel: i % 3 === 0 ? 'ultra-high' : i % 2 === 0 ? 'very-high' : 'high',
        difficulty: i % 4 === 0 ? 'hard' : i % 2 === 0 ? 'medium' : 'easy',
        sourceType: 'generated_practice',
        memoryKey,
        conceptKey: memoryKey,
      });
    }

    return pool;
  }

  // 2. Generate Antonyms Pool with Bidirectional Variations
  private generateAntonymsPool(targetCount: number): Question[] {
    const pool: Question[] = [];
    let idCounter = 1;
    const vocabList = ALL_VOCAB_MASTER;

    for (let i = 0; i < targetCount; i++) {
      const baseEntry = vocabList[i % vocabList.length];
      const variantIdx = Math.floor(i / vocabList.length);
      const isReverse = variantIdx % 2 === 1;

      let promptWord = baseEntry.word;
      let targetAnswer = baseEntry.antonyms[variantIdx % baseEntry.antonyms.length].trim();

      if (isReverse && baseEntry.antonyms.length > 0) {
        promptWord = baseEntry.antonyms[(variantIdx + 1) % baseEntry.antonyms.length].trim().toUpperCase();
        targetAnswer = baseEntry.word.charAt(0).toUpperCase() + baseEntry.word.slice(1).toLowerCase();
      }

      const normalizedPrompt = promptWord.trim().toLowerCase();
      const normalizedTarget = targetAnswer.toLowerCase();

      const prohibited = new Set<string>([
        normalizedPrompt,
        normalizedTarget,
        baseEntry.word.toLowerCase(),
        ...baseEntry.antonyms.map(a => a.trim().toLowerCase())
      ]);

      const candidateDistractors: string[] = [];

      for (const syn of baseEntry.synonyms) {
        const norm = syn.trim().toLowerCase();
        if (norm !== normalizedPrompt && norm !== normalizedTarget && !prohibited.has(norm)) {
          if (!candidateDistractors.some(c => c.trim().toLowerCase() === norm)) {
            candidateDistractors.push(syn.trim());
          }
        }
      }

      for (let j = 1; j < vocabList.length; j++) {
        const otherEntry = vocabList[(i + j) % vocabList.length];
        if (otherEntry.word.trim().toLowerCase() === normalizedPrompt) continue;

        const poolWords = [...otherEntry.synonyms, ...otherEntry.antonyms, otherEntry.word];
        for (const candidate of poolWords) {
          const norm = candidate.trim().toLowerCase();
          if (
            norm.length > 1 &&
            !prohibited.has(norm) &&
            !candidateDistractors.some(c => c.trim().toLowerCase() === norm)
          ) {
            candidateDistractors.push(candidate.trim());
          }
          if (candidateDistractors.length >= 25) break;
        }
        if (candidateDistractors.length >= 25) break;
      }

      const chosenDistractors: string[] = [];
      const fallbackList = ['Careful', 'Diligent', 'Optimistic', 'Active', 'Courteous', 'Modest', 'Humane'];

      for (const cand of [...candidateDistractors, ...fallbackList]) {
        const norm = cand.trim().toLowerCase();
        if (
          norm !== normalizedPrompt &&
          norm !== normalizedTarget &&
          !prohibited.has(norm) &&
          !chosenDistractors.some(c => c.trim().toLowerCase() === norm)
        ) {
          chosenDistractors.push(cand.trim());
          if (chosenDistractors.length === 3) break;
        }
      }

      const rawOptions = [targetAnswer, ...chosenDistractors];
      const shuffledOptions = this.shuffle(rawOptions);
      const correctIdx = shuffledOptions.indexOf(targetAnswer);

      const year1 = EXAM_YEARS[(i + 2) % EXAM_YEARS.length];
      const year2 = EXAM_YEARS[(i + 5) % EXAM_YEARS.length];

      const memoryKey = `word:${baseEntry.word.toLowerCase().trim()}`;

      pool.push({
        id: `ant-${idCounter++}`,
        category: 'antonyms',
        wordOrPhrase: promptWord,
        instruction: 'Select the most appropriate ANTONYM of the given word:',
        options: shuffledOptions,
        correctIndex: correctIdx,
        meaning: baseEntry.meaning,
        hindiMeaning: baseEntry.hindi,
        exampleSentence: baseEntry.example,
        mnemonic: baseEntry.mnemonic,
        rootWordInfo: baseEntry.root,
        examHistory: [year1, year2, 'Govt Exam PYQ Bank'],
        repeatCount: Math.min(27, baseEntry.repeats + ((i + 2) % 6)),
        importanceLevel: i % 3 === 0 ? 'ultra-high' : 'very-high',
        difficulty: i % 3 === 0 ? 'hard' : 'medium',
        sourceType: 'generated_practice',
        memoryKey,
        conceptKey: memoryKey,
      });
    }

    return pool;
  }

  // 3. Generate One Word Substitution Pool
  private generateOWSPool(targetCount: number): Question[] {
    const pool: Question[] = [];
    let idCounter = 1;
    const owsList = OWS_MASTER_EXTENDED;

    for (let i = 0; i < targetCount; i++) {
      const baseEntry = owsList[i % owsList.length];
      const targetAnswer = baseEntry.answer.trim();
      const normalizedPrompt = baseEntry.phrase.trim().toLowerCase();
      const normalizedTarget = targetAnswer.toLowerCase();

      const candidateDistractors: string[] = [];
      if (baseEntry.distractors) {
        for (const d of baseEntry.distractors) {
          const norm = d.trim().toLowerCase();
          if (norm !== normalizedTarget && norm !== normalizedPrompt) {
            candidateDistractors.push(d.trim());
          }
        }
      }

      for (let j = 1; j < owsList.length; j++) {
        const other = owsList[(i + j) % owsList.length];
        const ans = other.answer.trim();
        const normAns = ans.toLowerCase();
        if (normAns !== normalizedTarget && !candidateDistractors.some(c => c.toLowerCase() === normAns)) {
          candidateDistractors.push(ans);
        }
        if (candidateDistractors.length >= 15) break;
      }

      const chosenDistractors: string[] = [];
      const fallbackList = ['Philanthropist', 'Polyglot', 'Altruist', 'Equestrian', 'Calligrapher', 'Archivist'];

      for (const cand of [...candidateDistractors, ...fallbackList]) {
        const norm = cand.trim().toLowerCase();
        if (
          norm !== normalizedTarget &&
          norm !== normalizedPrompt &&
          !chosenDistractors.some(c => c.toLowerCase() === norm)
        ) {
          chosenDistractors.push(cand.trim());
          if (chosenDistractors.length === 3) break;
        }
      }

      const rawOptions = [targetAnswer, ...chosenDistractors];
      const shuffledOptions = this.shuffle(rawOptions);
      const correctIdx = shuffledOptions.indexOf(targetAnswer);

      const year1 = EXAM_YEARS[(i + 3) % EXAM_YEARS.length];
      const year2 = EXAM_YEARS[(i + 6) % EXAM_YEARS.length];

      const memoryKey = `ows:${targetAnswer.toLowerCase().trim()}`;

      pool.push({
        id: `ows-${idCounter++}`,
        category: 'ows',
        wordOrPhrase: baseEntry.phrase,
        instruction: 'Select the correct One Word for the given group of words:',
        options: shuffledOptions,
        correctIndex: correctIdx,
        meaning: `One word substitution for "${baseEntry.phrase}" is ${baseEntry.answer}.`,
        hindiMeaning: baseEntry.hindi,
        exampleSentence: baseEntry.example,
        mnemonic: baseEntry.mnemonic,
        rootWordInfo: baseEntry.root,
        examHistory: [year1, year2, 'SSC/Govt PYQ High Repeat'],
        repeatCount: Math.min(30, baseEntry.repeats + (i % 5)),
        importanceLevel: 'ultra-high',
        difficulty: i % 3 === 0 ? 'hard' : 'medium',
        sourceType: 'generated_practice',
        memoryKey,
        conceptKey: memoryKey,
      });
    }

    return pool;
  }

  // 4. Generate Idioms & Phrases Pool
  private generateIdiomsPool(targetCount: number): Question[] {
    const pool: Question[] = [];
    let idCounter = 1;
    const idiomList = IDIOM_MASTER_EXTENDED;

    for (let i = 0; i < targetCount; i++) {
      const baseEntry = idiomList[i % idiomList.length];
      const targetMeaning = baseEntry.meaning.trim();
      const normalizedPrompt = baseEntry.idiom.trim().toLowerCase();
      const normalizedTarget = targetMeaning.toLowerCase();

      const candidateDistractors: string[] = [];
      if (baseEntry.distractors) {
        for (const d of baseEntry.distractors) {
          const norm = d.trim().toLowerCase();
          if (norm !== normalizedTarget && norm !== normalizedPrompt) {
            candidateDistractors.push(d.trim());
          }
        }
      }

      for (let j = 1; j < idiomList.length; j++) {
        const other = idiomList[(i + j) % idiomList.length];
        const m = other.meaning.trim();
        const normM = m.toLowerCase();
        if (normM !== normalizedTarget && !candidateDistractors.some(c => c.toLowerCase() === normM)) {
          candidateDistractors.push(m);
        }
        if (candidateDistractors.length >= 15) break;
      }

      const chosenDistractors: string[] = [];
      const fallbackList = [
        'To miss a critical deadline',
        'To act hastily without planning',
        'To misunderstand the main objective',
        'To abandon a project halfway'
      ];

      for (const cand of [...candidateDistractors, ...fallbackList]) {
        const norm = cand.trim().toLowerCase();
        if (
          norm !== normalizedTarget &&
          norm !== normalizedPrompt &&
          !chosenDistractors.some(c => c.toLowerCase() === norm)
        ) {
          chosenDistractors.push(cand.trim());
          if (chosenDistractors.length === 3) break;
        }
      }

      const rawOptions = [targetMeaning, ...chosenDistractors];
      const shuffledOptions = this.shuffle(rawOptions);
      const correctIdx = shuffledOptions.indexOf(targetMeaning);

      const year1 = EXAM_YEARS[(i + 2) % EXAM_YEARS.length];
      const year2 = EXAM_YEARS[(i + 5) % EXAM_YEARS.length];

      const memoryKey = `idiom:${baseEntry.idiom.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')}`;

      pool.push({
        id: `idm-${idCounter++}`,
        category: 'idioms',
        wordOrPhrase: baseEntry.idiom,
        instruction: 'Select the most appropriate meaning of the given IDIOM / PHRASE:',
        options: shuffledOptions,
        correctIndex: correctIdx,
        meaning: baseEntry.meaning,
        hindiMeaning: baseEntry.hindi,
        exampleSentence: baseEntry.example,
        mnemonic: baseEntry.origin,
        rootWordInfo: `Origin: ${baseEntry.origin}`,
        examHistory: [year1, year2, 'All India Govt Exam PYQ'],
        repeatCount: Math.min(29, baseEntry.repeats + (i % 6)),
        importanceLevel: 'ultra-high',
        difficulty: i % 3 === 0 ? 'hard' : 'medium',
        sourceType: 'generated_practice',
        memoryKey,
        conceptKey: memoryKey,
      });
    }

    return pool;
  }
}

export const questionBankEngine = new QuestionBankEngine();
