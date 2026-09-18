import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { fetchPublishedQuestionBank } from '../src/services/pyqFirestoreService';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const isBadEnglish = (eng?: string) => {
  if (!eng || typeof eng !== 'string' || eng.trim().length === 0) return true;
  const l = eng.toLowerCase();
  return (
    l.includes('distractor') ||
    l.includes('distinct vocabulary concept') ||
    l.includes('distinct concept denoting') ||
    l.includes('serving as an exam') ||
    l.includes('serving as a distractor') ||
    l.includes('incorrect option') ||
    l.includes('alternative vocabulary option') ||
    l.includes('not the correct choice') ||
    l.includes('exam choice') ||
    l.includes('accurate definition corresponding to') ||
    l.includes('option explanation') ||
    l.includes('vocabulary meaning') ||
    l.includes('accurately denotes the quality')
  );
};

const isBadHindi = (hin?: string) => {
  if (!hin || typeof hin !== 'string' || hin.trim().length === 0) return true;
  return (
    hin.includes('का स्वतंत्र अर्थ') ||
    hin.includes('का सटीक भावार्थ एवं समानार्थी शब्द') ||
    hin.includes('का यथार्थ शब्दार्थ')
  );
};

async function main() {
  console.log('Fetching questions from Firestore...');
  const questions = await fetchPublishedQuestionBank();
  console.log(`Total questions in Firestore: ${questions.length}`);

  const termsNeedingDefinition = new Set<string>();

  for (const q of questions) {
    if (!Array.isArray(q.optionDetails) || q.optionDetails.length !== 4) {
      if (Array.isArray(q.options)) {
        for (const opt of q.options) {
          if (opt && typeof opt === 'string' && opt.trim()) {
            termsNeedingDefinition.add(opt.trim());
          }
        }
      }
      continue;
    }

    q.optionDetails.forEach((od: any, idx: number) => {
      const opt = od.option || q.options?.[idx] || '';
      if (!opt || typeof opt !== 'string' || !opt.trim()) return;

      if (isBadEnglish(od?.englishMeaning) || isBadHindi(od?.hindiMeaning)) {
        termsNeedingDefinition.add(opt.trim());
      }
    });
  }

  // Also ensure benchmark terms like Conscious, Aware, Cognizant, Mindful are included
  ['Conscious', 'Aware', 'Cognizant', 'Mindful'].forEach(w => termsNeedingDefinition.add(w));

  const termsList = Array.from(termsNeedingDefinition);
  console.log(`Total unique option terms to define: ${termsList.length}`);

  // Check if cache file already exists
  const cachePath = path.join(process.cwd(), 'option_definitions_cache.json');
  let cache: Record<string, { english: string; hindi: string }> = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      console.log(`Loaded ${Object.keys(cache).length} cached definitions.`);
    } catch {}
  }

  const termsToFetch = termsList.filter(t => !cache[t.toLowerCase()]);
  console.log(`Terms remaining to fetch from Gemini: ${termsToFetch.length}`);

  const BATCH_SIZE = 35;
  for (let i = 0; i < termsToFetch.length; i += BATCH_SIZE) {
    const chunk = termsToFetch.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(termsToFetch.length / BATCH_SIZE)} (${chunk.length} words)...`);

    const prompt = `You are a standard English dictionary and bilingual lexicographer.
Provide concise, accurate dictionary-style definitions for the following vocabulary words or short phrases.

STRICT GUIDELINES:
1. For each word/phrase, define the word itself objectively in clean dictionary style.
2. DO NOT mention whether it is correct or incorrect, exam, distractor, choice, question, or option.
3. englishMeaning: Objective dictionary definition (8-16 words).
4. hindiMeaning: Concise, authentic Hindi meaning(s) separated by ' / '.
5. Return strictly a JSON array of objects with keys: "word", "englishMeaning", "hindiMeaning".

Terms to define:
${JSON.stringify(chunk, null, 2)}`;

    let attempts = 0;
    let success = false;
    while (attempts < 3 && !success) {
      attempts++;
      try {
        const res = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        const text = res.text?.trim() || '';
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.word && item.englishMeaning) {
              const eng = String(item.englishMeaning).trim();
              const hin = String(item.hindiMeaning || '').trim();
              // Verify no distractor language leaked in
              if (!eng.toLowerCase().includes('distractor') && !eng.toLowerCase().includes('option')) {
                cache[item.word.toLowerCase()] = {
                  english: eng,
                  hindi: hin,
                };
              }
            }
          }
          success = true;
        }
      } catch (err: any) {
        console.warn(`Batch attempt ${attempts} failed: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Incremental save
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`Finished dictionary generation! Total entries in cache: ${Object.keys(cache).length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
