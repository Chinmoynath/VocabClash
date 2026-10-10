var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_oidc = require("@vercel/oidc");
var import_razorpay = __toESM(require("razorpay"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");

// server/pyqEnrichmentLogic.ts
function extractJsonArray(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  try {
    const direct = JSON.parse(trimmed);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === "object") {
      for (const val of Object.values(direct)) {
        if (Array.isArray(val)) return val;
      }
    }
  } catch {
  }
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const cleanedParsed = JSON.parse(cleaned);
    if (Array.isArray(cleanedParsed)) return cleanedParsed;
    if (cleanedParsed && typeof cleanedParsed === "object") {
      for (const val of Object.values(cleanedParsed)) {
        if (Array.isArray(val)) return val;
      }
    }
  } catch {
  }
  const firstBracket = cleaned.indexOf("[");
  if (firstBracket !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBracket; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) {
            const candidate = cleaned.slice(firstBracket, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (Array.isArray(parsed)) return parsed;
            } catch {
              try {
                const sanitized = candidate.replace(/,\s*([\]}])/g, "$1");
                const parsed = JSON.parse(sanitized);
                if (Array.isArray(parsed)) return parsed;
              } catch {
              }
            }
            break;
          }
        }
      }
    }
  }
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const arraySubstring = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const parsedSlice = JSON.parse(arraySubstring);
      if (Array.isArray(parsedSlice)) return parsedSlice;
    } catch {
    }
    try {
      const sanitized = arraySubstring.replace(/,\s*([\]}])/g, "$1");
      const sanitizedParsed = JSON.parse(sanitized);
      if (Array.isArray(sanitizedParsed)) return sanitizedParsed;
    } catch {
    }
  }
  const extractedObjects = [];
  let braceDepth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (!inStr) {
      if (ch === "{") {
        if (braceDepth === 0) objStart = i;
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0 && objStart !== -1) {
          const objCandidate = cleaned.slice(objStart, i + 1);
          try {
            const parsedObj = JSON.parse(objCandidate);
            if (parsedObj && typeof parsedObj === "object") {
              extractedObjects.push(parsedObj);
            }
          } catch {
            try {
              const sanitizedObj = objCandidate.replace(/,\s*([\]}])/g, "$1");
              const parsedObj = JSON.parse(sanitizedObj);
              if (parsedObj && typeof parsedObj === "object") {
                extractedObjects.push(parsedObj);
              }
            } catch {
            }
          }
          objStart = -1;
        }
      }
    }
  }
  if (extractedObjects.length > 0) {
    return extractedObjects;
  }
  return null;
}
var geminiQuotaCooldownUntil = 0;
function setGeminiQuotaCooldown(durationMs = 6e4) {
  geminiQuotaCooldownUntil = Math.max(geminiQuotaCooldownUntil, Date.now() + durationMs);
}
function isGeminiInQuotaCooldown() {
  return Date.now() < geminiQuotaCooldownUntil;
}
function parseRetryDelayMs(err) {
  try {
    const details = err?.error?.details || err?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d?.["@type"]?.includes("RetryInfo") && d?.retryDelay) {
          const sec = parseFloat(String(d.retryDelay).replace(/[^\d.]/g, ""));
          if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1e3) + 1e3;
        }
      }
    }
    const msg = typeof err?.message === "string" ? err.message : JSON.stringify(err);
    const retryMatch = msg.match(/retry(?:Delay| in)?[:\s]+(\d+(?:\.\d+)?)\s*s/i);
    if (retryMatch && retryMatch[1]) {
      const sec = parseFloat(retryMatch[1]);
      if (!isNaN(sec) && sec > 0) return Math.ceil(sec * 1e3) + 1e3;
    }
  } catch {
  }
  return 6e4;
}
async function processPyqEnrichmentBatch(batch, ai) {
  const safeBatch = batch.slice(0, 10);
  if (isGeminiInQuotaCooldown()) {
    const remainingSec = Math.ceil((geminiQuotaCooldownUntil - Date.now()) / 1e3);
    console.log(`[GEMINI ENRICHMENT] AI currently in quota cooldown (${remainingSec}s remaining). Using high-yield offline educational synthesis.`);
    return safeBatch.map(createFallbackOutput);
  }
  if (ai) {
    const prompt = `You are a distinguished English Faculty and Senior Vocabulary Master for Indian Govt Examinations (SSC CGL, CHSL, CPO, MTS, CDS, NDA, Banking PO).
Provide high-retention, dictionary-accurate educational enrichment for the following batch of ${safeBatch.length} competitive exam questions.

INPUT QUESTIONS:
${JSON.stringify(
      safeBatch.map((q) => ({
        tempId: q.tempId || q.id || "q_temp",
        category: q.category,
        wordOrPhrase: q.wordOrPhrase,
        question: q.question || q.wordOrPhrase,
        instruction: q.instruction || "",
        options: q.options,
        correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
        exam: q.exam || "SSC CGL",
        year: q.year || 2024,
        existingMeaning: q.meaning || q.englishMeaning || "",
        existingHindiMeaning: q.hindiMeaning || "",
        existingMnemonic: q.mnemonic || q.mnemonicHook || "",
        existingExample: q.exampleSentence || "",
        existingRoot: q.rootWordInfo || q.rootEtymology || ""
      })),
      null,
      2
    )}

STRICT EDUCATIONAL MANDATE (EVERY SINGLE QUESTION MUST BE FULLY ENRICHED):
1. NEVER leave meaning, hindiMeaning, rootWordInfo, mnemonic, exampleSentence, or optionDetails empty.
2. Word Meaning (Main target word/phrase):
   - "meaning": Format explicitly pairing the word and definition: "<targetWord> \u2013 <Accurate, concise English dictionary definition>". For synonym or antonym questions where the correct answer option has a distinctive dictionary meaning, also include it: e.g., "puritanical \u2013 having or displaying excessively strict moral or religious views. | prudish (synonym) \u2013 excessively proper or easily shocked by matters relating to modesty."
   - "hindiMeaning": Format with word name: "<targetWord>: 2 to 4 natural Hindi synonyms. / <correctOption>: Hindi meaning."
3. Root & Etymology:
   - Provide genuine Latin, Greek, French, or Sanskrit roots, prefixes, and suffixes.
   - Format example: 'Latin fastidium ("loathing, distaste")' or 'Greek panegyrikos (pan "all" + agyris "assembly")'.
4. Mnemonic Hook:
   - Must be high-retention Hinglish/visual hooks tailored for Indian aspirants (e.g., "Fast + Hideous: Jo fast khana khane walo se chidh jaye aur ultra particular ho.").
5. Example Sentence:
   - Natural, high-standard competitive examination usage sentence in quotes.
6. Exam Rationale ("explanation"):
   - 1 to 2 clear sentences explaining why the correct option is right.
7. ALL 4 Options Breakdown ("optionDetails"):
   - EXACTLY 4 items matching input options IN EXACT ORDER.
   - Every single option MUST have:
     * "option": Exact string of option.
     * "englishMeaning": Real dictionary definition of what that option actually means.
     * "hindiMeaning": Real Hindi meaning for that word.
     * "explanation": Why it is the correct answer, or why it differs as a distractor.
     * "mnemonicHook": Optional brief hook.
     * "isCorrect": true if index === correctIndex, else false.

Respond strictly with a JSON array.`;
    const modelCandidates = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    for (const modelName of modelCandidates) {
      if (isGeminiInQuotaCooldown()) break;
      let succeeded = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (isGeminiInQuotaCooldown()) break;
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          const responseText = response.text || "";
          if (responseText) {
            const parsedData = extractJsonArray(responseText);
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              succeeded = true;
              return safeBatch.map((q, qIndex) => {
                const qId = q.tempId || q.id || "q_temp";
                const match = parsedData.find((p) => p && (p.tempId === qId || p.id === qId)) || parsedData.find((p) => p && p.wordOrPhrase && q.wordOrPhrase && String(p.wordOrPhrase).toLowerCase().trim() === String(q.wordOrPhrase).toLowerCase().trim()) || (parsedData[qIndex] && typeof parsedData[qIndex] === "object" ? parsedData[qIndex] : null);
                const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : 0;
                const options = Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"];
                if (match && (match.meaning || match.englishMeaning || match.hindiMeaning)) {
                  const resolvedMeaning = match.meaning?.trim() || match.englishMeaning?.trim() || `Definition of ${q.wordOrPhrase}`;
                  const resolvedHindi = match.hindiMeaning?.trim() || `"${q.wordOrPhrase}" \u0915\u093E \u092D\u093E\u0935\u093E\u0930\u094D\u0925`;
                  let optDetails = [];
                  if (Array.isArray(match.optionDetails) && match.optionDetails.length === options.length) {
                    optDetails = options.map((opt, idx) => {
                      const od = match.optionDetails[idx] || {};
                      return {
                        option: opt,
                        englishMeaning: od.englishMeaning?.trim() || (idx === correctIdx ? resolvedMeaning : `Definition of "${opt}"`),
                        hindiMeaning: od.hindiMeaning?.trim() || (idx === correctIdx ? resolvedHindi : `\u0905\u0930\u094D\u0925: "${opt}"`),
                        explanation: od.explanation?.trim() || (idx === correctIdx ? "Correct Answer" : "Distractor"),
                        shortExplanation: od.explanation?.trim() || (idx === correctIdx ? "Correct Answer" : void 0),
                        mnemonicHook: od.mnemonicHook?.trim() || void 0,
                        isCorrect: idx === correctIdx
                      };
                    });
                  } else {
                    optDetails = options.map((opt, idx) => ({
                      option: opt,
                      englishMeaning: idx === correctIdx ? resolvedMeaning : `Meaning of "${opt}"`,
                      hindiMeaning: idx === correctIdx ? resolvedHindi : `\u0905\u0930\u094D\u0925: "${opt}"`,
                      explanation: idx === correctIdx ? "Correct Answer" : "Distractor option",
                      shortExplanation: idx === correctIdx ? "Correct Answer" : void 0,
                      isCorrect: idx === correctIdx
                    }));
                  }
                  return {
                    tempId: qId,
                    meaning: resolvedMeaning,
                    hindiMeaning: resolvedHindi,
                    rootWordInfo: match.rootWordInfo?.trim() || match.rootEtymology?.trim() || "",
                    mnemonic: match.mnemonic?.trim() || match.mnemonicHook?.trim() || "",
                    exampleSentence: match.exampleSentence?.trim() || "",
                    explanation: match.explanation?.trim() || "",
                    enrichmentWarning: match.enrichmentWarning?.trim() || void 0,
                    optionDetails: optDetails,
                    enrichment: {
                      status: "complete",
                      version: "learning-v1",
                      enrichedAt: Date.now(),
                      provider: "gemini-ai"
                    }
                  };
                }
                return createFallbackOutput(q);
              });
            }
          }
        } catch (err) {
          const isQuota = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("Quota exceeded") || err?.message?.includes("quota");
          if (isQuota) {
            const cooldownMs = Math.max(3e4, parseRetryDelayMs(err));
            setGeminiQuotaCooldown(cooldownMs);
            console.warn(`[GEMINI ENRICHMENT] Model ${modelName} reached rate/quota limit (429). Setting cooldown for ${Math.round(cooldownMs / 1e3)}s. Activating high-yield dictionary synthesis.`);
            break;
          }
          const isTransient = err?.status === 503 || err?.message?.includes("503");
          if (attempt === 1 && isTransient) {
            const delay = 1e3 + Math.floor(Math.random() * 600);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          console.warn(`[GEMINI ENRICHMENT] Model ${modelName} unavailable, falling back:`, err?.status || err?.message);
          break;
        }
      }
      if (succeeded || isGeminiInQuotaCooldown()) break;
    }
  }
  return safeBatch.map(createFallbackOutput);
}
function synthesizeOptionDetail(opt, isCorrect, targetMeaning, targetHindi, category) {
  const clean = (opt || "").trim();
  const lower = clean.toLowerCase();
  if (isCorrect) {
    return {
      englishMeaning: targetMeaning || `Accurate definition: "${clean}".`,
      hindiMeaning: targetHindi || `"${clean}" \u0915\u093E \u0938\u091F\u0940\u0915 \u0905\u0930\u094D\u0925`,
      explanation: `Correct Answer: Accurately conveys the target ${category || "vocabulary"} requirement.`
    };
  }
  let eng = "";
  let hin = "";
  if (lower.includes("wake up") || lower.includes("sleep") || lower.includes("morning")) {
    eng = `To struggle with waking up early or dealing with sleep schedules.`;
    hin = `\u0938\u0941\u092C\u0939 \u0909\u0920\u0928\u0947 \u092F\u093E \u0928\u0940\u0902\u0926 \u0938\u0947 \u091C\u0941\u0921\u093C\u0940 \u092A\u0930\u0947\u0936\u093E\u0928\u0940`;
  } else if (lower.includes("calculate") || lower.includes("math") || lower.includes("number") || lower.includes("count")) {
    eng = `Inability or difficulty in performing mathematical computation or financial counting.`;
    hin = `\u0917\u0923\u0928\u093E \u0915\u0930\u0928\u0947 \u092F\u093E \u0939\u093F\u0938\u093E\u092C \u0932\u0917\u093E\u0928\u0947 \u092E\u0947\u0902 \u0905\u0938\u092E\u0930\u094D\u0925\u0924\u093E`;
  } else if (lower.includes("stair") || lower.includes("climb") || lower.includes("walk") || lower.includes("physical")) {
    eng = `Experiencing physical exhaustion or mobility difficulty when ascending stairs or elevations.`;
    hin = `\u0938\u0940\u0922\u093C\u093F\u092F\u093E\u0902 \u091A\u0922\u093C\u0928\u0947 \u092F\u093E \u0936\u093E\u0930\u0940\u0930\u093F\u0915 \u0936\u094D\u0930\u092E \u092E\u0947\u0902 \u092A\u0930\u0947\u0936\u093E\u0928\u0940`;
  } else if (lower.includes("money") || lower.includes("poor") || lower.includes("cash") || lower.includes("wealth")) {
    eng = `Pertaining to financial assets, monetary income, or economic standing.`;
    hin = `\u0927\u0928, \u0938\u0902\u092A\u0924\u094D\u0924\u093F \u092F\u093E \u0906\u0930\u094D\u0925\u093F\u0915 \u0938\u094D\u0925\u093F\u0924\u093F \u0938\u0947 \u0938\u0902\u092C\u0902\u0927\u093F\u0924`;
  } else if (lower.includes("difficult") || lower.includes("hard") || lower.includes("trouble")) {
    eng = `Facing hardship, complexity, or arduous circumstances.`;
    hin = `\u092E\u0941\u0936\u094D\u0915\u093F\u0932 \u092F\u093E \u091C\u091F\u093F\u0932 \u092A\u0930\u093F\u0938\u094D\u0925\u093F\u0924\u093F \u0915\u093E \u0938\u093E\u092E\u0928\u093E \u0915\u0930\u0928\u093E`;
  } else if (lower.includes("happy") || lower.includes("joy") || lower.includes("glad")) {
    eng = `Expressing positive emotional state, contentment, or joy.`;
    hin = `\u0916\u0941\u0936\u0940, \u0909\u0932\u094D\u0932\u093E\u0938 \u092F\u093E \u092A\u094D\u0930\u0938\u0928\u094D\u0928\u0924\u093E \u0915\u0940 \u0905\u0935\u0938\u094D\u0925\u093E`;
  } else if (lower.includes("angry") || lower.includes("furious") || lower.includes("rage")) {
    eng = `Exhibiting strong displeasure, hostility, or intense indignation.`;
    hin = `\u0915\u094D\u0930\u094B\u0927, \u0930\u094B\u0937 \u092F\u093E \u0924\u0940\u0935\u094D\u0930 \u0917\u0941\u0938\u094D\u0938\u093E \u092A\u094D\u0930\u0915\u091F \u0915\u0930\u0928\u093E`;
  } else if (lower.includes("praise") || lower.includes("admire") || lower.includes("compliment")) {
    eng = `Expressing warm approval, admiration, or formal commendation.`;
    hin = `\u092A\u094D\u0930\u0936\u0902\u0938\u093E, \u0938\u0930\u093E\u0939\u0928\u093E \u092F\u093E \u0924\u093E\u0930\u0940\u092B \u0915\u0930\u0928\u093E`;
  } else if (lower.includes("critic") || lower.includes("blame") || lower.includes("scold")) {
    eng = `Expressing disapproval, censure, or pointing out faults severely.`;
    hin = `\u0906\u0932\u094B\u091A\u0928\u093E, \u0928\u093F\u0902\u0926\u093E \u092F\u093E \u0921\u093E\u0902\u091F-\u092B\u091F\u0915\u093E\u0930 \u0915\u0930\u0928\u093E`;
  } else if (lower.includes("secret") || lower.includes("hide") || lower.includes("conceal")) {
    eng = `Keeping information hidden from public view; confidentiality.`;
    hin = `\u0917\u0941\u092A\u094D\u0924 \u0930\u0916\u0928\u093E \u092F\u093E \u0930\u0939\u0938\u094D\u092F \u091B\u093F\u092A\u093E\u0928\u093E`;
  } else {
    eng = `Expresses the distinct concept of "${clean}".`;
    hin = `"${clean}" \u0915\u093E \u0936\u093E\u092C\u094D\u0926\u093F\u0915 \u0905\u0930\u094D\u0925`;
  }
  return {
    englishMeaning: eng,
    hindiMeaning: hin,
    explanation: `Distractor: Represents an incorrect interpretation in this context.`
  };
}
function createFallbackOutput(q) {
  const qId = q.tempId || q.id || "q_temp";
  const correctIdx = typeof q.correctIndex === "number" ? q.correctIndex : 0;
  const options = Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"];
  const correctOption = options[correctIdx] || "Option";
  const targetWord = (q.wordOrPhrase || q.question || "").trim();
  const lowerTarget = targetWord.toLowerCase();
  const lowerCorrect = correctOption.toLowerCase();
  let meaning = (q.meaning || q.englishMeaning || "").trim();
  let hindiMeaning = (q.hindiMeaning || "").trim();
  let explanation = "";
  let mnemonic = (q.mnemonic || q.mnemonicHook || "").trim();
  let rootWordInfo = (q.rootWordInfo || q.rootEtymology || "").trim();
  let example = (q.exampleSentence || "").trim();
  if (q.category === "idioms" || q.category === "idiom") {
    if (lowerTarget.includes("hard up")) {
      meaning = `Be hard up \u2013 Having very little money; experiencing severe financial difficulty or shortage of funds.`;
      hindiMeaning = `Be hard up: \u0905\u0924\u094D\u092F\u0927\u093F\u0915 \u0906\u0930\u094D\u0925\u093F\u0915 \u0924\u0902\u0917\u0940 \u092E\u0947\u0902 \u0939\u094B\u0928\u093E / \u092A\u0948\u0938\u0947 \u0915\u0940 \u092D\u093E\u0930\u0940 \u0915\u093F\u0932\u094D\u0932\u0924 \u0939\u094B\u0928\u093E / \u0915\u0902\u0917\u093E\u0932\u0940 \u0915\u0940 \u0938\u094D\u0925\u093F\u0924\u093F`;
      mnemonic = `Memory Hook: "Hard + Up" -> Jab paise khatam ho jayein aur guzara karna bohot "hard" ho jaye, to insaan "hard up" (tangi me) hota hai.`;
      example = `"After losing his job unexpectedly, he was hard up and had to curtail all unnecessary expenses."`;
      explanation = `The idiom "Be hard up" means having very little money or being in financial hardship, which precisely matches "${correctOption}".`;
      rootWordInfo = `19th-century nautical idiom: describes a ship's helm turned all the way ('hard up') to windward in severe storm distress.`;
    } else if (lowerTarget.includes("at the eleventh hour") || lowerTarget.includes("eleventh hour")) {
      meaning = `At the eleventh hour \u2013 At the very last possible moment; almost too late.`;
      hindiMeaning = `\u0905\u0902\u0924\u093F\u092E \u0915\u094D\u0937\u0923 \u092E\u0947\u0902 / \u092C\u093F\u0932\u094D\u0915\u0941\u0932 \u0906\u0916\u093F\u0930\u0940 \u0935\u0915\u094D\u0924 \u092A\u0930`;
      mnemonic = `Memory Hook: 12-hour clock me 11th hour matlab bas din khatam hone se theek pehle -> Last moment.`;
      example = `"The candidate submitted his examination application at the eleventh hour."`;
      explanation = `"At the eleventh hour" means at the last possible moment, matching "${correctOption}".`;
      rootWordInfo = `Biblical origin: from the parable of workers hired at the eleventh hour of a twelve-hour workday.`;
    } else if (lowerTarget.includes("under the weather")) {
      meaning = `Under the weather \u2013 Feeling slightly unwell, sick, or indisposed.`;
      hindiMeaning = `\u0924\u092C\u0940\u092F\u0924 \u0916\u0930\u093E\u092C \u0939\u094B\u0928\u093E / \u0905\u0938\u094D\u0935\u0938\u094D\u0925 \u092E\u0939\u0938\u0942\u0938 \u0915\u0930\u0928\u093E`;
      mnemonic = `Memory Hook: Kharab weather ke under aane se tabiyat kharab ho gayi -> Feeling sick.`;
      example = `"She stayed home from the coaching class as she was feeling under the weather."`;
      explanation = `"Under the weather" expresses feeling unwell, matching "${correctOption}".`;
      rootWordInfo = `Maritime origin: ill sailors went below deck to be sheltered 'under the weather'.`;
    } else if (lowerTarget.includes("bite the bullet")) {
      meaning = `Bite the bullet \u2013 To face a difficult or unpleasant situation with courage and fortitude.`;
      hindiMeaning = `\u0939\u093F\u092E\u094D\u092E\u0924 \u0938\u0947 \u0915\u0920\u093F\u0928 \u092A\u0930\u093F\u0938\u094D\u0925\u093F\u0924\u093F \u0915\u093E \u0938\u093E\u092E\u0928\u093E \u0915\u0930\u0928\u093E / \u092E\u091C\u092C\u0942\u0930\u0940 \u092E\u0947\u0902 \u0915\u0921\u093C\u093E \u092B\u0948\u0938\u0932\u093E \u0932\u0947\u0928\u093E`;
      mnemonic = `Memory Hook: Dard sehte waqt bullet chabana -> Painful situation ko bravery se face karna.`;
      example = `"He decided to bite the bullet and confess his mistake to the board."`;
      explanation = `"Bite the bullet" means enduring hardship courageously, matching "${correctOption}".`;
      rootWordInfo = `Military surgery origin: soldiers bit on lead bullets during battlefield surgery without anesthesia.`;
    } else {
      if (!meaning) {
        meaning = `Figurative Meaning: "${targetWord}" \u2013 ${correctOption.toLowerCase().startsWith("to ") ? correctOption : "To " + correctOption.toLowerCase()}.`;
      }
      if (!hindiMeaning) {
        hindiMeaning = `\u092E\u0941\u0939\u093E\u0935\u0930\u0947 "${targetWord}" \u0915\u093E \u092D\u093E\u0935\u093E\u0930\u094D\u0925: ${correctOption}`;
      }
      if (!explanation) {
        explanation = `The idiomatic expression "${targetWord}" is used figuratively to convey "${correctOption}".`;
      }
      if (!mnemonic) {
        mnemonic = `Memory Hook: Visualize the literal imagery of "${targetWord}" to recall its figurative sense "${correctOption}".`;
      }
      if (!example) {
        example = `"The editorial used the phrase '${targetWord}' to emphasize the urgency of administrative reforms."`;
      }
      if (!rootWordInfo) {
        rootWordInfo = `Idiomatic English expression tested frequently in SSC CGL & Govt examinations.`;
      }
    }
  } else if (q.category === "ows") {
    if (!meaning) {
      meaning = `One Word Substitution: "${correctOption}" \u2013 ${q.question || targetWord}.`;
    }
    if (!hindiMeaning) {
      hindiMeaning = `"${correctOption}": ${q.question || targetWord} \u0915\u093E \u090F\u0915 \u0936\u092C\u094D\u0926`;
    }
    if (!explanation) {
      explanation = `Option ${String.fromCharCode(65 + correctIdx)} ("${correctOption}") accurately substitutes the phrase "${q.question || targetWord}".`;
    }
    if (!mnemonic) {
      mnemonic = `Memory Hook: Break down the root/affixes of "${correctOption}" to remember this one-word definition easily.`;
    }
    if (!example) {
      example = `"In the examination paper, the phrase was accurately substituted by the term '${correctOption}'."`;
    }
    if (!rootWordInfo) {
      rootWordInfo = `Etymology: classical Greek/Latin root structure tested in competitive one-word substitution sections.`;
    }
  } else {
    if (!meaning) {
      if (q.category === "synonyms") {
        meaning = `${targetWord} \u2013 ${correctOption} (closely matching in meaning and semantic connotation).`;
      } else {
        meaning = `${targetWord} \u2013 directly contrasting in meaning with ${correctOption}.`;
      }
    }
    if (!hindiMeaning) {
      if (q.category === "synonyms") {
        hindiMeaning = `"${targetWord}": \u0938\u092E\u093E\u0928\u093E\u0930\u094D\u0925\u0940 \u0936\u092C\u094D\u0926 -> ${correctOption}`;
      } else {
        hindiMeaning = `"${targetWord}": \u0935\u093F\u0932\u094B\u092E\u093E\u0930\u094D\u0925\u0940 \u0936\u092C\u094D\u0926 -> ${correctOption}`;
      }
    }
    if (!explanation) {
      if (q.category === "synonyms") {
        explanation = `"${correctOption}" is the most precise synonym corresponding to "${targetWord}".`;
      } else {
        explanation = `"${correctOption}" is the direct antonym conveying the opposite meaning of "${targetWord}".`;
      }
    }
    if (!mnemonic) {
      mnemonic = `Memory Hook: Associate "${targetWord}" with "${correctOption}" in your daily revision notes.`;
    }
    if (!example) {
      example = `"The author used the word '${targetWord}' to emphasize the central theme of the passage."`;
    }
    if (!rootWordInfo) {
      const lower = targetWord.toLowerCase();
      if (lower.startsWith("pan")) {
        rootWordInfo = 'Greek pan- ("all, whole") -> encompassing universal scope.';
      } else if (lower.startsWith("castig") || lower.startsWith("chast")) {
        rootWordInfo = 'Latin castigare (castus "pure" + agere "to drive") -> to discipline or severely criticize.';
      } else if (lower.startsWith("bene") || lower.startsWith("bon")) {
        rootWordInfo = 'Latin bene ("well, good") -> expressing benevolence or kindness.';
      } else if (lower.startsWith("mal")) {
        rootWordInfo = 'Latin malus ("bad, evil") -> denoting harmful or hostile condition.';
      } else if (lower.startsWith("fastid")) {
        rootWordInfo = 'Latin fastidium ("loathing, distaste") -> difficult to please; excessively particular.';
      } else {
        rootWordInfo = `Linguistic root and etymology tested frequently in SSC CGL & competitive English papers.`;
      }
    }
  }
  const optionDetails = options.map((opt, idx) => {
    const isCorrect = idx === correctIdx;
    const cleanOpt = String(opt || "").trim();
    const synth = synthesizeOptionDetail(cleanOpt, isCorrect, meaning, hindiMeaning, q.category);
    return {
      option: cleanOpt,
      englishMeaning: synth.englishMeaning,
      hindiMeaning: synth.hindiMeaning,
      explanation: synth.explanation,
      shortExplanation: isCorrect ? "Correct Option" : void 0,
      mnemonicHook: void 0,
      isCorrect
    };
  });
  return {
    tempId: qId,
    meaning,
    hindiMeaning,
    rootWordInfo,
    mnemonic,
    exampleSentence: example,
    explanation,
    optionDetails,
    enrichment: {
      status: "complete",
      version: "learning-v1",
      enrichedAt: Date.now(),
      provider: "dictionary_synthesizer"
    }
  };
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
var genAIClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAIClient;
}
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
var mailTransporter = null;
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  if (smtpHost && smtpUser && smtpPass) {
    mailTransporter = import_nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    console.log(`[EMAIL SERVICE] Initialized SMTP transporter for host: ${smtpHost} as ${smtpUser}`);
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    mailTransporter = import_nodemailer.default.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    console.log(`[EMAIL SERVICE] Initialized Gmail transporter for ${process.env.GMAIL_USER}`);
  } else {
    try {
      const testAccount = await import_nodemailer.default.createTestAccount();
      mailTransporter = import_nodemailer.default.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[EMAIL SERVICE] Created development SMTP transporter (${testAccount.user})`);
    } catch (e) {
      mailTransporter = import_nodemailer.default.createTransport({
        host: "localhost",
        port: 1025,
        ignoreTLS: true
      });
    }
  }
  return mailTransporter;
}
var otpStore = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60 * 1e3);
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = otpStore.get(normalizedEmail);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < 30 * 1e3) {
      const waitSec = Math.ceil((30 * 1e3 - (now - existing.lastSentAt)) / 1e3);
      return res.status(429).json({
        error: `Please wait ${waitSec} seconds before requesting a new OTP.`
      });
    }
    const otpCode = Math.floor(1e5 + Math.random() * 9e5).toString();
    const expiresAt = now + 10 * 60 * 1e3;
    otpStore.set(normalizedEmail, {
      otp: otpCode,
      expiresAt,
      attempts: 0,
      lastSentAt: now
    });
    const senderName = "VocabClash Arena";
    const senderEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || "noreply@vocabclash.app";
    const aspirantName = name?.trim() || "Aspirant";
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VocabClash Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d0b18; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #f1f5f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 30px auto; background-color: #151224; border-radius: 16px; border: 1px solid #312e81; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <!-- Header -->
        <tr>
          <td style="padding: 28px 24px 20px; background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%); text-align: center; border-bottom: 1px solid #4338ca;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #fbbf24; margin-bottom: 4px;">
              \u26A1 VOCABCLASH ARENA
            </div>
            <div style="font-size: 12px; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
              Govt Exams Battleground \u2022 SSC \u2022 Banking \u2022 CDS \u2022 UPSC
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 32px 28px;">
            <p style="font-size: 16px; line-height: 1.5; color: #e2e8f0; margin: 0 0 16px 0;">
              Hello <strong style="color: #60a5fa;">${aspirantName}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0;">
              Thank you for registering on VocabClash! Use the official 6-digit verification code below to complete your account setup and secure your battle rank:
            </p>

            <!-- OTP Box -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
              <tr>
                <td style="background-color: #0f0d1b; border: 2px solid #f59e0b; border-radius: 12px; padding: 16px 36px; text-align: center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #fbbf24; display: block;">
                    ${otpCode}
                  </span>
                </td>
              </tr>
            </table>

            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0 0 24px 0;">
              \u23F1\uFE0F This code is valid for <strong>10 minutes</strong>.
            </p>

            <div style="background-color: #1e1b4b; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
              <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.5;">
                \u{1F512} <strong>Security Tip:</strong> Never share this OTP with anyone. VocabClash staff will never ask for your verification code.
              </p>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 24px 0 0 0;">
              If you did not request this verification, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 18px 24px; background-color: #0a0814; text-align: center; border-top: 1px solid #1e1b4b;">
            <p style="font-size: 11px; color: #64748b; margin: 0;">
              VocabClash Arena &copy; 2026. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
    try {
      const transporter = await getMailTransporter();
      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: normalizedEmail,
        subject: `Your VocabClash Verification Code: ${otpCode}`,
        text: `Hello ${aspirantName},

Your VocabClash verification code is: ${otpCode}

This code will expire in 10 minutes.

Never share this code with anyone.`,
        html: htmlContent
      });
      console.log(`[EMAIL DISPATCHED] Verification email sent to ${normalizedEmail}. MessageId: ${info.messageId}`);
      if (import_nodemailer.default.getTestMessageUrl(info)) {
        console.log(`[ETHEREAL PREVIEW URL] ${import_nodemailer.default.getTestMessageUrl(info)}`);
      }
    } catch (mailErr) {
      console.error("[EMAIL DISPATCH ERROR]", mailErr);
    }
    res.json({
      success: true,
      message: `A 6-digit verification code was sent to ${normalizedEmail}. Please check your inbox and spam folder.`,
      expiresInMinutes: 10
    });
  } catch (error) {
    console.error("Error in send-otp:", error);
    res.status(500).json({ error: "Failed to send verification email. Please try again." });
  }
});
app.post("/api/auth/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP code are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const entry = otpStore.get(normalizedEmail);
    const now = Date.now();
    if (!entry) {
      return res.status(400).json({
        error: "No OTP found for this email or it has expired. Please request a new code."
      });
    }
    if (entry.expiresAt < now) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({
        error: "Verification code has expired. Please request a new one."
      });
    }
    if (entry.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({
        error: "Too many incorrect attempts. Please request a new verification code."
      });
    }
    const providedOtp = String(otp).trim();
    if (entry.otp !== providedOtp) {
      entry.attempts += 1;
      const remaining = 5 - entry.attempts;
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining} attempt(s) remaining.`
      });
    }
    otpStore.delete(normalizedEmail);
    res.json({
      success: true,
      message: "Email successfully verified!"
    });
  } catch (error) {
    console.error("Error in verify-otp:", error);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});
function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  return new import_razorpay.default({
    key_id: keyId,
    key_secret: keySecret
  });
}
app.get("/api/payment/config", (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || null;
  res.json({
    enabled: Boolean(keyId),
    keyId: keyId || null,
    currency: "INR"
  });
});
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt, notes } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const rzp = getRazorpay();
    if (!rzp) {
      const fallbackKeyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder";
      return res.json({
        id: `order_sim_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `rec_${Date.now()}`,
        status: "created",
        isSimulation: true,
        keyId: fallbackKeyId
      });
    }
    const options = {
      amount: Math.round(amount * 100),
      // amount in paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    };
    const order = await rzp.orders.create(options);
    res.json({
      ...order,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      error: error.message || "Failed to create Razorpay order"
    });
  }
});
app.post("/api/payment/verify", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.json({
        success: true,
        message: "Payment verified in development simulation mode"
      });
    }
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Missing verification parameters" });
    }
    const generatedSignature = import_crypto.default.createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const isValid = generatedSignature === razorpay_signature;
    if (isValid) {
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, error: "Invalid payment signature" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, error: error.message || "Verification failed" });
  }
});
function toFsValueHelper(val) {
  if (val === null || val === void 0) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFsValueHelper) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== void 0) {
        fields[k] = toFsValueHelper(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}
var cachedFirebasePublicKeys = {};
var firebaseKeysExpiry = 0;
async function getFirebasePublicKeys() {
  const now = Date.now();
  if (cachedFirebasePublicKeys && firebaseKeysExpiry > now) {
    return cachedFirebasePublicKeys;
  }
  try {
    const res = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cacheControl = res.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
    cachedFirebasePublicKeys = await res.json();
    firebaseKeysExpiry = now + maxAgeSec * 1e3;
    return cachedFirebasePublicKeys;
  } catch (err) {
    console.error("[Verify] Failed to fetch Firebase public certs:", err);
    if (Object.keys(cachedFirebasePublicKeys).length > 0) {
      return cachedFirebasePublicKeys;
    }
    throw new Error("Unable to fetch Firebase authentication keys");
  }
}
async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT token");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid token encoding");
  }
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid token header algorithm or missing key ID");
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  if (payload.exp && payload.exp < nowSec) {
    throw new Error("Token expired");
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    throw new Error("Token issued in the future");
  }
  if (payload.aud !== projectId) {
    throw new Error(`Invalid audience: expected ${projectId}`);
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Invalid issuer");
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Missing token subject (UID)");
  }
  const publicKeys = await getFirebasePublicKeys();
  const cert = publicKeys[header.kid];
  if (!cert) {
    throw new Error("Unknown key identifier (kid)");
  }
  const verifier = import_crypto.default.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const isSignatureValid = verifier.verify(cert, signatureB64, "base64url");
  if (!isSignatureValid) {
    throw new Error("Cryptographic signature verification failed");
  }
  return {
    uid: payload.sub,
    email: payload.email
  };
}
var cachedServerPlayAccessToken = null;
var serverPlayTokenExpiry = 0;
async function getServerGooglePlayAccessToken(req) {
  const now = Date.now();
  if (cachedServerPlayAccessToken && serverPlayTokenExpiry > now + 6e4) {
    return cachedServerPlayAccessToken;
  }
  let vercelOidcToken = null;
  try {
    vercelOidcToken = await (0, import_oidc.getVercelOidcToken)();
  } catch {
    vercelOidcToken = req?.headers?.["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN || null;
  }
  if (!vercelOidcToken) {
    console.warn("[WIF] Missing Vercel OIDC token in x-vercel-oidc-token header or VERCEL_OIDC_TOKEN env.");
    return null;
  }
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER || "970204579955";
  const poolId = process.env.GOOGLE_WIF_POOL_ID || "vercel";
  const providerId = process.env.GOOGLE_WIF_PROVIDER_ID || "vercel";
  const saEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || "vocabclash-play-billing@tactile-world-jq6d2.iam.gserviceaccount.com";
  const stsAudience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  let federatedToken = "";
  try {
    const stsRes = await fetch("https://sts.googleapis.com/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: stsAudience,
        grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
        requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
        scope: "https://www.googleapis.com/auth/cloud-platform",
        subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
        subjectToken: vercelOidcToken
      })
    });
    if (!stsRes.ok) {
      const stsErr = await stsRes.text();
      console.error("[WIF] STS token exchange failed:", stsRes.status, stsErr);
      return null;
    }
    const stsData = await stsRes.json();
    federatedToken = stsData.access_token;
  } catch (err) {
    console.error("[WIF] STS request network exception:", err?.message || err);
    return null;
  }
  if (!federatedToken) {
    console.error("[WIF] STS response missing access_token");
    return null;
  }
  const impersonateUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(saEmail)}:generateAccessToken`;
  let googleAccessToken = "";
  let expireTimeStr = null;
  try {
    const iamRes = await fetch(impersonateUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${federatedToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scope: [
          "https://www.googleapis.com/auth/androidpublisher",
          "https://www.googleapis.com/auth/datastore"
        ]
      })
    });
    if (!iamRes.ok) {
      const iamErr = await iamRes.text();
      console.error("[WIF] IAM service account impersonation failed:", iamRes.status, iamErr);
      return null;
    }
    const iamData = await iamRes.json();
    googleAccessToken = iamData.accessToken;
    expireTimeStr = iamData.expireTime;
  } catch (err) {
    console.error("[WIF] IAM request network exception:", err?.message || err);
    return null;
  }
  if (!googleAccessToken) {
    console.error("[WIF] IAM response missing accessToken");
    return null;
  }
  cachedServerPlayAccessToken = googleAccessToken;
  serverPlayTokenExpiry = expireTimeStr ? new Date(expireTimeStr).getTime() : now + 36e5;
  return cachedServerPlayAccessToken;
}
app.post("/api/payments/google/verify", async (req, res) => {
  try {
    const projectId = "tactile-world-jq6d2";
    const databaseId = "ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3";
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "in.vocabclash.twa";
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    const authHeader = req.headers.authorization || "";
    const isBearer = authHeader.startsWith("Bearer ");
    const idToken = isBearer ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: "Unauthorized: Missing Firebase ID token in Authorization header"
      });
    }
    let verifiedCaller;
    try {
      verifiedCaller = await verifyFirebaseIdToken(idToken, projectId);
    } catch (authErr) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: `Unauthorized: ${authErr.message}`
      });
    }
    const verifiedUid = verifiedCaller.uid;
    const { purchaseToken, sku, productId, planId } = req.body || {};
    if (!purchaseToken || typeof purchaseToken !== "string" || purchaseToken.trim().length < 5) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: "Invalid or missing Google Play purchase token. Entitlement not granted."
      });
    }
    const candidateProduct = (productId || sku || "").trim();
    const serverAccessToken = await getServerGooglePlayAccessToken(req);
    if (!serverAccessToken) {
      console.warn("[Google Play] Keyless Vercel OIDC / WIF authentication could not be completed.");
      return res.status(503).json({
        success: false,
        verified: false,
        error: "Keyless Vercel OIDC / Workload Identity Federation authentication failed. Please ensure OpenID Connect is enabled in Vercel project settings."
      });
    }
    const tokenHash = import_crypto.default.createHash("sha256").update(purchaseToken).digest("hex");
    const tokenRecordUrl = `${baseUrl}/google_play_purchases/${tokenHash}`;
    try {
      const existingTokenRes = await fetch(tokenRecordUrl, {
        headers: { "Authorization": `Bearer ${serverAccessToken}` }
      });
      if (existingTokenRes.ok) {
        const tokenDoc = await existingTokenRes.json();
        const claimedBy = tokenDoc?.fields?.claimedByUid?.stringValue;
        if (claimedBy && claimedBy !== verifiedUid) {
          console.warn(`[Token Replay] Purchase token already claimed by ${claimedBy}, caller is ${verifiedUid}`);
          return res.status(409).json({
            success: false,
            verified: false,
            error: "This Google Play purchase has already been claimed by another account."
          });
        }
      }
    } catch (replayErr) {
      console.warn("[Token Replay] Check notice:", replayErr);
    }
    let verifiedProductId = candidateProduct;
    let verifiedExpiryTimeMs = null;
    let verifiedOrderId = `GPA-${Date.now()}`;
    let verifiedState = "ACTIVE";
    let isAcknowledged = false;
    if (candidateProduct !== "vocabclash_lifetime") {
      const playUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
      const playRes = await fetch(playUrl, {
        headers: { "Authorization": `Bearer ${serverAccessToken}` }
      });
      if (!playRes.ok) {
        const playErr = await playRes.text();
        console.error("[Google Play API] Subscription verification error:", playRes.status, playErr);
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Google Play API rejected purchase verification (${playRes.status})`
        });
      }
      const subData = await playRes.json();
      const state = subData.subscriptionState;
      const lineItem = subData.lineItems?.[0];
      verifiedProductId = lineItem?.productId || candidateProduct;
      isAcknowledged = subData.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
      verifiedOrderId = subData.latestOrderId || verifiedOrderId;
      const expiryTimeIso = lineItem?.expiryTime;
      if (expiryTimeIso) {
        verifiedExpiryTimeMs = new Date(expiryTimeIso).getTime();
      }
      const nowMs = Date.now();
      const isCurrentlyEntitled = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" || state === "SUBSCRIPTION_STATE_CANCELED" && verifiedExpiryTimeMs !== null && verifiedExpiryTimeMs > nowMs;
      if (!isCurrentlyEntitled) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Subscription is not currently active in Google Play (State: ${state})`
        });
      }
      verifiedState = state;
    } else {
      const playUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`;
      const playRes = await fetch(playUrl, {
        headers: { "Authorization": `Bearer ${serverAccessToken}` }
      });
      if (!playRes.ok) {
        const playErr = await playRes.text();
        console.error("[Google Play API] Productsv2 verification error:", playRes.status, playErr);
        return res.status(400).json({
          success: false,
          verified: false,
          error: `Google Play API rejected product verification (${playRes.status})`
        });
      }
      const prodData = await playRes.json();
      const purchaseState = prodData.purchaseStateContext?.purchaseState || prodData.purchaseState || "";
      if (purchaseState !== "PURCHASED" && purchaseState !== 0) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: `One-time purchase state is not complete (purchaseState: ${purchaseState || "UNKNOWN"})`
        });
      }
      const lineItems = Array.isArray(prodData.productLineItem) ? prodData.productLineItem : prodData.productLineItem ? [prodData.productLineItem] : Array.isArray(prodData.lineItems) ? prodData.lineItems : [];
      const hasLifetimeProduct = lineItems.some((item) => item.productId === "vocabclash_lifetime");
      if (!hasLifetimeProduct && prodData.productId !== "vocabclash_lifetime") {
        return res.status(400).json({
          success: false,
          verified: false,
          error: "Google Play response does not contain the vocabclash_lifetime product."
        });
      }
      verifiedProductId = "vocabclash_lifetime";
      const matchedItem = lineItems.find((item) => item.productId === "vocabclash_lifetime") || lineItems[0];
      verifiedOrderId = matchedItem?.orderId || prodData.orderId || prodData.latestOrderId || verifiedOrderId;
      isAcknowledged = prodData.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" || prodData.acknowledgementState === 1 || prodData.acknowledgementState === true;
      verifiedExpiryTimeMs = null;
      verifiedState = "PURCHASED";
    }
    const isLifetime = verifiedProductId === "vocabclash_lifetime";
    let effectivePlanId = planId || "quarterly";
    if (verifiedProductId === "vocabclash_monthly") effectivePlanId = "monthly";
    else if (verifiedProductId === "vocabclash_quarterly") effectivePlanId = "quarterly";
    else if (verifiedProductId === "vocabclash_half_yearly") effectivePlanId = "six_months";
    else if (verifiedProductId === "vocabclash_yearly") effectivePlanId = "annual";
    else if (verifiedProductId === "vocabclash_lifetime") effectivePlanId = "lifetime";
    const now = Date.now();
    const planName = isLifetime ? "Life Time" : effectivePlanId === "monthly" ? "Monthly" : effectivePlanId === "six_months" ? "6 Months" : effectivePlanId === "annual" ? "Annual" : "Quarterly";
    const renewDate = isLifetime ? "Lifetime Active" : verifiedExpiryTimeMs ? `Renews ${new Date(verifiedExpiryTimeMs).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })} at ${new Date(verifiedExpiryTimeMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Active Subscription";
    const subscriptionPayload = {
      isPremium: true,
      planId: effectivePlanId,
      planName,
      subscribedAt: now,
      renewalDate: renewDate,
      autoRenew: !isLifetime && verifiedState === "SUBSCRIPTION_STATE_ACTIVE",
      provider: "google_play",
      orderId: verifiedOrderId,
      purchaseType: isLifetime ? "one_time" : "subscription",
      expiresAt: isLifetime ? null : verifiedExpiryTimeMs,
      verifiedAt: now
    };
    const userDocUrl = `${baseUrl}/users/${verifiedUid}`;
    let userDocExists = false;
    try {
      const userDocCheckRes = await fetch(userDocUrl, {
        headers: { "Authorization": `Bearer ${serverAccessToken}` }
      });
      userDocExists = userDocCheckRes.ok;
    } catch {
      userDocExists = false;
    }
    const userWrite = userDocExists ? {
      update: {
        name: `projects/${projectId}/databases/${databaseId}/documents/users/${verifiedUid}`,
        fields: {
          subscription: toFsValueHelper(subscriptionPayload),
          updatedAt: toFsValueHelper(now)
        }
      },
      updateMask: {
        fieldPaths: ["subscription", "updatedAt"]
      }
    } : {
      update: {
        name: `projects/${projectId}/databases/${databaseId}/documents/users/${verifiedUid}`,
        fields: {
          uid: toFsValueHelper(verifiedUid),
          ...verifiedCaller.email ? { email: toFsValueHelper(verifiedCaller.email) } : {},
          subscription: toFsValueHelper(subscriptionPayload),
          updatedAt: toFsValueHelper(now)
        }
      },
      updateMask: {
        fieldPaths: ["uid", "subscription", "updatedAt", ...verifiedCaller.email ? ["email"] : []]
      }
    };
    const commitUrl = `${baseUrl}:commit`;
    const commitRes = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serverAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        writes: [
          userWrite,
          {
            update: {
              name: `projects/${projectId}/databases/${databaseId}/documents/google_play_purchases/${tokenHash}`,
              fields: {
                claimedByUid: toFsValueHelper(verifiedUid),
                productId: toFsValueHelper(verifiedProductId),
                orderId: toFsValueHelper(verifiedOrderId),
                verifiedAt: toFsValueHelper(now),
                expiresAt: toFsValueHelper(verifiedExpiryTimeMs),
                state: toFsValueHelper(verifiedState)
              }
            }
          }
        ]
      })
    });
    if (!commitRes.ok) {
      const errorText = await commitRes.text();
      console.error("[Google Play Verification] Firestore commit failed:", commitRes.status, errorText);
      return res.status(commitRes.status).json({
        success: false,
        verified: false,
        error: `Entitlement write failed (${commitRes.status}): ${errorText}`
      });
    }
    try {
      const verifyDocRes = await fetch(userDocUrl, {
        headers: { "Authorization": `Bearer ${serverAccessToken}` }
      });
      if (!verifyDocRes.ok) {
        console.error("[Google Play Verification] Entitlement users/{uid} could not be verified after commit");
        return res.status(500).json({
          success: false,
          verified: false,
          error: "Firestore entitlement could not be verified after commit."
        });
      }
      const verifyDocJson = await verifyDocRes.json();
      const confirmedSub = verifyDocJson?.fields?.subscription?.mapValue?.fields;
      if (!confirmedSub || confirmedSub?.isPremium?.booleanValue !== true) {
        console.error("[Google Play Verification] Entitlement subscription is not active in Firestore");
        return res.status(500).json({
          success: false,
          verified: false,
          error: "Firestore entitlement verification failed: subscription is not active."
        });
      }
    } catch (verifyReadErr) {
      console.error("[Google Play Verification] Post-commit user document read failed:", verifyReadErr);
      return res.status(500).json({
        success: false,
        verified: false,
        error: "Firestore entitlement could not be verified after commit."
      });
    }
    const purchaseDocUrl = `${baseUrl}/google_play_purchases/${tokenHash}`;
    try {
      const verifyPurchaseRes = await fetch(purchaseDocUrl, {
        headers: { "Authorization": `Bearer ${serverAccessToken}` }
      });
      if (!verifyPurchaseRes.ok) {
        console.error("[Google Play Verification] google_play_purchases/{tokenHash} could not be verified after commit");
        return res.status(500).json({
          success: false,
          verified: false,
          error: "Google Play token registry could not be confirmed in cloud database."
        });
      }
    } catch (verifyPurchaseErr) {
      console.error("[Google Play Verification] Post-commit token registry read failed:", verifyPurchaseErr);
      return res.status(500).json({
        success: false,
        verified: false,
        error: "Google Play token registry could not be confirmed in cloud database."
      });
    }
    res.json({
      success: true,
      verified: true,
      isAcknowledged,
      message: "Google Play purchase verified by Developer API and entitlement granted",
      subscription: subscriptionPayload
    });
  } catch (error) {
    console.error("Error during Google Play verification:", error);
    res.status(500).json({
      success: false,
      verified: false,
      error: error.message || "Google Play purchase verification failed"
    });
  }
});
var serverLobbies = /* @__PURE__ */ new Map();
var serverLiveRooms = /* @__PURE__ */ new Map();
var serverMatchmakingQueue = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [code, lobby] of serverLobbies.entries()) {
    if (lobby.expiresAt < now || lobby.status === "cancelled") {
      serverLobbies.delete(code);
    }
  }
  for (const [roomId, room] of serverLiveRooms.entries()) {
    if (room.updatedAt && now - room.updatedAt > 36e5) {
      serverLiveRooms.delete(roomId);
    }
  }
  for (const [uid, entry] of serverMatchmakingQueue.entries()) {
    if (entry.status === "cancelled" || now - entry.heartbeatAt > 12e3 || now - entry.createdAt > 2e4) {
      serverMatchmakingQueue.delete(uid);
    }
  }
}, 5e3);
app.post("/api/matchmaking/join", (req, res) => {
  try {
    const { player, category = "mixed", exam = "SSC CGL", roundCount = 10, questions = [] } = req.body;
    if (!player || !player.id) {
      return res.status(400).json({ success: false, error: "Player profile with id is required" });
    }
    const uid = player.id;
    const now = Date.now();
    let matchedCandidate = null;
    for (const [cId, candidate] of serverMatchmakingQueue.entries()) {
      if (cId !== uid && candidate.status === "waiting" && now - candidate.heartbeatAt < 12e3) {
        const matchesCategory = category === "mixed" || candidate.category === "mixed" || candidate.category === category;
        if (matchesCategory) {
          matchedCandidate = candidate;
          break;
        }
      }
    }
    if (matchedCandidate) {
      const sortedPair = [uid, matchedCandidate.uid].sort();
      const matchId = `duel_1v1_${sortedPair[0].slice(0, 6)}_${sortedPair[1].slice(0, 6)}_${Date.now()}`;
      const sharedQuestions = matchedCandidate.questions && matchedCandidate.questions.length > 0 ? matchedCandidate.questions : questions && questions.length > 0 ? questions : [];
      matchedCandidate.status = "matched";
      matchedCandidate.matchedRoomId = matchId;
      matchedCandidate.matchedOpponent = player;
      matchedCandidate.matchedQuestions = sharedQuestions;
      serverMatchmakingQueue.set(matchedCandidate.uid, matchedCandidate);
      const liveRoomData = {
        id: matchId,
        roomId: matchId,
        mode: roundCount === 10 ? "quick_duel" : "1v1_ranked",
        category,
        exam,
        roundCount,
        player1: player,
        player2: matchedCandidate.player,
        questions: sharedQuestions,
        status: "in_progress",
        scores: {
          [player.id]: 0,
          [matchedCandidate.player.id]: 0
        },
        combos: {
          [player.id]: 0,
          [matchedCandidate.player.id]: 0
        },
        answers: {
          [player.id]: [],
          [matchedCandidate.player.id]: []
        },
        completedPlayers: [],
        activeEmotes: [],
        createdAt: now,
        updatedAt: now
      };
      serverLiveRooms.set(matchId, liveRoomData);
      console.log(`[MATCHMAKING-SERVER] Instant match created: ${player.name} (${uid}) vs ${matchedCandidate.player.name} (${matchedCandidate.uid}) in room ${matchId}`);
      return res.json({
        success: true,
        matched: true,
        roomId: matchId,
        opponent: matchedCandidate.player,
        questions: sharedQuestions,
        isRealPlayer: true
      });
    }
    const myEntry = {
      uid,
      player,
      category,
      exam,
      roundCount,
      questions,
      status: "waiting",
      createdAt: now,
      heartbeatAt: now
    };
    serverMatchmakingQueue.set(uid, myEntry);
    console.log(`[MATCHMAKING-SERVER] Player entered queue: ${player.name} (${uid}). Waiting pool size: ${serverMatchmakingQueue.size}`);
    return res.json({
      success: true,
      matched: false,
      waiting: true
    });
  } catch (error) {
    console.error("Error in matchmaking join:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/matchmaking/poll", (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ success: false, error: "uid is required" });
    }
    const entry = serverMatchmakingQueue.get(uid);
    if (!entry) {
      return res.json({ success: true, matched: false, queueExpired: true });
    }
    entry.heartbeatAt = Date.now();
    serverMatchmakingQueue.set(uid, entry);
    if (entry.status === "matched" && entry.matchedRoomId && entry.matchedOpponent) {
      console.log(`[MATCHMAKING-SERVER] Poll returned match for ${uid} -> room ${entry.matchedRoomId}`);
      return res.json({
        success: true,
        matched: true,
        roomId: entry.matchedRoomId,
        opponent: entry.matchedOpponent,
        questions: entry.matchedQuestions || [],
        isRealPlayer: true
      });
    }
    return res.json({
      success: true,
      matched: false,
      status: entry.status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/matchmaking/leave", (req, res) => {
  try {
    const { uid } = req.body;
    if (uid) {
      serverMatchmakingQueue.delete(uid);
      console.log(`[MATCHMAKING-SERVER] Player ${uid} left matchmaking queue`);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/lobby/create", (req, res) => {
  try {
    const {
      code: customCode,
      roomId: customRoomId,
      host,
      category = "mixed",
      exam = "SSC_CGL",
      roundCount = 20,
      questions = []
    } = req.body;
    if (!host || !host.id) {
      return res.status(400).json({ success: false, error: "Host player profile is required" });
    }
    let code = customCode && typeof customCode === "string" ? customCode.trim().replace(/\D/g, "") : "";
    if (code.length !== 6) {
      code = Math.floor(1e5 + Math.random() * 9e5).toString();
      while (serverLobbies.has(code)) {
        code = Math.floor(1e5 + Math.random() * 9e5).toString();
      }
    }
    const roomId = customRoomId || `duel_friend_${code}_${Date.now()}`;
    const now = Date.now();
    const lobby = {
      code,
      roomId,
      host,
      category,
      exam,
      roundCount,
      status: "waiting",
      questions,
      hostReady: true,
      guestReady: false,
      createdAt: now,
      expiresAt: now + 36e5,
      // 1 hour TTL
      updatedAt: now
    };
    serverLobbies.set(code, lobby);
    console.log(`[LOBBY] Created/Registered 6-digit lobby ${code} by ${host.name} (${host.id})`);
    res.json({ success: true, code, roomId, lobby });
  } catch (error) {
    console.error("Error creating lobby:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create lobby" });
  }
});
app.post("/api/lobby/join", (req, res) => {
  try {
    const { code, guest } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, error: "6-digit room code is required" });
    }
    if (!guest || !guest.id) {
      return res.status(400).json({ success: false, error: "Guest player profile is required" });
    }
    const cleanCode = code.trim().replace(/\D/g, "");
    const lobby = serverLobbies.get(cleanCode);
    if (!lobby) {
      return res.status(404).json({ success: false, error: `Room #${cleanCode} not found on server. Please check the code with your friend.` });
    }
    if (lobby.status !== "waiting" && lobby.guest?.id !== guest.id) {
      return res.status(400).json({ success: false, error: "Lobby is already full or battle is already in progress." });
    }
    if (lobby.expiresAt < Date.now()) {
      serverLobbies.delete(cleanCode);
      return res.status(410).json({ success: false, error: "This lobby has expired. Ask your friend to create a new one." });
    }
    lobby.guest = guest;
    lobby.guestReady = true;
    lobby.status = "ready";
    lobby.updatedAt = Date.now();
    serverLobbies.set(cleanCode, lobby);
    console.log(`[LOBBY] Player ${guest.name} (${guest.id}) joined lobby ${cleanCode}`);
    res.json({ success: true, lobby });
  } catch (error) {
    console.error("Error joining lobby:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to join lobby" });
  }
});
app.get("/api/lobby/:code", (req, res) => {
  const code = (req.params.code || "").trim().replace(/\D/g, "");
  const lobby = serverLobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ success: false, error: "Lobby not found" });
  }
  res.json({ success: true, lobby });
});
app.post("/api/lobby/start", (req, res) => {
  try {
    const { code, hostId, questions } = req.body;
    const cleanCode = (code || "").trim().replace(/\D/g, "");
    const lobby = serverLobbies.get(cleanCode);
    if (!lobby) {
      return res.status(404).json({ success: false, error: "Lobby not found" });
    }
    if (lobby.host.id !== hostId) {
      return res.status(403).json({ success: false, error: "Only the host can start the duel" });
    }
    if (!lobby.guest) {
      return res.status(400).json({ success: false, error: "Waiting for friend to join before starting" });
    }
    lobby.status = "in_progress";
    if (questions && Array.isArray(questions) && questions.length > 0) {
      lobby.questions = questions;
    }
    lobby.updatedAt = Date.now();
    serverLobbies.set(cleanCode, lobby);
    const liveRoomData = {
      id: lobby.roomId,
      roomId: lobby.roomId,
      mode: "friend_lobby",
      category: lobby.category,
      exam: lobby.exam,
      roundCount: lobby.roundCount,
      player1: lobby.host,
      player2: lobby.guest,
      questions: lobby.questions || questions || [],
      status: "in_progress",
      scores: {
        [lobby.host.id]: 0,
        [lobby.guest.id]: 0
      },
      combos: {
        [lobby.host.id]: 0,
        [lobby.guest.id]: 0
      },
      answers: {
        [lobby.host.id]: [],
        [lobby.guest.id]: []
      },
      completedPlayers: [],
      activeEmotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    serverLiveRooms.set(lobby.roomId, liveRoomData);
    console.log(`[LOBBY] Match started for room ${cleanCode} (RoomId: ${lobby.roomId})`);
    res.json({ success: true, lobby, liveRoom: liveRoomData });
  } catch (error) {
    console.error("Error starting lobby:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to start match" });
  }
});
app.post("/api/match/room/sync", (req, res) => {
  try {
    const { roomId, playerId, score, combo, answerRecord, emote, isLastQuestion } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, error: "roomId is required" });
    }
    let room = serverLiveRooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        roomId,
        scores: {},
        combos: {},
        answers: {},
        completedPlayers: [],
        activeEmotes: [],
        updatedAt: Date.now()
      };
      serverLiveRooms.set(roomId, room);
    }
    if (playerId) {
      if (typeof score === "number") {
        room.scores = room.scores || {};
        room.scores[playerId] = score;
      }
      if (typeof combo === "number") {
        room.combos = room.combos || {};
        room.combos[playerId] = combo;
      }
      if (answerRecord) {
        room.answers = room.answers || {};
        room.answers[playerId] = room.answers[playerId] || [];
        const exists = room.answers[playerId].some((a) => a.questionId === answerRecord.questionId);
        if (!exists) {
          room.answers[playerId].push(answerRecord);
        }
      }
      if (isLastQuestion) {
        room.completedPlayers = room.completedPlayers || [];
        if (!room.completedPlayers.includes(playerId)) {
          room.completedPlayers.push(playerId);
        }
      }
      if (room.completedPlayers && (room.completedPlayers.length >= 2 || isLastQuestion && room.forfeitedBy)) {
        const p1Id = room.player1?.id;
        const p2Id = room.player2?.id;
        const p1Score = (p1Id ? room.scores?.[p1Id] : 0) ?? 0;
        const p2Score = (p2Id ? room.scores?.[p2Id] : 0) ?? 0;
        let winnerId = "";
        let loserId = "";
        if (room.forfeitedBy) {
          loserId = room.forfeitedBy;
          winnerId = loserId === p1Id ? p2Id || "" : p1Id || "";
        } else {
          winnerId = p1Score > p2Score ? p1Id : p2Score > p1Score ? p2Id : "draw";
          loserId = winnerId === p1Id ? p2Id : winnerId === p2Id ? p1Id : "";
        }
        room.status = "completed";
        room.finalResult = {
          winnerId,
          loserId,
          player1FinalScore: p1Score,
          player2FinalScore: p2Score,
          player1LPChange: winnerId === p1Id ? 30 : winnerId === "draw" ? 5 : -15,
          player2LPChange: winnerId === p2Id ? 30 : winnerId === "draw" ? 5 : -15,
          finalised: true
        };
      }
    }
    if (emote) {
      room.activeEmotes = room.activeEmotes || [];
      room.activeEmotes.push({
        ...emote,
        timestamp: Date.now()
      });
      room.activeEmotes = room.activeEmotes.filter((e) => Date.now() - e.timestamp < 1e4);
    }
    room.updatedAt = Date.now();
    serverLiveRooms.set(roomId, room);
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post("/api/match/room/forfeit", (req, res) => {
  try {
    const { roomId, forfeitingPlayerId } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, error: "roomId is required" });
    }
    const room = serverLiveRooms.get(roomId);
    if (room) {
      room.forfeitedBy = forfeitingPlayerId;
      const p1Id = room.player1?.id;
      const p2Id = room.player2?.id;
      const winnerId = forfeitingPlayerId === p1Id ? p2Id : p1Id;
      const p1Score = (p1Id ? room.scores?.[p1Id] : 0) ?? 0;
      const p2Score = (p2Id ? room.scores?.[p2Id] : 0) ?? 0;
      room.status = "completed";
      room.finalResult = {
        winnerId: winnerId || "",
        loserId: forfeitingPlayerId,
        player1FinalScore: p1Score,
        player2FinalScore: p2Score,
        player1LPChange: forfeitingPlayerId === p1Id ? -15 : 30,
        player2LPChange: forfeitingPlayerId === p2Id ? -15 : 30,
        finalised: true
      };
      room.updatedAt = Date.now();
      serverLiveRooms.set(roomId, room);
    }
    res.json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get("/api/match/room/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const room = serverLiveRooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: "Room not found" });
  }
  res.json({ success: true, room });
});
app.post("/api/admin/publish-questions", async (req, res) => {
  console.log("[Publish API] request_received");
  try {
    let toFsValue = function(val) {
      if (val === null || val === void 0) return { nullValue: null };
      if (typeof val === "boolean") return { booleanValue: val };
      if (typeof val === "number") {
        if (Number.isInteger(val)) return { integerValue: String(val) };
        return { doubleValue: val };
      }
      if (typeof val === "string") return { stringValue: val };
      if (Array.isArray(val)) {
        return { arrayValue: { values: val.map(toFsValue) } };
      }
      if (typeof val === "object") {
        const fields = {};
        for (const [k, v] of Object.entries(val)) {
          if (v !== void 0) {
            fields[k] = toFsValue(v);
          }
        }
        return { mapValue: { fields } };
      }
      return { stringValue: String(val) };
    };
    const authHeader = req.headers.authorization || "";
    const isBearer = authHeader.startsWith("Bearer ");
    const token = isBearer ? authHeader.slice(7).trim() : "";
    const tokenSegments = token ? token.split(".").length : 0;
    console.log(`[Publish API] authorization_present=${Boolean(authHeader)}`);
    console.log(`[Publish API] auth_scheme=${isBearer ? "Bearer" : "unknown"}`);
    console.log(`[Publish API] token_length=${token.length}`);
    console.log(`[Publish API] token_segments=${tokenSegments}`);
    if (!isBearer || !token) {
      console.warn("[Publish API] Rejected: Missing or invalid Authorization header");
      return res.status(401).json({ success: false, error: "Unauthorized: Missing admin authorization token" });
    }
    const { questions, batchMetadata } = req.body;
    console.log(`[Publish API] payload_question_count=${Array.isArray(questions) ? questions.length : 0}`);
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: "No questions provided for publishing" });
    }
    const projectId = "tactile-world-jq6d2";
    const databaseId = "ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3";
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    const commitUrl = `${baseUrl}:commit`;
    const CHUNK_SIZE = 20;
    let totalCommitted = 0;
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const writes = [];
      for (const q of chunk) {
        const docId = q.canonicalQuestionId || q.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const fields = {};
        for (const [k, v] of Object.entries(q)) {
          if (v !== void 0) {
            fields[k] = toFsValue(v);
          }
        }
        writes.push({
          update: {
            name: `projects/${projectId}/databases/${databaseId}/documents/question_bank/${docId}`,
            fields
          }
        });
      }
      console.log(`[Publish API] firestore_url=${commitUrl}`);
      console.log(`[Publish API] auth_scheme=Bearer`);
      console.log(`[Publish API] outbound_token_length=${token.length}`);
      console.log(`[Publish API] writes_count=${writes.length}`);
      console.log(`[Publish API] firestore_request_started chunk=${Math.floor(i / CHUNK_SIZE) + 1} count=${chunk.length}`);
      const commitRes = await fetch(commitUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ writes })
      });
      console.log(`[Publish API] firestore_response_status=${commitRes.status}`);
      if (!commitRes.ok) {
        const errorText = await commitRes.text();
        let errorJson = null;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
        }
        console.error(`[Publish API] firestore_request_failed HTTP ${commitRes.status}:`, errorJson?.error?.status || "UNKNOWN", errorJson?.error?.message || errorText);
        return res.status(commitRes.status).json({
          success: false,
          error: `Firestore commit error (${commitRes.status}): ${errorJson?.error?.message || errorText}`,
          publishedCount: totalCommitted
        });
      }
      console.log(`[Publish API] firestore_response_finished chunk=${Math.floor(i / CHUNK_SIZE) + 1}`);
      totalCommitted += chunk.length;
    }
    if (batchMetadata && batchMetadata.batchId) {
      try {
        const batchDocId = batchMetadata.batchId;
        const batchFields = {};
        for (const [k, v] of Object.entries(batchMetadata)) {
          if (v !== void 0) {
            batchFields[k] = toFsValue(v);
          }
        }
        await fetch(commitUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            writes: [{
              update: {
                name: `projects/${projectId}/databases/${databaseId}/documents/pyq_import_batches/${batchDocId}`,
                fields: batchFields
              }
            }]
          })
        });
      } catch (batchLogErr) {
        console.warn("[Publish API] Batch metadata log warning:", batchLogErr);
      }
    }
    return res.json({
      success: true,
      publishedCount: totalCommitted
    });
  } catch (err) {
    console.error("[Publish API] firestore_request_failed exception:", err);
    return res.status(500).json({ success: false, error: err?.message || "Server error during publish" });
  }
});
app.post("/api/admin/delete-question", async (req, res) => {
  console.log("[Delete API] request_received");
  try {
    const authHeader = req.headers.authorization || "";
    const isBearer = authHeader.startsWith("Bearer ");
    const token = isBearer ? authHeader.slice(7).trim() : "";
    if (!isBearer || !token) {
      console.warn("[Delete API] Rejected: Missing admin authorization token");
      return res.status(401).json({ success: false, error: "Unauthorized: Missing admin authorization token" });
    }
    const { questionIds, reportIds } = req.body;
    const targetQuestionIds = Array.isArray(questionIds) ? questionIds.filter(Boolean) : req.body.questionId ? [String(req.body.questionId)] : [];
    const targetReportIds = Array.isArray(reportIds) ? reportIds.filter(Boolean) : req.body.reportId ? [String(req.body.reportId)] : [];
    if (targetQuestionIds.length === 0 && targetReportIds.length === 0) {
      return res.status(400).json({ success: false, error: "No questionIds or reportIds provided for deletion" });
    }
    const projectId = "tactile-world-jq6d2";
    const databaseId = "ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3";
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    const commitUrl = `${baseUrl}:commit`;
    const writes = [];
    for (const qId of targetQuestionIds) {
      writes.push({
        delete: `projects/${projectId}/databases/${databaseId}/documents/question_bank/${qId}`
      });
    }
    for (const rId of targetReportIds) {
      writes.push({
        delete: `projects/${projectId}/databases/${databaseId}/documents/question_reports/${rId}`
      });
    }
    console.log(`[Delete API] deleting ${targetQuestionIds.length} question docs and ${targetReportIds.length} report docs via Firestore REST`);
    const commitRes = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ writes })
    });
    console.log(`[Delete API] firestore_response_status=${commitRes.status}`);
    if (!commitRes.ok) {
      const errorText = await commitRes.text();
      console.error(`[Delete API] commit failed HTTP ${commitRes.status}:`, errorText);
      return res.status(commitRes.status).json({ success: false, error: `Firestore delete error: ${errorText}` });
    }
    return res.json({
      success: true,
      deletedQuestions: targetQuestionIds.length,
      deletedReports: targetReportIds.length
    });
  } catch (err) {
    console.error("[Delete API] exception:", err);
    return res.status(500).json({ success: false, error: err?.message || "Server error during delete" });
  }
});
app.post("/api/admin/resolve-reports", async (req, res) => {
  console.log("[Resolve Reports API] request_received");
  try {
    const authHeader = req.headers.authorization || "";
    const isBearer = authHeader.startsWith("Bearer ");
    const token = isBearer ? authHeader.slice(7).trim() : "";
    if (!isBearer || !token) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing admin authorization token" });
    }
    const { reportIds, status = "resolved", resolutionNotes } = req.body;
    const targetReportIds = Array.isArray(reportIds) ? reportIds.filter(Boolean) : req.body.reportId ? [String(req.body.reportId)] : [];
    if (targetReportIds.length === 0) {
      return res.json({ success: true, resolvedCount: 0 });
    }
    const targetStatus = status === "dismissed" ? "dismissed" : "resolved";
    const now = Date.now();
    const projectId = "tactile-world-jq6d2";
    const databaseId = "ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3";
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
    const commitUrl = `${baseUrl}:commit`;
    const fieldPaths = ["status", "updatedAt", targetStatus === "resolved" ? "resolvedAt" : "dismissedAt"];
    if (resolutionNotes) {
      fieldPaths.push("resolutionNotes");
    }
    const writes = targetReportIds.map((rId) => {
      const fields = {
        status: { stringValue: targetStatus },
        updatedAt: { integerValue: String(now) }
      };
      if (targetStatus === "resolved") {
        fields.resolvedAt = { integerValue: String(now) };
      } else {
        fields.dismissedAt = { integerValue: String(now) };
      }
      if (resolutionNotes) {
        fields.resolutionNotes = { stringValue: String(resolutionNotes) };
      }
      return {
        update: {
          name: `projects/${projectId}/databases/${databaseId}/documents/question_reports/${rId}`,
          fields
        },
        updateMask: {
          fieldPaths
        }
      };
    });
    const commitRes = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ writes })
    });
    if (!commitRes.ok) {
      const errText = await commitRes.text();
      console.warn("[Resolve Reports API] Warning:", errText);
      return res.status(commitRes.status).json({ success: false, error: errText });
    }
    console.log(`[Resolve Reports API] Successfully updated ${targetReportIds.length} reports to status='${targetStatus}'`);
    return res.json({ success: true, updatedCount: targetReportIds.length, status: targetStatus });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Server error during report resolution" });
  }
});
app.post("/api/lobby/leave", (req, res) => {
  try {
    const { code, playerId } = req.body;
    const cleanCode = (code || "").trim();
    const lobby = serverLobbies.get(cleanCode);
    if (lobby) {
      if (lobby.host.id === playerId) {
        lobby.status = "cancelled";
        serverLobbies.delete(cleanCode);
      } else if (lobby.guest?.id === playerId) {
        lobby.guest = void 0;
        lobby.guestReady = false;
        lobby.status = "waiting";
        lobby.updatedAt = Date.now();
        serverLobbies.set(cleanCode, lobby);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
var handleEnrichmentRequest = async (req, res) => {
  try {
    let questionsList = [];
    if (Array.isArray(req.body.questions)) {
      questionsList = req.body.questions;
    } else if (req.body.question && typeof req.body.question === "object") {
      questionsList = [req.body.question];
    } else if (req.body.wordOrPhrase) {
      questionsList = [req.body];
    }
    if (questionsList.length === 0) {
      return res.status(400).json({ error: "Array of questions or question object is required" });
    }
    const ai = getGenAI();
    const enrichedList = await processPyqEnrichmentBatch(questionsList, ai);
    return res.json({
      success: true,
      enrichedQuestions: enrichedList,
      // For single question requests:
      enrichedQuestion: enrichedList[0] || null
    });
  } catch (error) {
    console.warn("Issue in PYQ enrichment handler:", error?.status || error?.message || error);
    res.status(500).json({ success: false, error: error?.message || "Enrichment failed" });
  }
};
app.post("/api/gemini/enrich-pyq", handleEnrichmentRequest);
app.post("/api/gemini/enrich-pyq-batch", handleEnrichmentRequest);
var handleExplainRequest = async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const wordOrPhrase = req.method === "POST" ? req.body?.wordOrPhrase : req.query?.wordOrPhrase || req.query?.word;
  const category = req.method === "POST" ? req.body?.category : req.query?.category;
  const meaning = req.method === "POST" ? req.body?.meaning : req.query?.meaning;
  const examHistory = req.method === "POST" ? req.body?.examHistory : req.query?.examHistory;
  if (!wordOrPhrase || typeof wordOrPhrase !== "string") {
    return res.status(400).json({ error: "Word or phrase is required" });
  }
  const prompt = `You are an expert English Faculty for SSC CGL, CHSL, CPO, CDS & Banking Govt examinations in India.
Analyze the following English vocabulary term for an aspirant preparing for SSC/Govt exams:
Word/Phrase: "${wordOrPhrase}"
Category: "${category || "General Vocabulary"}"
Context Meaning: "${meaning || ""}"
Past Exam Appearances: "${Array.isArray(examHistory) ? examHistory.join(", ") : examHistory || "SSC CGL"}"

Respond strictly with a JSON object in this exact schema without markdown formatting or code fences:
{
  "meaning": "clear, precise, and complete English dictionary and exam definition of the word/phrase",
  "hindiMeaning": "accurate Hindi meaning with Devanagari script and clear explanation (e.g. \u0905\u0932\u094D\u092A\u092D\u093E\u0937\u0940 / \u0915\u092E \u092C\u094B\u0932\u0928\u0947 \u0935\u093E\u0932\u093E)",
  "partOfSpeech": "part of speech (e.g. Adjective, Noun, Verb, Adverb, Idiom/Phrase)",
  "rootEtymology": "concise root word origin, Latin/Greek components and meanings in 1-2 lines",
  "mnemonicHook": "a clever, humorous, or highly effective memory trick / Hinglish trick (like how KD Campus / Neetu Singh / Jaideep Sir teach) to never forget this word",
  "examTrapTip": "common traps set by exam paper setters (e.g. confuse with similar sounding words, synonym vs antonym trap, trap risk)",
  "sampleUsage": "a crisp sentence demonstrating authentic usage in an administrative / exam context",
  "relatedWords": ["word1", "word2", "word3", "word4"]
}`;
  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: "Gemini AI API key not configured",
      aiEnrichmentAvailable: false
    });
  }
  if (isGeminiInQuotaCooldown()) {
    return res.status(429).json({
      success: false,
      status: 429,
      error: "Gemini rate limit exceeded",
      aiEnrichmentAvailable: false
    });
  }
  const modelCandidates = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  let lastErrorStatus = 500;
  let lastErrorMessage = "Gemini AI unavailable";
  for (const modelName of modelCandidates) {
    if (isGeminiInQuotaCooldown()) break;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (isGeminiInQuotaCooldown()) break;
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        const responseText = response.text || "";
        if (responseText) {
          let parsedData = null;
          try {
            parsedData = JSON.parse(responseText.trim());
          } catch {
            const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            try {
              parsedData = JSON.parse(cleaned);
            } catch {
              const firstBrace = cleaned.indexOf("{");
              const lastBrace = cleaned.lastIndexOf("}");
              if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                  parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
                } catch {
                }
              }
            }
          }
          if (parsedData && (parsedData.mnemonicHook || parsedData.rootEtymology || parsedData.meaning)) {
            return res.json({ success: true, analysis: parsedData, source: "gemini" });
          }
        }
      } catch (err) {
        const isQuota = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("Quota exceeded") || err?.message?.includes("quota");
        if (isQuota) {
          setGeminiQuotaCooldown(6e4);
          console.warn(`[GEMINI EXPLAIN] Model ${modelName} hit quota limit (429). Setting 60s cooldown.`);
          return res.status(429).json({
            success: false,
            status: 429,
            error: "Gemini rate limit exceeded",
            aiEnrichmentAvailable: false
          });
        }
        const isTransient = err?.status === 503 || err?.message?.includes("503");
        if (attempt === 1 && isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        lastErrorStatus = err?.status || 500;
        lastErrorMessage = err?.message || "Gemini error";
        console.warn(`[GEMINI EXPLAIN] Model ${modelName} unavailable (${err?.status || err?.message}), trying next candidate...`);
        break;
      }
    }
  }
  return res.status(lastErrorStatus).json({
    success: false,
    status: lastErrorStatus,
    error: lastErrorMessage,
    aiEnrichmentAvailable: false
  });
};
app.post("/api/gemini/explain", handleExplainRequest);
app.get("/api/gemini/explain", handleExplainRequest);
app.options("/api/gemini/explain", (_req, res) => {
  res.setHeader("Allow", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});
app.post("/api/gemini/mentor-insight", async (req, res) => {
  const {
    analytics,
    targetExam,
    overallAccuracy,
    weakestCategory,
    weakestCategoryAccuracy,
    strongestCategory,
    strongestCategoryAccuracy,
    mistakesCount,
    totalSolved
  } = req.body;
  const target = (analytics?.targetExam || targetExam || "SSC CGL").trim();
  const periodLabel = analytics?.periodLabel || "This Week";
  const solved = typeof analytics?.totalAttempted === "number" ? analytics.totalAttempted : totalSolved || 0;
  const correct = typeof analytics?.totalCorrect === "number" ? analytics.totalCorrect : 0;
  const overallAcc = typeof analytics?.overallAccuracy === "number" ? `${analytics.overallAccuracy}%` : overallAccuracy ? `${overallAccuracy}%` : solved > 0 ? `${Math.round(correct / solved * 100)}%` : "Not enough data";
  const weakCat = analytics?.weakestCategory || (weakestCategory ? String(weakestCategory).toLowerCase() : null);
  const strongCat = analytics?.strongestCategory || (strongestCategory ? String(strongestCategory).toLowerCase() : null);
  const weakStat = weakCat && analytics?.categoryStats?.[weakCat];
  const weakAccStr = weakStat && typeof weakStat.accuracy === "number" ? `${weakStat.accuracy}% (${weakStat.correct}/${weakStat.attempted})` : typeof weakestCategoryAccuracy === "number" ? `${weakestCategoryAccuracy}%` : "Not enough data";
  const strongStat = strongCat && analytics?.categoryStats?.[strongCat];
  const strongAccStr = strongStat && typeof strongStat.accuracy === "number" ? `${strongStat.accuracy}% (${strongStat.correct}/${strongStat.attempted})` : typeof strongestCategoryAccuracy === "number" ? `${strongestCategoryAccuracy}%` : "Not enough data";
  const mistakes = typeof analytics?.unresolvedMistakesCount === "number" ? analytics.unresolvedMistakesCount : mistakesCount || 0;
  const dueReviews = typeof analytics?.dueReviews === "number" ? analytics.dueReviews : 0;
  const repeatedWords = Array.isArray(analytics?.repeatedMistakes) ? analytics.repeatedMistakes.slice(0, 5).map((m) => `${m.wordOrPhrase} (missed ${m.wrongCount}x)`).join(", ") : "";
  const deltaStr = typeof analytics?.accuracyDeltaPp === "number" ? `${analytics.accuracyDeltaPp >= 0 ? "+" : ""}${analytics.accuracyDeltaPp} percentage points vs previous period` : "No previous period comparison available";
  let categorySummary = "";
  if (analytics?.categoryStats) {
    categorySummary = Object.entries(analytics.categoryStats).map(([cat, stat]) => {
      const acc = typeof stat.accuracy === "number" ? `${stat.accuracy}%` : "Not attempted";
      return `${cat.toUpperCase()}: ${acc} (${stat.correct || 0}/${stat.attempted || 0} correct)`;
    }).join("; ");
  }
  const prompt = `You are an elite, objective Senior English Vocabulary Mentor for Indian Competitive Exams (${target}).
Here is the student's real, deterministic performance analytics on VocabClash:
- Target Exam: ${target}
- Period: ${periodLabel}
- Questions Attempted: ${solved} (Correct: ${correct})
- Overall Accuracy: ${overallAcc}
- Accuracy Trend: ${deltaStr}
- Category Breakdown: ${categorySummary || "N/A"}
- Weakest Category: ${weakCat ? `${weakCat.toUpperCase()} at ${weakAccStr}` : "Not enough category data yet (<5 questions)"}
- Strongest Category: ${strongCat ? `${strongCat.toUpperCase()} at ${strongAccStr}` : "Not enough category data yet (<5 questions)"}
- Repeatedly Missed Words: ${repeatedWords || "None recorded"}
- Concepts Due for Spaced Repetition Review: ${dueReviews}
- Active Mistakes in Vault: ${mistakes}

STRICT GROUNDING RULES:
1. You may ONLY make claims strictly supported by the supplied analytics.
2. NEVER invent accuracy percentages, question counts, marks, exam patterns, user behavior or question statistics.
3. NEVER make unsupported claims like "examiners frequently put synonyms in Option A" or promises like "This will increase your score by 4-6 marks".
4. If a metric is "Not enough data" or "Not attempted", state that clearly rather than assuming 0% or fabricating a reason.
5. Provide a crisp, professional coaching report strictly in JSON format without markdown code blocks:
{
  "diagnosis": "2 sharp, objective sentences diagnosing their current vocabulary performance and accuracy based strictly on the provided numbers.",
  "whatImproved": "1-2 sentences highlighting positive trends or areas with solid accuracy, referencing actual figures if applicable.",
  "mainWeakness": "1-2 sentences describing their lowest-accuracy category or repeated mistakes without making ungrounded claims.",
  "whatToDoNext": ["Actionable step 1 based on weakest category or due reviews", "Actionable step 2", "Actionable step 3"],
  "encouragement": "1 crisp, uplifting competitive exam mantra (10-15 words)."
}`;
  const ai = getGenAI();
  if (ai) {
    const modelCandidates = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    for (const modelName of modelCandidates) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          const responseText = response.text || "";
          if (responseText) {
            let parsedData = null;
            try {
              parsedData = JSON.parse(responseText.trim());
            } catch {
              const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
              try {
                parsedData = JSON.parse(cleaned);
              } catch {
                const firstBrace = cleaned.indexOf("{");
                const lastBrace = cleaned.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  try {
                    parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
                  } catch {
                  }
                }
              }
            }
            if (parsedData && parsedData.diagnosis) {
              const report = {
                diagnosis: parsedData.diagnosis,
                whatImproved: parsedData.whatImproved || "Keep practicing daily to build steady vocabulary recall.",
                mainWeakness: parsedData.mainWeakness || (weakCat ? `${weakCat.toUpperCase()} is currently your lowest-scoring area.` : "Continue practicing all categories to identify specific patterns."),
                whatToDoNext: Array.isArray(parsedData.whatToDoNext) ? parsedData.whatToDoNext : ["Practice questions in your weakest category", "Clear due spaced repetition reviews", "Review repeatedly missed words"],
                encouragement: parsedData.encouragement || parsedData.motivationalQuote || "Consistent daily vocabulary practice builds long-term exam mastery.",
                // Legacy compatibility fields
                recommendedFocus: Array.isArray(parsedData.whatToDoNext) ? parsedData.whatToDoNext : ["Root words and prefixes", "High-frequency exam words", "Daily mistake vault review"],
                tacticalTip: parsedData.mainWeakness || "Analyze question context and eliminate wrong options systematically.",
                motivationalQuote: parsedData.encouragement || "Consistent daily revision separates the aspirants from the selected officers."
              };
              return res.json({ insight: report, report });
            }
          }
        } catch (err) {
          const isTransient = err?.status === 503 || err?.status === 429 || err?.message?.includes("503") || err?.message?.includes("429");
          if (attempt === 1 && isTransient) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
          console.warn(`[GEMINI MENTOR INSIGHT] Model ${modelName} unavailable, trying next candidate...`);
          break;
        }
      }
    }
  }
  const fallbackDiagnosis = weakCat && weakStat && typeof weakStat.accuracy === "number" ? `Your ${weakCat.toUpperCase()} accuracy is currently ${weakStat.accuracy}% across ${weakStat.attempted} questions, while overall accuracy is ${overallAcc}.` : solved > 0 ? `You have completed ${solved} vocabulary questions with an overall accuracy of ${overallAcc}.` : `Complete at least 20 vocabulary questions across categories to establish detailed diagnostics.`;
  const fallbackImproved = typeof analytics?.accuracyDeltaPp === "number" && analytics.accuracyDeltaPp > 0 ? `Your accuracy improved by ${analytics.accuracyDeltaPp} percentage points compared to the previous period.` : strongCat && strongStat && typeof strongStat.accuracy === "number" ? `${strongCat.toUpperCase()} is your strongest category at ${strongStat.accuracy}% accuracy (${strongStat.correct}/${strongStat.attempted} correct).` : `Daily consistent practice creates durable memory traces.`;
  const fallbackWeakness = weakCat && weakStat && typeof weakStat.accuracy === "number" ? `${weakCat.toUpperCase()} requires targeted focus (${weakStat.wrong} incorrect answers recorded).` : repeatedWords ? `Repeatedly missed words like ${repeatedWords} need focused revision.` : `More category attempts are needed to isolate specific weaknesses.`;
  const fallbackReport = {
    diagnosis: fallbackDiagnosis,
    whatImproved: fallbackImproved,
    mainWeakness: fallbackWeakness,
    whatToDoNext: [
      weakCat ? `Complete a 10-question Weak Areas Drill in ${weakCat.toUpperCase()}` : "Complete questions across all 4 categories",
      dueReviews > 0 ? `Review your ${dueReviews} due spaced repetition concepts` : "Check your Mistake Vault for unresolved words",
      "Maintain your daily practice streak to consolidate long-term retention"
    ],
    encouragement: "Consistent daily vocabulary practice builds steady long-term exam mastery.",
    // Legacy fields
    recommendedFocus: [
      "Negative prefixes: IN-, IM-, DIS-, UN-",
      "Root morphology: LOQ-, BENE-, MAL-, CHRON-",
      "Frequently repeated exam concepts"
    ],
    tacticalTip: "Verify word polarity and context before confirming your choice.",
    motivationalQuote: "Consistency in revision converts weak areas into strengths."
  };
  res.json({ insight: fallbackReport, report: fallbackReport });
});
app.get(["/sw.js", "/service-worker.js"], (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Service-Worker-Allowed", "/");
  res.send(`self.options = {
    "domain": "5gvci.com",
    "zoneId": 11591217
};
self.lary = "";
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');
`);
});
app.get("/ads.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send("google.com, pub-6402582146558440, DIRECT, f08c47fec0942fa0\n");
});
app.get("/sitemap.xml", (req, res) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>https://vocabclash.in/</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-vocabulary</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-cgl-vocabulary</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-chsl-vocabulary</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/synonyms</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/antonyms</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/one-word-substitution</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/idioms-and-phrases</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-english-pyq</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/articles</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/articles/top-50-ssc-cgl-repeated-synonyms</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/articles/how-to-score-50-in-ssc-english-vocabulary</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/privacy.html</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/terms.html</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;
  res.send(sitemapXml);
});
app.get("/robots.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/\nDisallow: /api/\nDisallow: /.well-known/\n\nSitemap: https://vocabclash.in/sitemap.xml\n");
});
var serverDailyChallengeStore = /* @__PURE__ */ new Map();
app.get("/api/daily-challenge/history", (req, res) => {
  const userId = req.query.userId || "";
  if (!userId || userId === "default_user" || userId === "guest_user") {
    return res.json({ success: true, history: [] });
  }
  const history = serverDailyChallengeStore.get(userId) || [];
  res.json({ success: true, history });
});
app.post("/api/daily-challenge/attempt", (req, res) => {
  try {
    const { userId = "", attempt } = req.body;
    if (!attempt || !attempt.date) {
      return res.status(400).json({ success: false, error: "Valid attempt data required" });
    }
    if (!userId || userId === "default_user" || userId === "guest_user") {
      return res.json({ success: true, history: [] });
    }
    const current = serverDailyChallengeStore.get(userId) || [];
    const updated = current.filter((a) => a.date !== attempt.date);
    updated.push({
      ...attempt,
      userId
    });
    updated.sort((a, b) => a.date.localeCompare(b.date));
    serverDailyChallengeStore.set(userId, updated);
    res.json({ success: true, history: updated });
  } catch (error) {
    console.error("Error saving daily challenge attempt:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to save attempt" });
  }
});
app.delete("/api/daily-challenge/history", (req, res) => {
  const userId = req.query.userId || "";
  if (userId) {
    serverDailyChallengeStore.delete(userId);
  }
  res.json({ success: true });
});
var serveAdsTxt = (req, res) => {
  const adsContent = "google.com, pub-6402582146558440, DIRECT, f08c47fec0942fa0\n";
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(adsContent);
};
app.get("/ads.txt", serveAdsTxt);
app.get("/app-ads.txt", serveAdsTxt);
var serveServiceWorker = (req, res) => {
  const swPath = import_path.default.join(process.cwd(), "public", "sw.js");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(swPath);
};
app.get("/sw.js", serveServiceWorker);
app.get("/service-worker.js", serveServiceWorker);
app.get("/.well-known/assetlinks.json", (req, res) => {
  const assetLinksPath = import_path.default.join(process.cwd(), "public", ".well-known", "assetlinks.json");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(assetLinksPath);
});
app.get("/manifest.json", (req, res) => {
  const manifestPath = import_path.default.join(process.cwd(), "public", "manifest.json");
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.sendFile(manifestPath);
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
