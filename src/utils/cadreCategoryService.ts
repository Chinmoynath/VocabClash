import { RankTier } from '../types';

export type ExamCategoryKey = 'ssc' | 'banking' | 'defence' | 'dsssb';

export interface CadreTierDefinition {
  tier: RankTier;
  title: string;
  lpRange: string;
  minLP: number;
  maxLP: number;
  perks: string[];
}

export interface CategoryCadreConfig {
  key: ExamCategoryKey;
  displayName: string;
  shortName: string;
  icon: string;
  cadres: CadreTierDefinition[];
}

export const CATEGORY_CADRE_CONFIGS: Record<ExamCategoryKey, CategoryCadreConfig> = {
  ssc: {
    key: 'ssc',
    displayName: 'SSC & Central Govt',
    shortName: 'SSC',
    icon: '🏛️',
    cadres: [
      {
        tier: 'Apex_Officer',
        title: '👑 Principal Commissioner / Joint Secretary',
        lpRange: '4,500+ LP',
        minLP: 4500,
        maxLP: 99999,
        perks: [
          'Apex Bureaucracy Cadre with Official Staff Vehicle',
          'VVIP Type-VII/VIII Lutyens Bungalow Entitlement'
        ]
      },
      {
        tier: 'Gazetted_Officer',
        title: '🎖️ Gazetted Officer / Ministry Section Officer',
        lpRange: '3,000 - 4,499 LP',
        minLP: 3000,
        maxLP: 4499,
        perks: [
          'Group-A Gazetted Authority & Official Seal',
          'Central Secretariat Type-V Quarters & LTC Perks'
        ]
      },
      {
        tier: 'GST_IT_Inspector',
        title: '💎 GST / Income Tax / CBI Inspector',
        lpRange: '2,000 - 2,999 LP',
        minLP: 2000,
        maxLP: 2999,
        perks: [
          'Uniform & Raid Allowance with Ministry Quarters',
          'Full CGHS Medical Coverage for Family'
        ]
      },
      {
        tier: 'Auditor_Accountant',
        title: '🥇 CAG Auditor / Junior Accountant',
        lpRange: '1,200 - 1,999 LP',
        minLP: 1200,
        maxLP: 1999,
        perks: [
          'Special Audit Tour Allowances & DA',
          'Railway Concession & Annual Earned Leaves'
        ]
      },
      {
        tier: 'Clerk_Assistant',
        title: '🥈 Upper Division Clerk / Assistant',
        lpRange: '600 - 1,199 LP',
        minLP: 600,
        maxLP: 1199,
        perks: [
          'Guaranteed Job Security & 7th Pay Commission Scale',
          'Standard Govt Housing & Medical Benefits'
        ]
      },
      {
        tier: 'Aspirant',
        title: '🥉 Govt Job Aspirant',
        lpRange: '0 - 599 LP',
        minLP: 0,
        maxLP: 599,
        perks: [
          'Foundational Preparation & Daily Combat Drill'
        ]
      }
    ]
  },
  defence: {
    key: 'defence',
    displayName: 'Defence & Armed Forces',
    shortName: 'Defence',
    icon: '⚔️',
    cadres: [
      {
        tier: 'Apex_Officer',
        title: '👑 General / Air Chief Marshal / Admiral',
        lpRange: '4,500+ LP',
        minLP: 4500,
        maxLP: 99999,
        perks: [
          'Z+ Protocol, Staff Car with Star Plates & Flag Rank',
          'Lifetime ECHS Super-Specialty Coverage & CSD Canteen'
        ]
      },
      {
        tier: 'Gazetted_Officer',
        title: '🎖️ Colonel / Group Captain / Captain (Navy)',
        lpRange: '3,000 - 4,499 LP',
        minLP: 3000,
        maxLP: 4499,
        perks: [
          'Military Service Pay (MSP) + High Altitude Allowance',
          'Commandant Cantonment Officer Bungalow with Mess Staff'
        ]
      },
      {
        tier: 'GST_IT_Inspector',
        title: '💎 Major / Squadron Leader / Lt Commander',
        lpRange: '2,000 - 2,999 LP',
        minLP: 2000,
        maxLP: 2999,
        perks: [
          'Field Combat Allowances & Cantonment Housing',
          'Annual 60-Day Paid Leave + Free Travel Warrants'
        ]
      },
      {
        tier: 'Auditor_Accountant',
        title: '🥇 Captain / Flight Lieutenant / Lieutenant',
        lpRange: '1,200 - 1,999 LP',
        minLP: 1200,
        maxLP: 1999,
        perks: [
          'Free Dry/Fresh Officer Rations & Officers Mess',
          'Army Group Insurance ₹1 Crore Life Cover'
        ]
      },
      {
        tier: 'Clerk_Assistant',
        title: '🥈 Commissioned Lieutenant / Flying Officer',
        lpRange: '600 - 1,199 LP',
        minLP: 600,
        maxLP: 1199,
        perks: [
          'Presidential Commission signed by President of India',
          'CSD Smart Card Shopping & Military Club Access'
        ]
      },
      {
        tier: 'Aspirant',
        title: '🥉 Gentleman Cadet / Defence Aspirant',
        lpRange: '0 - 599 LP',
        minLP: 0,
        maxLP: 599,
        perks: [
          'NDA/CDS Academy Aspirant Drill & Vocabulary Training'
        ]
      }
    ]
  },
  banking: {
    key: 'banking',
    displayName: 'Banking & Financial',
    shortName: 'Banking',
    icon: '🏦',
    cadres: [
      {
        tier: 'Apex_Officer',
        title: '👑 Chairman & MD / Executive Director',
        lpRange: '4,500+ LP',
        minLP: 4500,
        maxLP: 99999,
        perks: [
          'Executive Luxury Penthouse & Chauffeur-Driven Car',
          'Top Banking Protocol & Executive Medical Policy'
        ]
      },
      {
        tier: 'Gazetted_Officer',
        title: '🎖️ Chief General Manager / DGM',
        lpRange: '3,000 - 4,499 LP',
        minLP: 3000,
        maxLP: 4499,
        perks: [
          'Fully Leased Prime Residential Quarters',
          'Subsidized 100% Staff Home Loans & Petrol Allowance'
        ]
      },
      {
        tier: 'GST_IT_Inspector',
        title: '💎 Chief Manager / Assistant General Manager',
        lpRange: '2,000 - 2,999 LP',
        minLP: 2000,
        maxLP: 2999,
        perks: [
          'Key Branch Leadership & Loan Sanctioning Authority',
          'Concessional Housing & Vehicle Loans'
        ]
      },
      {
        tier: 'Auditor_Accountant',
        title: '🥇 Branch Manager / Scale-II Officer',
        lpRange: '1,200 - 1,999 LP',
        minLP: 1200,
        maxLP: 1999,
        perks: [
          'JAIIB & CAIIB Dual Increments + Leased Flat',
          'Quarterly Medical Aid & Briefcase Allowance'
        ]
      },
      {
        tier: 'Clerk_Assistant',
        title: '🥈 Probationary Officer / Assistant Manager',
        lpRange: '600 - 1,199 LP',
        minLP: 600,
        maxLP: 1199,
        perks: [
          'Prestigious Officer Cadre Entry with City Compensatory Pay',
          'Bank Quarters or Leased Accommodation'
        ]
      },
      {
        tier: 'Aspirant',
        title: '🥉 Bank Aspirant / Clerk Cadet',
        lpRange: '0 - 599 LP',
        minLP: 0,
        maxLP: 599,
        perks: [
          'Speed Math & Banking Vocabulary Foundation'
        ]
      }
    ]
  },
  dsssb: {
    key: 'dsssb',
    displayName: 'DSSSB (Delhi Govt)',
    shortName: 'DSSSB',
    icon: '🏢',
    cadres: [
      {
        tier: 'Apex_Officer',
        title: '👑 Principal Secretary / Special Commissioner (Delhi Admin)',
        lpRange: '4,500+ LP',
        minLP: 4500,
        maxLP: 99999,
        perks: [
          'Delhi Secretariat Apex Admin Protocol',
          'Official Staff Vehicle & Secretariat Staff'
        ]
      },
      {
        tier: 'Gazetted_Officer',
        title: '🎖️ Admn Officer / Sub-Divisional Magistrate Cadre',
        lpRange: '3,000 - 4,499 LP',
        minLP: 3000,
        maxLP: 4499,
        perks: [
          'Gazetted Authority in Delhi Govt Departments',
          'Delhi Govt Officer Quarters & LTC Entitlement'
        ]
      },
      {
        tier: 'GST_IT_Inspector',
        title: '💎 Assistant Section Officer (ASO / DASS Gr-II)',
        lpRange: '2,000 - 2,999 LP',
        minLP: 2000,
        maxLP: 2999,
        perks: [
          'Delhi Secretariat 4600 GP Cadre Position',
          'Full DGEHS Delhi Healthcare Coverage'
        ]
      },
      {
        tier: 'Auditor_Accountant',
        title: '🥇 Statistical Assistant / Head Clerk',
        lpRange: '1,200 - 1,999 LP',
        minLP: 1200,
        maxLP: 1999,
        perks: [
          'Delhi Departmental Senior Desk Authority',
          'Annual Grade Pay Increments & Allowances'
        ]
      },
      {
        tier: 'Clerk_Assistant',
        title: '🥈 Junior Secretariat Assistant / LDC',
        lpRange: '600 - 1,199 LP',
        minLP: 600,
        maxLP: 1199,
        perks: [
          'Permanent Delhi Govt Subordinate Services Cadre',
          'Standard Delhi Govt Quarters Priority'
        ]
      },
      {
        tier: 'Aspirant',
        title: '🥉 DSSSB Delhi Aspirant',
        lpRange: '0 - 599 LP',
        minLP: 0,
        maxLP: 599,
        perks: [
          'DSSSB Exam Vocabulary & Grammar Drills'
        ]
      }
    ]
  }
};

export function resolveExamCategoryKey(targetExam?: string | null): ExamCategoryKey {
  if (!targetExam) return 'ssc';
  const text = targetExam.toLowerCase();

  // 1. Banking
  if (
    text.includes('bank') ||
    text.includes('ibps') ||
    text.includes('sbi') ||
    text.includes('rbi') ||
    text.includes('nabard') ||
    text.includes('sebi') ||
    text.includes('lic') ||
    text.includes('insurance') ||
    text.includes('po') ||
    text.includes('clerk')
  ) {
    return 'banking';
  }

  // 2. Defence
  if (
    text.includes('defence') ||
    text.includes('defense') ||
    text.includes('cds') ||
    text.includes('nda') ||
    text.includes('afcat') ||
    text.includes('capf') ||
    text.includes('army') ||
    text.includes('navy') ||
    text.includes('air force') ||
    text.includes('inet') ||
    text.includes('ota') ||
    text.includes('ima')
  ) {
    return 'defence';
  }

  // 3. DSSSB (Delhi Govt)
  if (
    text.includes('dsssb') ||
    text.includes('dass') ||
    text.includes('delhi')
  ) {
    return 'dsssb';
  }

  // Default: SSC & Central Govt
  return 'ssc';
}

export function getCadreConfigForTarget(targetExam?: string | null): CategoryCadreConfig {
  const catKey = resolveExamCategoryKey(targetExam);
  return CATEGORY_CADRE_CONFIGS[catKey] || CATEGORY_CADRE_CONFIGS.ssc;
}

export function getCategoryTierTitle(tier: RankTier, targetExam?: string | null): string {
  const config = getCadreConfigForTarget(targetExam);
  const matched = config.cadres.find(c => c.tier === tier);
  if (matched) return matched.title;

  switch (tier) {
    case 'Apex_Officer': return '👑 Apex Cadre Officer';
    case 'Gazetted_Officer': return '🎖️ Gazetted Officer';
    case 'GST_IT_Inspector': return '💎 GST / IT Inspector';
    case 'Auditor_Accountant': return '🥇 Auditor / Accountant';
    case 'Clerk_Assistant': return '🥈 Assistant / Clerk';
    case 'Aspirant': return '🥉 Govt Job Aspirant';
  }
}

export function getCategoryNextTierInfo(lp: number, targetExam?: string | null) {
  const config = getCadreConfigForTarget(targetExam);
  let prevTierLP = 0;
  let nextTierLP = 600;
  let nextTierName = config.cadres.find(c => c.tier === 'Clerk_Assistant')?.title || 'Assistant Cadre';
  let activeCadre = config.cadres[config.cadres.length - 1];

  if (lp < 600) {
    prevTierLP = 0;
    nextTierLP = 600;
    nextTierName = config.cadres.find(c => c.tier === 'Clerk_Assistant')?.title || 'Clerk / Assistant';
    activeCadre = config.cadres.find(c => c.tier === 'Aspirant') || activeCadre;
  } else if (lp < 1200) {
    prevTierLP = 600;
    nextTierLP = 1200;
    nextTierName = config.cadres.find(c => c.tier === 'Auditor_Accountant')?.title || 'Auditor / Accountant';
    activeCadre = config.cadres.find(c => c.tier === 'Clerk_Assistant') || activeCadre;
  } else if (lp < 2000) {
    prevTierLP = 1200;
    nextTierLP = 2000;
    nextTierName = config.cadres.find(c => c.tier === 'GST_IT_Inspector')?.title || 'Inspector / Manager';
    activeCadre = config.cadres.find(c => c.tier === 'Auditor_Accountant') || activeCadre;
  } else if (lp < 3000) {
    prevTierLP = 2000;
    nextTierLP = 3000;
    nextTierName = config.cadres.find(c => c.tier === 'Gazetted_Officer')?.title || 'Gazetted Officer';
    activeCadre = config.cadres.find(c => c.tier === 'GST_IT_Inspector') || activeCadre;
  } else {
    prevTierLP = 3000;
    nextTierLP = 4500;
    nextTierName = config.cadres.find(c => c.tier === 'Apex_Officer')?.title || 'Apex Cadre Officer';
    activeCadre = config.cadres.find(c => c.tier === 'Gazetted_Officer') || activeCadre;
  }

  const lpRange = Math.max(1, nextTierLP - prevTierLP);
  const lpEarnedInTier = Math.max(0, lp - prevTierLP);
  const progressPercent = Math.min(100, Math.max(0, Math.round((lpEarnedInTier / lpRange) * 100)));
  const lpRemaining = Math.max(0, nextTierLP - lp);

  return {
    prevTierLP,
    nextTierLP,
    nextTierName,
    progressPercent,
    lpRemaining,
    activeCadre,
    categoryName: config.displayName,
    categoryShortName: config.shortName,
    categoryIcon: config.icon
  };
}
