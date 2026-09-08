import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  // Handle allowed methods
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const wordOrPhrase = req.method === 'POST' ? req.body?.wordOrPhrase : (req.query?.wordOrPhrase || req.query?.word);
  const category = req.method === 'POST' ? req.body?.category : req.query?.category;
  const meaning = req.method === 'POST' ? req.body?.meaning : req.query?.meaning;
  const examHistory = req.method === 'POST' ? req.body?.examHistory : req.query?.examHistory;

  if (!wordOrPhrase || typeof wordOrPhrase !== 'string') {
    return res.status(400).json({ error: 'Word or phrase is required' });
  }

  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'Gemini AI API key not configured',
      aiEnrichmentAvailable: false,
    });
  }

  const prompt = `You are an expert English Faculty for SSC CGL, CHSL, CPO, CDS & Banking Govt examinations in India.
Analyze the following English vocabulary term for an aspirant preparing for SSC/Govt exams:
Word/Phrase: "${wordOrPhrase}"
Category: "${category || 'General Vocabulary'}"
Context Meaning: "${meaning || ''}"
Past Exam Appearances: "${Array.isArray(examHistory) ? examHistory.join(', ') : (examHistory || 'SSC CGL')}"

Respond strictly with a JSON object in this exact schema without markdown formatting or code fences:
{
  "meaning": "clear, precise, and complete English dictionary and exam definition of the word/phrase",
  "hindiMeaning": "accurate Hindi meaning with Devanagari script and clear explanation (e.g. अल्पभाषी / कम बोलने वाला)",
  "partOfSpeech": "part of speech (e.g. Adjective, Noun, Verb, Adverb, Idiom/Phrase)",
  "rootEtymology": "concise root word origin, Latin/Greek components and meanings in 1-2 lines",
  "mnemonicHook": "a clever, humorous, or highly effective memory trick / Hinglish trick (like how KD Campus / Neetu Singh / Jaideep Sir teach) to never forget this word",
  "examTrapTip": "common traps set by exam paper setters (e.g. confuse with similar sounding words, synonym vs antonym trap, trap risk)",
  "sampleUsage": "a crisp sentence demonstrating authentic usage in an administrative / exam context",
  "relatedWords": ["word1", "word2", "word3", "word4"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch {
      const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsedData = JSON.parse(cleaned);
      } catch {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
          } catch {}
        }
      }
    }

    if (parsedData && (parsedData.mnemonicHook || parsedData.rootEtymology || parsedData.meaning)) {
      return res.status(200).json({ success: true, analysis: parsedData, source: 'gemini' });
    } else {
      return res.status(500).json({ success: false, error: 'Empty analysis from AI model', aiEnrichmentAvailable: false });
    }
  } catch (err: any) {
    const isQuota = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
    return res.status(isQuota ? 429 : 503).json({
      success: false,
      status: isQuota ? 429 : 503,
      error: isQuota ? 'Gemini rate limit exceeded' : (err?.message || 'Gemini enrichment error'),
      aiEnrichmentAvailable: false,
    });
  }
}
