import { SeoPageData } from '../data/seoContentData';
import { Article } from '../types/article';

export function updatePageSeo(pageData?: SeoPageData | null) {
  if (typeof document === 'undefined') return;

  const defaultTitle = 'VocabClash – SSC Vocabulary, English PYQs & 1v1 Battles';
  const defaultDesc = 'Practice SSC CGL, CHSL, CPO and government exam English vocabulary with 24,000+ PYQs, synonyms, antonyms, idioms, one-word substitutions and real-time 1v1 battles on VocabClash.';
  const defaultCanonical = 'https://vocabclash.in/';
  const defaultImage = 'https://vocabclash.in/screenshot-wide.png';

  const title = pageData ? pageData.title : defaultTitle;
  const description = pageData ? pageData.metaDescription : defaultDesc;
  const canonicalUrl = pageData ? `https://vocabclash.in${pageData.slug}` : defaultCanonical;

  // 1. Document Title
  document.title = title;

  // 2. Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', description);

  // 3. Canonical Link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 4. Open Graph Tags
  const updateMetaProperty = (prop: string, val: string) => {
    let tag = document.querySelector(`meta[property="${prop}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', prop);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  };

  updateMetaProperty('og:title', title);
  updateMetaProperty('og:description', description);
  updateMetaProperty('og:url', canonicalUrl);
  updateMetaProperty('og:type', 'website');
  updateMetaProperty('og:site_name', 'VocabClash');
  updateMetaProperty('og:image', defaultImage);

  // 5. Twitter Card Tags
  const updateMetaName = (name: string, val: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  };

  updateMetaName('twitter:card', 'summary_large_image');
  updateMetaName('twitter:title', title);
  updateMetaName('twitter:description', description);
  updateMetaName('twitter:image', defaultImage);

  // 6. JSON-LD Structured Data
  let scriptTag = document.getElementById('vocabclash-jsonld') as HTMLScriptElement | null;
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = 'vocabclash-jsonld';
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }

  const structuredData: any[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': 'VocabClash',
      'url': 'https://vocabclash.in/',
      'potentialAction': {
        '@type': 'SearchAction',
        'target': 'https://vocabclash.in/?q={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'VocabClash',
      'url': 'https://vocabclash.in/',
      'logo': 'https://vocabclash.in/icon-512.png',
      'description': 'Real-time competitive English vocabulary arena and PYQ practice app for SSC CGL, CHSL, CPO and government exam aspirants.'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': 'VocabClash',
      'url': 'https://vocabclash.in/',
      'applicationCategory': 'EducationalApplication',
      'operatingSystem': 'Web, Android, iOS, Windows, macOS',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'INR'
      }
    }
  ];

  if (pageData) {
    // Add BreadcrumbList Schema
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://vocabclash.in/'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': pageData.h1,
          'item': `https://vocabclash.in${pageData.slug}`
        }
      ]
    });

    // Add FAQPage Schema
    if (pageData.faqs && pageData.faqs.length > 0) {
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': pageData.faqs.map(faq => ({
          '@type': 'Question',
          'name': faq.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': faq.answer
          }
        }))
      });
    }

    // Add Article / EducationalWebPage Schema
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': pageData.h1,
      'description': pageData.metaDescription,
      'url': `https://vocabclash.in${pageData.slug}`,
      'publisher': {
        '@type': 'Organization',
        'name': 'VocabClash',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://vocabclash.in/icon-512.png'
        }
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': `https://vocabclash.in${pageData.slug}`
      },
      'inLanguage': 'en'
    });
  }

  scriptTag.textContent = JSON.stringify(structuredData);
}

/**
 * Updates SEO meta tags and Safari-safe @graph JSON-LD structured data for published Articles
 */
export function updateArticleSeo(article: Article) {
  if (typeof document === 'undefined') return;

  const title = article.seo?.title ? `${article.seo.title}` : `${article.title} – VocabClash`;
  const description = article.seo?.description || article.excerpt;
  const canonicalUrl = article.seo?.canonical || `https://vocabclash.in/articles/${article.slug}`;
  const imageUrl = article.featuredImage?.url || 'https://vocabclash.in/screenshot-wide.png';

  // 1. Document Title
  document.title = title;

  // 2. Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', description);

  // 3. Canonical Link
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 4. Open Graph Tags
  const updateMetaProperty = (prop: string, val: string) => {
    let tag = document.querySelector(`meta[property="${prop}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', prop);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  };

  updateMetaProperty('og:title', title);
  updateMetaProperty('og:description', description);
  updateMetaProperty('og:url', canonicalUrl);
  updateMetaProperty('og:type', 'article');
  updateMetaProperty('og:site_name', 'VocabClash');
  updateMetaProperty('og:image', imageUrl);
  if (article.publishedAt) {
    updateMetaProperty('article:published_time', article.publishedAt);
  }
  if (article.updatedAt) {
    updateMetaProperty('article:modified_time', article.updatedAt);
  }
  if (article.author?.name) {
    updateMetaProperty('article:author', article.author.name);
  }

  // 5. Twitter Card Tags
  const updateMetaName = (name: string, val: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  };

  updateMetaName('twitter:card', 'summary_large_image');
  updateMetaName('twitter:title', title);
  updateMetaName('twitter:description', description);
  updateMetaName('twitter:image', imageUrl);

  // 6. JSON-LD Structured Data using single-object @graph (Safari crash prevention)
  let scriptTag = document.getElementById('vocabclash-jsonld') as HTMLScriptElement | null;
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = 'vocabclash-jsonld';
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }

  const graphEntities: any[] = [
    {
      '@type': 'WebSite',
      '@id': 'https://vocabclash.in/#website',
      'name': 'VocabClash',
      'url': 'https://vocabclash.in/'
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://vocabclash.in/'
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Articles',
          'item': 'https://vocabclash.in/articles'
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': article.title,
          'item': canonicalUrl
        }
      ]
    },
    {
      '@type': 'Article',
      '@id': `${canonicalUrl}#article`,
      'headline': title,
      'description': description,
      'url': canonicalUrl,
      'datePublished': article.publishedAt || article.createdAt,
      'dateModified': article.updatedAt || article.publishedAt || article.createdAt,
      'image': [imageUrl],
      'inLanguage': 'en',
      'publisher': {
        '@type': 'Organization',
        'name': 'VocabClash',
        'url': 'https://vocabclash.in/',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://vocabclash.in/icon-512.png'
        }
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': canonicalUrl
      },
      'author': {
        '@type': 'Organization',
        'name': article.author?.name || 'VocabClash Editorial Team'
      }
    }
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': graphEntities
  };

  scriptTag.textContent = JSON.stringify(structuredData);
}

/**
 * Updates SEO meta tags for public /articles index
 */
export function updateArticlesIndexSeo() {
  if (typeof document === 'undefined') return;

  const title = 'VocabClash Articles & Guides – SSC, Banking & Defence English Prep';
  const description = 'Comprehensive guides, PYQ frequency analysis, active recall strategies, and vocabulary lists for SSC CGL, CHSL, CPO, CDS, and Banking examinations.';
  const canonicalUrl = 'https://vocabclash.in/articles';
  const defaultImage = 'https://vocabclash.in/screenshot-wide.png';

  document.title = title;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', description);

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  const updateMetaProperty = (prop: string, val: string) => {
    let tag = document.querySelector(`meta[property="${prop}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', prop);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', val);
  };

  updateMetaProperty('og:title', title);
  updateMetaProperty('og:description', description);
  updateMetaProperty('og:url', canonicalUrl);
  updateMetaProperty('og:type', 'website');
  updateMetaProperty('og:site_name', 'VocabClash');
  updateMetaProperty('og:image', defaultImage);

  let scriptTag = document.getElementById('vocabclash-jsonld') as HTMLScriptElement | null;
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = 'vocabclash-jsonld';
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://vocabclash.in/#website',
        'name': 'VocabClash',
        'url': 'https://vocabclash.in/'
      },
      {
        '@type': 'CollectionPage',
        '@id': 'https://vocabclash.in/articles#collection',
        'name': title,
        'description': description,
        'url': canonicalUrl
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://vocabclash.in/articles#breadcrumb',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': 'https://vocabclash.in/'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Articles',
            'item': canonicalUrl
          }
        ]
      }
    ]
  };

  scriptTag.textContent = JSON.stringify(structuredData);
}

