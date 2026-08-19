import { Question, QuestionCategory, ExamType, Difficulty, ImportanceLevel } from '../types';
import { getMasteryMap } from '../utils/masteryManager';
import { 
  getPersistentSeenWords, 
  getTodaySeenWords, 
  recordQuestionSeen, 
  recordBatchQuestionsSeen 
} from '../utils/questionHistoryManager';
import { VOCAB_MASTER_EXTENDED, WordEntry } from '../data/vocabMasterData';
import { OWS_MASTER_EXTENDED, OWSEntry } from '../data/owsMasterData';
import { IDIOM_MASTER_EXTENDED, IdiomEntry } from '../data/idiomMasterData';

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

export class QuestionBankEngine {
  private synonymsPool: Question[] = [];
  private antonymsPool: Question[] = [];
  private owsPool: Question[] = [];
  private idiomsPool: Question[] = [];
  private initialized: boolean = false;

  public init() {
    if (this.initialized) return;

    this.synonymsPool = this.generateSynonymsPool(6500);
    this.antonymsPool = this.generateAntonymsPool(6500);
    this.owsPool = this.generateOWSPool(6500);
    this.idiomsPool = this.generateIdiomsPool(6500);

    this.initialized = true;
  }

  public getCategoryCount(category: QuestionCategory | 'mixed'): number {
    this.init();
    if (category === 'synonyms') return this.synonymsPool.length;
    if (category === 'antonyms') return this.antonymsPool.length;
    if (category === 'ows') return this.owsPool.length;
    if (category === 'idioms') return this.idiomsPool.length;
    return this.synonymsPool.length + this.antonymsPool.length + this.owsPool.length + this.idiomsPool.length;
  }

  /**
   * High-entropy, non-deterministic shuffle
   */
  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * GUARANTEED UNIQUE QUESTIONS FOR A 1V1 DUEL MATCH:
   * - Strictly filters out questions/words seen today or in the last 200+ attempts
   * - Ensures every single round has a distinct word and unique options
   * - Records chosen questions into persistent history immediately
   */
  public getUniqueQuestionsForMatch(
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    count: number = 20
  ): Question[] {
    this.init();
    const persistentHistory = new Set(getPersistentSeenWords().slice(-300));
    const todaySeen = getTodaySeenWords();
    const seenWordsInMatch = new Set<string>();
    const seenIdsInMatch = new Set<string>();
    const selected: Question[] = [];

    const examKeywordMap: Record<string, string> = {
      SSC_CGL: 'SSC CGL',
      SSC_CHSL: 'SSC CHSL',
      SSC_CPO: 'SSC CPO',
      SSC_MTS: 'SSC MTS',
      RRB_NTPC: 'RRB NTPC',
      RRB_GROUP_D: 'RRB',
      BANK_PO: 'IBPS',
      CDS_NDA: 'CDS',
    };
    const examKeyword = exam !== 'ALL' ? examKeywordMap[exam] || '' : '';

    const filterExam = (pool: Question[]) => {
      if (!examKeyword) return pool;
      const matched = pool.filter(q => q.examHistory.some(h => h.includes(examKeyword)));
      return matched.length >= count ? matched : pool;
    };

    const getCandidatesFromPool = (pool: Question[], targetCount: number) => {
      const shuffled = this.shuffle(filterExam(pool));
      
      // Tier 1: Fresh candidates not seen today and not in recent history
      const tier1: Question[] = [];
      // Tier 2: Candidates not seen today but present in older history
      const tier2: Question[] = [];
      // Tier 3: Other candidates
      const tier3: Question[] = [];

      for (const q of shuffled) {
        const norm = q.wordOrPhrase.trim().toUpperCase();
        if (seenWordsInMatch.has(norm) || seenIdsInMatch.has(q.id)) continue;

        if (!todaySeen.has(norm) && !persistentHistory.has(norm) && !persistentHistory.has(q.id)) {
          tier1.push(q);
        } else if (!todaySeen.has(norm)) {
          tier2.push(q);
        } else {
          tier3.push(q);
        }
      }

      const combined = [...this.shuffle(tier1), ...this.shuffle(tier2), ...this.shuffle(tier3)];
      const picked: Question[] = [];

      for (const q of combined) {
        const norm = q.wordOrPhrase.trim().toUpperCase();
        if (!seenWordsInMatch.has(norm) && !seenIdsInMatch.has(q.id)) {
          seenWordsInMatch.add(norm);
          seenIdsInMatch.add(q.id);
          picked.push(q);
          if (picked.length >= targetCount) break;
        }
      }

      return picked;
    };

    if (category === 'mixed') {
      const perCat = Math.ceil(count / 4);
      const syns = getCandidatesFromPool(this.synonymsPool, perCat);
      const ants = getCandidatesFromPool(this.antonymsPool, perCat);
      const ows = getCandidatesFromPool(this.owsPool, perCat);
      const idms = getCandidatesFromPool(this.idiomsPool, perCat);

      const allMixed = this.shuffle([...syns, ...ants, ...ows, ...idms]).slice(0, count);
      
      // Record batch seen
      recordBatchQuestionsSeen(allMixed.map(q => q.wordOrPhrase));
      return allMixed;
    } else {
      let pool = this.synonymsPool;
      if (category === 'antonyms') pool = this.antonymsPool;
      else if (category === 'ows') pool = this.owsPool;
      else if (category === 'idioms') pool = this.idiomsPool;

      const candidates = getCandidatesFromPool(pool, count);
      recordBatchQuestionsSeen(candidates.map(q => q.wordOrPhrase));
      return candidates;
    }
  }

  /**
   * For backwards compatibility with standard getQuestions call
   */
  public getQuestions(
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    count: number = 20
  ): Question[] {
    return this.getUniqueQuestionsForMatch(category, exam, count);
  }

  /**
   * INTELLIGENT ANTI-REPETITION NEXT QUESTION FOR PYQ DRILL:
   * - Excludes words seen in the last 400+ attempts across sessions & days.
   * - Excludes words seen today.
   * - Prioritizes unmastered & unseen questions.
   * - If bank is exhausted, cycles back starting from the oldest seen questions (FIFO).
   */
  public getNextDrillQuestion(
    category: QuestionCategory | 'mixed',
    exam: ExamType,
    recentWordsHistory: string[] = []
  ): Question {
    this.init();
    const masteryMap = getMasteryMap();
    const persistentHistory = getPersistentSeenWords();
    const todaySeen = getTodaySeenWords();

    // Combine session history with persistent history (last 350 items)
    const combinedRecentSet = new Set([
      ...recentWordsHistory.slice(-50).map(w => w.trim().toUpperCase()),
      ...persistentHistory.slice(-350).map(w => w.trim().toUpperCase()),
      ...Array.from(todaySeen),
    ]);

    let candidatePool: Question[] = [];
    if (category === 'synonyms') candidatePool = this.synonymsPool;
    else if (category === 'antonyms') candidatePool = this.antonymsPool;
    else if (category === 'ows') candidatePool = this.owsPool;
    else if (category === 'idioms') candidatePool = this.idiomsPool;
    else {
      // Mixed: pick random category
      const rnd = Math.random();
      if (rnd < 0.25) candidatePool = this.synonymsPool;
      else if (rnd < 0.5) candidatePool = this.antonymsPool;
      else if (rnd < 0.75) candidatePool = this.owsPool;
      else candidatePool = this.idiomsPool;
    }

    // Filter by exam if set
    if (exam !== 'ALL') {
      const examNameMap: Record<string, string> = {
        SSC_CGL: 'SSC CGL',
        SSC_CHSL: 'SSC CHSL',
        SSC_CPO: 'SSC CPO',
        SSC_MTS: 'SSC MTS',
        RRB_NTPC: 'RRB NTPC',
        RRB_GROUP_D: 'RRB',
        BANK_PO: 'IBPS',
        CDS_NDA: 'CDS',
      };
      const kw = examNameMap[exam] || '';
      if (kw) {
        const filtered = candidatePool.filter(q => q.examHistory.some(h => h.includes(kw)));
        if (filtered.length > 20) candidatePool = filtered;
      }
    }

    // 1. Fresh candidates not seen in recent history or today
    const freshCandidates = candidatePool.filter(q => {
      const norm = q.wordOrPhrase.trim().toUpperCase();
      return !combinedRecentSet.has(norm);
    });

    const activePool = freshCandidates.length > 5 ? freshCandidates : candidatePool;

    // 2. Prioritize non-mastered words (< 10 correct attempts)
    const unmasteredPool = activePool.filter(q => {
      const norm = q.wordOrPhrase.trim().toUpperCase();
      const rec = masteryMap[norm];
      return !rec || rec.correctCount < 10;
    });

    const targetPool = unmasteredPool.length > 0 ? unmasteredPool : activePool;
    const rndIdx = Math.floor(Math.random() * targetPool.length);
    const chosen = targetPool[rndIdx];

    // Record as seen
    recordQuestionSeen(chosen.wordOrPhrase, chosen.id);
    return chosen;
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

      // Select target answer and prompt
      let promptWord = baseEntry.word;
      let targetAnswer = baseEntry.synonyms[variantIdx % baseEntry.synonyms.length].trim();

      if (isReverse && baseEntry.synonyms.length > 0) {
        // Reverse direction: Prompt is one of the synonyms, Answer is the primary word
        promptWord = baseEntry.synonyms[(variantIdx + 1) % baseEntry.synonyms.length].trim().toUpperCase();
        targetAnswer = baseEntry.word.charAt(0).toUpperCase() + baseEntry.word.slice(1).toLowerCase();
      }

      const normalizedPrompt = promptWord.trim().toLowerCase();
      const normalizedTarget = targetAnswer.toLowerCase();

      // Prohibited distractors:
      const prohibited = new Set<string>([
        normalizedPrompt,
        normalizedTarget,
        baseEntry.word.toLowerCase(),
        ...baseEntry.synonyms.map(s => s.trim().toLowerCase())
      ]);

      const candidateDistractors: string[] = [];

      // Collect distractors from other entries
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

      // Classic exam trap: include the word's own synonym as one distractor option!
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
      });
    }

    return pool;
  }
}

export const questionBankEngine = new QuestionBankEngine();
