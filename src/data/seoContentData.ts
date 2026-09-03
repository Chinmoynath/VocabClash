export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoPyqSample {
  wordOrPhrase: string;
  type: 'Synonym' | 'Antonym' | 'OWS' | 'Idiom';
  examTag: string;
  meaning: string;
  hindiMeaning: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  mnemonic?: string;
}

export interface SeoPageData {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  badge: string;
  readingTime: string;
  examFocus: string;
  intro: string;
  whyItMatters: string[];
  weightageInfo: {
    tier1Questions: string;
    tier2Questions: string;
    totalMarksWeightage: string;
  };
  strategySteps: {
    title: string;
    description: string;
  }[];
  pyqSamples: SeoPyqSample[];
  rootWordsOrTips: {
    title: string;
    content: string;
  }[];
  faqs: SeoFaqItem[];
  relatedSlugs: string[];
}

export const SEO_PAGES: Record<string, SeoPageData> = {
  'ssc-vocabulary': {
    id: 'ssc-vocabulary',
    slug: '/ssc-vocabulary',
    title: 'SSC Vocabulary 2026: Master Synonyms, Antonyms, OWS & Idioms | VocabClash',
    metaDescription: 'Comprehensive SSC English vocabulary guide with weightage analysis, high-frequency PYQs from SSC CGL & CHSL (2018-2025), root word techniques, and real-time 1v1 practice duels on VocabClash.',
    h1: 'SSC Vocabulary Master Guide: High-Yield PYQs, Strategy & 1v1 Practice',
    badge: 'Comprehensive SSC English Guide',
    readingTime: '7 min read',
    examFocus: 'SSC CGL, CHSL, CPO, MTS, Selection Post & GD Constable',
    intro: 'In SSC examinations, English Language and Comprehension constitutes up to 50% of the overall merit weightage in Tier 1 and Tier 2. Vocabulary alone accounts for 40% to 55% of all English questions in SSC CGL, CHSL, and CPO. Mastering synonyms, antonyms, one-word substitutions (OWS), idioms, and spelling corrections is the fastest way to score 45+/50 in Tier 1 and 125+/135 in Tier 2 without risking negative marks.',
    whyItMatters: [
      'Over 20-25 questions in SSC CGL Tier 2 test direct or contextual vocabulary mastery.',
      'Previous Year Questions (PYQs) from 2018 to 2025 repeat at an astonishing 70%+ frequency across shifts.',
      'Active recall through spaced repetition and timed 1v1 battles cuts vocabulary revision time by half.'
    ],
    weightageInfo: {
      tier1Questions: '8 - 12 Questions (16 - 24 Marks out of 50)',
      tier2Questions: '18 - 24 Questions (54 - 72 Marks out of 135)',
      totalMarksWeightage: '40% - 50% of Total English Section',
    },
    strategySteps: [
      {
        title: '1. Target 2018-2025 TCS Pattern PYQs First',
        description: 'Prioritize words tested repeatedly in SSC CGL, CHSL, and CPO since 2018. Over 70% of exam questions are direct repeats or derived from answer options of previous shifts.'
      },
      {
        title: '2. Deconstruct Words Using Greek & Latin Roots (Etymology)',
        description: 'Learn foundational prefixes, roots, and suffixes (e.g., "Bene" = good, "Mal" = bad, "Loqu/Locut" = speak, "Chron" = time). A single root unlocks the meaning of 15-20 complex words instantly.'
      },
      {
        title: '3. Test Under Strict Time Pressure (1v1 Live Duels)',
        description: 'Passive memorization creates the "illusion of competence." Compete in 10-second timed rounds on VocabClash to build rapid visual word recognition for exam hall speed.'
      },
      {
        title: '4. Maintain a Targeted Mistake Vault',
        description: 'Never review words you already know. Save incorrect attempts in an automated spaced repetition vault and review them at 24-hour and 7-day intervals.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'EPHEMERAL',
        type: 'Synonym',
        examTag: 'SSC CGL 2024 Tier 1',
        meaning: 'Lasting for a very short time; fleeting or transient.',
        hindiMeaning: 'अल्पकालिक / क्षणिक',
        options: ['Permanent', 'Transient', 'Eternal', 'Substantial'],
        correctAnswer: 'Transient',
        explanation: 'Ephemeral originates from the Greek word "ephemeros" (lasting only one day). Synonyms include Transient, Fleeting, Evanescent, Fugacious.',
        mnemonic: 'Remember: "E-PHEM-eral" sounds like "A fever" — a seasonal fever lasts for a short time.'
      },
      {
        wordOrPhrase: 'UBIQUITOUS',
        type: 'Antonym',
        examTag: 'SSC CHSL 2024',
        meaning: 'Present, appearing, or found everywhere.',
        hindiMeaning: 'सर्वव्यापी / हर जगह मौजूद',
        options: ['Omnipresent', 'Pervasive', 'Rare', 'Universal'],
        correctAnswer: 'Rare',
        explanation: 'Ubiquitous means found everywhere (Omnipresent). The opposite (antonym) is Rare, Scarce, or Infrequent.',
        mnemonic: 'Think of "UBI" (like USB ports) which are present everywhere on modern computers.'
      },
      {
        wordOrPhrase: 'A person who hates or distrusts humankind',
        type: 'OWS',
        examTag: 'SSC CPO 2023',
        meaning: 'One who harbors hatred or deep distrust towards humanity.',
        hindiMeaning: 'मानवद्वेषी',
        options: ['Philanthropist', 'Misanthrope', 'Misogynist', 'Altruist'],
        correctAnswer: 'Misanthrope',
        explanation: 'Root: Mis- (hatred) + Anthropos (human/mankind). Hence Misanthrope = hater of mankind.',
        mnemonic: 'Mis (Hatred) + Anthrop (Human) = Misanthrope.'
      },
      {
        wordOrPhrase: 'Bury the hatchet',
        type: 'Idiom',
        examTag: 'SSC CGL 2023 Tier 2',
        meaning: 'To end a quarrel or conflict and make peace.',
        hindiMeaning: 'पुरानी दुश्मनी भुलाकर समझौता करना',
        options: ['Keep a secret', 'Make peace / end hostility', 'Start a fresh fight', 'Hide valuable weapons'],
        correctAnswer: 'Make peace / end hostility',
        explanation: 'Historically, Native American tribes buried their weapons (hatchets) underground when concluding peace treaties.',
        mnemonic: 'Burying the axe/hatchet means you no longer intend to fight.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'Root: "LUC / LUM" (Light / Clear)',
        content: 'Lucid (clear, easy to understand), Elucidate (make clear/explain), Pellucid (translucently clear), Luminous (bright/shining).'
      },
      {
        title: 'Root: "MAL" (Bad / Evil)',
        content: 'Malevolent (wishing evil upon others), Malign (speak evil of), Malice (desire to harm), Malediction (a curse), Maladroit (clumsy/inept).'
      },
      {
        title: 'Root: "VOR / VOUR" (To Eat / Devour)',
        content: 'Voracious (having a huge appetite), Carnivorous (meat-eating), Herbivorous (plant-eating), Omnivorous (eating all foods).'
      }
    ],
    faqs: [
      {
        question: 'How many vocabulary words are needed for SSC CGL and CHSL?',
        answer: 'A targeted core vocabulary of approximately 3,000 to 4,000 high-frequency words (drawn primarily from 2018-2025 PYQs and classic word roots) covers 95%+ of questions asked in SSC CGL, CHSL, and CPO exams.'
      },
      {
        question: 'Are previous year vocabulary questions repeated in SSC exams?',
        answer: 'Yes. Empirical analysis of 2018-2025 SSC question papers shows that between 65% and 75% of vocabulary questions are either exact repeats or derived from the options of previous shifts.'
      },
      {
        question: 'How does 1v1 battle practice on VocabClash help in SSC preparation?',
        answer: '1v1 battles simulate the time constraint of the actual exam hall (10-15 seconds per question), forcing your brain into instant visual recognition and active recall rather than slow passive reading.'
      }
    ],
    relatedSlugs: ['/ssc-cgl-vocabulary', '/ssc-chsl-vocabulary', '/synonyms', '/antonyms', '/one-word-substitution', '/idioms-and-phrases', '/ssc-english-pyq']
  },

  'ssc-cgl-vocabulary': {
    id: 'ssc-cgl-vocabulary',
    slug: '/ssc-cgl-vocabulary',
    title: 'SSC CGL Vocabulary 2026: Tier 1 & Tier 2 High-Frequency PYQ Guide | VocabClash',
    metaDescription: 'Master SSC CGL Tier 1 and Tier 2 English vocabulary with 2018-2025 PYQs, antonyms, synonyms, OWS, idioms, and live 1v1 competitive arena battles on VocabClash.',
    h1: 'SSC CGL Vocabulary: Tier 1 & Tier 2 English Master Preparation Guide',
    badge: 'SSC CGL Tier 1 & Tier 2 Focus',
    readingTime: '8 min read',
    examFocus: 'SSC Combined Graduate Level (CGL) 2025 - 2026',
    intro: 'In the revised SSC CGL exam pattern, English Language carries 45 questions (135 marks) in Tier 2 — making it the single highest scoring section with the highest overall weightage. Vocabulary questions in CGL Tier 1 and Tier 2 test nuanced word usage, contextual synonyms, confusing antonym pairs, and advanced idioms.',
    whyItMatters: [
      'Tier 2 has 45 questions for 135 marks with negative marking of 1 mark per incorrect answer.',
      'Vocabulary speed determines whether you have sufficient time left for lengthy Reading Comprehension passages and Cloze Tests.',
      'High rankers score 130+/135 in Tier 2 English primarily by achieving 100% accuracy in vocabulary.'
    ],
    weightageInfo: {
      tier1Questions: '10 - 12 Questions (20 - 24 Marks)',
      tier2Questions: '20 - 24 Questions (60 - 72 Marks out of 135)',
      totalMarksWeightage: 'Single largest scoring component in SSC CGL',
    },
    strategySteps: [
      {
        title: '1. Master Tier 1 & Tier 2 Shift-Wise Question Banks',
        description: 'Solve all shifts of SSC CGL from 2018 to 2024. Pay special attention to Tier 2 papers where words with subtle contextual nuances (e.g., Candor vs. Frankness, Acrimonious vs. Acerbic) are tested.'
      },
      {
        title: '2. Understand Contextual Cloze Test Vocabulary',
        description: 'SSC CGL Tier 2 Cloze Tests frequently test word collocations and subtle prepositions (e.g., "abide by", "adhere to", "conducive to").'
      },
      {
        title: '3. Track Speed and Accuracy with Live Duels',
        description: 'In SSC CGL, spending more than 8-10 seconds on a pure vocabulary question costs you valuable time needed for Maths and Reasoning.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'ACRIMONIOUS',
        type: 'Synonym',
        examTag: 'SSC CGL Tier 2 (2023)',
        meaning: 'Angry, bitter, and sharp in tone or words.',
        hindiMeaning: 'उग्र / कटु / तल्ख़',
        options: ['Harmonious', 'Bitter / Caustic', 'Sympathetic', 'Delightful'],
        correctAnswer: 'Bitter / Caustic',
        explanation: 'Acrimonious comes from Latin "acer" (sharp, sour). Synonyms: Rancorous, Acerbic, Caustic, Vitriolic.',
        mnemonic: 'Think of "Acri" like "Acid" — acidic words cause sharp burning bitterness.'
      },
      {
        wordOrPhrase: 'SANCTION',
        type: 'Antonym',
        examTag: 'SSC CGL 2024 Tier 1',
        meaning: 'Official permission or approval for an action.',
        hindiMeaning: 'अनुमोदन / मंजूरी (भी और प्रतिबंध भी - Auto-antonym)',
        options: ['Approve', 'Authorize', 'Prohibit', 'Endorse'],
        correctAnswer: 'Prohibit',
        explanation: 'When sanction means approval, its antonym is Prohibit or Disallow.',
        mnemonic: 'Sanction is a Janus word (two opposite meanings). Look carefully at the options provided.'
      },
      {
        wordOrPhrase: 'A speech delivered without any prior preparation',
        type: 'OWS',
        examTag: 'SSC CGL Tier 1 (2023)',
        meaning: 'An impromptu speech given on the spot.',
        hindiMeaning: 'बिना पूर्व तैयारी का भाषण',
        options: ['Extempore', 'Maiden speech', 'Monologue', 'Oration'],
        correctAnswer: 'Extempore',
        explanation: 'Extempore / Impromptu = spoken or done without preparation. (Maiden speech = first speech; Monologue = speech by one person).',
        mnemonic: 'Ex (out of) + Tempore (time) = outside of planned preparation time.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'Root: "PLAC / PLEAS" (To please / calm)',
        content: 'Placid (calm and peaceful), Complacent (self-satisfied), Implacable (cannot be pacified/calmed), Placate (make someone less angry).'
      },
      {
        title: 'Root: "GREG" (Flock / Herd / Group)',
        content: 'Gregarious (sociable, fond of company), Egregious (outstandingly bad / standing out from the flock), Segregate (separate from the group), Congregate (gather together).'
      }
    ],
    faqs: [
      {
        question: 'How is SSC CGL Tier 2 vocabulary different from Tier 1?',
        answer: 'Tier 1 focuses heavily on direct synonyms, antonyms, and standard OWS. Tier 2 tests advanced vocabulary, contextual collocations in Cloze Tests, and secondary/figurative meanings of words.'
      },
      {
        question: 'What is the negative marking for English in SSC CGL Tier 2?',
        answer: 'Each correct question awards +3 marks, while each incorrect answer deducts -1 mark. This 33.33% penalty makes guessing risky, emphasizing the need for absolute certainty.'
      }
    ],
    relatedSlugs: ['/ssc-vocabulary', '/ssc-chsl-vocabulary', '/ssc-english-pyq', '/synonyms', '/antonyms', '/one-word-substitution', '/idioms-and-phrases']
  },

  'ssc-chsl-vocabulary': {
    id: 'ssc-chsl-vocabulary',
    slug: '/ssc-chsl-vocabulary',
    title: 'SSC CHSL Vocabulary 2026: 10+2 LDC & DEO English PYQ Preparation | VocabClash',
    metaDescription: 'Targeted SSC CHSL English vocabulary preparation with high-frequency synonyms, antonyms, spelling rules, OWS, idioms, and 1v1 battle practice on VocabClash.',
    h1: 'SSC CHSL Vocabulary: High-Yield English PYQ Strategy for 10+2 Aspirants',
    badge: 'SSC CHSL 10+2 Exam Focus',
    readingTime: '6 min read',
    examFocus: 'SSC CHSL (LDC, DEO, JSA) 2025 - 2026',
    intro: 'The SSC Combined Higher Secondary Level (CHSL) 10+2 examination tests core English proficiency across Tier 1 and Tier 2. In CHSL, vocabulary questions feature a high proportion of spelling corrections, direct antonyms/synonyms, and daily conversational idioms alongside academic vocabulary.',
    whyItMatters: [
      'Spelling corrections in CHSL carry 4-6 direct marks with tricky silent letters and doubled consonants.',
      'High competition means cut-offs frequently cross 145-155 marks in Tier 1; 45+ in English is virtually mandatory.',
      'CHSL vocabulary closely overlaps with SSC MTS and CGL Tier 1 question pools.'
    ],
    weightageInfo: {
      tier1Questions: '8 - 10 Questions (16 - 20 Marks out of 50)',
      tier2Questions: '15 - 18 Questions (45 - 54 Marks out of 120)',
      totalMarksWeightage: '35% - 45% of Total Marks',
    },
    strategySteps: [
      {
        title: '1. Master Common Misspelled Words',
        description: 'CHSL consistently asks words like Occurrence, Bureaucracy, Maintenance, Questionnaire, Privilege, Accommodation, and Millennium.'
      },
      {
        title: '2. Focus on Idioms of Daily Action & Emotions',
        description: 'CHSL idioms focus on common human situations (e.g., "At one\'s wit\'s end", "Spill the beans", "A feather in one\'s cap", "Through thick and thin").'
      },
      {
        title: '3. Practice Daily Speed Quizzes on VocabClash',
        description: 'Complete 25-question rapid drills to build pattern recognition for rapid 12-minute English section completion.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'CONSCIENTIOUS',
        type: 'Synonym',
        examTag: 'SSC CHSL 2024 Tier 1',
        meaning: 'Wishing to do one\'s work or duty thoroughly and diligently.',
        hindiMeaning: 'कर्तव्यनिष्ठ / ईमानदार / मेहनती',
        options: ['Careless', 'Diligent / Meticulous', 'Casual', 'Dishonest'],
        correctAnswer: 'Diligent / Meticulous',
        explanation: 'Conscientious describes a person guided by conscience to do careful work. Synonyms: Meticulous, Scrupulous, Painstaking, Diligent.',
        mnemonic: 'Conscience + Conscious = A person who is consciously listening to their conscience to do correct work.'
      },
      {
        wordOrPhrase: 'Frugal',
        type: 'Antonym',
        examTag: 'SSC CHSL 2023',
        meaning: 'Sparing or economical with regard to money or food.',
        hindiMeaning: 'मितव्ययी / कम खर्चीला',
        options: ['Economical', 'Extravagant', 'Miserly', 'Thrifty'],
        correctAnswer: 'Extravagant',
        explanation: 'Frugal means economical/thrifty. The antonym is Extravagant, Spendthrift, or Profligate.',
        mnemonic: 'Frugal people eat simple "Fruit" rather than expensive dining.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'CHSL Spelling Trap: Double Consonant Rule',
        content: 'Notice the double letters: Em-bar-rass, Oc-cur-rence, Ac-com-mo-date, Ne-ces-sa-ry, Mis-cel-la-neous.'
      }
    ],
    faqs: [
      {
        question: 'Is SSC CHSL vocabulary easier than SSC CGL vocabulary?',
        answer: 'While CHSL words are slightly more standard, the cutoff for CHSL is extremely high. Every single mark matters, so studying CGL PYQs alongside CHSL is the safest strategy.'
      }
    ],
    relatedSlugs: ['/ssc-vocabulary', '/ssc-cgl-vocabulary', '/synonyms', '/antonyms', '/one-word-substitution', '/idioms-and-phrases', '/ssc-english-pyq']
  },

  'synonyms': {
    id: 'synonyms',
    slug: '/synonyms',
    title: 'SSC English Synonyms: High-Yield PYQ List with Hindi Meanings & Mnemonics | VocabClash',
    metaDescription: 'Master English synonyms for SSC CGL, CHSL, CPO & Bank exams with 2018-2025 PYQ word lists, Hindi meanings, mnemonics, and real-time 1v1 practice battles on VocabClash.',
    h1: 'SSC English Synonyms: 500+ High-Yield PYQs, Meanings & 1v1 Battle Drills',
    badge: 'Synonyms Mastery Hub',
    readingTime: '6 min read',
    examFocus: 'SSC, Banking, Railway, CDS & AFCAT Exams',
    intro: 'Synonym questions in government examinations test your ability to distinguish precise shades of meaning among closely related words. In SSC CGL and CHSL, the examiner often pairs a challenging headword with four plausible options, requiring you to eliminate subtle distractor choices.',
    whyItMatters: [
      'Direct synonym questions carry 4 to 8 marks in Tier 1 and up to 15 marks in Tier 2.',
      'Understanding synonyms enriches your Reading Comprehension and Cloze Test accuracy.',
      'Learning synonyms in thematic clusters (e.g., words for Praising, Criticizing, Short-lived) accelerates retention threefold.'
    ],
    weightageInfo: {
      tier1Questions: '2 - 3 Questions (4 - 6 Marks)',
      tier2Questions: '4 - 6 Questions (12 - 18 Marks)',
      totalMarksWeightage: '15% of English Vocabulary Section',
    },
    strategySteps: [
      {
        title: '1. Group Words into Thematic Synonyms Clusters',
        description: 'Instead of studying alphabetical lists (A-Z), group words by core emotional concepts (e.g., Eulogize, Extol, Laud, Applaud, Exalt all mean "to praise highly").'
      },
      {
        title: '2. Use Tone & Connotation Elimination (+ / -)',
        description: 'Identify whether the target word has a positive, negative, or neutral tone. If the question word is negative (e.g., Deleterious), immediately eliminate positive options.'
      },
      {
        title: '3. Test Speed Under 10-Second Countdown on VocabClash',
        description: 'Quickly lock the correct synonym before your opponent in VocabClash 1v1 matches to develop lightning-fast reflex recall.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'METICULOUS',
        type: 'Synonym',
        examTag: 'SSC CGL 2024 / SSC CPO 2023',
        meaning: 'Showing great attention to detail; very careful and precise.',
        hindiMeaning: 'अति सावधान / सूक्ष्म / बारीकी से काम करने वाला',
        options: ['Careless', 'Painstaking / Scrupulous', 'Hasty', 'Reckless'],
        correctAnswer: 'Painstaking / Scrupulous',
        explanation: 'Meticulous = Fastidious, Scrupulous, Painstaking, Punctilious, Thorough.',
        mnemonic: 'Meticulous = "Matters in minute details" — someone who checks every tiny detail.'
      },
      {
        wordOrPhrase: 'OBDURATE',
        type: 'Synonym',
        examTag: 'SSC CGL Tier 2',
        meaning: 'Stubbornly refusing to change one\'s opinion or course of action.',
        hindiMeaning: 'हठी / ज़िद्दी / कठोर',
        options: ['Flexible', 'Stubborn / Obstinate', 'Submissive', 'Amenable'],
        correctAnswer: 'Stubborn / Obstinate',
        explanation: 'Obdurate = Stubborn, Obstinate, Intractable, Refractory, Inflexible, Bullheaded.',
        mnemonic: 'Obdurate = "Durable" like a rock that will not bend or yield.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'Synonym Cluster: "Praise & Flattery"',
        content: 'Laud, Extol, Eulogize, Acclaim, Exalt, Commend, Compliment, Adulate (excessive flattery), Sycophantic.'
      },
      {
        title: 'Synonym Cluster: "Tired / Weak"',
        content: 'Enervated, Lethargic, Languid, Debilitated, Frail, Fatigued, Exhausted, Feeble.'
      }
    ],
    faqs: [
      {
        question: 'How do I remember difficult synonyms without forgetting?',
        answer: 'Use the 3-pillar method: Root word analysis + Visual mnemonic + Active testing in 1v1 duels. Reviewing errors in your Mistake Vault cements long-term memory.'
      }
    ],
    relatedSlugs: ['/antonyms', '/one-word-substitution', '/idioms-and-phrases', '/ssc-vocabulary', '/ssc-cgl-vocabulary', '/ssc-english-pyq']
  },

  'antonyms': {
    id: 'antonyms',
    slug: '/antonyms',
    title: 'SSC English Antonyms: High-Frequency PYQ Opposite Word Pairs | VocabClash',
    metaDescription: 'Master English antonyms for SSC CGL, CHSL, CPO, MTS and Bank exams with contrasting word pairs, prefixes, Hindi meanings, and 1v1 battle practice on VocabClash.',
    h1: 'SSC English Antonyms: High-Frequency Opposite Pairs & Exam Strategies',
    badge: 'Antonyms Mastery Hub',
    readingTime: '6 min read',
    examFocus: 'SSC CGL, CHSL, CPO, MTS, Bank PO & Clerk',
    intro: 'Antonym questions are notorious in SSC exams because test-takers often mistakenly choose the synonym due to reading haste under timer pressure. Mastering antonyms requires understanding negative prefixes (un-, in-, dis-, a-, mis-) and recognizing polar opposite concepts in context.',
    whyItMatters: [
      'Antonyms test your ability to reject attractive synonym distractors under time pressure.',
      'Understanding antonyms doubles your total vocabulary by linking every concept with its exact counterpart.',
      'Averaging 100% accuracy in antonyms directly boosts Tier 1 scores by 6 marks.'
    ],
    weightageInfo: {
      tier1Questions: '2 - 3 Questions (4 - 6 Marks)',
      tier2Questions: '4 - 6 Questions (12 - 18 Marks)',
      totalMarksWeightage: '15% of English Vocabulary Section',
    },
    strategySteps: [
      {
        title: '1. Watch Out for the "Synonym Trap"',
        description: 'In 90% of SSC antonym questions, Option A or Option B is a direct SYNONYM designed to catch hasty readers. Always re-verify: "Does this mean the OPPOSITE?" before selecting.'
      },
      {
        title: '2. Leverage Negative Prefixes for Fast Elimination',
        description: 'Look for prefix polarity: Mal- vs Bene- (Malicious vs Benevolent), Hyper- vs Hypo-, Intro- vs Extro-.'
      },
      {
        title: '3. Drill with Contrasting Flashcards & 1v1 Matches',
        description: 'Pair opposite words together (e.g., Ephemeral ↔ Eternal, Frugal ↔ Extravagant, Candid ↔ Deceptive) in VocabClash battles.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'CANDID',
        type: 'Antonym',
        examTag: 'SSC CGL Tier 1',
        meaning: 'Truthful, straightforward, and frank.',
        hindiMeaning: 'निष्कपट / स्पष्टवादी',
        options: ['Frank', 'Honest', 'Deceitful / Cunning', 'Outspoken'],
        correctAnswer: 'Deceitful / Cunning',
        explanation: 'Candid means honest and frank. The antonym is Deceitful, Cunning, Insincere, or Evasive.',
        mnemonic: 'Candid photos are real and unposed. The opposite is staged and fake (Deceitful).'
      },
      {
        wordOrPhrase: 'TACITURN',
        type: 'Antonym',
        examTag: 'SSC CHSL / CPO',
        meaning: 'Reserved or uncommunicative in speech; saying little.',
        hindiMeaning: 'कम बोलने वाला / अल्पभाषी',
        options: ['Silent', 'Reticent', 'Loquacious / Talkative', 'Mute'],
        correctAnswer: 'Loquacious / Talkative',
        explanation: 'Taciturn = Reticent, Silent, Reserved. Antonym = Loquacious, Garrulous, Voluble, Talkative.',
        mnemonic: 'Taciturn = "Takes turn" to speak once in a blue moon. Loquacious speaks non-stop.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'Opposite Pairs Frequently Repeated in SSC:',
        content: 'Altruistic (Selfless) ↔ Egoistic (Selfish); Benevolent (Kind) ↔ Malevolent (Cruel); Zenith (Peak) ↔ Nadir (Lowest point); Gregarious (Sociable) ↔ Reclusive (Introverted).'
      }
    ],
    faqs: [
      {
        question: 'Why do candidates lose marks in Antonyms more than Synonyms?',
        answer: 'Under exam pressure, the brain automatically seeks word associations (synonyms). Aspirants frequently identify the synonym and click it instinctively without inverting to find the opposite.'
      }
    ],
    relatedSlugs: ['/synonyms', '/one-word-substitution', '/idioms-and-phrases', '/ssc-vocabulary', '/ssc-cgl-vocabulary', '/ssc-english-pyq']
  },

  'one-word-substitution': {
    id: 'one-word-substitution',
    slug: '/one-word-substitution',
    title: 'SSC One Word Substitution (OWS): Master List, Root Words & PYQs | VocabClash',
    metaDescription: 'Complete One Word Substitution (OWS) master guide for SSC CGL, CHSL, CPO exams with root word categorizations (Phobias, Manias, Cides, Cracies) and 1v1 drills on VocabClash.',
    h1: 'SSC One Word Substitution: 400+ High-Yield OWS with Root Word Tricks',
    badge: 'One Word Substitution Master Hub',
    readingTime: '7 min read',
    examFocus: 'SSC CGL, CHSL, CPO, MTS, Stenographer & CDS',
    intro: 'One Word Substitution (OWS) is the highest-scoring and most predictable segment of the SSC English syllabus. By categorizing OWS questions into systematic root suffixes — such as -cide (killing), -cracy (government), -phobia (fear), -mania (madness/obsession), and -phile (lover) — you can master hundreds of exam questions systematically.',
    whyItMatters: [
      'OWS represents 100% rule-bound vocabulary where root words guarantee certainty.',
      'Accounts for 3-5 questions in Tier 1 and 6-8 questions in Tier 2 (up to 24 marks).',
      'High repetition rate: 80%+ of OWS in SSC exams are repeats from previous years.'
    ],
    weightageInfo: {
      tier1Questions: '2 - 3 Questions (4 - 6 Marks)',
      tier2Questions: '4 - 7 Questions (12 - 21 Marks)',
      totalMarksWeightage: '20% of Total English Vocabulary',
    },
    strategySteps: [
      {
        title: '1. Master the Top 6 Suffix Categories',
        description: 'Categorize terms by -cide (Killing), -cracy (Rule/Govt), -mania (Obsession), -phobia (Fear), -ist (Practitioner/Believer), -ology (Study of).'
      },
      {
        title: '2. Focus on People & Occupations',
        description: 'Learn terms describing specialists: Numismatist (coins), Philatelist (stamps), Somnambulist (sleepwalker), Calligrapher (fine handwriting).'
      },
      {
        title: '3. Test Speed with Rapid-Fire 1v1 Battle Arena',
        description: 'OWS questions should take no more than 5 seconds in the exam hall. VocabClash drills build instinctive recall.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'A person who loves books and reading',
        type: 'OWS',
        examTag: 'SSC CGL 2024 Tier 1',
        meaning: 'A lover of books and literature.',
        hindiMeaning: 'पुस्तकों से प्रेम करने वाला / पुस्तक प्रेमी',
        options: ['Bibliophile', 'Bibliophobe', 'Bibliographer', 'Polyglot'],
        correctAnswer: 'Bibliophile',
        explanation: 'Biblio (book) + Phil (love) = Bibliophile.',
        mnemonic: 'Biblio = Bible/Books; Phil = Philosophy/Love of wisdom.'
      },
      {
        wordOrPhrase: 'Government by the wealthy class',
        type: 'OWS',
        examTag: 'SSC CPO Tier 1',
        meaning: 'A society or system ruled or dominated by the wealthy.',
        hindiMeaning: 'धनिक तंत्र / अमीरों का शासन',
        options: ['Aristocracy', 'Plutocracy', 'Oligarchy', 'Autocracy'],
        correctAnswer: 'Plutocracy',
        explanation: 'Pluto (wealth/riches) + Cracy (rule/government) = Plutocracy.',
        mnemonic: 'Pluto has mountains of gold and riches = Plutocracy is government by the rich.'
      },
      {
        wordOrPhrase: 'The act of killing one\'s own brother',
        type: 'OWS',
        examTag: 'SSC CHSL 2023',
        meaning: 'The murder or killing of one\'s brother.',
        hindiMeaning: 'भ्रातृघात / भाई की हत्या',
        options: ['Patricide', 'Fratricide', 'Sororicide', 'Regicide'],
        correctAnswer: 'Fratricide',
        explanation: 'Frater (Brother) + Cide (Kill) = Fratricide. (Patricide = Father, Sororicide = Sister, Regicide = King).',
        mnemonic: 'Fraternity = Brotherhood → Fratricide = Killing of a brother.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'Key Suffix: "-CIDE" (Act of Killing)',
        content: 'Matricide (Mother), Patricide (Father), Fratricide (Brother), Sororicide (Sister), Uxoricide (Wife), Mariticide (Husband), Filicide (Child), Regicide (King), Infanticide (Infant), Genocide (Entire race).'
      },
      {
        title: 'Key Suffix: "-CRACY" (Rule / Form of Government)',
        content: 'Democracy (People), Plutocracy (Wealthy), Aristocracy (Nobles), Bureaucracy (Officials), Autocracy (Single ruler with absolute power), Oligarchy (Few people), Theocracy (Religious leaders), Anarchy (No government).'
      }
    ],
    faqs: [
      {
        question: 'Which OWS root categories appear most often in SSC CGL?',
        answer: 'The most frequently tested categories are: Types of Governments (-cracy), Forms of Killings (-cide), Personal Characteristics & Habits (Misanthrope, Altruist, Ascetic), and Places where things are kept (Aviary, Apiary, Arsenal).'
      }
    ],
    relatedSlugs: ['/idioms-and-phrases', '/synonyms', '/antonyms', '/ssc-vocabulary', '/ssc-cgl-vocabulary', '/ssc-chsl-vocabulary', '/ssc-english-pyq']
  },

  'idioms-and-phrases': {
    id: 'idioms-and-phrases',
    slug: '/idioms-and-phrases',
    title: 'SSC Idioms & Phrases: High-Frequency PYQ Meanings & Origins | VocabClash',
    metaDescription: 'Master 500+ SSC idioms and phrases for SSC CGL, CHSL, CPO exams with origins, Hindi meanings, exam examples, and live 1v1 battle quizzes on VocabClash.',
    h1: 'SSC Idioms and Phrases: 500+ High-Yield PYQs, Meanings & 1v1 Duels',
    badge: 'Idioms & Phrases Mastery Hub',
    readingTime: '7 min read',
    examFocus: 'SSC CGL, CHSL, CPO, MTS & Banking Exams',
    intro: 'Idioms and phrases are figurative expressions whose real meaning cannot be deduced from the literal words alone. In SSC examinations, questions test your knowledge of traditional idioms, animal-based idioms, body-part idioms, and color idioms.',
    whyItMatters: [
      'Idioms questions appear in both direct MCQs and sentence improvement / error spotting.',
      'Carries 4-6 marks in Tier 1 and up to 15 marks in Tier 2.',
      'Understanding idiom stories and historical origins eliminates rote memorization.'
    ],
    weightageInfo: {
      tier1Questions: '2 - 3 Questions (4 - 6 Marks)',
      tier2Questions: '4 - 6 Questions (12 - 18 Marks)',
      totalMarksWeightage: '15% of Total English Section',
    },
    strategySteps: [
      {
        title: '1. Group Idioms by Themes (Colors, Animals, Body Parts)',
        description: 'Study color idioms (e.g., Once in a blue moon, Red tape, Black sheep, Out of the blue) and body part idioms (e.g., Turn a blind eye, Cold shoulder, Cost an arm and a leg).'
      },
      {
        title: '2. Understand the Historical Origin Story',
        description: 'Connecting idioms to their historical origins (e.g., "Bite the bullet" was born from soldiers biting lead bullets during surgery before anesthesia) makes them impossible to forget.'
      },
      {
        title: '3. Eliminate Literal Distractors',
        description: 'Never pick an answer option that takes the idiom literally. If an idiom mentions "apple" or "bull", the correct figurative answer will rarely mention actual fruit or livestock.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'Gift of the gab',
        type: 'Idiom',
        examTag: 'SSC CGL 2024 / SSC CHSL',
        meaning: 'The ability to speak easily, eloquently, and persuasively.',
        hindiMeaning: 'वाकपटुता / धाराप्रवाह और प्रभावशाली बोलने की कला',
        options: ['Receiving an unexpected present', 'Ability to speak eloquently', 'A deceptive offer', 'Having great wealth'],
        correctAnswer: 'Ability to speak eloquently',
        explanation: '"Gab" is an old word for chatter/talk. Having the gift of the gab means having natural talent for persuasive speech.',
        mnemonic: 'Gab = Gup-shup (talking) → Gift of the gab = Gift of great speaking.'
      },
      {
        wordOrPhrase: 'Burn the midnight oil',
        type: 'Idiom',
        examTag: 'SSC CGL Tier 1',
        meaning: 'To work or study late into the night.',
        hindiMeaning: 'देर रात तक कड़ी मेहनत या पढ़ाई करना',
        options: ['Waste electricity', 'Work or study late into the night', 'Create chaos', 'Cause a fire accident'],
        correctAnswer: 'Work or study late into the night',
        explanation: 'Before electric lighting, people burned oil lamps to read and work through the night.',
        mnemonic: 'Burning lamp oil at midnight represents dedicated night study.'
      },
      {
        wordOrPhrase: 'A red-letter day',
        type: 'Idiom',
        examTag: 'SSC CPO 2023',
        meaning: 'A memorably important or joyful day.',
        hindiMeaning: 'एक बहुत महत्वपूर्ण या सुखद दिन',
        options: ['A dangerous day', 'A very important or auspicious day', 'A boring holiday', 'A day full of anger'],
        correctAnswer: 'A very important or auspicious day',
        explanation: 'Calendars traditionally printed holy days and festival dates in red ink.',
        mnemonic: 'Red dates on calendars represent special holidays and celebrations.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'Popular Color-Themed Idioms for SSC:',
        content: 'Once in a blue moon (rarely), Beat black and blue (badly bruised), Red tape (official delay/bureaucracy), White elephant (expensive but useless possession), Green horn (inexperienced person), In the pink of health (in best physical condition).'
      }
    ],
    faqs: [
      {
        question: 'Are idioms repeated frequently in SSC exams?',
        answer: 'Yes! SSC has a core repository of about 400-500 idioms that account for 85%+ of questions in SSC CGL, CHSL, and CPO shifts.'
      }
    ],
    relatedSlugs: ['/one-word-substitution', '/synonyms', '/antonyms', '/ssc-vocabulary', '/ssc-cgl-vocabulary', '/ssc-chsl-vocabulary', '/ssc-english-pyq']
  },

  'ssc-english-pyq': {
    id: 'ssc-english-pyq',
    slug: '/ssc-english-pyq',
    title: 'SSC English PYQ: Chapter-Wise Previous Year Questions & Solutions | VocabClash',
    metaDescription: 'Solve 24,000+ SSC English Previous Year Questions (PYQs) with verified answers, Hindi explanations, root words, and real-time 1v1 battle practice on VocabClash.',
    h1: 'SSC English PYQs: 24,000+ Shift-Wise Questions with Instant Solutions',
    badge: 'Previous Year Question Arena',
    readingTime: '8 min read',
    examFocus: 'SSC CGL, CHSL, CPO, MTS, Selection Posts (2018-2025)',
    intro: 'Previous Year Questions (PYQs) form the bedrock of SSC English preparation. With over 24,000 official questions administered across shifts from 2018 to 2025 under the TCS testing pattern, analyzing recurring patterns, vocabulary frequency, and common error traps provides the highest return on study time.',
    whyItMatters: [
      'Over 70% of questions in upcoming shifts are direct repeats or closely patterned on 2018-2025 PYQs.',
      'Solving PYQs under timed constraints builds accurate intuition and prevents exam-hall panic.',
      'VocabClash lets you practice chapter-wise PYQs solo or challenge real aspirants in head-to-head 1v1 duels.'
    ],
    weightageInfo: {
      tier1Questions: '25 Questions (50 Marks)',
      tier2Questions: '45 Questions (135 Marks)',
      totalMarksWeightage: 'Crucial for 100% Final Merit Selection',
    },
    strategySteps: [
      {
        title: '1. Chapter-Wise Decomposition',
        description: 'Break down your preparation into distinct modules: Synonyms, Antonyms, One Word Substitution, Idioms & Phrases, Spelling Correction, and Error Spotting.'
      },
      {
        title: '2. Analyze All 4 Options of Every PYQ',
        description: 'Do not just memorize the correct answer. Learn the definitions of the other 3 incorrect options, because SSC frequently turns previous distractor options into future questions.'
      },
      {
        title: '3. Challenge Aspirants in 1v1 Ranked Duels',
        description: 'Test your PYQ mastery against thousands of fellow aspirants on the VocabClash All-India leaderboard.'
      }
    ],
    pyqSamples: [
      {
        wordOrPhrase: 'Select the correctly spelled word:',
        type: 'Synonym',
        examTag: 'SSC CGL 2024 Tier 1',
        meaning: 'Correct spelling identification.',
        hindiMeaning: 'शुद्ध वर्तनी',
        options: ['Occurence', 'Occurrence', 'Ocurrence', 'Occurrance'],
        correctAnswer: 'Occurrence',
        explanation: 'Occurrence has double "c" and double "r" and ends in "-ence" (O-c-c-u-r-r-e-n-c-e).',
        mnemonic: 'Double C, Double R, Ends in ENCE.'
      },
      {
        wordOrPhrase: 'A person who is indifferent to pain or pleasure',
        type: 'OWS',
        examTag: 'SSC CGL Tier 2',
        meaning: 'One who endures pain or hardship without showing feelings or complaining.',
        hindiMeaning: 'उदासीन / सुख-दुःख में समान रहने वाला व्यक्ति',
        options: ['Stoic', 'Epicurean', 'Cynic', 'Hedonist'],
        correctAnswer: 'Stoic',
        explanation: 'A Stoic remains unaffected by joy or sorrow. (Hedonist = pleasure seeker; Epicurean = seeker of refined sensory pleasure; Cynic = distrusts human motives).',
        mnemonic: 'Stoic = Stands like a stone in both rain and sunshine.'
      }
    ],
    rootWordsOrTips: [
      {
        title: 'High-Frequency Exam Trend Analysis (2018-2025):',
        content: 'Synonyms & Antonyms: 35% | OWS: 25% | Idioms & Phrases: 25% | Spelling Corrections: 15%.'
      }
    ],
    faqs: [
      {
        question: 'Which years of SSC English PYQs are most relevant for 2025-2026 exams?',
        answer: 'Questions from 2018 onwards (when TCS began conducting SSC exams) are the most critical. Ensure you have thoroughly covered 2021, 2022, 2023, and 2024 CGL, CHSL, and CPO shifts.'
      },
      {
        question: 'How does VocabClash help in PYQ retention?',
        answer: 'VocabClash integrates 24,000+ verified SSC questions with instant Hindi explanations, mnemonics, automated spaced repetition (Mistake Vault), and 1v1 live multiplayer battles.'
      }
    ],
    relatedSlugs: ['/ssc-vocabulary', '/ssc-cgl-vocabulary', '/ssc-chsl-vocabulary', '/synonyms', '/antonyms', '/one-word-substitution', '/idioms-and-phrases']
  }
};

export const ALL_SEO_SLUGS = Object.keys(SEO_PAGES).map(k => SEO_PAGES[k].slug);
