// Free Dictionary API Service
// Provides real definitions, parts of speech, examples, synonyms, and phonetics
// from the public Free Dictionary API (https://api.dictionaryapi.dev/api/v2/entries/en/{word})
// No API key required, with safe timeouts and structured parsing.

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
  sourceUrl?: string;
}

interface RawDefinition {
  definition: string;
  synonyms?: string[];
  antonyms?: string[];
  example?: string;
}

interface RawMeaning {
  partOfSpeech: string;
  definitions: RawDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface RawPhonetic {
  text?: string;
  audio?: string;
}

interface RawDictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics?: RawPhonetic[];
  meanings?: RawMeaning[];
  sourceUrls?: string[];
}

/**
 * Fetches real dictionary data from the Free Dictionary API.
 * Returns null if the word was not found or if the service is unreachable.
 */
export async function fetchFreeDictionaryEntry(word: string): Promise<DictionaryEntry | null> {
  const cleanWord = word.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleanWord) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      // 404 means word not found in the dictionary
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const entry: RawDictionaryResponse = data[0];
    const meanings = entry.meanings || [];
    if (meanings.length === 0) {
      return null;
    }

    // Determine phonetic text
    let phonetic = entry.phonetic;
    if (!phonetic && entry.phonetics && entry.phonetics.length > 0) {
      const pWithText = entry.phonetics.find(p => p.text && p.text.trim().length > 0);
      if (pWithText) phonetic = pWithText.text;
    }

    // Extract primary definition and part of speech
    const primaryMeaning = meanings[0];
    const partOfSpeech = primaryMeaning.partOfSpeech || 'Noun';
    
    // Find first valid definition
    let definition = '';
    let example: string | undefined;

    for (const m of meanings) {
      for (const d of m.definitions || []) {
        if (!definition && d.definition) {
          definition = d.definition;
        }
        if (!example && d.example) {
          example = d.example;
        }
        if (definition && example) break;
      }
      if (definition && example) break;
    }

    if (!definition && primaryMeaning.definitions?.[0]?.definition) {
      definition = primaryMeaning.definitions[0].definition;
    }

    if (!definition) {
      return null;
    }

    // Aggregate synonyms and antonyms across meanings
    const synonymsSet = new Set<string>();
    const antonymsSet = new Set<string>();

    for (const m of meanings) {
      (m.synonyms || []).forEach(s => { if (s && s.toLowerCase() !== cleanWord) synonymsSet.add(s); });
      (m.antonyms || []).forEach(a => { if (a && a.toLowerCase() !== cleanWord) antonymsSet.add(a); });
      for (const d of m.definitions || []) {
        (d.synonyms || []).forEach(s => { if (s && s.toLowerCase() !== cleanWord) synonymsSet.add(s); });
        (d.antonyms || []).forEach(a => { if (a && a.toLowerCase() !== cleanWord) antonymsSet.add(a); });
      }
    }

    return {
      word: entry.word || cleanWord,
      phonetic: phonetic || undefined,
      partOfSpeech: partOfSpeech.charAt(0).toUpperCase() + partOfSpeech.slice(1),
      definition,
      example,
      synonyms: Array.from(synonymsSet).slice(0, 6),
      antonyms: Array.from(antonymsSet).slice(0, 6),
      sourceUrl: entry.sourceUrls?.[0],
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[Free Dictionary] Timeout looking up "${cleanWord}"`);
    } else {
      console.warn(`[Free Dictionary] Error looking up "${cleanWord}":`, err?.message || err);
    }
    return null;
  }
}
