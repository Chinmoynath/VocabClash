import { ExamType, Question, ExamAppearance } from '../types';

export type CanonicalExamFamily = 'ssc' | 'banking' | 'defence' | 'railways' | 'other';

export interface ExamFamilyPillOption {
  id: ExamType;
  label: string;
  family?: CanonicalExamFamily;
}

export interface SubExamOption {
  id: ExamType;
  label: string;
  tag?: string;
  family: CanonicalExamFamily;
}

export const EXAM_FAMILY_PILLS: ExamFamilyPillOption[] = [
  { id: 'ALL', label: 'All Exams' },
  { id: 'SSC', label: 'SSC', family: 'ssc' },
  { id: 'BANKING', label: 'Banking', family: 'banking' },
  { id: 'DEFENCE', label: 'Defence', family: 'defence' },
];

/**
 * Informative non-touchable preview tags for what exams are covered under each board family.
 */
export const EXAM_FAMILY_SUB_TAGS: Record<CanonicalExamFamily, string[]> = {
  ssc: ['CGL (Tier 1/2)', 'CHSL (10+2)', 'CPO (SI)', 'MTS & Havaldar', 'Steno & Phase'],
  banking: ['SBI PO', 'IBPS PO', 'SBI Clerk', 'IBPS Clerk', 'RRB & RBI Asst/PO'],
  defence: ['CDS (UPSC)', 'AFCAT', 'NDA / NA', 'CAPF (AC)'],
  railways: ['RRB NTPC', 'RRB Group D'],
  other: [],
};

export const EXAM_SUB_OPTIONS: Record<CanonicalExamFamily, SubExamOption[]> = {
  ssc: [
    { id: 'SSC', label: 'All SSC Shifts', tag: 'Combined', family: 'ssc' },
    { id: 'SSC_CGL', label: 'SSC CGL', tag: 'Tier 1/2', family: 'ssc' },
    { id: 'SSC_CHSL', label: 'SSC CHSL', tag: '10+2', family: 'ssc' },
    { id: 'SSC_CPO', label: 'SSC CPO', tag: 'SI / DP', family: 'ssc' },
    { id: 'SSC_MTS', label: 'SSC MTS', tag: 'Havaldar', family: 'ssc' },
    { id: 'SSC_STENO', label: 'SSC Steno & Selection', tag: 'Phase', family: 'ssc' },
  ],
  banking: [
    { id: 'BANKING', label: 'All Banking', tag: 'Combined', family: 'banking' },
    { id: 'BANK_SBI_PO', label: 'SBI PO', tag: 'Phase I/II', family: 'banking' },
    { id: 'BANK_IBPS_PO', label: 'IBPS PO', tag: 'Prelims/Mains', family: 'banking' },
    { id: 'BANK_SBI_CLERK', label: 'SBI Clerk', tag: 'Mains', family: 'banking' },
    { id: 'BANK_IBPS_CLERK', label: 'IBPS Clerk', tag: 'Clerk', family: 'banking' },
    { id: 'BANK_RRB_RBI', label: 'RRB & RBI', tag: 'PO / Asst', family: 'banking' },
  ],
  defence: [
    { id: 'DEFENCE', label: 'All Defence', tag: 'Combined', family: 'defence' },
    { id: 'DEF_CDS', label: 'CDS', tag: 'UPSC OTA/IMA', family: 'defence' },
    { id: 'DEF_AFCAT', label: 'AFCAT', tag: 'IAF Flying', family: 'defence' },
    { id: 'DEF_NDA', label: 'NDA / NA', tag: 'Cadet Wing', family: 'defence' },
    { id: 'DEF_CAPF', label: 'CAPF', tag: 'Asst. Comdt.', family: 'defence' },
  ],
  railways: [
    { id: 'RRB_NTPC', label: 'RRB NTPC', tag: 'CBT 1/2', family: 'railways' },
    { id: 'RRB_GROUP_D', label: 'RRB Group D', tag: 'CBT', family: 'railways' },
  ],
  other: [],
};

/**
 * Returns clean, human-readable display info for the current exam filter.
 */
export function getExamFilterDisplayName(exam: ExamType | string | undefined | null): {
  familyName: string;
  subName: string;
  fullLabel: string;
} {
  const family = normalizeFilterToFamily(exam);
  if (family === 'all') {
    return {
      familyName: 'All Govt Exams',
      subName: 'All Board PYQs',
      fullLabel: 'All Govt Exams',
    };
  }

  const familyLabel = family === 'ssc' ? 'SSC' : family === 'banking' ? 'Banking' : family === 'defence' ? 'Defence' : 'Railways';
  const subOptions = EXAM_SUB_OPTIONS[family] || [];
  const found = subOptions.find(opt => opt.id === exam);

  if (!found || found.id === 'SSC' || found.id === 'BANKING' || found.id === 'DEFENCE') {
    return {
      familyName: familyLabel,
      subName: `All ${familyLabel} Shifts`,
      fullLabel: `${familyLabel} (All Shifts)`,
    };
  }

  return {
    familyName: familyLabel,
    subName: `${found.label}${found.tag ? ` (${found.tag})` : ''}`,
    fullLabel: `${familyLabel} > ${found.label}`,
  };
}

/**
 * Normalizes any raw string (exam name, family name, or history tag) into a CanonicalExamFamily.
 * Robust against aliases, punctuation, spacing, and casing.
 */
export function normalizeExamStringToFamily(raw: string | undefined | null): CanonicalExamFamily {
  if (!raw || typeof raw !== 'string') return 'other';

  const clean = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ');

  if (!clean) return 'other';

  // 1. BANKING CHECKS (Must check before general RRB to avoid misclassifying IBPS RRB as Railways)
  if (
    clean.includes('ibps') ||
    clean.includes('sbi') ||
    clean.includes('rbi') ||
    clean.includes('nabard') ||
    clean.includes('sebi') ||
    clean.includes('bank') ||
    clean.includes('banking') ||
    clean.includes('lic aao') ||
    clean.includes('niacl') ||
    clean.includes('rrb po') ||
    clean.includes('rrb clerk') ||
    clean.includes('ibps rrb')
  ) {
    return 'banking';
  }

  // 2. DEFENCE CHECKS
  if (
    clean.includes('defence') ||
    clean.includes('defense') ||
    clean.includes('cds') ||
    clean.includes('afcat') ||
    clean.includes('nda') ||
    clean.includes('capf') ||
    clean.includes('territorial army') ||
    clean.includes('air force') ||
    clean.includes('naval') ||
    clean.includes('navy') ||
    clean.includes('coast guard') ||
    clean.includes('inet')
  ) {
    return 'defence';
  }

  // 3. RAILWAYS CHECKS
  if (
    clean.includes('railway') ||
    clean.includes('railways') ||
    clean.includes('ntpc') ||
    clean.includes('group d') ||
    clean.includes('groupd') ||
    clean.includes('rrc') ||
    clean.includes('rrb') ||
    clean.includes('alp') ||
    clean.includes('loco pilot')
  ) {
    return 'railways';
  }

  // 4. SSC CHECKS
  if (
    clean.includes('ssc') ||
    clean.includes('cgl') ||
    clean.includes('combined graduate level') ||
    clean.includes('chsl') ||
    clean.includes('combined higher secondary') ||
    clean.includes('10 2') ||
    clean.includes('cpo') ||
    clean.includes('delhi police') ||
    clean.includes('mts') ||
    clean.includes('multi tasking') ||
    clean.includes('multitasking') ||
    clean.includes('havaldar') ||
    clean.includes('selection post') ||
    clean.includes('stenographer') ||
    clean.includes('steno') ||
    clean.includes('gd constable') ||
    clean.includes('ssc gd')
  ) {
    return 'ssc';
  }

  return 'other';
}

/**
 * Centralized function to determine the canonical exam family of a Question, ExamAppearance, or string.
 * Inspects:
 *  1. Direct examFamily property
 *  2. Direct exam property
 *  3. Primary / all appearances
 *  4. Exam history tags
 */
export function normalizeExamFamily(
  input: Question | ExamAppearance | { examFamily?: string; exam?: string; appearances?: ExamAppearance[]; examHistory?: string[] } | string | undefined | null
): CanonicalExamFamily {
  if (!input) return 'other';

  if (typeof input === 'string') {
    return normalizeExamStringToFamily(input);
  }

  // 1. Direct examFamily string property
  if (input.examFamily && typeof input.examFamily === 'string') {
    const fromFamily = normalizeExamStringToFamily(input.examFamily);
    if (fromFamily !== 'other') return fromFamily;
  }

  // 2. Direct exam property
  if (input.exam && typeof input.exam === 'string') {
    const fromExam = normalizeExamStringToFamily(input.exam);
    if (fromExam !== 'other') return fromExam;
  }

  // 3. Primary appearance from appearances array
  if ('appearances' in input && Array.isArray(input.appearances) && input.appearances.length > 0) {
    for (const app of input.appearances) {
      if (!app) continue;
      if (app.examFamily) {
        const fam = normalizeExamStringToFamily(app.examFamily);
        if (fam !== 'other') return fam;
      }
      if (app.exam) {
        const fam = normalizeExamStringToFamily(app.exam);
        if (fam !== 'other') return fam;
      }
    }
  }

  // 4. Exam history tags
  if ('examHistory' in input && Array.isArray(input.examHistory) && input.examHistory.length > 0) {
    for (const tag of input.examHistory) {
      if (typeof tag === 'string') {
        const fam = normalizeExamStringToFamily(tag);
        if (fam !== 'other') return fam;
      }
    }
  }

  // Default fallback for legacy Govt PYQs with no explicit exam info
  return 'ssc';
}

/**
 * Converts user filter selection (ExamType or string) into target canonical family or 'all'.
 */
export function normalizeFilterToFamily(
  filter: ExamType | string | undefined | null
): 'all' | CanonicalExamFamily {
  if (!filter) return 'all';

  const normalized = String(filter).toUpperCase().trim();

  if (normalized === 'ALL' || normalized === 'ALL_EXAMS' || normalized === 'ALL EXAMS') {
    return 'all';
  }

  if (normalized === 'SSC' || normalized.startsWith('SSC_')) {
    return 'ssc';
  }

  if (normalized === 'BANKING' || normalized.startsWith('BANK_') || normalized === 'BANK') {
    return 'banking';
  }

  if (normalized === 'DEFENCE' || normalized.startsWith('DEF_') || normalized === 'CDS_NDA' || normalized === 'DEFENSE') {
    return 'defence';
  }

  if (normalized.startsWith('RRB_') || normalized === 'RAILWAYS') {
    return 'railways';
  }

  const detected = normalizeExamStringToFamily(filter);
  return detected === 'other' ? 'all' : detected;
}

/**
 * Checks if a question matches the target exam filter.
 * Guaranteed:
 *  - When ALL: matches everything.
 *  - When SSC: ONLY questions whose canonical family is 'ssc' match.
 *  - When BANKING: ONLY questions whose canonical family is 'banking' match.
 *  - When DEFENCE: ONLY questions whose canonical family is 'defence' match.
 *  - Sub-exam granularity is preserved for granular selection (e.g. 'SSC_CGL').
 */
export function matchesExamFamilyFilter(
  question: Question | { examFamily?: string; exam?: string; appearances?: ExamAppearance[]; examHistory?: string[] } | undefined | null,
  filter: ExamType | string | undefined | null
): boolean {
  if (!question) return false;
  if (!filter) return true;

  const targetFamily = normalizeFilterToFamily(filter);
  if (targetFamily === 'all') return true;

  const questionFamily = normalizeExamFamily(question);

  // Strictly enforce family boundary
  if (questionFamily !== targetFamily) {
    return false;
  }

  // If a general family was chosen (e.g. SSC, BANKING, DEFENCE)
  const rawFilter = String(filter).toUpperCase().trim();
  if (
    rawFilter === 'SSC' ||
    rawFilter === 'BANKING' ||
    rawFilter === 'DEFENCE' ||
    rawFilter === 'ALL'
  ) {
    return true;
  }

  // If a granular sub-filter was specified (e.g. 'SSC_CGL', 'SSC_CHSL', 'BANK_SBI_PO')
  return matchGranularSubExam(question, rawFilter);
}

/**
 * Robust matcher for granular sub-exams within a board family.
 */
function matchGranularSubExam(question: any, subFilter: string): boolean {
  const texts: string[] = [];
  if (question.exam && typeof question.exam === 'string') texts.push(question.exam.toLowerCase());
  if (question.tier && typeof question.tier === 'string') texts.push(question.tier.toLowerCase());
  if (Array.isArray(question.appearances)) {
    for (const app of question.appearances) {
      if (app && app.exam) texts.push(String(app.exam).toLowerCase());
      if (app && app.tier) texts.push(String(app.tier).toLowerCase());
    }
  }
  if (Array.isArray(question.examHistory)) {
    for (const tag of question.examHistory) {
      if (typeof tag === 'string') texts.push(tag.toLowerCase());
    }
  }
  const combined = texts.join(' ');

  switch (subFilter) {
    // SSC Sub-exams
    case 'SSC_CGL':
      return combined.includes('cgl') || combined.includes('combined graduate');
    case 'SSC_CHSL':
      return combined.includes('chsl') || combined.includes('combined higher') || combined.includes('10+2') || combined.includes('10 2');
    case 'SSC_CPO':
      return combined.includes('cpo') || combined.includes('central police') || combined.includes('delhi police') || combined.includes('si');
    case 'SSC_MTS':
      return combined.includes('mts') || combined.includes('multi tasking') || combined.includes('multitasking') || combined.includes('havaldar');
    case 'SSC_STENO':
      return combined.includes('steno') || combined.includes('selection post') || combined.includes('phase');

    // Banking Sub-exams
    case 'BANK_SBI_PO':
      return combined.includes('sbi po') || (combined.includes('sbi') && combined.includes('po'));
    case 'BANK_IBPS_PO':
      return combined.includes('ibps po') || (combined.includes('ibps') && combined.includes('po'));
    case 'BANK_SBI_CLERK':
      return combined.includes('sbi clerk') || (combined.includes('sbi') && combined.includes('clerk'));
    case 'BANK_IBPS_CLERK':
      return combined.includes('ibps clerk') || (combined.includes('ibps') && combined.includes('clerk'));
    case 'BANK_RRB_RBI':
      return combined.includes('rrb') || combined.includes('rbi') || combined.includes('nabard');
    case 'BANK_PO':
      return combined.includes('po') || combined.includes('probationary');

    // Defence Sub-exams
    case 'DEF_CDS':
      return combined.includes('cds');
    case 'DEF_AFCAT':
      return combined.includes('afcat') || combined.includes('air force');
    case 'DEF_NDA':
      return combined.includes('nda') || combined.includes('naval academy');
    case 'DEF_CAPF':
      return combined.includes('capf') || combined.includes('central armed police') || combined.includes('commandant');
    case 'CDS_NDA':
      return combined.includes('cds') || combined.includes('nda') || combined.includes('afcat');

    // Railways Sub-exams
    case 'RRB_NTPC':
      return combined.includes('ntpc');
    case 'RRB_GROUP_D':
      return combined.includes('group d') || combined.includes('group-d');

    default:
      return true;
  }
}
