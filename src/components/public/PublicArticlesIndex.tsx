import React, { useEffect, useState, useMemo } from 'react';
import { 
  Search, 
  BookOpen, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Flame, 
  ShieldCheck, 
  Swords, 
  Target, 
  Filter, 
  Sparkles,
  ArrowLeft,
  Share2
} from 'lucide-react';
import { Article, ArticleCategory } from '../../types/article';
import { getPublishedArticles } from '../../services/articleService';
import { updateArticlesIndexSeo } from '../../utils/seoMetaManager';

interface PublicArticlesIndexProps {
  onSelectArticle: (slug: string) => void;
  onNavigateHome: () => void;
  onStartPractice: (route: string) => void;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
}

const CATEGORY_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All Articles' },
  { id: 'ssc', label: 'SSC CGL / CHSL' },
  { id: 'banking', label: 'Banking & Insurance' },
  { id: 'defence', label: 'Defence (CDS / NDA)' },
  { id: 'vocabulary', label: 'Root Words & Vocab' },
  { id: 'pyqs', label: 'PYQ Shift Trends' },
  { id: 'strategy', label: 'Prep Strategies' }
];

export const PublicArticlesIndex: React.FC<PublicArticlesIndexProps> = ({
  onSelectArticle,
  onNavigateHome,
  onStartPractice,
  isAdmin,
  onNavigateToAdmin,
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    updateArticlesIndexSeo();

    let isMounted = true;
    async function loadArticles() {
      try {
        setIsLoading(true);
        const data = await getPublishedArticles();
        if (isMounted) {
          setArticles(data);
        }
      } catch (err) {
        console.error('Error fetching articles:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadArticles();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchesCategory = selectedCategory === 'all' || art.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const inTitle = art.title.toLowerCase().includes(query);
      const inExcerpt = art.excerpt.toLowerCase().includes(query);
      const inTags = art.tags?.some(t => t.toLowerCase().includes(query));
      return inTitle || inExcerpt || inTags;
    });
  }, [articles, selectedCategory, searchQuery]);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 overflow-y-auto">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 sm:py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateHome}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Arena</span>
            </button>

            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2"
            >
              <span className="text-amber-400 font-black tracking-wider text-base sm:text-xl">
                VOCAB<span className="text-white">CLASH</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium hidden sm:inline">
                Articles & Guides
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {isAdmin && onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-700/50 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <span>Write Article</span>
              </button>
            )}

            <button
              onClick={() => onStartPractice('/pyq-drill')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-950/40 transition flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5 fill-slate-950" />
              <span>Practice PYQs</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Government Exam Vocabulary Insights</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            VocabClash Articles & Guides
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Comprehensive English vocabulary analyses, recurring PYQ shift patterns, root-word frameworks, and active recall revision blueprints for SSC CGL, CHSL, Banking, and Defence examinations.
          </p>
        </section>

        {/* Search & Category Filter Toolbar */}
        <section className="space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles by keyword, topic, or exam (e.g. synonyms, active recall)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Articles Grid */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Loading articles...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Articles Found</h3>
            <p className="text-xs text-slate-400">
              {searchQuery 
                ? `No articles match the keyword "${searchQuery}". Try a different search term.` 
                : 'No articles are available in this category yet.'}
            </p>
            {(searchQuery || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                onClick={() => onSelectArticle(article.slug)}
                className="bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl overflow-hidden cursor-pointer transition flex flex-col group shadow-lg hover:shadow-2xl hover:shadow-amber-950/20 transform hover:-translate-y-1"
              >
                {/* Featured Thumbnail */}
                {article.featuredImage?.url ? (
                  <div className="h-48 w-full overflow-hidden relative bg-slate-950">
                    <img
                      src={article.featuredImage.url}
                      alt={article.featuredImage.alt || article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30">
                        {article.category}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-28 bg-gradient-to-br from-slate-900 to-slate-800 p-4 flex items-start justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-950/80 text-amber-400 border border-amber-500/30">
                      {article.category}
                    </span>
                    <BookOpen className="w-5 h-5 text-slate-600" />
                  </div>
                )}

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{article.readingTimeMinutes} min read</span>
                      {article.publishedAt && (
                        <>
                          <span>•</span>
                          <span>{formatDate(article.publishedAt)}</span>
                        </>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition leading-snug line-clamp-2">
                      {article.title}
                    </h2>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>

                  {/* Footer & CTA */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] truncate max-w-[150px]">
                      By {article.author?.name || 'VocabClash Team'}
                    </span>
                    <span className="text-amber-400 font-bold group-hover:translate-x-1 transition flex items-center gap-1">
                      <span>Read Article</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Conversion Banner: Practice Real PYQs */}
        <section className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Stop Passive Reading. Start Active Retrieval.
            </h3>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Drill 24,000+ authentic previous year exam questions across SSC CGL, CHSL, Banking, and Defence with instant score feedback and multiplayer 1v1 battles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onStartPractice('/ssc-top-100-synonyms')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-950/40 transition"
            >
              Practice Top 100 Synonyms
            </button>
            <button
              onClick={() => onStartPractice('/pyq-drill')}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
            >
              Endless PYQ Drill
            </button>
          </div>
        </section>

        {/* Disclaimer Footer */}
        <footer className="pt-10 border-t border-slate-800/80 text-center space-y-3 text-xs text-slate-500">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Independent Exam Preparation Platform</span>
          </div>
          <p className="max-w-2xl mx-auto leading-relaxed">
            VocabClash is an independent learning platform and is not affiliated with the Staff Selection Commission (SSC), Institute of Banking Personnel Selection (IBPS), or Union Public Service Commission (UPSC). All question papers and trademarks belong to their respective examining authorities.
          </p>
        </footer>
      </main>
    </div>
  );
};
