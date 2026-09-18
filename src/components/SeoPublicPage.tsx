import React, { useEffect, useState } from 'react';
import { 
  Swords, 
  Target, 
  Trophy, 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  ChevronRight, 
  CheckCircle2, 
  HelpCircle, 
  Flame, 
  ShieldCheck, 
  Zap, 
  ExternalLink,
  BookMarked,
  Layers,
  ChevronDown,
  Clock,
  Award
} from 'lucide-react';
import { SeoPageData, SEO_PAGES, SeoPyqSample } from '../data/seoContentData';
import { updatePageSeo } from '../utils/seoMetaManager';
import { soundManager } from '../utils/audio';

interface SeoPublicPageProps {
  pageData: SeoPageData;
  onNavigateHome: () => void;
  onStartBattle: () => void;
  onStartPractice: () => void;
  onNavigateToSlug: (slug: string) => void;
}

export const SeoPublicPage: React.FC<SeoPublicPageProps> = ({
  pageData,
  onNavigateHome,
  onStartBattle,
  onStartPractice,
  onNavigateToSlug,
}) => {
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    updatePageSeo(pageData);
    window.scrollTo(0, 0);
  }, [pageData]);

  const toggleRevealAnswer = (idx: number) => {
    soundManager.playTap();
    setRevealedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleFaq = (idx: number) => {
    soundManager.playTap();
    setOpenFaqIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* 1. Header & Navigation */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div 
            onClick={() => {
              soundManager.playTap();
              onNavigateHome();
            }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Swords className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black tracking-tight text-white text-base">Vocab<span className="text-amber-400">Clash</span></span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-extrabold uppercase">Hub</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Govt Exam English Arena</p>
            </div>
          </div>

          {/* Quick CTA Actions */}
          <nav className="flex items-center gap-2" aria-label="Quick Actions">
            <button
              onClick={() => {
                soundManager.playTap();
                onStartPractice();
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-sky-400" />
              <span>Solo PYQ Drill</span>
            </button>

            <button
              onClick={() => {
                soundManager.playTap();
                onStartBattle();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Play 1v1 Battle</span>
            </button>
          </nav>
        </div>
      </header>

      {/* 2. Main Article Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto no-scrollbar py-1">
          <button 
            onClick={() => {
              soundManager.playTap();
              onNavigateHome();
            }}
            className="hover:text-amber-400 transition-colors flex items-center gap-1 text-slate-300 cursor-pointer"
          >
            Home
          </button>
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-amber-400 font-medium truncate">{pageData.badge}</span>
        </nav>

        {/* Hero Section */}
        <article className="space-y-6">
          <header className="space-y-4 border-b border-slate-800/80 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide uppercase">
                {pageData.badge}
              </span>
              <span className="flex items-center gap-1 text-slate-400 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {pageData.readingTime}
              </span>
              <span className="flex items-center gap-1 text-sky-400 text-xs font-semibold">
                <Award className="w-3.5 h-3.5" />
                Target: {pageData.examFocus}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {pageData.h1}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {pageData.intro}
            </p>

            {/* Quick Interactive Launch Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800/90 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Flame className="w-4 h-4 fill-amber-400" />
                  <span>Interactive Practice Available</span>
                </div>
                <p className="text-xs text-slate-300">
                  Challenge real aspirants in 10-second live duels or solve chapter-wise PYQs.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onStartBattle();
                  }}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 transition-all cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Start 1v1 Battle</span>
                </button>
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onStartPractice();
                  }}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-sky-400" />
                  <span>Solo Drill</span>
                </button>
              </div>
            </div>
          </header>

          {/* Section: Why it matters */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Exam Importance & Key Realities</span>
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {pageData.whyItMatters.map((point, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Weightage Table */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              <span>Exam Pattern & Marks Weightage Breakdown</span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-850 text-slate-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Stage / Tier</th>
                    <th className="p-3">Questions & Marks</th>
                    <th className="p-3">Merit Weightage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white">Tier 1 (Preliminary)</td>
                    <td className="p-3 text-sky-300 font-mono">{pageData.weightageInfo.tier1Questions}</td>
                    <td className="p-3">Qualifying / Screening</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Tier 2 (Mains)</td>
                    <td className="p-3 text-amber-300 font-mono">{pageData.weightageInfo.tier2Questions}</td>
                    <td className="p-3 text-amber-400 font-semibold">100% Final Merit Decider</td>
                  </tr>
                  <tr className="bg-slate-900">
                    <td className="p-3 font-bold text-white">Total Importance</td>
                    <td colSpan={2} className="p-3 text-emerald-400 font-bold">{pageData.weightageInfo.totalMarksWeightage}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Proven Strategy Steps */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Step-by-Step Preparation Strategy</span>
            </h2>
            <div className="space-y-3">
              {pageData.strategySteps.map((step, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <h3 className="text-sm font-bold text-amber-300">{step.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: High-Yield PYQ Samples (Interactive) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-indigo-400" />
                <span>High-Yield Previous Year Questions (PYQs)</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">Click to reveal answer & mnemonics</span>
            </div>

            <div className="space-y-3">
              {pageData.pyqSamples.map((sample: SeoPyqSample, idx: number) => {
                const isRevealed = !!revealedAnswers[idx];
                return (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase">
                        {sample.type}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono">
                        {sample.examTag}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Question Word / Phrase:</div>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                        {sample.wordOrPhrase}
                      </h3>
                      {sample.hindiMeaning && (
                        <p className="text-xs text-amber-400/90 font-medium mt-0.5">
                          Hindi Meaning: {sample.hindiMeaning}
                        </p>
                      )}
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {sample.options.map((opt, optIdx) => {
                        const isCorrect = isRevealed && opt.toLowerCase().includes(sample.correctAnswer.toLowerCase().split('/')[0].trim());
                        return (
                          <div 
                            key={optIdx}
                            className={`p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                              isCorrect 
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                                : 'bg-slate-850/70 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className="text-slate-500 mr-1.5">{String.fromCharCode(65 + optIdx)}.</span>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Toggle Button & Explanation */}
                    <div className="pt-2 border-t border-slate-800/80">
                      {!isRevealed ? (
                        <button
                          onClick={() => toggleRevealAnswer(idx)}
                          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Show Answer & Explanation</span>
                        </button>
                      ) : (
                        <div className="space-y-2 text-xs bg-slate-950/80 p-3 rounded-xl border border-emerald-500/30 animate-fadeIn">
                          <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Correct Answer: {sample.correctAnswer}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">
                            {sample.explanation}
                          </p>
                          {sample.mnemonic && (
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
                              💡 <strong>Mnemonic Trick:</strong> {sample.mnemonic}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section: Root Words & Key Rules */}
          {pageData.rootWordsOrTips && pageData.rootWordsOrTips.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span>Essential Root Words & High-Frequency Rules</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {pageData.rootWordsOrTips.map((tip, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <h3 className="text-sm font-bold text-yellow-300">{tip.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{tip.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: FAQs */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-sky-400" />
              <span>Frequently Asked Questions (FAQs)</span>
            </h2>
            <div className="space-y-2">
              {pageData.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-3.5 text-left text-xs sm:text-sm font-bold text-white flex items-center justify-between gap-3 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-3.5 pb-3.5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-2.5">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section: Internal Linking / Related Guides */}
          <section className="space-y-3 pt-4 border-t border-slate-800">
            <h2 className="text-base font-bold text-slate-200">
              Explore More Free SSC English & Vocabulary Preparation Guides:
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {pageData.relatedSlugs.map((slug) => {
                const key = slug.replace('/', '');
                const related = SEO_PAGES[key];
                if (!related) return null;
                return (
                  <a
                    key={slug}
                    href={slug}
                    onClick={(e) => {
                      e.preventDefault();
                      soundManager.playTap();
                      onNavigateToSlug(slug);
                    }}
                    className="p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-xs font-semibold text-slate-300 hover:text-amber-300 transition-all flex flex-col justify-between gap-1 group"
                  >
                    <span>{related.badge}</span>
                    <span className="text-[10px] text-slate-500 group-hover:text-amber-400/80 flex items-center gap-1 font-mono">
                      Read Guide <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </a>
                );
              })}
            </div>
          </section>

          {/* Bottom Big CTA */}
          <section className="p-6 rounded-3xl bg-gradient-to-tr from-amber-600/20 via-slate-900 to-indigo-900/30 border-2 border-amber-500/40 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <Swords className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Ready to Test Your Vocabulary Under Real Match Pressure?
              </h2>
              <p className="text-xs text-slate-300">
                Join thousands of SSC CGL, CHSL, and CPO aspirants playing live 1v1 duels every minute on VocabClash.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  soundManager.playTap();
                  onStartBattle();
                }}
                className="py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Swords className="w-4 h-4" />
                <span>Launch 1v1 Ranked Duel</span>
              </button>
              <button
                onClick={() => {
                  soundManager.playTap();
                  onStartPractice();
                }}
                className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all"
              >
                <Target className="w-4 h-4 text-sky-400" />
                <span>Practice 24,000+ PYQs</span>
              </button>
            </div>
          </section>
        </article>
      </main>

      {/* 3. Crawlable Footer with Legal & Topic Links */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 px-4 sm:px-6 text-xs text-slate-500 space-y-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-amber-400" />
              <span className="font-black text-white text-sm">VocabClash</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              India's premier real-time English vocabulary battle arena and PYQ practice app for SSC (CGL, CHSL, CPO, MTS), Banking, Defence, and DSSSB exams.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Exam Hubs</h3>
            <ul className="space-y-1 text-[11px]">
              <li><a href="/ssc-vocabulary" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/ssc-vocabulary'); }} className="hover:text-amber-400">SSC Vocabulary 2026</a></li>
              <li><a href="/ssc-cgl-vocabulary" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/ssc-cgl-vocabulary'); }} className="hover:text-amber-400">SSC CGL Tier 1 & 2</a></li>
              <li><a href="/ssc-chsl-vocabulary" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/ssc-chsl-vocabulary'); }} className="hover:text-amber-400">SSC CHSL 10+2</a></li>
              <li><a href="/ssc-english-pyq" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/ssc-english-pyq'); }} className="hover:text-amber-400">24,000+ SSC English PYQs</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Topic Drills</h3>
            <ul className="space-y-1 text-[11px]">
              <li><a href="/synonyms" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/synonyms'); }} className="hover:text-amber-400">Synonyms Master List</a></li>
              <li><a href="/antonyms" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/antonyms'); }} className="hover:text-amber-400">Antonyms & Opposites</a></li>
              <li><a href="/one-word-substitution" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/one-word-substitution'); }} className="hover:text-amber-400">One Word Substitution (OWS)</a></li>
              <li><a href="/idioms-and-phrases" onClick={(e) => { e.preventDefault(); onNavigateToSlug('/idioms-and-phrases'); }} className="hover:text-amber-400">Idioms & Phrases</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Legal & Links</h3>
            <ul className="space-y-1 text-[11px]">
              <li><a href="/privacy.html" className="hover:text-amber-400">Privacy Policy</a></li>
              <li><a href="/terms.html" className="hover:text-amber-400">Terms of Service</a></li>
              <li><a href="/delete-account.html" className="hover:text-amber-400">Delete Account / Data</a></li>
              <li><a href="/sitemap.xml" className="hover:text-amber-400">XML Sitemap</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto text-center border-t border-slate-900 pt-4 text-[10px] text-slate-600">
          © 2026 VocabClash.in. All rights reserved. Built for SSC, Banking, Defence & DSSSB Aspirants across India.
        </div>
      </footer>
    </div>
  );
};
