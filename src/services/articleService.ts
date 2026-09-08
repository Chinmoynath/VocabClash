import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  db, 
  auth, 
  handleFirestoreError, 
  OperationType, 
  isFirestoreQuotaExhausted 
} from './firebaseService';
import { 
  Article, 
  ArticleInput, 
  ArticleStatus, 
  ArticleCategory,
  RELATED_PRACTICE_PRESETS 
} from '../types/article';
import { SAMPLE_ARTICLES } from '../data/sampleArticles';
import { isUserAdmin } from './pyqFirestoreService';

const ARTICLES_COLLECTION = 'articles';

/**
 * Generate a clean URL slug from article title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Estimate reading time in minutes based on 200 WPM
 */
export function estimateReadingTime(contentOrHtml: string): number {
  const plainText = contentOrHtml.replace(/<[^>]*>/g, ' ');
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Check if slug is already used by another article
 */
export async function checkSlugAvailability(slug: string, excludeId?: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, ARTICLES_COLLECTION),
      where('slug', '==', slug)
    );
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (excludeId && snap.docs.length === 1 && snap.docs[0].id === excludeId) {
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[ArticleService] Slug check error, proceeding:', error);
    return true;
  }
}

/**
 * Compress an image file in the browser using HTML Canvas
 * Resizes to max width/height 1200px and compresses to JPEG with 0.8 quality
 */
async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, dataUrl: reader.result as string });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              resolve({ blob: file, dataUrl });
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image for an article (featured image or inline)
 * Uses client-side compression, Firebase Storage, and graceful fallback
 */
export async function uploadArticleImage(file: File, altText?: string): Promise<{ url: string; alt: string }> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '') + '.jpg';
  const timestamp = Date.now();
  const storagePath = `article-images/${timestamp}_${sanitizedName}`;
  const defaultAlt = altText || file.name.replace(/\.[^/.]+$/, '');

  // Compress image client-side first for fast upload and small footprint
  let compressedBlob: Blob = file;
  let fallbackDataUrl: string = '';
  try {
    const comp = await compressImage(file, 1200, 0.82);
    compressedBlob = comp.blob;
    fallbackDataUrl = comp.dataUrl;
  } catch (compErr) {
    console.warn('[ArticleService] Canvas compression error, proceeding with original file:', compErr);
  }

  try {
    const storage = getStorage();
    const storageRef = ref(storage, storagePath);
    
    const metadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        altText: defaultAlt,
        uploadedBy: auth.currentUser?.email || 'admin'
      }
    };

    const snapshot = await uploadBytes(storageRef, compressedBlob, metadata);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      url: downloadUrl,
      alt: defaultAlt
    };
  } catch (primaryError) {
    console.warn('[ArticleService] Direct Firebase Storage upload error, trying fallback:', primaryError);

    // Fallback: Try server-side upload endpoint if available
    try {
      const formData = new FormData();
      formData.append('image', compressedBlob, sanitizedName);
      if (defaultAlt) formData.append('altText', defaultAlt);

      const res = await fetch('/api/articles/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          return { url: json.url, alt: json.alt || defaultAlt };
        }
      }
    } catch (fallbackError) {
      console.warn('[ArticleService] Fallback upload failed:', fallbackError);
    }

    // Secondary fallback: Return the high-quality compressed Data URL
    if (fallbackDataUrl) {
      return {
        url: fallbackDataUrl,
        alt: defaultAlt
      };
    }

    throw new Error('Could not process image. Please verify your connection or use an external image URL.');
  }
}

/**
 * Fetch all articles for Admin Dashboard (includes drafts)
 */
export async function getAllArticlesForAdmin(): Promise<Article[]> {
  try {
    const articlesCol = collection(db, ARTICLES_COLLECTION);
    const snap = await getDocs(articlesCol);
    
    const articles: Article[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      articles.push({
        id: docSnap.id,
        title: data.title || '',
        slug: data.slug || docSnap.id,
        excerpt: data.excerpt || '',
        content: data.content || '',
        category: (data.category as ArticleCategory) || 'general',
        tags: Array.isArray(data.tags) ? data.tags : [],
        featuredImage: data.featuredImage || { url: '', alt: '' },
        seo: data.seo || { title: data.title || '', description: data.excerpt || '' },
        relatedPractice: data.relatedPractice || RELATED_PRACTICE_PRESETS[0],
        status: (data.status as ArticleStatus) || 'draft',
        publishedAt: data.publishedAt || null,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        author: data.author || { name: 'VocabClash Editorial Team' },
        readingTimeMinutes: data.readingTimeMinutes || estimateReadingTime(data.content || ''),
        viewsCount: data.viewsCount || 0
      });
    });

    if (articles.length === 0) {
      return [...SAMPLE_ARTICLES];
    }

    // Sort by updatedAt descending
    return articles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ARTICLES_COLLECTION);
    throw error;
  }
}

/**
 * Fetch published articles for the public /articles index
 */
export async function getPublishedArticles(category?: string, limitCount: number = 50): Promise<Article[]> {
  try {
    const articlesCol = collection(db, ARTICLES_COLLECTION);
    
    const q = query(
      articlesCol,
      where('status', '==', 'published')
    );

    const snap = await getDocs(q);
    let articles: Article[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      articles.push({
        id: docSnap.id,
        title: data.title || '',
        slug: data.slug || docSnap.id,
        excerpt: data.excerpt || '',
        content: data.content || '',
        category: (data.category as ArticleCategory) || 'general',
        tags: Array.isArray(data.tags) ? data.tags : [],
        featuredImage: data.featuredImage || { url: '', alt: '' },
        seo: data.seo || { title: data.title || '', description: data.excerpt || '' },
        relatedPractice: data.relatedPractice || RELATED_PRACTICE_PRESETS[0],
        status: 'published',
        publishedAt: data.publishedAt || data.createdAt || new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        author: data.author || { name: 'VocabClash Editorial Team' },
        readingTimeMinutes: data.readingTimeMinutes || estimateReadingTime(data.content || ''),
        viewsCount: data.viewsCount || 0
      });
    });

    // Optional category filter
    if (category && category !== 'all') {
      articles = articles.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }

    // Sort by publishedAt descending
    articles.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    // Fallback to SAMPLE_ARTICLES if Firestore has no custom articles yet
    if (articles.length === 0) {
      let samples = [...SAMPLE_ARTICLES];
      if (category && category !== 'all') {
        samples = samples.filter(a => a.category.toLowerCase() === category.toLowerCase());
      }
      return samples.slice(0, limitCount);
    }

    return articles.slice(0, limitCount);
  } catch (error) {
    console.warn('[ArticleService] getPublishedArticles encountered error, serving sample articles:', error);
    let samples = [...SAMPLE_ARTICLES];
    if (category && category !== 'all') {
      samples = samples.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    return samples.slice(0, limitCount);
  }
}

/**
 * Fetch a single article by slug
 * Resilient multi-strategy retrieval for incognito and public visitors
 */
export async function getArticleBySlug(slug: string, isAdminUser: boolean = false): Promise<Article | null> {
  if (!slug) return null;
  const cleanSlug = decodeURIComponent(slug).trim().toLowerCase();
  const effectiveIsAdmin = isAdminUser || isUserAdmin(auth.currentUser?.email);

  // Strategy 1: Check sample articles first for instant matching if in offline or incognito
  const localSample = SAMPLE_ARTICLES.find(a => 
    a.slug.toLowerCase() === cleanSlug || 
    a.id.toLowerCase() === cleanSlug
  );

  try {
    // Strategy 2: Direct document lookup by ID (fastest, most resilient)
    try {
      const directDocRef = doc(db, ARTICLES_COLLECTION, cleanSlug);
      const directDoc = await getDoc(directDocRef);
      if (directDoc.exists()) {
        const data = directDoc.data();
        if (data.status === 'published' || effectiveIsAdmin) {
          return formatArticleDoc(directDoc.id, data);
        }
      }
    } catch (directErr) {
      // Continue to query strategy
    }

    // Also check case-sensitive doc ID if different
    if (slug !== cleanSlug) {
      try {
        const directDocRefOriginal = doc(db, ARTICLES_COLLECTION, slug);
        const directDocOriginal = await getDoc(directDocRefOriginal);
        if (directDocOriginal.exists()) {
          const data = directDocOriginal.data();
          if (data.status === 'published' || effectiveIsAdmin) {
            return formatArticleDoc(directDocOriginal.id, data);
          }
        }
      } catch {}
    }

    // Strategy 3: Query by slug field in Firestore
    const articlesCol = collection(db, ARTICLES_COLLECTION);
    const q = query(
      articlesCol,
      where('slug', '==', cleanSlug)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (data.status === 'published' || effectiveIsAdmin) {
          return formatArticleDoc(docSnap.id, data);
        }
      }
    }

    // If cleanSlug didn't match, try original slug
    if (slug !== cleanSlug) {
      const qOrig = query(
        articlesCol,
        where('slug', '==', slug)
      );
      const snapOrig = await getDocs(qOrig);
      if (!snapOrig.empty) {
        for (const docSnap of snapOrig.docs) {
          const data = docSnap.data();
          if (data.status === 'published' || effectiveIsAdmin) {
            return formatArticleDoc(docSnap.id, data);
          }
        }
      }
    }

    // Strategy 4: Fallback to local sample article if found
    if (localSample && (localSample.status === 'published' || effectiveIsAdmin)) {
      return localSample;
    }

    return null;
  } catch (error) {
    console.warn(`[ArticleService] Firestore query error for slug "${slug}", falling back to sample articles:`, error);
    if (localSample && (localSample.status === 'published' || effectiveIsAdmin)) {
      return localSample;
    }
    return null;
  }
}

/**
 * Fetch article by ID
 */
export async function getArticleById(id: string): Promise<Article | null> {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return formatArticleDoc(docSnap.id, docSnap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ARTICLES_COLLECTION}/${id}`);
    return null;
  }
}

/**
 * Helper to normalize Firestore doc data into Article object
 */
function formatArticleDoc(id: string, data: any): Article {
  return {
    id,
    title: data.title || '',
    slug: data.slug || id,
    excerpt: data.excerpt || '',
    content: data.content || '',
    category: (data.category as ArticleCategory) || 'general',
    tags: Array.isArray(data.tags) ? data.tags : [],
    featuredImage: data.featuredImage || { url: '', alt: '' },
    seo: data.seo || { title: data.title || '', description: data.excerpt || '' },
    relatedPractice: data.relatedPractice || RELATED_PRACTICE_PRESETS[0],
    status: (data.status as ArticleStatus) || 'draft',
    publishedAt: data.publishedAt || null,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    author: data.author || { name: 'VocabClash Editorial Team' },
    readingTimeMinutes: data.readingTimeMinutes || estimateReadingTime(data.content || ''),
    viewsCount: data.viewsCount || 0
  };
}

/**
 * Save new or existing article
 */
export async function saveArticle(input: ArticleInput): Promise<Article> {
  const isUpdate = Boolean(input.id);
  const docId = input.id || generateSlug(input.title) || `article_${Date.now()}`;
  const now = new Date().toISOString();

  // Clean and validate slug
  const finalSlug = generateSlug(input.slug || input.title);
  const readingTime = estimateReadingTime(input.content);

  const articleData: any = {
    title: input.title.trim(),
    slug: finalSlug,
    excerpt: input.excerpt.trim(),
    content: input.content,
    category: input.category,
    tags: Array.isArray(input.tags) ? input.tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
    featuredImage: {
      url: input.featuredImage?.url || '',
      alt: input.featuredImage?.alt || input.title,
      caption: input.featuredImage?.caption || ''
    },
    seo: {
      title: input.seo?.title || input.title,
      description: input.seo?.description || input.excerpt,
      canonical: input.seo?.canonical || `https://vocabclash.in/articles/${finalSlug}`
    },
    relatedPractice: input.relatedPractice || RELATED_PRACTICE_PRESETS[0],
    status: input.status || 'draft',
    publishedAt: input.status === 'published' 
      ? (input.publishedAt || now) 
      : (input.publishedAt || null),
    updatedAt: now,
    author: {
      name: input.author?.name || 'VocabClash Editorial Team',
      email: input.author?.email || auth.currentUser?.email || 'nathchinmoy777@gmail.com',
      role: input.author?.role || 'Staff Editor'
    },
    readingTimeMinutes: readingTime
  };

  if (!isUpdate) {
    articleData.createdAt = now;
  }

  try {
    const docRef = doc(db, ARTICLES_COLLECTION, docId);
    await setDoc(docRef, articleData, { merge: true });

    return {
      id: docId,
      ...articleData,
      createdAt: articleData.createdAt || now
    };
  } catch (error) {
    handleFirestoreError(error, isUpdate ? OperationType.UPDATE : OperationType.CREATE, `${ARTICLES_COLLECTION}/${docId}`);
    throw error;
  }
}

/**
 * Publish an article
 */
export async function publishArticle(id: string): Promise<void> {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Article not found');

    const data = snap.data();
    const now = new Date().toISOString();

    await setDoc(docRef, {
      status: 'published',
      publishedAt: data.publishedAt || now,
      updatedAt: now
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ARTICLES_COLLECTION}/${id}`);
    throw error;
  }
}

/**
 * Unpublish an article (reverts to draft)
 */
export async function unpublishArticle(id: string): Promise<void> {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    const now = new Date().toISOString();

    await setDoc(docRef, {
      status: 'draft',
      updatedAt: now
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ARTICLES_COLLECTION}/${id}`);
    throw error;
  }
}

/**
 * Delete an article permanently
 */
export async function deleteArticle(id: string): Promise<void> {
  try {
    const docRef = doc(db, ARTICLES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ARTICLES_COLLECTION}/${id}`);
    throw error;
  }
}
