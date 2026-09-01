export const EXAMS_BY_FAMILY: Record<string, string[]> = {
  SSC: ['SSC CGL', 'SSC CHSL', 'SSC CPO', 'SSC MTS', 'SSC Selection Post'],
  Banking: ['IBPS PO', 'IBPS Clerk', 'SBI PO', 'SBI Clerk', 'IBPS RRB PO', 'IBPS RRB Clerk'],
  Defence: ['CDS', 'AFCAT', 'NDA'],
  Railways: ['RRB NTPC', 'RRB Group D', 'RRB JE'],
  State: ['DSSSB', 'Other'],
};

export const EXAM_STAGE_OPTIONS: Record<string, string[]> = {
  'SSC CGL': ['Tier-I', 'Tier-II'],
  'SSC CHSL': ['Tier-I', 'Tier-II'],
  'SSC CPO': ['Paper-I', 'Paper-II'],
  'SSC MTS': ['CBE', 'CBE - Session-I', 'CBE - Session-II'],
  'SSC Selection Post': ['CBE'],
  'IBPS PO': ['Preliminary Examination', 'Main Examination'],
  'IBPS Clerk': ['Preliminary Examination', 'Main Examination'],
  'SBI PO': ['Phase-I (Preliminary)', 'Phase-II (Main)', 'Phase-III'],
  'SBI Clerk': ['Preliminary Examination', 'Main Examination'],
  'IBPS RRB PO': ['Preliminary Examination', 'Main Examination'],
  'IBPS RRB Clerk': ['Preliminary Examination', 'Main Examination'],
  'CDS': ['Written Examination'],
  'AFCAT': ['Online Examination'],
  'NDA': ['Written Examination'],
  'RRB NTPC': ['CBT-1', 'CBT-2'],
  'RRB Group D': ['CBT'],
  'RRB JE': ['CBT-1', 'CBT-2'],
  'DSSSB': [
    'One Tier',
    'One Tier (General)',
    'One Tier (Technical/Teaching)',
    'Tier-I',
    'Tier-II',
    'Skill Test',
    'Written Examination',
  ],
  'Other': [
    'Preliminary Examination',
    'Main Examination',
    'Written Examination',
    'Tier-I',
    'Tier-II',
    'CBT',
  ],
};

/**
 * Returns available predefined stage / tier / phase options for a given exam name.
 */
export function getStageOptionsForExam(examName?: string): string[] {
  if (!examName) return [];
  const normalized = examName.trim();
  return EXAM_STAGE_OPTIONS[normalized] || [];
}

/**
 * Intelligently normalize stage/tier/phase inputs from JSON or raw text.
 * Keeps unknown or custom strings as clean custom text. Returns '' if not specified.
 */
export function normalizeTier(rawTier: any): string {
  if (rawTier === null || rawTier === undefined) return '';
  const str = String(rawTier).trim();
  if (
    !str || 
    str.toLowerCase() === 'null' || 
    str.toLowerCase() === 'undefined' || 
    str.toLowerCase() === 'not specified' || 
    str.toLowerCase() === 'custom...' ||
    str === '-'
  ) {
    return '';
  }

  const lower = str.toLowerCase().replace(/[\s_\-]+/g, ' ').trim();

  // Tier I / II / III normalization
  if (
    lower === 'tier 1' || 
    lower === 'tier1' || 
    lower === 'tier i' || 
    lower === 't1' || 
    lower === 'tier-1' || 
    lower === 'tier-i' ||
    lower === 'tier 1st'
  ) {
    return 'Tier-I';
  }
  if (
    lower === 'tier 2' || 
    lower === 'tier2' || 
    lower === 'tier ii' || 
    lower === 't2' || 
    lower === 'tier-2' || 
    lower === 'tier-ii' ||
    lower === 'tier 2nd'
  ) {
    return 'Tier-II';
  }
  if (
    lower === 'tier 3' || 
    lower === 'tier3' || 
    lower === 'tier iii' || 
    lower === 't3' || 
    lower === 'tier-3' || 
    lower === 'tier-iii' ||
    lower === 'tier 3rd'
  ) {
    return 'Tier-III';
  }

  // Paper I / II normalization (SSC CPO, etc.)
  if (
    lower === 'paper 1' || 
    lower === 'paper1' || 
    lower === 'paper i' || 
    lower === 'paper-1' || 
    lower === 'paper-i' ||
    lower === 'paper 1st'
  ) {
    return 'Paper-I';
  }
  if (
    lower === 'paper 2' || 
    lower === 'paper2' || 
    lower === 'paper ii' || 
    lower === 'paper-2' || 
    lower === 'paper-ii' ||
    lower === 'paper 2nd'
  ) {
    return 'Paper-II';
  }

  // CBT normalization (Railways, etc.)
  if (
    lower === 'cbt 1' || 
    lower === 'cbt1' || 
    lower === 'cbt-1' || 
    lower === 'cbt i' ||
    lower === 'cbt-i' ||
    lower === 'cbt 01' ||
    lower === 'cbt-01' ||
    lower === 'stage 1' || 
    lower === 'stage-1'
  ) {
    return 'CBT-1';
  }
  if (
    lower === 'cbt 2' || 
    lower === 'cbt2' || 
    lower === 'cbt-2' || 
    lower === 'cbt ii' ||
    lower === 'cbt-ii' ||
    lower === 'cbt 02' ||
    lower === 'cbt-02' ||
    lower === 'stage 2' || 
    lower === 'stage-2'
  ) {
    return 'CBT-2';
  }
  if (lower === 'cbt' || lower === 'computer based test') {
    return 'CBT';
  }

  // CBE & Sessions (SSC MTS, Selection Post)
  if (
    lower === 'cbe session 1' || 
    lower === 'cbe session i' || 
    lower === 'session 1' || 
    lower === 'session i' ||
    lower === 'cbe - session-i' ||
    lower === 'cbe-session-i' ||
    lower === 'session-i' ||
    lower === 'session-1'
  ) {
    return 'CBE - Session-I';
  }
  if (
    lower === 'cbe session 2' || 
    lower === 'cbe session ii' || 
    lower === 'session 2' || 
    lower === 'session ii' ||
    lower === 'cbe - session-ii' ||
    lower === 'cbe-session-ii' ||
    lower === 'session-ii' ||
    lower === 'session-2'
  ) {
    return 'CBE - Session-II';
  }
  if (lower === 'cbe' || lower === 'computer based exam' || lower === 'computer based examination') {
    return 'CBE';
  }

  // Banking stages (IBPS, SBI, RRB)
  if (
    lower === 'prelims' || 
    lower === 'pre' || 
    lower === 'prelim' || 
    lower === 'pt' || 
    lower === 'preliminary' ||
    lower === 'preliminary exam' ||
    lower === 'preliminary examination'
  ) {
    return 'Preliminary Examination';
  }
  if (
    lower === 'mains' || 
    lower === 'main' || 
    lower === 'mains exam' ||
    lower === 'main exam' ||
    lower === 'main examination'
  ) {
    return 'Main Examination';
  }

  // SBI PO Phase designations
  if (
    lower === 'phase 1 (preliminary)' ||
    lower === 'phase-i (preliminary)' ||
    lower === 'phase 1 preliminary' ||
    lower === 'phase-i preliminary' ||
    lower === 'phase 1 prelims' ||
    lower === 'phase-i prelims' ||
    lower === 'phase 1' ||
    lower === 'phase-1' ||
    lower === 'phase i' ||
    lower === 'phase-i'
  ) {
    return 'Phase-I (Preliminary)';
  }
  if (
    lower === 'phase 2 (main)' ||
    lower === 'phase-ii (main)' ||
    lower === 'phase 2 main' ||
    lower === 'phase-ii main' ||
    lower === 'phase 2 mains' ||
    lower === 'phase-ii mains' ||
    lower === 'phase 2' ||
    lower === 'phase-2' ||
    lower === 'phase ii' ||
    lower === 'phase-ii'
  ) {
    return 'Phase-II (Main)';
  }
  if (
    lower === 'phase 3' ||
    lower === 'phase-3' ||
    lower === 'phase iii' ||
    lower === 'phase-iii'
  ) {
    return 'Phase-III';
  }

  // Defence & State examinations
  if (lower === 'written' || lower === 'written exam' || lower === 'written examination') {
    return 'Written Examination';
  }
  if (lower === 'online' || lower === 'online exam' || lower === 'online examination') {
    return 'Online Examination';
  }

  // DSSSB options
  if (
    lower === 'one tier (general)' || 
    lower === 'one tier general' ||
    lower === 'single tier (general)'
  ) {
    return 'One Tier (General)';
  }
  if (
    lower === 'one tier (technical/teaching)' ||
    lower === 'one tier (teaching/technical)' ||
    lower === 'one tier (technical)' ||
    lower === 'one tier technical' ||
    lower === 'one tier teaching' ||
    lower === 'one tier (teaching)'
  ) {
    return 'One Tier (Technical/Teaching)';
  }
  if (lower === 'one tier' || lower === 'one tier exam' || lower === 'single tier') {
    return 'One Tier';
  }
  if (lower === 'skill test' || lower === 'skill-test' || lower === 'typing test') {
    return 'Skill Test';
  }

  return str;
}
