import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Upload, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Heading2, 
  Heading3, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Table as TableIcon, 
  Minus, 
  AlertCircle, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  FileText, 
  Settings, 
  Layers, 
  Tag, 
  Flame, 
  Globe, 
  X,
  Code
} from 'lucide-react';
import { 
  Article, 
  ArticleInput, 
  ArticleCategory, 
  RELATED_PRACTICE_PRESETS, 
  RelatedPracticePreset 
} from '../../types/article';
import { 
  saveArticle, 
  uploadArticleImage, 
  generateSlug, 
  checkSlugAvailability, 
  estimateReadingTime 
} from '../../services/articleService';
import { PublicArticleDetail } from '../public/PublicArticleDetail';

interface ArticleEditorProps {
  initialArticle?: Article | null;
  onBack: () => void;
  onSaved: (article: Article) => void;
}

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  initialArticle,
  onBack,
  onSaved,
}) => {
  // Main form fields
  const [title, setTitle] = useState(initialArticle?.title || '');
  const [slug, setSlug] = useState(initialArticle?.slug || '');
  const [isSlugCustomized, setIsSlugCustomized] = useState(Boolean(initialArticle?.slug));
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt || '');
  const [content, setContent] = useState(initialArticle?.content || '');
  const [category, setCategory] = useState<ArticleCategory>(initialArticle?.category || 'ssc');
  const [tags, setTags] = useState<string[]>(initialArticle?.tags || ['ssc', 'vocabulary']);
  const [tagInput, setTagInput] = useState('');

  // Featured Image
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialArticle?.featuredImage?.url || '');
  const [featuredImageAlt, setFeaturedImageAlt] = useState(initialArticle?.featuredImage?.alt || '');
  const [featuredImageCaption, setFeaturedImageCaption] = useState(initialArticle?.featuredImage?.caption || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);

  // SEO Overrides
  const [metaTitle, setMetaTitle] = useState(initialArticle?.seo?.title || '');
  const [metaDescription, setMetaDescription] = useState(initialArticle?.seo?.description || '');
  const [canonicalUrl, setCanonicalUrl] = useState(initialArticle?.seo?.canonical || '');

  // Related Practice
  const [selectedPracticePresetId, setSelectedPracticePresetId] = useState<string>(
    initialArticle?.relatedPractice?.type || 'ssc_top100_synonyms'
  );
  const [customPracticeRoute, setCustomPracticeRoute] = useState(
    initialArticle?.relatedPractice?.route || '/ssc-top-100-synonyms'
  );
  const [customPracticeLabel, setCustomPracticeLabel] = useState(
    initialArticle?.relatedPractice?.label || 'Practice Top 100 SSC Synonyms'
  );
  const [customPracticeSubtitle, setCustomPracticeSubtitle] = useState(
    initialArticle?.relatedPractice?.subtitle || 'Master recurring words with 1v1 battle testing.'
  );

  // Author
  const [authorName, setAuthorName] = useState(initialArticle?.author?.name || 'VocabClash Editorial Team');
  const [authorRole, setAuthorRole] = useState(initialArticle?.author?.role || 'Head of Content');

  // UI States
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'html'>('editor');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [slugWarning, setSlugWarning] = useState<string | null>(null);
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);

  // Editor selection state
  const editorAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-generate slug when title changes unless manually customized
  useEffect(() => {
    if (!isSlugCustomized && title) {
      setSlug(generateSlug(title));
    }
  }, [title, isSlugCustomized]);

  // Check slug availability on blur/change
  useEffect(() => {
    const checkSlug = async () => {
      if (!slug) return;
      const isAvailable = await checkSlugAvailability(slug, initialArticle?.id);
      if (!isAvailable) {
        setSlugWarning('This URL slug is already taken by another article. Please modify.');
      } else {
        setSlugWarning(null);
      }
    };
    const timer = setTimeout(checkSlug, 500);
    return () => clearTimeout(timer);
  }, [slug, initialArticle?.id]);

  // Handle Practice Preset Selection
  const handlePresetChange = (presetId: string) => {
    setSelectedPracticePresetId(presetId);
    if (presetId === 'custom') return;
    const preset = RELATED_PRACTICE_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setCustomPracticeRoute(preset.route);
      setCustomPracticeLabel(preset.label);
      setCustomPracticeSubtitle(preset.subtitle);
    }
  };

  // Add Tag
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  // Remove Tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Insert formatting snippet at cursor position in content textarea
  const insertFormatting = (before: string, after: string = '', defaultPlaceholder: string = '') => {
    const textarea = editorAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end) || defaultPlaceholder;
    const replacement = `${before}${selected}${after}`;

    const newContent = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  // Insert Callout Box
  const insertCallout = (type: 'tip' | 'note' | 'warning' | 'important') => {
    const labelMap = {
      tip: 'Pro Tip:',
      note: 'Note:',
      warning: 'Exam Caution:',
      important: 'Important Rule:'
    };
    const html = `\n<div class="callout callout-${type}">\n  <strong>${labelMap[type]}</strong> Write your crucial observation or exam takeaway here.\n</div>\n`;
    insertFormatting(html);
  };

  // Insert Table
  const insertTable = () => {
    const tableHtml = `\n<table>
  <thead>
    <tr>
      <th>Word / Idiom</th>
      <th>Part of Speech</th>
      <th>Target Exam Synonym</th>
      <th>Contextual Hindi Meaning</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>LACONIC</strong></td>
      <td>Adjective</td>
      <td>Concise, Terse, Brief</td>
      <td>संक्षिप्त, कम शब्दों में</td>
    </tr>
    <tr>
      <td><strong>CANDID</strong></td>
      <td>Adjective</td>
      <td>Frank, Outspoken, Honest</td>
      <td>निष्कपट, स्पष्टवादी</td>
    </tr>
  </tbody>
</table>\n`;
    insertFormatting(tableHtml);
  };

  // Insert Inline Image via file upload
  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const alt = prompt('Enter image description (ALT text for SEO & accessibility):', file.name.replace(/\.[^/.]+$/, '')) || file.name;
    const caption = prompt('Enter optional caption for this image:', '');

    try {
      setIsUploadingImage(true);
      const res = await uploadArticleImage(file, alt);
      const figureHtml = `\n<figure class="article-figure">
  <img src="${res.url}" alt="${res.alt}" loading="lazy" />
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</figure>\n`;
      insertFormatting(figureHtml);
      setStatusMessage({ type: 'success', text: 'Image inserted successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Image upload failed.' });
    } finally {
      setIsUploadingImage(false);
      if (inlineImageInputRef.current) inlineImageInputRef.current.value = '';
    }
  };

  // Upload Featured Header Image
  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const defaultAlt = title ? `${title} – VocabClash` : file.name;

    try {
      setIsUploadingImage(true);
      const res = await uploadArticleImage(file, featuredImageAlt || defaultAlt);
      setFeaturedImageUrl(res.url);
      if (!featuredImageAlt) setFeaturedImageAlt(res.alt);
      setStatusMessage({ type: 'success', text: 'Featured image uploaded!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Featured image upload failed.' });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save or Publish Article
  const handleSave = async (publishStatus: 'draft' | 'published') => {
    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Article Title is required.' });
      return;
    }
    if (!slug.trim()) {
      setStatusMessage({ type: 'error', text: 'URL Slug is required.' });
      return;
    }
    if (!content.trim()) {
      setStatusMessage({ type: 'error', text: 'Article Content cannot be empty.' });
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);

      const articleInput: ArticleInput = {
        id: initialArticle?.id,
        title: title.trim(),
        slug: generateSlug(slug),
        excerpt: excerpt.trim() || title.trim(),
        content: content.trim(),
        category,
        tags,
        featuredImage: {
          url: featuredImageUrl,
          alt: featuredImageAlt || title,
          caption: featuredImageCaption
        },
        seo: {
          title: metaTitle.trim() || `${title.trim()} – VocabClash`,
          description: metaDescription.trim() || excerpt.trim() || title.trim(),
          canonical: canonicalUrl.trim() || `https://vocabclash.in/articles/${generateSlug(slug)}`
        },
        relatedPractice: {
          type: selectedPracticePresetId,
          route: customPracticeRoute,
          label: customPracticeLabel,
          subtitle: customPracticeSubtitle
        },
        status: publishStatus,
        publishedAt: publishStatus === 'published' 
          ? (initialArticle?.publishedAt || new Date().toISOString()) 
          : (initialArticle?.publishedAt || null),
        author: {
          name: authorName,
          email: initialArticle?.author?.email,
          role: authorRole
        },
        readingTimeMinutes: estimateReadingTime(content)
      };

      const saved = await saveArticle(articleInput);
      setStatusMessage({ 
        type: 'success', 
        text: publishStatus === 'published' ? 'Article published live!' : 'Draft saved successfully.' 
      });
      onSaved(saved);
    } catch (err: any) {
      console.error('Save article error:', err);
      setStatusMessage({ 
        type: 'error', 
        text: err.message || 'Failed to save article. Please check your permissions.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Construct preview Article object
  const previewArticle: Article = {
    id: initialArticle?.id || 'preview',
    title: title || 'Untitled Article',
    slug: generateSlug(slug) || 'untitled-article',
    excerpt: excerpt || 'Article excerpt preview...',
    content: content || '<p>Start writing your article content above...</p>',
    category,
    tags,
    featuredImage: {
      url: featuredImageUrl,
      alt: featuredImageAlt,
      caption: featuredImageCaption
    },
    seo: {
      title: metaTitle || title,
      description: metaDescription || excerpt,
      canonical: canonicalUrl || `https://vocabclash.in/articles/${generateSlug(slug)}`
    },
    relatedPractice: {
      type: selectedPracticePresetId,
      route: customPracticeRoute,
      label: customPracticeLabel,
      subtitle: customPracticeSubtitle
    },
    status: initialArticle?.status || 'draft',
    publishedAt: initialArticle?.publishedAt || new Date().toISOString(),
    createdAt: initialArticle?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      name: authorName,
      role: authorRole
    },
    readingTimeMinutes: estimateReadingTime(content)
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation & Action Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
          
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              initialArticle?.status === 'published'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {initialArticle?.status === 'published' ? 'Published' : 'Draft'}
            </span>
            <span className="text-xs text-slate-400 hidden md:inline">
              ~{estimateReadingTime(content)} min read
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFullPreviewModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-medium transition flex items-center gap-2"
            title="Preview how article appears to readers"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Live Preview</span>
          </button>

          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 border ${
              showSettingsDrawer 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">SEO & Practice Settings</span>
          </button>

          <button
            disabled={isSaving}
            onClick={() => handleSave('draft')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>

          <button
            disabled={isSaving}
            onClick={() => handleSave('published')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{initialArticle?.status === 'published' ? 'Update & Keep Live' : 'Publish Article'}</span>
          </button>
        </div>
      </header>

      {/* Status banner */}
      {statusMessage && (
        <div className={`px-4 py-2.5 text-sm flex items-center justify-between border-b ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300' 
            : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center Content Editor */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6 overflow-y-auto">
          {/* Article Title Input */}
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article Title (e.g. Top 50 Most Repeated SSC CGL Synonyms: Complete Analysis)..."
              className="w-full bg-transparent text-2xl sm:text-3xl font-bold text-white placeholder-slate-600 border-b border-slate-800 pb-3 focus:outline-none focus:border-amber-500 transition"
            />
            
            {/* Slug row */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
              <span className="font-mono text-slate-500">https://vocabclash.in/articles/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsSlugCustomized(true);
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-cyan-400 focus:outline-none focus:border-cyan-500 max-w-xs"
                placeholder="article-url-slug"
              />
              {slugWarning && (
                <span className="text-amber-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {slugWarning}
                </span>
              )}
            </div>
          </div>

          {/* Short Excerpt */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Short Excerpt (Lead summary for search engines & previews)
            </label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="1-2 sentences summarizing the core educational takeaways or shift data discussed in this article..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 transition resize-none"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Recommended: 120-160 characters for high Google CTR</span>
              <span className={excerpt.length > 160 ? 'text-amber-400' : ''}>{excerpt.length} chars</span>
            </div>
          </div>

          {/* Editor Tabs & Rich Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* View switcher tabs */}
            <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'editor' 
                      ? 'bg-slate-800 text-white shadow' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Visual Editor
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'preview' 
                      ? 'bg-slate-800 text-white shadow' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  Live Preview
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('html')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'html' 
                      ? 'bg-slate-800 text-white shadow' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 text-emerald-400" />
                  HTML Source
                </button>
              </div>

              <span className="text-xs text-slate-500 font-mono">
                {content.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            {/* Quick-Insert Formatting Toolbar */}
            {activeTab !== 'preview' && (
              <div className="bg-slate-900/90 border-b border-slate-800/80 px-3 py-2 flex items-center gap-1 flex-wrap text-slate-300">
                <button
                  type="button"
                  title="Heading 2 (Section Title)"
                  onClick={() => insertFormatting('\n<h2>', '</h2>\n', 'Section Heading 2')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition flex items-center text-xs font-bold gap-1"
                >
                  <Heading2 className="w-4 h-4 text-amber-400" />
                  <span>H2</span>
                </button>

                <button
                  type="button"
                  title="Heading 3 (Subsection Title)"
                  onClick={() => insertFormatting('\n<h3>', '</h3>\n', 'Subsection Heading 3')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition flex items-center text-xs font-bold gap-1"
                >
                  <Heading3 className="w-4 h-4 text-cyan-400" />
                  <span>H3</span>
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                <button
                  type="button"
                  title="Bold Text"
                  onClick={() => insertFormatting('<strong>', '</strong>', 'bold text')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <Bold className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  title="Italic Text"
                  onClick={() => insertFormatting('<em>', '</em>', 'italicized text')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <Italic className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                <button
                  type="button"
                  title="Bulleted List"
                  onClick={() => insertFormatting('\n<ul>\n  <li>', '</li>\n  <li>Second point</li>\n</ul>\n', 'First key point')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <List className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  title="Numbered List"
                  onClick={() => insertFormatting('\n<ol>\n  <li>', '</li>\n  <li>Step two</li>\n</ol>\n', 'Step one')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  title="Blockquote"
                  onClick={() => insertFormatting('\n<blockquote>\n  "', '"\n</blockquote>\n', 'Insert expert exam quote or rule')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <Quote className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  title="Insert Link"
                  onClick={() => {
                    const url = prompt('Enter destination URL:', 'https://vocabclash.in/');
                    if (url) insertFormatting(`<a href="${url}" target="_blank" rel="noopener noreferrer">`, '</a>', 'Link Text');
                  }}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Callout insertion buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Insert Tip Callout Box"
                    onClick={() => insertCallout('tip')}
                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium transition"
                  >
                    + Tip Box
                  </button>
                  <button
                    type="button"
                    title="Insert Note Callout Box"
                    onClick={() => insertCallout('note')}
                    className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs font-medium transition"
                  >
                    + Note Box
                  </button>
                  <button
                    type="button"
                    title="Insert Warning Callout Box"
                    onClick={() => insertCallout('warning')}
                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-medium transition"
                  >
                    + Warning
                  </button>
                </div>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Table insertion */}
                <button
                  type="button"
                  title="Insert Comparative Vocabulary Table"
                  onClick={insertTable}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition flex items-center gap-1 text-xs"
                >
                  <TableIcon className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">Table</span>
                </button>

                {/* Image upload button */}
                <button
                  type="button"
                  title="Upload & Insert Inline Image"
                  onClick={() => inlineImageInputRef.current?.click()}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition flex items-center gap-1 text-xs"
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Image</span>
                </button>
                <input
                  type="file"
                  ref={inlineImageInputRef}
                  onChange={handleInlineImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  title="Horizontal Separator"
                  onClick={() => insertFormatting('\n<hr />\n')}
                  className="p-1.5 hover:bg-slate-800 hover:text-white rounded transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Editor Workspace Views */}
            {activeTab === 'editor' || activeTab === 'html' ? (
              <textarea
                ref={editorAreaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={22}
                placeholder="Write your in-depth educational article here. You can use standard formatting or toolbar buttons above (H2 headings, lists, tables, callouts, and images)..."
                className="w-full bg-slate-950 p-4 sm:p-6 text-slate-200 font-mono text-sm leading-relaxed focus:outline-none focus:ring-0 border-0 resize-y"
              />
            ) : (
              <div className="p-6 bg-slate-950 overflow-y-auto max-h-[600px]">
                <div className="prose prose-invert max-w-none article-content-rendered">
                  <div dangerouslySetInnerHTML={{ __html: content || '<p className="text-slate-500 italic">No content written yet.</p>' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Settings Drawer / Panel */}
        <aside className={`${
          showSettingsDrawer ? 'block' : 'hidden lg:block'
        } w-full lg:w-96 bg-slate-900 border-l border-slate-800 p-5 space-y-6 overflow-y-auto`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              Article Configuration
            </h3>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Category */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Exam Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ArticleCategory)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ssc">Staff Selection Commission (SSC CGL/CHSL)</option>
              <option value="banking">Banking & Insurance (IBPS, SBI PO/Clerk)</option>
              <option value="defence">Defence Exams (CDS, AFCAT, NDA)</option>
              <option value="vocabulary">Vocabulary & Root Words</option>
              <option value="pyqs">PYQ Shift & Trend Analyses</option>
              <option value="strategy">Exam Strategy & Score Improvement</option>
              <option value="general">General English & Grammar</option>
            </select>
          </div>

          {/* 2. Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Tags (Press Enter or Comma)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="e.g. ssc cgl, synonyms, 2026..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 3. Featured Image */}
          <div className="space-y-2.5 border-t border-slate-800 pt-4">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Featured Header Image</span>
              {isUploadingImage && <span className="text-amber-400 text-xs animate-pulse">Uploading...</span>}
            </label>

            {featuredImageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 group">
                <img
                  src={featuredImageUrl}
                  alt={featuredImageAlt || 'Featured Image'}
                  className="w-full h-36 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFeaturedImageUrl('')}
                  className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-rose-600 text-white rounded-lg transition"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-amber-400 transition"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-medium">Upload Image from Computer</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFeaturedImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            )}

            {/* Direct Image URL input */}
            <input
              type="text"
              value={featuredImageUrl}
              onChange={(e) => setFeaturedImageUrl(e.target.value)}
              placeholder="Or paste external image URL..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
            />

            {/* Image Alt Text (SEO Essential) */}
            <input
              type="text"
              value={featuredImageAlt}
              onChange={(e) => setFeaturedImageAlt(e.target.value)}
              placeholder="Image ALT text (Mandatory for SEO & Screen Readers)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />

            {/* Image Caption */}
            <input
              type="text"
              value={featuredImageCaption}
              onChange={(e) => setFeaturedImageCaption(e.target.value)}
              placeholder="Optional photo caption..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 4. Related VocabClash Practice (CRITICAL CONVERSION ENGINE) */}
          <div className="space-y-3 border-t border-slate-800 pt-4 bg-slate-950/40 p-3 rounded-xl border">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Related Practice CTA
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Directs readers straight into real question practice drills to boost active recall and conversions.
            </p>

            <select
              value={selectedPracticePresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {RELATED_PRACTICE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.category}: {preset.label}
                </option>
              ))}
              <option value="custom">Custom VocabClash Route...</option>
            </select>

            <input
              type="text"
              value={customPracticeLabel}
              onChange={(e) => setCustomPracticeLabel(e.target.value)}
              placeholder="Button Label (e.g. Practice Top 100 SSC Synonyms)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />

            <input
              type="text"
              value={customPracticeRoute}
              onChange={(e) => setCustomPracticeRoute(e.target.value)}
              placeholder="App Route (e.g. /ssc-top-100-synonyms)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-400 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />

            <input
              type="text"
              value={customPracticeSubtitle}
              onChange={(e) => setCustomPracticeSubtitle(e.target.value)}
              placeholder="Subtitle (e.g. Test your recall in timed drills)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* 5. SEO Overrides */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                Google Search & Meta Tags
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Meta Title Tag</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={title ? `${title} – VocabClash` : 'Page Title in Google Results'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <div className="text-right text-[10px] text-slate-500">
                {(metaTitle || title).length} / 60 chars
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Meta Description Tag</label>
              <textarea
                rows={2}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder={excerpt || 'Concise description appearing under title in Google...'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
              />
              <div className="text-right text-[10px] text-slate-500">
                {(metaDescription || excerpt).length} / 160 chars
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Canonical URL</label>
              <input
                type="text"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder={`https://vocabclash.in/articles/${slug || 'slug'}`}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-400 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 6. Author Metadata */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <label className="text-xs font-bold text-white uppercase tracking-wider">Author Info</label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Author Name (e.g. VocabClash Editorial Team)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={authorRole}
              onChange={(e) => setAuthorRole(e.target.value)}
              placeholder="Role (e.g. Head of Content, Staff Mentor)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </aside>
      </div>

      {/* Full Live Preview Modal */}
      {showFullPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto flex flex-col">
          <div className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">Full Reader Preview Mode</span>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                Simulated {category.toUpperCase()} Article
              </span>
            </div>
            <button
              onClick={() => setShowFullPreviewModal(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Close Preview</span>
            </button>
          </div>

          <div className="flex-1">
            <PublicArticleDetail
              articleSlug={previewArticle.slug}
              previewArticleData={previewArticle}
              onNavigateHome={() => setShowFullPreviewModal(false)}
              onNavigateToArticles={() => setShowFullPreviewModal(false)}
              onNavigateToSlug={() => {}}
              onStartPractice={() => setShowFullPreviewModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
