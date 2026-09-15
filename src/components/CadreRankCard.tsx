import React from 'react';
import { 
  Pencil,
  Target
} from 'lucide-react';
import { PlayerProfile } from '../types';
import { soundManager } from '../utils/audio';
import { getTierFromLP } from '../services/matchmakingService';
import { 
  getCategoryTierTitle, 
  getCategoryNextTierInfo 
} from '../utils/cadreCategoryService';

interface CadreRankCardProps {
  player: PlayerProfile;
  onOpenProfile?: () => void;
  onOpenEditProfile?: () => void;
}

export const parseTargetExam = (rawExam: string) => {
  if (!rawExam) return { tag: 'GOVT EXAM', detail: 'General Preparation' };
  const trimmed = rawExam.trim();

  const prefixes = [
    { pattern: /^SSC\s*CPO/i, tag: 'SSC CPO' },
    { pattern: /^SSC\s*CGL/i, tag: 'SSC CGL' },
    { pattern: /^SSC\s*CHSL/i, tag: 'SSC CHSL' },
    { pattern: /^SSC\s*MTS/i, tag: 'SSC MTS' },
    { pattern: /^SSC\s*GD/i, tag: 'SSC GD' },
    { pattern: /^RRB\s*NTPC/i, tag: 'RRB NTPC' },
    { pattern: /^RRB\s*(?:GROUP\s*D|JE|ALP)/i, tag: 'RAILWAY' },
    { pattern: /^BANK\s*(?:PO|CLERK)?/i, tag: 'BANK PO' },
    { pattern: /^(?:IBPS|SBI)\s*(?:PO|CLERK)?/i, tag: 'BANKING' },
    { pattern: /^CDS|NDA|AFCAT/i, tag: 'DEFENSE' },
    { pattern: /^UPSC|IAS|IPS/i, tag: 'CIVIL SERVICES' },
    { pattern: /^STATE\s*PSC/i, tag: 'STATE PSC' },
  ];

  for (const p of prefixes) {
    if (p.pattern.test(trimmed)) {
      let remainder = trimmed.replace(p.pattern, '').trim();
      remainder = remainder.replace(/^[-–—:\s/]+/, '').trim();
      if (!remainder) remainder = 'Cadre Officer / Aspirant';
      return { tag: p.tag, detail: remainder };
    }
  }

  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    return { 
      tag: parts[0].trim().slice(0, 10).toUpperCase(), 
      detail: parts.slice(1).join(' - ').trim() 
    };
  }

  return { tag: 'TARGET', detail: trimmed };
};

export const CadreRankCard: React.FC<CadreRankCardProps> = ({
  player,
  onOpenProfile,
  onOpenEditProfile,
}) => {
  // LP Tier progress computation
  const currentLP = player.rankPoints;
  const nextTierData = getCategoryNextTierInfo(currentLP, player.targetExam);
  
  const nextTierLP = nextTierData.nextTierLP;
  const prevTierLP = nextTierData.prevTierLP;
  const lpRemaining = nextTierData.lpRemaining;
  const progressPercent = nextTierData.progressPercent;

  // Compute dynamic category-aware rank title
  const effectiveTier = player.tier || getTierFromLP(currentLP);
  const dynamicTierTitle = getCategoryTierTitle(effectiveTier, player.targetExam);

  const parsedGoal = parseTargetExam(player.targetExam || 'SSC CPO - Sub-Inspector');

  // Tier Medal Icon
  const getTierInsignia = () => {
    if (currentLP >= 4500) return '👑';
    if (currentLP >= 3000) return '🎖️';
    if (currentLP >= 2000) return '💎';
    if (currentLP >= 1200) return '🥇';
    if (currentLP >= 600) return '🥈';
    return '🥉';
  };

  const tierIcon = getTierInsignia();
  const cleanTierTitle = (dynamicTierTitle || player.tierTitle || '').replace(/^[\p{Extended_Pictographic}\p{Emoji}\uFE0F\u200d\s]+/u, '').trim() || dynamicTierTitle;

  const handleEditClick = () => {
    soundManager.playTap();
    if (onOpenEditProfile) {
      onOpenEditProfile();
    } else if (onOpenProfile) {
      onOpenProfile();
    }
  };

  return (
    <div 
      id="govt-service-cadre-card"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5 transition-all"
    >
      {/* Top Header: Cadre & LP */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-xl shrink-0">
            <span>{tierIcon}</span>
          </div>

          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Govt Service Rank
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight truncate mt-0.5">
              {cleanTierTitle}
            </h2>
          </div>
        </div>

        {/* LP Score & Next Cadre Tag */}
        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-400">
              {player.rankPoints.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-amber-400/80 font-mono">
              LP
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {lpRemaining > 0 ? `${lpRemaining} LP to next tier` : 'Apex Cadre'}
          </div>
        </div>
      </div>

      {/* Target Cadre Strip (Simple, clickable) */}
      <div 
        onClick={handleEditClick}
        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 transition-colors cursor-pointer group"
        title="Click to change target exam"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Target className="w-3 h-3 text-sky-400" />
            <span>Target:</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-bold shrink-0">
            {parsedGoal.tag}
          </span>
          <span className="text-xs text-slate-300 truncate font-medium group-hover:text-slate-100 transition-colors">
            {parsedGoal.detail}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-slate-200 shrink-0 font-medium">
          <Pencil className="w-3 h-3" />
          <span>Change</span>
        </div>
      </div>

      {/* Cadre Tier Progress Section */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] font-medium text-slate-400">Cadre Progress</span>
          <span className="font-mono text-[11px] font-bold text-slate-300">{progressPercent}%</span>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-amber-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
