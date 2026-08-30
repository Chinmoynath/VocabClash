import { Plugin } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { processPyqEnrichmentBatch } from './pyqEnrichmentLogic';

dotenv.config();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function geminiApiPlugin(): Plugin {
  return {
    name: 'gemini-api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/gemini/')) {
          return next();
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let bodyStr = '';
        req.on('data', chunk => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const body = bodyStr ? JSON.parse(bodyStr) : {};
            const ai = getGeminiClient();

            if (req.url === '/api/gemini/explain') {
              const { wordOrPhrase, category, meaning, examHistory } = body;

              if (!ai) {
                // Fallback rich response if no API key is set
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    analysis: {
                      rootEtymology: `Root breakdown for "${wordOrPhrase}": Classic Latin/Greek origin tested repeatedly in SSC CGL & RRB exams.`,
                      mnemonicHook: `Memory Hack: Relate "${wordOrPhrase}" to a vivid daily Hindi/English visual situation.`,
                      tcsExamTip: `Frequently repeated in SSC Tier-1 & Tier-2 (appeared in ${examHistory?.join(', ') || 'multiple past papers'}). Watch out for trap close-synonym options.`,
                      sampleUsage: `The inspector used the term "${wordOrPhrase}" during the official briefing.`,
                      relatedWords: ['Cognate 1', 'Cognate 2', 'Antonym equivalent'],
                    },
                  })
                );
                return;
              }

              const prompt = `You are a master English teacher for Indian Government Competitive Exams (SSC CGL, CHSL, CPO, MTS, RRB NTPC, Banking).
Analyze the following vocabulary item:
- Word/Phrase: "${wordOrPhrase}"
- Category: ${category}
- Current Meaning: "${meaning}"
- Exam Context: ${examHistory ? examHistory.join(', ') : 'SSC CGL / Railway PYQs'}

Provide a structured, engaging, memorable breakdown with:
1. rootEtymology: Clear root word breakdown (Latin/Greek roots, prefix, suffix).
2. mnemonicHook: Super memorable Hinglish/English trick to never forget this in the exam hall.
3. tcsExamTip: Why TCS/SSC asks this repeatedly, what common confusing trap options they put in exams.
4. sampleUsage: High-standard formal sentence relevant to administration, government, or literature.
5. relatedWords: Array of 3 to 4 high-frequency synonyms/antonyms from SSC PYQs.`;

              const response = await ai.models.generateContent({
                model: 'gemini-3.7-flash',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      rootEtymology: { type: Type.STRING, description: 'Root word breakdown' },
                      mnemonicHook: { type: Type.STRING, description: 'Memorable Hinglish mnemonic' },
                      tcsExamTip: { type: Type.STRING, description: 'SSC / Railway exam trap tip' },
                      sampleUsage: { type: Type.STRING, description: 'Exemplary sentence' },
                      relatedWords: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Related exam vocabulary words',
                      },
                    },
                    required: ['rootEtymology', 'mnemonicHook', 'tcsExamTip', 'sampleUsage', 'relatedWords'],
                  },
                },
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ analysis: JSON.parse(response.text || '{}') }));
              return;
            }

            if (req.url === '/api/gemini/generate-battle') {
              const { category = 'mixed', examType = 'SSC_CGL', count = 5 } = body;

              if (!ai) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ questions: [] }));
                return;
              }

              const prompt = `Generate ${count} authentic, top-tier ${examType} level English competitive exam questions for category: ${category} (Antonyms, Synonyms, One Word Substitution, or Idioms & Phrases).
Include accurate Hindi meanings, realistic 4 options, exact correct answer index, exam repeat count, and a memory mnemonic.`;

              const response = await ai.models.generateContent({
                model: 'gemini-3.7-flash',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        category: { type: Type.STRING },
                        wordOrPhrase: { type: Type.STRING },
                        instruction: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.INTEGER },
                        meaning: { type: Type.STRING },
                        hindiMeaning: { type: Type.STRING },
                        exampleSentence: { type: Type.STRING },
                        mnemonic: { type: Type.STRING },
                        examHistory: { type: Type.ARRAY, items: { type: Type.STRING } },
                        repeatCount: { type: Type.INTEGER },
                        importanceLevel: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                      },
                      required: [
                        'id',
                        'category',
                        'wordOrPhrase',
                        'options',
                        'correctIndex',
                        'meaning',
                        'hindiMeaning',
                        'exampleSentence',
                        'mnemonic',
                        'examHistory',
                        'repeatCount',
                      ],
                    },
                  },
                },
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ questions: JSON.parse(response.text || '[]') }));
              return;
            }

            if (req.url === '/api/gemini/enrich-pyq-batch' || req.url === '/api/gemini/enrich-pyq') {
              let questionsList: any[] = [];
              if (Array.isArray(body.questions)) {
                questionsList = body.questions;
              } else if (body.question && typeof body.question === 'object') {
                questionsList = [body.question];
              } else if (body.wordOrPhrase) {
                questionsList = [body];
              }

              if (questionsList.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Array of questions is required' }));
                return;
              }

              const enrichedResults = await processPyqEnrichmentBatch(questionsList, ai);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                enrichedQuestions: enrichedResults,
                enrichedQuestion: enrichedResults[0] || null,
              }));
              return;
            }

            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
          } catch (err: unknown) {
            console.error('Gemini API Middleware Error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: (err as Error).message || 'Internal error' }));
          }
        });
      });
    },
  };
}
