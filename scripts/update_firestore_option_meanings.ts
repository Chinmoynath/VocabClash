import fs from 'fs';
import path from 'path';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/services/firebaseService';
import { sanitizeForFirestore, fetchPublishedQuestionBank } from '../src/services/pyqFirestoreService';
import { QuestionOptionDetail } from '../src/types';

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

// Clean punctuation and spacing for lookup
function normalizeLookupKey(term: string): string {
  return term.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').trim();
}

async function main() {
  const cachePath = path.join(process.cwd(), 'option_definitions_cache.json');
  if (!fs.existsSync(cachePath)) {
    console.error('Error: option_definitions_cache.json not found!');
    process.exit(1);
  }

  const dictionary: Record<string, { english: string; hindi: string }> = JSON.parse(
    fs.readFileSync(cachePath, 'utf-8')
  );
  console.log(`Loaded dictionary with ${Object.keys(dictionary).length} entries.`);

  console.log('Fetching all questions from Firestore question_bank...');
  const questions = await fetchPublishedQuestionBank();
  console.log(`Fetched ${questions.length} questions from Firestore.`);

  let totalQuestionsChecked = questions.length;
  let totalOptionsChecked = 0;
  let totalGoodOptionMeaningsPreserved = 0;
  let totalOptionMeaningsFixed = 0;
  let totalUnresolved = 0;
  let questionsToUpdate: { id: string; optionDetails: QuestionOptionDetail[] }[] = [];

  for (const q of questions) {
    const options = Array.isArray(q.options) ? q.options : [];
    const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;

    let updatedOptionDetails: QuestionOptionDetail[] = [];
    let questionModified = false;

    if (!Array.isArray(q.optionDetails) || q.optionDetails.length !== 4) {
      // Missing optionDetails: create real dictionary-backed optionDetails
      questionModified = true;
      updatedOptionDetails = options.slice(0, 4).map((opt, idx) => {
        totalOptionsChecked++;
        const rawOpt = String(opt || '').trim();
        const normKey = normalizeLookupKey(rawOpt);
        const lowerKey = rawOpt.toLowerCase();

        const dictEntry = dictionary[lowerKey] || dictionary[normKey];
        if (dictEntry && dictEntry.english) {
          totalOptionMeaningsFixed++;
          return {
            option: rawOpt,
            englishMeaning: dictEntry.english,
            hindiMeaning: dictEntry.hindi || '',
            isCorrect: idx === correctIndex,
          };
        } else {
          totalUnresolved++;
          return {
            option: rawOpt,
            englishMeaning: '',
            hindiMeaning: '',
            isCorrect: idx === correctIndex,
          };
        }
      });
    } else {
      // Existing optionDetails: preserve good meanings, fix bad ones
      updatedOptionDetails = q.optionDetails.map((od: any, idx: number) => {
        totalOptionsChecked++;
        const rawOpt = String(od?.option || options[idx] || '').trim();
        const normKey = normalizeLookupKey(rawOpt);
        const lowerKey = rawOpt.toLowerCase();

        const currentEng = typeof od?.englishMeaning === 'string' ? od.englishMeaning.trim() : '';
        const currentHin = typeof od?.hindiMeaning === 'string' ? od.hindiMeaning.trim() : '';

        const engIsBad = isBadEnglish(currentEng);
        const hinIsBad = isBadHindi(currentHin);

        let finalEng = currentEng;
        let finalHin = currentHin;

        if (engIsBad || hinIsBad) {
          questionModified = true;
          const dictEntry = dictionary[lowerKey] || dictionary[normKey];
          if (dictEntry) {
            if (engIsBad) {
              finalEng = dictEntry.english || '';
            }
            if (hinIsBad) {
              finalHin = dictEntry.hindi || '';
            }
            totalOptionMeaningsFixed++;
          } else {
            // Unresolved: leave empty per instructions
            if (engIsBad) finalEng = '';
            if (hinIsBad) finalHin = '';
            totalUnresolved++;
          }
        } else {
          totalGoodOptionMeaningsPreserved++;
        }

        const resDetail: QuestionOptionDetail = {
          option: rawOpt,
          englishMeaning: finalEng,
          hindiMeaning: finalHin,
          isCorrect: typeof od?.isCorrect === 'boolean' ? od.isCorrect : (idx === correctIndex),
        };

        if (od?.explanation !== undefined) resDetail.explanation = od.explanation;
        if (od?.shortExplanation !== undefined) resDetail.shortExplanation = od.shortExplanation;
        if (od?.mnemonicHook !== undefined) resDetail.mnemonicHook = od.mnemonicHook;

        return resDetail;
      });
    }

    if (questionModified) {
      questionsToUpdate.push({
        id: q.id,
        optionDetails: updatedOptionDetails,
      });
    }
  }

  console.log('--- PRE-UPDATE AUDIT ---');
  console.log(`Total questions checked: ${totalQuestionsChecked}`);
  console.log(`Total options checked: ${totalOptionsChecked}`);
  console.log(`Total good option meanings preserved: ${totalGoodOptionMeaningsPreserved}`);
  console.log(`Total option meanings fixed: ${totalOptionMeaningsFixed}`);
  console.log(`Total unresolved (left empty): ${totalUnresolved}`);
  console.log(`Total questions requiring Firestore update: ${questionsToUpdate.length}`);

  // Safe batch execution: 15 documents per batch, 200ms delay between batches
  console.log(`\nBeginning Firestore safe-batch update of ${questionsToUpdate.length} documents...`);
  const BATCH_SIZE = 15;
  let updatedCount = 0;

  for (let i = 0; i < questionsToUpdate.length; i += BATCH_SIZE) {
    const chunk = questionsToUpdate.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      chunk.map(async item => {
        const docRef = doc(db, 'question_bank', item.id);
        const sanitizedDetails = sanitizeForFirestore(item.optionDetails);
        await updateDoc(docRef, {
          optionDetails: sanitizedDetails,
        });
      })
    );

    updatedCount += chunk.length;
    console.log(`Progress: ${updatedCount} / ${questionsToUpdate.length} questions updated in Firestore...`);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nFirestore update completed successfully!');
}

main().catch(err => {
  console.error('Fatal error during Firestore update:', err);
  process.exit(1);
});
