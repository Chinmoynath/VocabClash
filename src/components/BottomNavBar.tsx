import React from 'react';
import { Swords, Target, Trophy, BookOpen, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/audio';

export type TabType = 'arena' | 'practice' | 'leaderboard' | 'mistakes' | 'ai_coach';

interface BottomNavBarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  mistakeCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onSelectTab,
  mistakeCount = 0,
}) => {
  const tabs = [
    { id: 'arena' as TabType, label: '1v1 Arena', icon: Swords, color: 'text-amber-400' },
    { id: 'practice' as TabType, label: 'PYQ Drill', icon: Target, color: 'text-sky-400' },
    { id: 'leaderboard' as TabType, label: 'Ranks', icon: Trophy, color: 'text-yellow-400' },
    { id: 'mistakes' as TabType, label: 'Vault', icon: BookOpen, color: 'text-rose-400', badge: mistakeCount },
    { id: 'ai_coach' as TabType, label: 'AI Tutor', icon: Sparkles, color: 'text-purple-400' },
  ];

  return (
    <nav className="w-full md:hidden bg-slate-950/98 backdrop-blur-lg border-t border-slate-800/90 px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around z-30 shrink-0 shadow-2xl mt-auto">
      {tabs.map(tab => {
        const isActive = currentTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => {
              soundManager.playTap();
              onSelectTab(tab.id);
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
              isActive
                ? 'bg-slate-800/90 text-slate-100 font-bold scale-105 shadow-md shadow-black/40 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? tab.color : 'text-slate-400'}`} />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2.5 bg-rose-600 text-white text-[9px] font-extrabold px-1 min-w-4 h-4 rounded-full flex items-center justify-center border border-rose-900 shadow-sm animate-pulse leading-none">
                  {tab.badge >= 10 ? '10+' : tab.badge}
                </span>
              ) : null}
            </div>
            <span className={`text-[10px] mt-1 tracking-tight ${isActive ? 'text-slate-100' : 'text-slate-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
