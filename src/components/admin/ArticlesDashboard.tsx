import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  UploadCloud, 
  EyeOff, 
  Clock, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft, 
  BookOpen, 
  ExternalLink,
  ShieldCheck,
  Tag,
  Sparkles,
  Layers
} from 'lucide-react';
import { Article, ArticleStatus, ArticleCategory } from '../../types/article';
import { 
  getAllArticlesForAdmin, 
  publishArticle, 
  unpublishArticle, 
  deleteArticle, 
  saveArticle 
} from '../../services/articleService';
import { SAMPLE_ARTICLES } from '../../data/sampleArticles';
import { isUserAdmin } from '../../services/pyqFirestoreService';

interface ArticlesDashboardProps {
  onNewArticle: () => void;
  onEditArticle: (article: Article) => void;
  onPreviewArticle: (article: Article) => void;
  onBackToApp: () => void;
  currentUserEmail?: string | null;
}

export const ArticlesDashboard: React.FC<ArticlesDashboardProps> = ({
  onNewArticle,
  onEditArticle,
  onPreviewArticle,
  onBackToApp,
  currentUserEmail,
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = isUserAdmin(currentUserEmail);

  // Load articles
  const loadArticles = async () => {
    try {
      setIsLoading(true);
      const list = await getAllArticlesForAdmin();
      setArticles(list);
    } catch (err: any) {
      console.error('Error loading articles for admin:', err);
      setToastMessage({ type: 'error', text: 'Failed to fetch articles from Firestore.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

  // Filtered Articles
  const filteredArticles = articles.filter((art) => {
    if (statusFilter !== 'all' && art.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && art.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      art.title.toLowerCase().includes(query) ||
      art.slug.toLowerCase().includes(query) ||
      art.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  // Toggle publish / unpublish
  const handleTogglePublish = async (article: Article) => {
    try {
      setIsActionInProgress(true);
      if (article.status === 'published') {
        await unpublishArticle(article.id);
        setToastMessage({ type: 'success', text: `"${article.title}" reverted to draft.` });
      } else {
        await publishArticle(article.id);
        setToastMessage({ type: 'success', text: `"${article.title}" published live!` });
      }
      await loadArticles();
    } catch (err: any) {
      console.error('Toggle publish error:', err);
      setToastMessage({ type: 'error', text: err.message || 'Could not update article status.' });
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!articleToDelete) return;
    try {
      setIsActionInProgress(true);
      await deleteArticle(articleToDelete.id);
      setToastMessage({ type: 'success', text: `"${articleToDelete.title}" deleted.` });
      setArticleToDelete(null);
      await loadArticles();
    } catch (err: any) {
      console.error('Delete article error:', err);
      setToastMessage({ type: 'error', text: err.message || 'Failed to delete article.' });
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Seed sample high-yield articles into Firestore
  const handleSeedSamples = async () => {
    try {
      setIsActionInProgress(true);
      for (const sample of SAMPLE_ARTICLES) {
        await saveArticle(sample);
      }
      setToastMessage({ type: 'success', text: 'Sample high-yield articles seeded successfully!' });
      await loadArticles();
    } catch (err: any) {
      console.error('Seed error:', err);
      setToastMessage({ type: 'error', text: 'Error seeding articles: ' + (err.message || '') });
    } finally {
      setIsActionInProgress(false);
    }
  };

  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Admin</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-black tracking-wider text-base sm:text-lg">
              VOCAB<span className="text-white">CLASH</span>
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
              Editorial Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadArticles}
            disabled={isLoading || isActionInProgress}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Refresh articles"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onNewArticle}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-950/40 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Article</span>
          </button>
        </div>
      </header>

      {/* Toast feedback */}
      {toastMessage && (
        <div className={`px-4 py-2.5 text-sm flex items-center justify-between border-b ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300' 
            : 'bg-rose-950/70 border-rose-800/60 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-xs hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Admin status notice */}
        {!isAdmin && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div>
              <strong>Security Notice:</strong> You are currently authenticated as{' '}
              <span className="font-mono text-white">{currentUserEmail || 'Guest'}</span>. Firestore
              rules only permit write operations from the registered administrator (nathchinmoy777@gmail.com).
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow">
            <div className="text-xs text-slate-400 font-medium">Total Articles</div>
            <div className="text-2xl font-black text-white">{articles.length}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow">
            <div className="text-xs text-emerald-400 font-medium">Published Live</div>
            <div className="text-2xl font-black text-emerald-400">{publishedCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow">
            <div className="text-xs text-amber-400 font-medium">Drafts in Progress</div>
            <div className="text-2xl font-black text-amber-400">{draftCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow flex flex-col justify-between">
            <div className="text-xs text-slate-400 font-medium">Public URL</div>
            <a
              href="/articles"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              <span>/articles Index</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, slug, or tag..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Categories</option>
              <option value="ssc">SSC</option>
              <option value="banking">Banking</option>
              <option value="defence">Defence</option>
              <option value="vocabulary">Vocabulary</option>
              <option value="pyqs">PYQs</option>
              <option value="strategy">Strategy</option>
              <option value="general">General</option>
            </select>

            {/* Seed Sample Articles */}
            <button
              onClick={handleSeedSamples}
              disabled={isActionInProgress}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
              title="Seed initial authentic article templates"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Seed Samples</span>
            </button>
          </div>
        </div>

        {/* Articles Table / List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-slate-400">Loading articles from Firestore...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No articles found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'No articles match your search criteria. Try modifying your filter.'
                  : 'You have not written any articles yet. Click "New Article" to create your first educational guide.'}
              </p>
              <button
                onClick={onNewArticle}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                + Write First Article
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Article</th>
                    <th className="py-3.5 px-3">Category</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3">Published</th>
                    <th className="py-3.5 px-3">Reading Time</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredArticles.map((art) => (
                    <tr key={art.id} className="hover:bg-slate-800/40 transition group">
                      {/* Title & Slug */}
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <div className="flex items-center gap-3">
                          {art.featuredImage?.url ? (
                            <img
                              src={art.featuredImage.url}
                              alt={art.title}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-950 border border-slate-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-600">
                              <BookOpen className="w-5 h-5" />
                            </div>
                          )}

                          <div className="space-y-0.5 min-w-0">
                            <div 
                              onClick={() => onEditArticle(art)}
                              className="font-bold text-white hover:text-amber-400 cursor-pointer truncate transition"
                              title={art.title}
                            >
                              {art.title}
                            </div>
                            <div className="text-[11px] font-mono text-cyan-400 truncate">
                              /articles/{art.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                          {art.category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          art.status === 'published'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {art.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 text-slate-400 text-xs">
                        {formatDate(art.publishedAt || art.createdAt)}
                      </td>

                      {/* Reading Time */}
                      <td className="py-3.5 px-3 text-slate-400 text-xs">
                        {art.readingTimeMinutes} min
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview */}
                          <button
                            onClick={() => onPreviewArticle(art)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition"
                            title="Preview Article"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => onEditArticle(art)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition"
                            title="Edit Article"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Toggle Publish */}
                          <button
                            disabled={isActionInProgress}
                            onClick={() => handleTogglePublish(art)}
                            className={`p-1.5 rounded-lg transition ${
                              art.status === 'published'
                                ? 'bg-slate-800 hover:bg-amber-950/60 text-slate-300 hover:text-amber-400'
                                : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400'
                            }`}
                            title={art.status === 'published' ? 'Unpublish to Draft' : 'Publish Article Live'}
                          >
                            {art.status === 'published' ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <UploadCloud className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            disabled={isActionInProgress}
                            onClick={() => setArticleToDelete(art)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {articleToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Article?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete:
              </p>
              <p className="text-sm font-semibold text-white py-1">
                "{articleToDelete.title}"
              </p>
              <p className="text-xs text-rose-400">
                This action is irreversible and removes the post from Firestore.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={isActionInProgress}
                onClick={() => setArticleToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                disabled={isActionInProgress}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 transition"
              >
                {isActionInProgress ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
