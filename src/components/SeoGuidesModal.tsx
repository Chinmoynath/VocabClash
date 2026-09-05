import React from 'react';
import { X, BookOpen, ArrowRight, Swords, Sparkles, ExternalLink, ShieldCheck, Target } from 'lucide-react';
import { SEO_PAGES } from '../data/seoContentData';
import { soundManager } from '../utils/audio';

interface SeoGuidesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGuide: (slug: string) => void;
}

export const SeoGuidesModal: React.FC<SeoGuidesModalProps> = ({
  isOpen,
  onClose,
  onSelectGuide,
}) => {
  if (!isOpen) return null;

  const guidesList = Object.values(SEO_PAGES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        id="seo-guides-modal-container"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-1.5">
                <span>SSC Vocab Guides & PYQ Hub</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase">Free</span>
              </h2>
              <p className="text-xs text-slate-400">Comprehensive study guides, root words & 2018-2025 PYQ analysis</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guides List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 no-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {guidesList.map((guide) => (
              <div
                key={guide.id}
                onClick={() => {
                  soundManager.playTap();
                  onSelectGuide(guide.slug);
                }}
                className="p-4 rounded-2xl bg-slate-850/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      {guide.badge}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{guide.readingTime}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                    {guide.h1}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {guide.intro}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-amber-400 pt-2 border-t border-slate-800/80">
                  <span>Read Complete Guide</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center shrink-0">
          <p className="text-xs text-slate-400">
            All guides contain official SSC CGL, CHSL, CPO and latest examiner pattern Previous Year Questions with full explanations.
          </p>
        </div>
      </div>
    </div>
  );
};
