import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  User, 
  Share2, 
  Check, 
  Flame, 
  ArrowRight, 
  BookOpen, 
  Swords, 
  Target, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Article } from '../../types/article';
import { getArticleBySlug, getPublishedArticles } from '../../services/articleService';
import { updateArticleSeo } from '../../utils/seoMetaManager';
import { trackArticleView, trackRelatedPracticeClick } from '../../services/analyticsService';

interface PublicArticleDetailProps {
  articleSlug: string;
  previewArticleData?: Article;
  onNavigateHome: () => void;
  onNavigateToArticles: () => void;
  onNavigateToSlug: (slug: string) => void;
  onStartPractice: (route: string) => void;
}

export const PublicArticleDetail: React.FC<PublicArticleDetailProps> = ({
  articleSlug,
  previewArticleData,
  onNavigateHome,
  onNavigateToArticles,
  onNavigateToSlug,
  onStartPractice,
}) => {
  const [article, setArticle] = useState<Article | null>(previewArticleData || null);
  const [isLoading, setIsLoading] = useState(!previewArticleData);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);

  useEffect(() => {
    if (previewArticleData) {
      setArticle(previewArticleData);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadArticle() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getArticleBySlug(articleSlug);
        if (!isMounted) return;

        if (!data) {
          setError('The requested article was not found or has been unpublished.');
          setIsLoading(false);
          return;
        }

        setArticle(data);
        updateArticleSeo(data);
        trackArticleView(data.slug, data.category);

        // Fetch related articles for the bottom section
        const allArticles = await getPublishedArticles();
        if (isMounted) {
          const others = allArticles
            .filter(a => a.id !== data.id && a.slug !== data.slug)
            .slice(0, 3);
          setRelatedArticles(others);
        }
      } catch (err) {
        console.error('Error fetching article:', err);
        if (isMounted) {
          setError('Failed to load article. Please check your connection.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadArticle();

    return () => {
      isMounted = false;
    };
  }, [articleSlug, previewArticleData]);

  // Handle Share button
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share && article) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  // Handle CTA Click
  const handleCtaClick = () => {
    if (!article?.relatedPractice) return;
    trackRelatedPracticeClick(
      article.slug, 
      article.relatedPractice.type, 
      article.relatedPractice.route
    );
    onStartPractice(article.relatedPractice.route);
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
        <header className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-black tracking-wider text-lg">VOCAB<span className="text-white">CLASH</span></span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Loading article...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
        <header className="border-b border-slate-800 bg-slate-900 px-4 py-3">
          <button
            onClick={onNavigateToArticles}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Articles</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Article Not Found</h2>
            <p className="text-sm text-slate-400">
              {error || "The article you are looking for doesn't exist or is currently in draft status."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={onNavigateToArticles}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
              >
                Browse All Articles
              </button>
              <button
                onClick={onNavigateHome}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 overflow-y-auto">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToArticles}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium transition flex items-center gap-1.5"
              title="Return to articles index"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">All Articles</span>
            </button>

            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 text-left"
            >
              <span className="text-amber-400 font-black tracking-wider text-base sm:text-lg">
                VOCAB<span className="text-white">CLASH</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium hidden md:inline">
                Guides & Analysis
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
              title="Share article link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              onClick={handleCtaClick}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-950/40 transition flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5 fill-slate-950" />
              <span className="hidden sm:inline">Practice PYQs</span>
              <span className="sm:hidden">Practice</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Article Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center flex-wrap gap-1.5 text-xs text-slate-400">
            <li>
              <button 
                onClick={onNavigateHome}
                className="hover:text-amber-400 transition"
              >
                Home
              </button>
            </li>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <li>
              <button 
                onClick={onNavigateToArticles}
                className="hover:text-amber-400 transition"
              >
                Articles
              </button>
            </li>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <li>
              <span className="text-slate-300 font-medium capitalize">
                {article.category}
              </span>
            </li>
          </ol>
        </nav>

        {/* Article Header */}
        <header className="space-y-4 mb-8">
          {/* Category Chip & Reading Time */}
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
              {article.category.toUpperCase()}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{article.readingTimeMinutes} min read</span>
            </div>
          </div>

          {/* Primary H1 Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Lead Excerpt */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            {article.excerpt}
          </p>

          {/* Author & Publishing Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold text-sm shadow">
                {article.author?.name ? article.author.name.charAt(0).toUpperCase() : 'V'}
              </div>
              <div>
                <div className="font-semibold text-slate-200">
                  {article.author?.name || 'VocabClash Editorial Team'}
                </div>
                <div className="text-slate-500">
                  {article.author?.role || 'Government Exam Content Specialist'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              {article.publishedAt && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Published {formatDate(article.publishedAt)}</span>
                </div>
              )}
              {article.updatedAt && article.publishedAt && article.updatedAt > article.publishedAt && (
                <span className="text-slate-500 italic hidden sm:inline">
                  (Updated {formatDate(article.updatedAt)})
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {article.featuredImage?.url && (
          <figure className="mb-10 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl">
            <img
              src={article.featuredImage.url}
              alt={article.featuredImage.alt || article.title}
              className="w-full h-auto max-h-[460px] object-cover"
              loading="eager"
            />
            {article.featuredImage.caption && (
              <figcaption className="px-4 py-2.5 text-xs text-slate-400 bg-slate-900/90 border-t border-slate-800/80 text-center italic">
                {article.featuredImage.caption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Article Body Content */}
        <article className="article-rendered-body prose prose-invert max-w-none text-slate-200 leading-relaxed space-y-6">
          <div 
            dangerouslySetInnerHTML={{ __html: article.content }} 
          />
        </article>

        {/* Tags Row */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-slate-800 flex items-center flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Tagged:
            </span>
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-amber-400 transition"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* HIGH CONVERSION EMBEDDED PRACTICE CTA CARD */}
        {article.relatedPractice && (
          <section 
            aria-label="Related Practice"
            className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-2 border-amber-500/40 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Immediate Active Recall</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  {article.relatedPractice.label}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {article.relatedPractice.subtitle || 'Put these exact high-frequency words to the test with real-time timers and instant answer keys.'}
                </p>
              </div>

              <button
                onClick={handleCtaClick}
                className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-950/50 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 flex-shrink-0"
              >
                <span>Start Practice Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* Author Bio Box */}
        <div className="mt-12 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md">
            {article.author?.name ? article.author.name.charAt(0).toUpperCase() : 'V'}
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">
              Written by {article.author?.name || 'VocabClash Editorial Team'}
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Curated by the VocabClash educational research group. We analyze authentic previous year question papers across Staff Selection Commission (SSC), Banking (IBPS, SBI), and Defence (CDS, NDA) examinations to create evidence-backed vocabulary guides.
            </p>
          </div>
        </div>

        {/* More Articles Section */}
        {relatedArticles.length > 0 && (
          <section className="mt-16 pt-10 border-t border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span>Related Articles & Guides</span>
              </h3>
              <button
                onClick={onNavigateToArticles}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
              >
                <span>View All Articles</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {relatedArticles.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => onNavigateToSlug(rel.slug)}
                  className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden cursor-pointer transition flex flex-col group shadow-md"
                >
                  {rel.featuredImage?.url && (
                    <div className="h-36 overflow-hidden">
                      <img
                        src={rel.featuredImage.url}
                        alt={rel.featuredImage.alt || rel.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        {rel.category}
                      </span>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 line-clamp-2 transition leading-snug">
                        {rel.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                      <span>{rel.readingTimeMinutes} min read</span>
                      <span className="text-amber-400 font-medium group-hover:translate-x-1 transition inline-flex items-center gap-0.5">
                        Read →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Government Exam Disclaimer */}
        <footer className="mt-16 pt-8 border-t border-slate-800/80 text-center space-y-3 text-xs text-slate-500">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Independent Educational Platform Notice</span>
          </div>
          <p className="max-w-2xl mx-auto leading-relaxed">
            VocabClash is an independent learning and test preparation portal. SSC, CGL, CHSL, CPO, IBPS, SBI, CDS, and NDA are registered trademarks of their respective government recruitment bodies. Examination past year papers are referenced strictly for fair educational practice and active recall training.
          </p>
          <div className="pt-2">
            <button
              onClick={onNavigateHome}
              className="text-amber-400 hover:text-amber-300 font-medium transition"
            >
              Return to VocabClash Home
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};
