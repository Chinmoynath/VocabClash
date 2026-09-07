import React from 'react';
import { 
  Target, 
  Swords, 
  TrendingUp, 
  Pencil, 
  Shield, 
  Sparkles,
  Award
} from 'lucide-react';
import { PlayerProfile } from '../types';
import { soundManager } from '../utils/audio';

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
  let nextTierLP = 2000;
  let prevTierLP = 1200;
  let nextTierName = 'Auditor / Accountant';

  if (currentLP < 600) { 
    prevTierLP = 0; 
    nextTierLP = 600; 
    nextTierName = 'Clerk / Assistant Cadre';
  } else if (currentLP < 1200) { 
    prevTierLP = 600; 
    nextTierLP = 1200; 
    nextTierName = 'Auditor / Accountant';
  } else if (currentLP < 2000) { 
    prevTierLP = 1200; 
    nextTierLP = 2000; 
    nextTierName = 'GST / IT Inspector';
  } else if (currentLP < 3000) { 
    prevTierLP = 2000; 
    nextTierLP = 3000; 
    nextTierName = 'Gazetted Officer';
  } else { 
    prevTierLP = 3000; 
    nextTierLP = 4500; 
    nextTierName = 'All India Rank #1';
  }

  const lpRange = Math.max(1, nextTierLP - prevTierLP);
  const lpEarnedInTier = Math.max(0, currentLP - prevTierLP);
  const progressPercent = Math.min(100, Math.max(0, Math.round((lpEarnedInTier / lpRange) * 100)));
  const lpRemaining = Math.max(0, nextTierLP - currentLP);

  const parsedGoal = parseTargetExam(player.targetExam || 'SSC CPO - Sub-Inspector');

  // Tier Medal Icon & Frame
  const getTierInsignia = () => {
    if (currentLP >= 3000) return { icon: '🎖️', label: 'Gazetted Cadre', border: 'border-amber-400/50', glow: 'shadow-amber-500/20' };
    if (currentLP >= 2000) return { icon: '💎', label: 'Inspector Cadre', border: 'border-cyan-400/50', glow: 'shadow-cyan-500/20' };
    if (currentLP >= 1200) return { icon: '🥇', label: 'Auditor Cadre', border: 'border-yellow-400/50', glow: 'shadow-yellow-500/20' };
    if (currentLP >= 600) return { icon: '🥈', label: 'Assistant Cadre', border: 'border-slate-400/50', glow: 'shadow-slate-400/20' };
    return { icon: '🥉', label: 'Aspirant Division', border: 'border-orange-500/40', glow: 'shadow-orange-500/20' };
  };

  const insignia = getTierInsignia();

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
      className="bg-gradient-to-b from-[#0b1322] via-[#0d1629] to-[#0a0f1d] border border-cyan-500/25 hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden transition-all space-y-3.5"
    >
      {/* Ambient background glows matching palette */}
      <div className="absolute -top-12 -left-12 w-44 h-44 bg-[#00C4EE]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER: Govt Service Rank badge + LP Score */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Insignia Shield Crest */}
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border ${insignia.border} flex items-center justify-center text-xl shadow-md ${insignia.glow} shrink-0`}>
            <span>{insignia.icon}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase text-slate-300">
                Govt Service Rank
              </span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black tracking-wide">
                SEASON 2026
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-amber-300 tracking-tight truncate mt-0.5">
              {player.tierTitle}
            </h2>
          </div>
        </div>

        {/* LP Readout with Gold & Amber styling */}
        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              {player.rankPoints}
            </span>
            <span className="text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 uppercase font-mono">
              LP
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
            League Standing
          </div>
        </div>
      </div>

      {/* COMBAT RECORD & WIN RATE (Redesigned: Clean, dignified capsules instead of ugly (3W/52M) brackets!) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 relative z-10">
        {/* Win Rate Capsule */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl px-3 py-2 sm:py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Win Rate
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-emerald-400 leading-tight">
                {player.accuracyRate}%
              </div>
            </div>
          </div>
          <div className="text-[9px] font-black text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
            {player.accuracyRate >= 60 ? 'ELITE' : 'ACTIVE'}
          </div>
        </div>

        {/* Battle Record Capsule */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl px-3 py-2 sm:py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-[#00C4EE]/30 text-[#00C4EE]">
              <Swords className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Combat Record
              </div>
              <div className="text-xs sm:text-sm font-black font-mono leading-tight flex items-center gap-1.5">
                <span className="text-[#00C4EE]">{player.matchesWon} Won</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">{player.matchesPlayed} Matches</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TARGET CADRE POST: Clean Electric Cyan Pill + Full Post Title + Sleek Change Button */}
      <div 
        onClick={handleEditClick}
        className="bg-slate-950/80 hover:bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/40 rounded-xl p-2.5 relative z-10 cursor-pointer transition-all group shadow-sm flex items-center justify-between gap-2.5"
        title="Click to switch your target exam post"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Vibrant Electric Cyan Pill matching user's reference image */}
          <div className="px-2.5 py-1 rounded-lg bg-[#00C4EE] text-slate-950 font-black text-xs tracking-wider shrink-0 shadow-sm shadow-[#00C4EE]/30 flex items-center gap-1">
            <Target className="w-3 h-3 stroke-[2.5]" />
            <span>{parsedGoal.tag}</span>
          </div>

          {/* Clean Post Title */}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
              Target Cadre Post
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-cyan-200 transition-colors truncate">
              {parsedGoal.detail}
            </div>
          </div>
        </div>

        {/* Change Goal Button */}
        <div className="flex items-center gap-1 text-slate-400 group-hover:text-cyan-300 bg-slate-900 group-hover:bg-cyan-950/60 border border-slate-700/80 group-hover:border-cyan-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0">
          <Pencil className="w-3 h-3" />
          <span>Change</span>
        </div>
      </div>

      {/* CADRE PROMOTION PROGRESS BAR */}
      <div className="space-y-1.5 relative z-10 pt-0.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-bold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Cadre Promotion</span>
          </span>
          <span className="text-amber-300 font-mono font-black bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px]">
            {lpRemaining} LP to Next Cadre
          </span>
        </div>

        {/* Multi-tier Gradient Bar with Stage Markers */}
        <div className="w-full bg-slate-950/90 rounded-full h-3 overflow-hidden border border-slate-700/60 p-0.5 relative shadow-inner">
          <div
            className="bg-gradient-to-r from-[#00C4EE] via-amber-400 to-orange-500 h-full rounded-full transition-all duration-700 relative shadow-sm"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Subtle glow highlight on leading tip */}
            {progressPercent > 5 && (
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/70 rounded-full blur-[1px]" />
            )}
          </div>
        </div>

        {/* Milestone Footer */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-0.5">
          <span>{prevTierLP} LP</span>
          <span className="text-cyan-300 font-bold">{progressPercent}% Cadre Progress</span>
          <span>{nextTierLP} LP</span>
        </div>
      </div>
    </div>
  );
};
