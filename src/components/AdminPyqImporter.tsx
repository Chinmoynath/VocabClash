import React, { useState, useEffect } from 'react';
import { 
  FileCode, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Edit3, 
  Check, 
  Layers, 
  Database,
  Shield,
  RefreshCw,
  EyeOff,
  CloudUpload,
  Sparkles,
  Info,
  CheckCheck,
  Activity,
  PlayCircle,
  Eye,
  Sliders,
  Award,
  Download,
  BookOpen,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Wand2,
  Search,
  Filter,
  Calendar,
  Tag,
  Tv,
  FileText
} from 'lucide-react';
import { ADS_ENABLED, ADSENSE_CLIENT_ID, ADSENSE_BANNER_SLOT, ADSENSE_INTERSTITIAL_SLOT } from '../services/adSenseService';
import { ExtractedQuestion, ImportBatch, ReviewStatus } from '../types/pyqImport';
import { parseAndValidatePyqJSON, SkippedQuestionItem, extractJsonMetadata, formatExamTag, normalizeExamDate } from '../services/jsonPyqParser';
import { questionBankEngine } from '../services/questionBankEngine';
import { publishApprovedQuestionsToFirestore, deduplicateAndMigrateQuestionBank, isUserAdmin, ADMIN_EMAIL } from '../services/pyqFirestoreService';
import { 
  enrichQuestionBatch, 
  enrichSingleQuestion, 
  enrichFirestoreQuestions, 
  backfillQuestionBankEnrichment,
  needsEnrichment,
  isFallbackEnrichment
} from '../services/pyqEnrichmentService';
import { Question, QuestionCategory, ExamAppearance } from '../types';
import { resolveQuestionMeaningsBreakdown } from '../utils/questionEducationResolver';
import { EXAMS_BY_FAMILY, EXAM_STAGE_OPTIONS, getStageOptionsForExam, normalizeTier } from '../config/examMetadataConfig';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';
import {
  computeQuestionFingerprint,
  computeQuestionIdentityKey,
  generateCanonicalQuestionId,
  computeImportanceLevel,
  computeRepeatCount,
  formatRepeatCount,
  mergeAppearances,
  sortAppearances,
} from '../utils/questionFingerprint';

interface AdminPyqImporterProps {
  userEmail?: string | null;
  onClose: () => void;
  onOpenArticles?: () => void;
}

export const AdminPyqImporter: React.FC<AdminPyqImporterProps> = ({ userEmail, onClose, onOpenArticles }) => {
  const isAdmin = isUserAdmin(userEmail) || (typeof window !== 'undefined' && window.location.hostname === 'localhost');

  // Navigation mode
  const [adminView, setAdminView] = useState<'importer' | 'health' | 'explorer' | 'simulation'>('health');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState<string>('');
  const [useTextInput, setUseTextInput] = useState<boolean>(false);

  const [metadata, setMetadata] = useState<{
    examFamily: string;
    exam: string;
    year: number;
    tier: string;
    shift: string;
    examDate: string;
    paper: string;
  }>({
    examFamily: 'SSC',
    exam: 'SSC CGL',
    year: 2024,
    tier: '',
    shift: '',
    examDate: '',
    paper: 'English Comprehension'
  });

  const [isCustomTier, setIsCustomTier] = useState<boolean>(false);
  const [modalCustomTier, setModalCustomTier] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [enrichingSingleId, setEnrichingSingleId] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ processed: number; total: number; stage: string } | null>(null);
  const [isBackfilling, setIsBackfilling] = useState<boolean>(false);
  const [backfillProgress, setBackfillProgress] = useState<{ processed: number; total: number; updated: number; currentExam?: string } | null>(null);
  const [backfillSummary, setBackfillSummary] = useState<{ totalChecked: number; totalUpdated: number; durationMs: number } | null>(null);

  // Deduplication migration state
  const [isDeduplicating, setIsDeduplicating] = useState<boolean>(false);
  const [deduplicationProgress, setDeduplicationProgress] = useState<{ processed: number; total: number; stage: string } | null>(null);
  const [deduplicationSummary, setDeduplicationSummary] = useState<{
    originalCount: number;
    canonicalCount: number;
    mergedCount: number;
    conflictCount: number;
  } | null>(null);

  const [expandedOptionDetails, setExpandedOptionDetails] = useState<Record<string, boolean>>({});

  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [skippedItems, setSkippedItems] = useState<SkippedQuestionItem[]>([]);
  const [currentBatch, setCurrentBatch] = useState<ImportBatch | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'eligible' | 'skipped'>('eligible');
  const [editingQuestion, setEditingQuestion] = useState<ExtractedQuestion | null>(null);
  const [importSummary, setImportSummary] = useState<{
    totalInput: number;
    eligibleCount: number;
    skippedCount: number;
    publishedCount: number;
    mergedCount: number;
    rejectedCount: number;
    totalApproved?: number;
    addedCount?: number;
    isQuotaExhausted?: boolean;
    isCloudSynced?: boolean;
    exportQuestions?: Question[];
    batchInfo?: ImportBatch;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Health Diagnostics State
  const [healthData, setHealthData] = useState(() => questionBankEngine.getCloudVsRuntimeCounts());
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [previewCat, setPreviewCat] = useState<QuestionCategory>('synonyms');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(() => questionBankEngine.getPreviewQuestion('synonyms'));

  // Cloud Exam & Year Explorer State
  const [explorerQuestions, setExplorerQuestions] = useState<Question[]>(() => questionBankEngine.getImportedQuestions());
  const [explorerExam, setExplorerExam] = useState<string>('ALL');
  const [explorerYear, setExplorerYear] = useState<string>('ALL');
  const [explorerTier, setExplorerTier] = useState<string>('ALL');
  const [explorerCategory, setExplorerCategory] = useState<string>('ALL');
  const [explorerSearch, setExplorerSearch] = useState<string>('');
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Simulation State
  const [simulationResult, setSimulationResult] = useState<ReturnType<typeof questionBankEngine.runRepetitionSimulation> | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    setHealthData(questionBankEngine.getCloudVsRuntimeCounts());
    setExplorerQuestions(questionBankEngine.getImportedQuestions());
  }, [adminView, importSummary]);

  // Security guard for non-admin visitors
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Administrator Access Restricted</h2>
          <p className="text-sm text-slate-400">
            This private ingestion portal is restricted to authorized VocabClash administrative accounts ({ADMIN_EMAIL}).
          </p>
          <div className="text-xs text-slate-500 font-mono">Current Identity: {userEmail || 'Guest'}</div>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition"
          >
            Return to Arena
          </button>
        </div>
      </div>
    );
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
      try {
        const text = await file.text();
        const detected = extractJsonMetadata(text);
        if (detected) {
          setMetadata(prev => {
            const familyKey = detected.examFamily && (detected.examFamily in EXAMS_BY_FAMILY || detected.examFamily === 'State')
              ? (detected.examFamily === 'State Govt' ? 'State' : detected.examFamily)
              : prev.examFamily;
            const availableExams = EXAMS_BY_FAMILY[familyKey] || EXAMS_BY_FAMILY.SSC;
            const newExam = detected.exam || (availableExams.includes(prev.exam) ? prev.exam : availableExams[0]);
            const resolvedTier = detected.tier !== undefined ? normalizeTier(detected.tier) : prev.tier;
            const stageOptions = getStageOptionsForExam(newExam);
            setIsCustomTier(Boolean(resolvedTier && !stageOptions.includes(resolvedTier)));

            return {
              ...prev,
              examFamily: familyKey,
              exam: newExam,
              year: detected.year || prev.year,
              shift: detected.shift !== undefined && detected.shift !== null ? detected.shift : prev.shift,
              examDate: detected.examDate || prev.examDate,
              tier: resolvedTier,
              paper: detected.paper || prev.paper,
            };
          });
        }
      } catch {
        // file reading fallback
      }
    }
  };

  const handleJsonTextChange = (text: string) => {
    setJsonText(text);
    setErrorMessage(null);
    if (text.trim().startsWith('{')) {
      const detected = extractJsonMetadata(text);
      if (detected) {
        setMetadata(prev => {
          const familyKey = detected.examFamily && (detected.examFamily in EXAMS_BY_FAMILY || detected.examFamily === 'State')
            ? (detected.examFamily === 'State Govt' ? 'State' : detected.examFamily)
            : prev.examFamily;
          const availableExams = EXAMS_BY_FAMILY[familyKey] || EXAMS_BY_FAMILY.SSC;
          const newExam = detected.exam || (availableExams.includes(prev.exam) ? prev.exam : availableExams[0]);
          const resolvedTier = detected.tier !== undefined ? normalizeTier(detected.tier) : prev.tier;
          const stageOptions = getStageOptionsForExam(newExam);
          setIsCustomTier(Boolean(resolvedTier && !stageOptions.includes(resolvedTier)));

          return {
            ...prev,
            examFamily: familyKey,
            exam: newExam,
            year: detected.year || prev.year,
            shift: detected.shift !== undefined && detected.shift !== null ? detected.shift : prev.shift,
            examDate: detected.examDate || prev.examDate,
            tier: resolvedTier,
            paper: detected.paper || prev.paper,
          };
        });
      }
    }
  };

  const handleExamFamilyChange = (newFamily: string) => {
    const availableExams = EXAMS_BY_FAMILY[newFamily] || EXAMS_BY_FAMILY.SSC;
    const newExam = availableExams.includes(metadata.exam) ? metadata.exam : (availableExams[0] || 'SSC CGL');
    const stageOptions = getStageOptionsForExam(newExam);
    const tierStillValid = stageOptions.includes(metadata.tier);
    if (!tierStillValid) {
      setIsCustomTier(false);
    }
    setMetadata(prev => ({
      ...prev,
      examFamily: newFamily,
      exam: newExam,
      tier: tierStillValid ? prev.tier : '',
    }));
  };

  const handleExamChange = (newExam: string) => {
    const stageOptions = getStageOptionsForExam(newExam);
    const tierStillValid = stageOptions.includes(metadata.tier);
    if (!tierStillValid) {
      setIsCustomTier(false);
    }
    setMetadata(prev => ({
      ...prev,
      exam: newExam,
      tier: tierStillValid ? prev.tier : '',
    }));
  };

  const handleEnrichBatch = async (questionsToEnrich?: ExtractedQuestion[], force: boolean = false) => {
    const list = questionsToEnrich || extractedQuestions;
    if (list.length === 0) return;

    setIsEnriching(true);
    setErrorMessage(null);
    setEnrichProgress({ processed: 0, total: list.length, stage: 'Connecting to Gemini AI for Hindi meanings, Mnemonics & Option Explanations...' });

    try {
      const { enrichedQuestions } = await enrichQuestionBatch(
        list,
        (progress) => {
          setEnrichProgress({ processed: progress.current, total: progress.total, stage: progress.stage });
        },
        force
      );
      setExtractedQuestions(enrichedQuestions);
    } catch (err: any) {
      setErrorMessage(`Enrichment notice: ${err?.message || 'Fallback generated for questions.'}`);
    } finally {
      setIsEnriching(false);
      setEnrichProgress(null);
    }
  };

  const handleEnrichSingle = async (tempId: string) => {
    const target = extractedQuestions.find(q => q.tempId === tempId);
    if (!target) return;

    try {
      setEnrichingSingleId(tempId);
      const enriched = await enrichSingleQuestion(target, true);
      setExtractedQuestions(prev => prev.map(q => q.tempId === tempId ? { ...enriched, reviewStatus: q.reviewStatus } : q));
    } catch (err: any) {
      setErrorMessage(`Single question enrichment error: ${err?.message}`);
    } finally {
      setEnrichingSingleId(null);
    }
  };

  const handleRunBackfill = async () => {
    setIsBackfilling(true);
    setErrorMessage(null);
    setBackfillSummary(null);

    try {
      const result = await backfillQuestionBankEnrichment((prog) => {
        setBackfillProgress({
          processed: prog.current,
          total: prog.total,
          updated: prog.updated,
          currentExam: prog.stage,
        });
      });

      setBackfillSummary({
        totalChecked: result.totalChecked,
        totalUpdated: result.totalUpdated,
        durationMs: result.durationMs,
      });

      // Refresh runtime cache
      await questionBankEngine.refreshFromFirestore(true);
      setHealthData(questionBankEngine.getCloudVsRuntimeCounts());
    } catch (err: any) {
      setErrorMessage(`Backfill error: ${err?.message || 'Failed to backfill.'}`);
    } finally {
      setIsBackfilling(false);
      setBackfillProgress(null);
    }
  };

  const handleRunDeduplicationMigration = async () => {
    setIsDeduplicating(true);
    setErrorMessage(null);
    setDeduplicationSummary(null);

    try {
      const result = await deduplicateAndMigrateQuestionBank((prog) => {
        setDeduplicationProgress({
          processed: prog.current,
          total: prog.total,
          stage: prog.stage,
        });
      });

      setDeduplicationSummary({
        originalCount: result.originalCount,
        canonicalCount: result.canonicalCount,
        mergedCount: result.mergedCount,
        conflictCount: result.conflictCount,
      });

      // Refresh runtime cache
      await questionBankEngine.refreshFromFirestore(true);
      setHealthData(questionBankEngine.getCloudVsRuntimeCounts());
    } catch (err: any) {
      setErrorMessage(`Deduplication migration error: ${err?.message || 'Failed to deduplicate.'}`);
    } finally {
      setIsDeduplicating(false);
      setDeduplicationProgress(null);
    }
  };

  const handleParseJSON = async () => {
    setErrorMessage(null);
    setImportSummary(null);
    setIsProcessing(true);

    try {
      let content = '';
      let filename = 'pasted_questions.json';

      if (useTextInput) {
        if (!jsonText.trim()) {
          throw new Error('Please paste JSON questions content first.');
        }
        content = jsonText.trim();
      } else {
        if (!selectedFile) {
          throw new Error('Please select a .json file first.');
        }
        filename = selectedFile.name;
        content = await selectedFile.text();
      }

      const result = parseAndValidatePyqJSON(content, filename, metadata);

      setExtractedQuestions(result.eligibleQuestions);
      setSkippedItems(result.skippedItems);
      setCurrentBatch(result.batch);
      setActiveTab('eligible');

      const needEnrich = result.eligibleQuestions.some(q => needsEnrichment(q));
      if (needEnrich) {
        // Automatically start AI enrichment for educational fields
        handleEnrichBatch(result.eligibleQuestions);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to parse JSON file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = (tempId: string, newStatus: ReviewStatus) => {
    setExtractedQuestions(prev =>
      prev.map(q => q.tempId === tempId ? { ...q, reviewStatus: newStatus } : q)
    );
  };

  const handleApproveAllValid = () => {
    setExtractedQuestions(prev =>
      prev.map(q => {
        if (q.correctIndex !== null && q.reviewStatus !== 'duplicate') {
          return { ...q, reviewStatus: 'approved' };
        }
        return q;
      })
    );
  };

  const handleSaveEdit = (edited: ExtractedQuestion) => {
    setExtractedQuestions(prev =>
      prev.map(q => q.tempId === edited.tempId ? { ...edited, reviewStatus: 'approved' } : q)
    );
    setEditingQuestion(null);
  };

  const handleFinalPublish = async () => {
    const approved = extractedQuestions.filter(q => q.reviewStatus === 'approved');
    if (approved.length === 0) {
      setErrorMessage('No questions have been approved for publishing.');
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);

    try {
      // Directly publish approved questions to Firestore without repeating enrichment
      const readyToPublish = [...approved];

      const finalQuestionsToPublish: Question[] = readyToPublish.map((q, qIndex) => {
        const resolvedShift = (q.shift && q.shift !== 'Not Specified' && q.shift !== 'null' && q.shift !== 'undefined')
          ? q.shift
          : (metadata.shift && metadata.shift !== 'Not Specified' && metadata.shift !== 'null' ? metadata.shift : null);
        const resolvedExamDate = q.examDate ? normalizeExamDate(q.examDate) : (metadata.examDate ? normalizeExamDate(metadata.examDate) : null);
        const resolvedExam = q.exam || metadata.exam || 'SSC CGL';
        const resolvedYear = q.year || metadata.year || 2024;
        const resolvedFamily = q.examFamily || metadata.examFamily || 'SSC';
        const resolvedTier = q.tier || metadata.tier || '';
        const resolvedQNo = q.questionNumber !== undefined ? q.questionNumber : (qIndex + 1);

        const canonicalId = q.canonicalQuestionId || generateCanonicalQuestionId(
          q.category,
          q.wordOrPhrase,
          q.options,
          q.correctIndex ?? 0
        );
        const fingerprint = q.fingerprint || computeQuestionFingerprint(
          q.category,
          q.wordOrPhrase,
          q.options,
          q.correctIndex ?? 0,
          q.instruction || q.question
        );
        const identityKey = q.identityKey || computeQuestionIdentityKey(
          q.category,
          q.wordOrPhrase,
          q.options,
          q.instruction || q.question
        );

        const currentAppearance: ExamAppearance = {
          examFamily: resolvedFamily,
          exam: resolvedExam,
          year: resolvedYear,
          tier: resolvedTier,
          shift: resolvedShift,
          examDate: resolvedExamDate,
          questionNumber: resolvedQNo,
        };

        const existingApps = Array.isArray(q.appearances) && q.appearances.length > 0 ? q.appearances : [];
        const { merged: mergedApps } = mergeAppearances(existingApps, [currentAppearance]);
        const sortedApps = sortAppearances(mergedApps);

        const dynamicTags = sortedApps.map(a => formatExamTag(a.exam, a.year, a.tier));
        const examHistoryTags = Array.from(new Set([...(q.examHistory || []), ...dynamicTags]));
        const repeatCount = computeRepeatCount(sortedApps, q.repeatCount || 1);
        const importanceLevel = computeImportanceLevel(repeatCount);

        return {
          id: canonicalId,
          canonicalQuestionId: canonicalId,
          fingerprint,
          identityKey,
          category: q.category,
          wordOrPhrase: q.wordOrPhrase,
          instruction: q.instruction || (
            q.category === 'synonyms' ? 'Select the most appropriate SYNONYM of the given word:' :
            q.category === 'antonyms' ? 'Select the most appropriate ANTONYM of the given word:' :
            q.category === 'ows' ? 'Choose the correct ONE WORD for the given group of words:' :
            'Select the most appropriate meaning of the given IDIOM:'
          ),
          options: q.options,
          correctIndex: q.correctIndex ?? 0,
          meaning: q.meaning || '',
          hindiMeaning: q.hindiMeaning || '',
          exampleSentence: q.exampleSentence || '',
          mnemonic: q.mnemonic || '',
          rootWordInfo: q.rootWordInfo || '',
          explanation: q.explanation || '',
          optionDetails: q.optionDetails && q.optionDetails.length === 4 ? q.optionDetails : undefined,
          enrichment: q.enrichment || undefined,
          examFamily: sortedApps[0]?.examFamily || resolvedFamily,
          exam: sortedApps[0]?.exam || resolvedExam,
          year: sortedApps[0]?.year || resolvedYear,
          tier: sortedApps[0]?.tier || resolvedTier,
          shift: sortedApps[0]?.shift || resolvedShift,
          examDate: sortedApps[0]?.examDate || resolvedExamDate,
          questionNumber: resolvedQNo,
          appearances: sortedApps,
          examHistory: examHistoryTags,
          repeatCount,
          importanceLevel,
          difficulty: q.difficulty || 'medium',
          verified: q.verified !== undefined ? q.verified : true,
          sourceType: q.sourceType || (q.isPYQ === false ? 'generated_practice' : 'verified_pyq'),
          isPYQ: q.isPYQ !== undefined ? q.isPYQ : true,
        };
      });

      // Commit to Firestore question_bank
      const resolvedShift = (metadata.shift && metadata.shift !== 'Not Specified' && metadata.shift !== 'null')
        ? metadata.shift
        : null;
      const resolvedExamDate = metadata.examDate ? normalizeExamDate(metadata.examDate) : null;

      const batchMetadata: ImportBatch = currentBatch 
        ? {
            ...currentBatch,
            shift: currentBatch.shift || resolvedShift || undefined,
            examDate: currentBatch.examDate || resolvedExamDate || undefined,
            status: 'completed',
            publishedCount: approved.length,
          }
        : {
            batchId: `batch_${Date.now()}`,
            filename: selectedFile?.name || 'pasted_json.json',
            uploadedAt: Date.now(),
            examFamily: metadata.examFamily,
            exam: metadata.exam,
            year: metadata.year,
            tier: metadata.tier,
            shift: resolvedShift || undefined,
            examDate: resolvedExamDate || undefined,
            paper: metadata.paper,
            totalQuestionsInFile: extractedQuestions.length + skippedItems.length,
            eligibleQuestionsCount: extractedQuestions.length,
            skippedQuestionsCount: skippedItems.length,
            status: 'completed',
            publishedCount: approved.length
          };

      const firestoreResult = await publishApprovedQuestionsToFirestore(
        batchMetadata,
        finalQuestionsToPublish
      );

      // Register immediately into runtime QuestionBankEngine
      const registerResult = questionBankEngine.registerApprovedQuestions(finalQuestionsToPublish, true);

      setImportSummary({
        totalInput: (currentBatch?.totalQuestionsInFile || extractedQuestions.length + skippedItems.length),
        eligibleCount: extractedQuestions.length,
        skippedCount: skippedItems.length,
        publishedCount: firestoreResult.publishedCount,
        totalApproved: approved.length,
        mergedCount: registerResult.mergedCount,
        addedCount: registerResult.addedCount,
        rejectedCount: extractedQuestions.filter(q => q.reviewStatus === 'rejected').length,
        isQuotaExhausted: firestoreResult.isQuotaExhausted || false,
        isCloudSynced: firestoreResult.success,
        exportQuestions: finalQuestionsToPublish,
        batchInfo: batchMetadata,
      });

      setHealthData(questionBankEngine.getCloudVsRuntimeCounts());
    } catch (err: any) {
      setErrorMessage(err?.message || 'Publishing completed with local caching.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportApprovedJson = (questionsToExport?: Question[]) => {
    const list = questionsToExport || extractedQuestions.filter(q => q.reviewStatus === 'approved');
    if (list.length === 0) return;

    const dataStr = JSON.stringify(list, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `vocabclash_pyq_${metadata.examFamily}_${metadata.exam.replace(/\s+/g, '_')}_${metadata.year}_${metadata.shift ? metadata.shift.replace(/\s+/g, '_') : 'all'}.json`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetForNextBatch = () => {
    setExtractedQuestions([]);
    setSkippedItems([]);
    setSelectedFile(null);
    setJsonText('');
    setCurrentBatch(null);
    setImportSummary(null);
    setErrorMessage(null);
  };

  const handleForceSyncCloud = async () => {
    setIsSyncingCloud(true);
    try {
      await questionBankEngine.refreshFromFirestore(true);
      setHealthData(questionBankEngine.getCloudVsRuntimeCounts());
      setExplorerQuestions(questionBankEngine.getImportedQuestions());
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    try {
      const res = questionBankEngine.runRepetitionSimulation(200);
      setSimulationResult(res);
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredQuestions = extractedQuestions.filter(q => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'approved') return q.reviewStatus === 'approved';
    if (filterStatus === 'needs_review') return q.reviewStatus === 'needs_review' || q.reviewStatus === 'answer_required';
    if (filterStatus === 'duplicate') return q.reviewStatus === 'duplicate';
    if (filterStatus === 'rejected') return q.reviewStatus === 'rejected';
    return true;
  });

  // Extract unique exams, years, and tiers present in explorerQuestions
  const availableExams = Array.from(
    new Set(
      explorerQuestions.flatMap(q => [
        q.exam,
        ...(q.appearances || []).map(a => a.exam),
      ]).filter(Boolean)
    )
  ).sort() as string[];

  const availableYears = Array.from(
    new Set(
      explorerQuestions.flatMap(q => [
        q.year,
        ...(q.appearances || []).map(a => a.year),
      ]).filter(y => typeof y === 'number' && y > 1990)
    )
  ).sort((a, b) => Number(b) - Number(a)) as number[];

  const availableTiers = Array.from(
    new Set(
      explorerQuestions.flatMap(q => [
        q.tier,
        ...(q.appearances || []).map(a => a.tier),
      ]).filter(Boolean)
    )
  ).sort() as string[];

  // Filtered explorer questions matching user selection
  const filteredExplorerQuestions = explorerQuestions.filter(q => {
    // Category filter
    if (explorerCategory !== 'ALL' && q.category !== explorerCategory) {
      return false;
    }

    // Exam filter
    if (explorerExam !== 'ALL') {
      const matchPrimary = (q.exam || '').toLowerCase().includes(explorerExam.toLowerCase());
      const matchAppearances = (q.appearances || []).some(a => (a.exam || '').toLowerCase().includes(explorerExam.toLowerCase()));
      const matchHistory = (q.examHistory || []).some(tag => tag.toLowerCase().includes(explorerExam.toLowerCase()));
      if (!matchPrimary && !matchAppearances && !matchHistory) return false;
    }

    // Year filter
    if (explorerYear !== 'ALL') {
      const numYear = Number(explorerYear);
      const matchPrimary = q.year === numYear;
      const matchAppearances = (q.appearances || []).some(a => a.year === numYear);
      const matchHistory = (q.examHistory || []).some(tag => tag.includes(explorerYear));
      if (!matchPrimary && !matchAppearances && !matchHistory) return false;
    }

    // Tier filter
    if (explorerTier !== 'ALL') {
      const normSelected = normalizeTier(explorerTier).toLowerCase();
      const matchPrimary = normalizeTier(q.tier).toLowerCase().includes(normSelected);
      const matchAppearances = (q.appearances || []).some(a => normalizeTier(a.tier).toLowerCase().includes(normSelected));
      const matchHistory = (q.examHistory || []).some(tag => tag.toLowerCase().includes(normSelected));
      if (!matchPrimary && !matchAppearances && !matchHistory) return false;
    }

    // Search query filter
    if (explorerSearch.trim()) {
      const s = explorerSearch.trim().toLowerCase();
      const matchWord = q.wordOrPhrase.toLowerCase().includes(s);
      const matchOptions = (q.options || []).some(opt => opt.toLowerCase().includes(s));
      const matchMeaning = (q.meaning || '').toLowerCase().includes(s) || (q.hindiMeaning || '').toLowerCase().includes(s);
      const matchExam = (q.examHistory || []).some(t => t.toLowerCase().includes(s));
      if (!matchWord && !matchOptions && !matchMeaning && !matchExam) return false;
    }

    return true;
  });

  // Track whether any active filter or search query is set for Explorer
  const hasActiveExplorerFilter =
    explorerExam !== 'ALL' ||
    explorerYear !== 'ALL' ||
    explorerTier !== 'ALL' ||
    explorerCategory !== 'ALL' ||
    explorerSearch.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Admin Navigation Bar - Slidable on mobile and smaller viewports */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4 shadow-md shrink-0 sticky top-0 z-20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Engine Title and Quick Exit Header Bar */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2 truncate">
                  <span className="truncate">VocabClash Admin Question Engine V3</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 shrink-0 font-medium">
                    Production Engine
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                  Deterministic 4-Category Filter • Firestore Cloud Synchronization • Adaptive Repetition Diagnostics
                </p>
              </div>
            </div>

            {/* Quick Exit Button (Always visible on phone header without needing to slide) */}
            <button
              onClick={onClose}
              className="lg:hidden px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-bold rounded-xl border border-rose-800/60 transition flex items-center gap-1.5 shrink-0"
              title="Exit Admin Mode"
            >
              <span>Exit Admin</span>
              <span className="text-xs font-mono">✕</span>
            </button>
          </div>

          {/* Horizontally Slidable Navigation Pills Track */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-thin py-1 -mx-4 px-4 sm:mx-0 sm:px-0 touch-pan-x scroll-smooth">
            <button
              onClick={() => setAdminView('importer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                adminView === 'importer'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              JSON Ingest & Publisher
            </button>

            <button
              onClick={() => setAdminView('health')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                adminView === 'health'
                  ? 'bg-sky-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Question Bank Health ({healthData.totalCloud} Cloud)
            </button>

            <button
              onClick={() => setAdminView('explorer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                adminView === 'explorer'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Exam & Year Explorer ({explorerQuestions.length})
            </button>

            <button
              onClick={() => setAdminView('simulation')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                adminView === 'simulation'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Repetition Simulator
            </button>

            {onOpenArticles && (
              <button
                onClick={onOpenArticles}
                className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:brightness-110 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md shadow-orange-950/40 shrink-0 whitespace-nowrap"
                title="Open Article & Blog CMS Publisher"
              >
                <FileText className="w-3.5 h-3.5" />
                Articles / Blog CMS
              </button>
            )}

            {/* Slidable Exit Admin Mode Pill */}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 text-xs font-bold rounded-xl border border-rose-800/60 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ml-1"
              title="Close Admin Panel"
            >
              <span>Exit Admin Mode</span>
              <span className="text-xs font-mono">✕</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500/40 p-4 rounded-xl text-rose-200 text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* VIEW 1: JSON IMPORTER & PUBLISHER */}
        {adminView === 'importer' && (
          <div className="space-y-6">
            {/* Import & Publishing Summary Card */}
            {importSummary && (
              <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        PYQ Dataset Successfully Ingested & Verified
                        {importSummary.isQuotaExhausted && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono">
                            Offline Runtime Active
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-300">
                        {importSummary.totalApproved || importSummary.publishedCount} approved questions are registered into the active question engine.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportApprovedJson(importSummary.exportQuestions)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Approved JSON
                    </button>
                    <button
                      onClick={handleResetForNextBatch}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Ingest Another Batch
                    </button>
                  </div>
                </div>

                {importSummary.isQuotaExhausted && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block text-amber-300">
                        Firestore Free Tier Daily Write Limit (20,000 writes/day)
                      </strong>
                      <span>
                        Your questions are 100% saved in the local engine cache and fully playable across all game modes (1v1 Duels, PYQ Drills, and Practice). When the daily cloud limit resets, new cloud batches will sync automatically. You can also download the JSON backup above anytime.
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Total Ingested</span>
                    <div className="text-xl font-black text-white font-mono">{importSummary.totalInput}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Eligible Vocab</span>
                    <div className="text-xl font-black text-sky-400 font-mono">{importSummary.eligibleCount}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Active in Engine</span>
                    <div className="text-xl font-black text-emerald-400 font-mono">
                      {importSummary.totalApproved || importSummary.publishedCount}
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <span className="text-[11px] text-slate-400 block">Skipped Non-Vocab</span>
                    <div className="text-xl font-black text-slate-400 font-mono">{importSummary.skippedCount}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Upload & Metadata Input Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  1. Ingest JSON PYQ Dataset
                </h2>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setUseTextInput(false)}
                    className={`px-3 py-1 rounded-lg border transition ${
                      !useTextInput ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Upload File (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseTextInput(true)}
                    className={`px-3 py-1 rounded-lg border transition ${
                      useTextInput ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    Paste Raw JSON
                  </button>
                </div>
              </div>

              {!useTextInput ? (
                <div className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-6 text-center transition bg-slate-950/40">
                  <input
                    type="file"
                    accept=".json,application/json"
                    id="json-upload"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="json-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-400 hover:text-sky-400 transition" />
                    <span className="text-sm font-medium text-slate-300">
                      {selectedFile ? selectedFile.name : 'Click to select PYQ JSON file (.json)'}
                    </span>
                    <span className="text-xs text-slate-500">
                      Standard format: array of questions or vocabclash-pyq-1.0 schema
                    </span>
                  </label>
                </div>
              ) : (
                <div>
                  <textarea
                    value={jsonText}
                    onChange={e => handleJsonTextChange(e.target.value)}
                    placeholder='[{"category": "synonyms", "wordOrPhrase": "ABERRATION", "question": "Select the synonym...", "options": ["Anomaly", "Normality", "Regularity", "Standard"], "answer": 0}]'
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {/* Metadata Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Exam Family</label>
                  <select
                    value={metadata.examFamily}
                    onChange={e => handleExamFamilyChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="SSC">SSC (CGL, CHSL, CPO, MTS)</option>
                    <option value="Banking">Banking (IBPS PO, SBI Clerk, RRB)</option>
                    <option value="Defence">Defence (CDS, AFCAT, NDA)</option>
                    <option value="Railways">Railways (RRB NTPC, Group D, JE)</option>
                    <option value="State">State Govt (DSSSB, etc.)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Specific Exam Name</label>
                  <select
                    value={metadata.exam}
                    onChange={e => handleExamChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {(() => {
                      const available = EXAMS_BY_FAMILY[metadata.examFamily] || EXAMS_BY_FAMILY.SSC;
                      const optionsList = available.includes(metadata.exam) ? available : [metadata.exam, ...available];
                      return optionsList.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ));
                    })()}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Exam Year</label>
                  <input
                    type="number"
                    value={metadata.year}
                    onChange={e => setMetadata({ ...metadata, year: parseInt(e.target.value, 10) || 2024 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Stage / Tier / Phase</label>
                  <div className="space-y-1">
                    <select
                      value={
                        !metadata.tier
                          ? ''
                          : isCustomTier || !getStageOptionsForExam(metadata.exam).includes(metadata.tier)
                          ? '__custom__'
                          : metadata.tier
                      }
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomTier(true);
                          if (getStageOptionsForExam(metadata.exam).includes(metadata.tier)) {
                            setMetadata(prev => ({ ...prev, tier: '' }));
                          }
                        } else {
                          setIsCustomTier(false);
                          setMetadata(prev => ({ ...prev, tier: val }));
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Not Specified</option>
                      {getStageOptionsForExam(metadata.exam).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="__custom__">Custom Stage / Tier...</option>
                    </select>

                    {(isCustomTier || (!getStageOptionsForExam(metadata.exam).includes(metadata.tier) && Boolean(metadata.tier))) && (
                      <input
                        type="text"
                        value={metadata.tier}
                        onChange={e => setMetadata(prev => ({ ...prev, tier: e.target.value }))}
                        placeholder="e.g. Tier-I, Paper-I, Stage-II, Written Exam"
                        className="w-full bg-slate-950 border border-sky-500/50 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-medium"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-between items-center">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>VocabClash strictly ingests Synonyms, Antonyms, OWS, and Idioms. Other categories are safely filtered out.</span>
                </div>

                <button
                  onClick={handleParseJSON}
                  disabled={isProcessing || (!selectedFile && !jsonText.trim())}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  Validate & Ingest JSON
                </button>
              </div>
            </div>

            {/* Step 2: Extraction Batch Summary & Controls */}
            {(extractedQuestions.length > 0 || skippedItems.length > 0) && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-400" />
                      2. Review Queue ({extractedQuestions.length} Eligible, {skippedItems.length} Skipped)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Review educational learning data and approve eligible vocabulary questions before publishing.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleEnrichBatch(undefined, false)}
                      disabled={isEnriching || extractedQuestions.length === 0}
                      className="px-3.5 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                      title="AI Auto-Enrich Hindi meanings, Mnemonics & 4-Option Details"
                    >
                      <Sparkles className={`w-4 h-4 text-purple-400 ${isEnriching ? 'animate-spin' : ''}`} />
                      {isEnriching 
                        ? 'Enriching Learning Data...' 
                        : `Auto-Enrich Batch (${extractedQuestions.filter(q => needsEnrichment(q)).length} need AI)`}
                    </button>

                    <button
                      onClick={() => handleEnrichBatch(undefined, true)}
                      disabled={isEnriching || extractedQuestions.length === 0}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Force Gemini AI to re-generate educational content for all questions, replacing any template fallbacks"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${isEnriching ? 'animate-spin' : ''}`} />
                      Force Re-Enrich All
                    </button>

                    <button
                      onClick={handleApproveAllValid}
                      className="px-3.5 py-2 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve All Valid ({extractedQuestions.filter(q => q.correctIndex !== null && q.reviewStatus !== 'duplicate').length})
                    </button>

                    <button
                      onClick={handleFinalPublish}
                      disabled={isPublishing || extractedQuestions.filter(q => q.reviewStatus === 'approved').length === 0}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
                    >
                      <CloudUpload className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                      Publish to Firestore Question Bank ({extractedQuestions.filter(q => q.reviewStatus === 'approved').length})
                    </button>
                  </div>
                </div>

                {/* Enrichment Live Progress Bar */}
                {isEnriching && enrichProgress && (
                  <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-200 flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-purple-400 animate-spin" />
                        {enrichProgress.stage}
                      </span>
                      <span className="font-mono text-purple-300 font-bold">
                        {enrichProgress.processed} / {enrichProgress.total} Questions ({Math.round((enrichProgress.processed / (enrichProgress.total || 1)) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-purple-500/20">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.round((enrichProgress.processed / (enrichProgress.total || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveTab('eligible')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      activeTab === 'eligible' 
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Eligible VocabClash Questions</span>
                    <span className="bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded-full text-[10px]">
                      {extractedQuestions.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('skipped')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                      activeTab === 'skipped' 
                        ? 'bg-slate-800 text-slate-200 border border-slate-700' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    <span>Skipped Non-Vocab Items</span>
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">
                      {skippedItems.length}
                    </span>
                  </button>
                </div>

                {/* Tab: Eligible Questions List */}
                {activeTab === 'eligible' && (
                  <div className="space-y-4 pt-2">
                    {filteredQuestions.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm bg-slate-950/40 rounded-xl border border-slate-800">
                        No questions match the selected filter status ({filterStatus}).
                      </div>
                    ) : (
                      filteredQuestions.map((q, idx) => {
                        const isFallback = isFallbackEnrichment(q);
                        const isEnriched = Boolean(!isFallback && q.hindiMeaning && q.meaning && q.optionDetails && q.optionDetails.length === 4);
                        const isExpanded = expandedOptionDetails[q.tempId] ?? false;

                        return (
                          <div 
                            key={`${q.tempId}_${idx}`} 
                            className={`bg-slate-950/80 border rounded-xl p-4 transition space-y-3 ${
                              q.reviewStatus === 'approved' 
                                ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/5' 
                                : q.reviewStatus === 'duplicate'
                                ? 'border-purple-500/40'
                                : q.reviewStatus === 'rejected'
                                ? 'border-rose-500/30 opacity-60'
                                : 'border-amber-500/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                                    #{idx + 1}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                    {q.category}
                                  </span>
                                  {(() => {
                                    const parts: string[] = [q.exam, String(q.year)];
                                    if (q.tier && q.tier.trim() && q.tier !== 'Not Specified' && q.tier !== 'null' && q.tier !== '-') {
                                      parts.push(q.tier);
                                    }
                                    const qNo = q.questionNumber !== undefined && q.questionNumber !== null ? q.questionNumber : (idx + 1);
                                    parts.push(`Q${qNo}`);
                                    return (
                                      <span className="text-[10px] text-slate-400 font-mono font-medium">
                                        {parts.join(' • ')}
                                      </span>
                                    );
                                  })()}

                                  {isEnriched ? (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" /> Enriched (AI)
                                    </span>
                                  ) : isFallback ? (
                                    <span 
                                      className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 transition"
                                      title="Using temporary robotic template fallback. Click the sparkle button to enrich with Gemini AI."
                                      onClick={() => handleEnrichSingle(q.tempId)}
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" /> Template Fallback (Click to AI Enrich)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium border border-slate-700">
                                      Pending Enrichment
                                    </span>
                                  )}

                                  {q.matchedExistingQuestion && (
                                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-bold border border-sky-500/30 flex items-center gap-1">
                                      🔁 Merging Appearance into Canonical Question
                                    </span>
                                  )}

                                  {q.appearances && q.appearances.length > 1 && (
                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold border border-indigo-500/30 flex items-center gap-1">
                                      📚 {q.appearances.length} Exam Occurrences
                                    </span>
                                  )}

                                  {q.isAnswerConflict && (
                                    <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold border border-rose-500/40 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-rose-400" /> Answer Conflict Flagged
                                    </span>
                                  )}

                                  {q.duplicateConfidence && q.duplicateConfidence !== 'none' && !q.matchedExistingQuestion && !q.isAnswerConflict && (
                                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-medium border border-purple-500/30 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> Duplicate ({q.duplicateOfQuestion})
                                    </span>
                                  )}

                                  {(q.enrichment?.warnings || q.enrichmentWarning) && (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-500/30 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> {q.enrichment?.warnings || q.enrichmentWarning}
                                    </span>
                                  )}
                                </div>

                                {q.conflictDetails && (
                                  <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-200 space-y-1">
                                    <div className="font-bold flex items-center gap-1.5 text-rose-300">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                      <span>{q.conflictDetails.message || 'Answer Key Conflict Detected'}</span>
                                    </div>
                                    <div className="text-[11px] text-rose-300/80">
                                      Incoming import answer: <b className="text-white">Option {q.conflictDetails.incomingCorrectIndex + 1} ({q.conflictDetails.incomingCorrectAnswer})</b> vs Existing canonical answer: <b className="text-white">Option {q.conflictDetails.existingCorrectIndex + 1} ({q.conflictDetails.existingCorrectAnswer})</b>
                                    </div>
                                  </div>
                                )}

                                {q.appearances && q.appearances.length > 0 && (
                                  <div className="pt-1">
                                    <ExamAppearancesBadge
                                      appearances={q.appearances}
                                      exam={q.exam}
                                      year={q.year}
                                      tier={q.tier}
                                      showRepeatCount={false}
                                      size="xs"
                                    />
                                  </div>
                                )}

                                <div className="text-sm font-semibold text-white pt-1">
                                  {q.question}
                                </div>
                                <div className="text-xs font-mono font-bold text-amber-400">
                                  Target: "{q.wordOrPhrase}"
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleEnrichSingle(q.tempId)}
                                  disabled={enrichingSingleId === q.tempId || isEnriching}
                                  className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition disabled:opacity-50"
                                  title="Enrich or Re-enrich with Gemini AI"
                                >
                                  <Sparkles className={`w-3.5 h-3.5 ${enrichingSingleId === q.tempId ? 'animate-spin text-purple-400' : ''}`} />
                                </button>

                                <button
                                  onClick={() => setEditingQuestion(q)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                                  title="Edit Question Details"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {q.reviewStatus !== 'approved' ? (
                                  <button
                                    onClick={() => handleUpdateStatus(q.tempId, 'approved')}
                                    disabled={q.correctIndex === null}
                                    className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/40 disabled:opacity-40 text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Approve
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateStatus(q.tempId, 'needs_review')}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition"
                                  >
                                    Undo
                                  </button>
                                )}

                                {q.reviewStatus !== 'rejected' && (
                                  <button
                                    onClick={() => handleUpdateStatus(q.tempId, 'rejected')}
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                                    title="Reject Question"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Options Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {q.options.map((opt, oIdx) => (
                                <div
                                  key={oIdx}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                                    q.correctIndex === oIdx
                                      ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200 font-bold'
                                      : 'bg-slate-900 border border-slate-800 text-slate-300'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-slate-500">
                                      {String.fromCharCode(65 + oIdx)}.
                                    </span>
                                    <span>{opt}</span>
                                  </span>
                                  {q.correctIndex === oIdx && (
                                    <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Learning & Educational Information Box */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                              {(() => {
                                const breakdown = resolveQuestionMeaningsBreakdown(q);
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <span className="text-slate-500 font-bold uppercase text-[10px] block mb-1">English Meaning</span>
                                      {breakdown.targetMeaning ? (
                                        <div className="space-y-1.5">
                                          <div className="text-slate-200 leading-relaxed">
                                            <span className="font-bold text-sky-400 capitalize">{breakdown.targetWord}</span>
                                            <span className="text-slate-400 font-normal"> – </span>
                                            <span>{breakdown.targetMeaning}</span>
                                          </div>
                                          {breakdown.correctOption && breakdown.correctMeaning && (
                                            <div className="text-slate-300 pt-1.5 border-t border-slate-800/70 leading-relaxed">
                                              <span className="font-bold text-emerald-400 capitalize">{breakdown.correctOption}</span>
                                              {breakdown.categoryLabel && (
                                                <span className="text-[10px] text-emerald-300 font-semibold uppercase ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                                                  {breakdown.categoryLabel}
                                                </span>
                                              )}
                                              <span className="text-slate-400 font-normal"> – </span>
                                              <span>{breakdown.correctMeaning}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <em className="text-slate-600">Pending AI enrichment</em>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-emerald-400/90 font-bold uppercase text-[10px] block mb-1">Hindi Meaning (हिन्दी अर्थ)</span>
                                      {breakdown.targetHindi ? (
                                        <div className="space-y-1.5">
                                          <div className="text-emerald-200 font-medium leading-relaxed">
                                            <span className="font-bold text-emerald-400 capitalize">{breakdown.targetWord}: </span>
                                            <span>{breakdown.targetHindi}</span>
                                          </div>
                                          {breakdown.correctOption && breakdown.correctHindi && (
                                            <div className="text-emerald-200/90 font-medium pt-1.5 border-t border-slate-800/70 leading-relaxed">
                                              <span className="font-bold text-teal-300 capitalize">{breakdown.correctOption}</span>
                                              {breakdown.categoryLabel && (
                                                <span className="text-[10px] text-teal-300 font-semibold uppercase ml-1.5 px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30">
                                                  {breakdown.categoryLabel}
                                                </span>
                                              )}
                                              <span>: {breakdown.correctHindi}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <em className="text-slate-600">Pending AI enrichment</em>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                              {(q.mnemonic || q.exampleSentence || q.rootWordInfo || q.explanation) && (
                                <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                                  {q.mnemonic && (
                                    <div className="flex items-start gap-1.5 text-amber-300/90">
                                      <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                                      <span><b className="text-amber-400">Mnemonic:</b> {q.mnemonic}</span>
                                    </div>
                                  )}
                                  {q.exampleSentence && (
                                    <div className="text-slate-300">
                                      <span className="text-slate-500 font-semibold">Example: </span>
                                      <em>"{q.exampleSentence}"</em>
                                    </div>
                                  )}
                                  {q.rootWordInfo && (
                                    <div className="text-slate-400 text-[11px]">
                                      <span className="text-slate-500 font-semibold">Root / Etymology: </span>
                                      {q.rootWordInfo}
                                    </div>
                                  )}
                                  {q.explanation && (
                                    <div className="text-slate-300 text-[11px] bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                                      <span className="text-sky-400 font-bold block mb-0.5">Explanation / Rationale:</span>
                                      {q.explanation}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Collapsible 4-Option Meaning Breakdown */}
                              {q.optionDetails && q.optionDetails.length === 4 && (
                                <div className="pt-1 border-t border-slate-800/80">
                                  <button
                                    onClick={() => setExpandedOptionDetails(prev => ({ ...prev, [q.tempId]: !prev[q.tempId] }))}
                                    className="flex items-center justify-between w-full text-slate-400 hover:text-sky-300 text-[11px] font-semibold transition py-1"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                                      4-Option Meanings Breakdown ({q.optionDetails.length} options mapped)
                                    </span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>

                                  {isExpanded && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                      {q.optionDetails.map((optDetail, oIdx) => {
                                        const optText = (optDetail as any).option || (optDetail as any).text || q.options?.[oIdx] || '';
                                        const engMeaning = (optDetail as any).englishMeaning || (optDetail as any).meaning || (optDetail as any).explanation || (optDetail as any).shortExplanation || '';
                                        const hinMeaning = optDetail.hindiMeaning || '';
                                        const hook = (optDetail as any).mnemonicHook || (optDetail as any).mnemonic || '';
                                        const isCorrect = oIdx === q.correctIndex;

                                        return (
                                          <div 
                                            key={oIdx} 
                                            className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 ${
                                              isCorrect
                                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                                                : 'bg-slate-950 border-slate-800/80 text-slate-300'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-2 font-bold">
                                              <span className="text-white text-xs">
                                                <span className="text-sky-400 font-mono">Option {String.fromCharCode(65 + oIdx)}:</span>{' '}
                                                <span className="text-slate-100 font-semibold">{optText}</span>
                                              </span>
                                              {isCorrect && (
                                                <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">
                                                  Correct
                                                </span>
                                              )}
                                            </div>

                                            {/* English Meaning / Explanation */}
                                            {engMeaning && (
                                              <div className="text-slate-300 text-[11px] leading-relaxed">
                                                <span className="text-slate-400 font-semibold">Meaning:</span> {engMeaning}
                                              </div>
                                            )}

                                            {/* Hindi Meaning (Bilingual Aid) */}
                                            {hinMeaning && (
                                              <div className="text-amber-300/90 font-medium text-[11px] leading-relaxed">
                                                <span className="text-amber-400/80 font-semibold">हिन्दी अर्थ:</span> {hinMeaning}
                                              </div>
                                            )}

                                            {/* Memory Hook / Mnemonic if available */}
                                            {hook && (
                                              <div className="text-purple-300/80 text-[10px]">
                                                <span className="font-semibold text-purple-400">Hook:</span> {hook}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: QUESTION BANK HEALTH & DIAGNOSTICS */}
        {adminView === 'health' && (
          <div className="space-y-6">
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-1">
                <span className="text-xs text-sky-400 font-bold uppercase tracking-wider block">
                  Cloud Verified PYQs
                </span>
                <div className="text-3xl font-black text-white font-mono">
                  {healthData.totalCloud}
                </div>
                <p className="text-[11px] text-slate-400">
                  Published in Firestore <code>question_bank</code>
                </p>
              </div>

              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-1">
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">
                  Unique Concepts
                </span>
                <div className="text-3xl font-black text-white font-mono">
                  {healthData.totalConcepts}
                </div>
                <p className="text-[11px] text-slate-400">
                  Playable distinct concept clusters across 4 categories
                </p>
              </div>

              <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-1">
                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block">
                  Runtime Variations
                </span>
                <div className="text-3xl font-black text-white font-mono">
                  {healthData.totalRuntimeVariants}
                </div>
                <p className="text-[11px] text-slate-400">
                  Total generated variations + verified cloud questions
                </p>
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    Category-Wise Question Bank Distribution
                  </h3>
                  <p className="text-xs text-slate-400">
                    Synonyms, Antonyms, One-Word Substitution, and Idioms
                  </p>
                </div>

                <button
                  onClick={handleForceSyncCloud}
                  disabled={isSyncingCloud}
                  className="px-4 py-2 bg-sky-500/20 border border-sky-500/40 hover:bg-sky-500/30 text-sky-300 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  Force Cloud Sync
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                {[
                  { id: 'synonyms' as QuestionCategory, name: 'Synonyms', color: 'sky' },
                  { id: 'antonyms' as QuestionCategory, name: 'Antonyms', color: 'indigo' },
                  { id: 'ows' as QuestionCategory, name: 'One-Word (OWS)', color: 'emerald' },
                  { id: 'idioms' as QuestionCategory, name: 'Idioms & Phrases', color: 'amber' },
                ].map(cat => (
                  <div key={cat.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{cat.name}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {cat.id}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Cloud PYQs:</span>
                        <b className="text-white font-mono">{healthData.cloudCounts[cat.id]}</b>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Unique Concepts:</span>
                        <b className="text-amber-400 font-mono">{healthData.runtimeConceptCounts[cat.id]}</b>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total Variations:</span>
                        <b className="text-sky-400 font-mono">{healthData.runtimeVariantCounts[cat.id]}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Learning Data Firestore Backfill Tool */}
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    AI Learning Data Backfill Engine
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scans existing Firestore <code>question_bank</code> items and generates missing Hindi meanings, mnemonics, explanations, and all 4-option breakdowns.
                  </p>
                </div>

                <button
                  onClick={handleRunBackfill}
                  disabled={isBackfilling}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBackfilling ? 'animate-spin' : ''}`} />
                  {isBackfilling ? 'Backfilling Firestore Learning Data...' : 'Enrich Existing Firestore Questions'}
                </button>
              </div>

              {isBackfilling && backfillProgress && (
                <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-200 flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-purple-400 animate-spin" />
                      Scanning & Enriching {backfillProgress.currentExam || 'Questions'}...
                    </span>
                    <span className="font-mono text-purple-300 font-bold">
                      {backfillProgress.processed} / {backfillProgress.total} ({backfillProgress.updated} updated)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-purple-500/20">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.round((backfillProgress.processed / (backfillProgress.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {backfillSummary && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      Backfill finished in {Math.round(backfillSummary.durationMs / 1000)}s! Checked {backfillSummary.totalChecked} questions, successfully enriched & updated <b>{backfillSummary.totalUpdated}</b> questions.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cross-Exam Deduplication & Canonical Appearance Consolidation Tool */}
            <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    Cross-Exam Question Deduplication & Appearance Consolidation
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scans entire Firestore <code>question_bank</code>, identifies questions appearing across multiple exams (e.g. SSC CGL + RRB NTPC), merges them into unified canonical records with merged <code>appearances</code> array, recalculates authentic repeat counts, and logs any answer key conflicts.
                  </p>
                </div>

                <button
                  onClick={handleRunDeduplicationMigration}
                  disabled={isDeduplicating}
                  className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-sky-500/20 flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDeduplicating ? 'animate-spin' : ''}`} />
                  {isDeduplicating ? 'Consolidating Canonical Questions...' : 'Run Question Deduplication & Migration'}
                </button>
              </div>

              {isDeduplicating && deduplicationProgress && (
                <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400 animate-spin" />
                      {deduplicationProgress.stage}
                    </span>
                    <span className="font-mono text-sky-300 font-bold">
                      {deduplicationProgress.processed} / {deduplicationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-sky-500/20">
                    <div 
                      className="bg-gradient-to-r from-sky-500 to-indigo-400 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.round((deduplicationProgress.processed / (deduplicationProgress.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {deduplicationSummary && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Deduplication complete! Scanned <b>{deduplicationSummary.originalCount}</b> questions. Consolidated into <b>{deduplicationSummary.canonicalCount}</b> canonical questions with <b>{deduplicationSummary.mergedCount}</b> cross-exam appearances merged. {deduplicationSummary.conflictCount > 0 && <span className="text-amber-300 font-bold">({deduplicationSummary.conflictCount} answer key conflicts logged).</span>}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Admin-Only Monetization & Ad System Diagnostics */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Tv className="w-4 h-4 text-sky-400" />
                    Monetization & Advertising Architecture Diagnostics
                  </h3>
                  <p className="text-xs text-slate-400">
                    System-level ad configuration, feature flags, and Google AdSense publisher parameters (Admin View Only).
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  ADS_ENABLED 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${ADS_ENABLED ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {ADS_ENABLED ? 'Ads Active (Live Mode)' : 'Ads Dormant (Clean Study Mode)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Feature Flag Status</div>
                  <div className="font-mono text-sm font-bold text-white">
                    {ADS_ENABLED ? 'true' : 'false'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Gated by <code>VITE_ADS_ENABLED</code> / <code>ADS_ENABLED</code>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Publisher Client ID</div>
                  <div className="font-mono text-xs font-bold text-sky-300 truncate" title={ADSENSE_CLIENT_ID}>
                    {ADSENSE_CLIENT_ID}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Site meta tag verified
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Configured Slots</div>
                  <div className="font-mono text-xs font-bold text-emerald-300">
                    Banner: {ADSENSE_BANNER_SLOT}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Modal: {ADSENSE_INTERSTITIAL_SLOT}
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Cadence & Retention Rule</div>
                  <div className="font-mono text-xs font-bold text-amber-300">
                    10m Cooldown
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Exempts match #1 (100% clean onboarding)
                  </div>
                </div>
              </div>

              {!ADS_ENABLED && (
                <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200/90 leading-relaxed">
                  💡 <strong>Admin Notice:</strong> All student-facing ad banners, intermission countdowns, test ad triggers, and ad network requests are currently dormant. To activate advertisements once your Google AdSense publisher approval is completed, change <code>ADS_ENABLED</code> in <code>src/services/adSenseService.ts</code> to <code>true</code> or set <code>VITE_ADS_ENABLED=true</code> in your environment.
                </div>
              )}
            </div>

            {/* Live Question Previewer */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    Live Runtime Question Inspector
                  </h3>
                  <p className="text-xs text-slate-400">
                    Preview an actual playable question variant from the active engine
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(['synonyms', 'antonyms', 'ows', 'idioms'] as QuestionCategory[]).map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        setPreviewCat(c);
                        setPreviewQuestion(questionBankEngine.getPreviewQuestion(c));
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${
                        previewCat === c
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    onClick={() => setPreviewQuestion(questionBankEngine.getPreviewQuestion(previewCat))}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Load another random question"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {previewQuestion ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {previewQuestion.category}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        previewQuestion.sourceType === 'verified_pyq'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {previewQuestion.sourceType || 'generated_practice'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        MemoryKey: <code>{previewQuestion.memoryKey || 'n/a'}</code>
                      </span>
                    </div>

                    <span 
                      title={previewQuestion.repeatCount > 5 ? `Repeated ${previewQuestion.repeatCount} times across exam papers` : undefined}
                      className="text-xs text-amber-400 font-bold"
                    >
                      Repeated {formatRepeatCount(previewQuestion.repeatCount)} in Govt Exams
                    </span>
                  </div>

                  <div>
                    <div className="text-xs text-slate-400 mb-1">{previewQuestion.instruction}</div>
                    <div className="text-lg font-black text-white">"{previewQuestion.wordOrPhrase}"</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewQuestion.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                          i === previewQuestion.correctIndex
                            ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-200 font-bold'
                            : 'bg-slate-900 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <span>{String.fromCharCode(65 + i)}. {opt}</span>
                        {i === previewQuestion.correctIndex && (
                          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded">
                            Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800/80">
                    {previewQuestion.hindiMeaning && (
                      <div>
                        <span className="text-slate-500 block">Hindi Meaning:</span>
                        <span className="text-slate-200 font-medium">{previewQuestion.hindiMeaning}</span>
                      </div>
                    )}
                    {previewQuestion.mnemonic && (
                      <div>
                        <span className="text-slate-500 block">Mnemonic / Origin:</span>
                        <span className="text-amber-300/90">{previewQuestion.mnemonic}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No preview available for this category.
                </div>
              )}
            </div>

            {/* Quick Link from Health to Dedicated Explorer */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Cloud Exam & Year Question Explorer</h4>
                  <p className="text-xs text-slate-400">Search and audit all {explorerQuestions.length} verified questions by Exam, Year, Tier, or Category.</p>
                </div>
              </div>
              <button
                onClick={() => setAdminView('explorer')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md"
              >
                <Search className="w-3.5 h-3.5" />
                Open Question Explorer
              </button>
            </div>
          </div>
        )}

        {/* VIEW: DEDICATED EXAM & YEAR CLOUD QUESTION EXPLORER */}
        {adminView === 'explorer' && (
          <div className="space-y-6">
            {/* Exam, Year & Category Cloud Question Explorer */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    Cloud Exam & Year Question Explorer
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 font-mono font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                      {hasActiveExplorerFilter ? `${filteredExplorerQuestions.length} Found` : `${explorerQuestions.length} in Cloud`}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Filter and audit verified questions published to Firestore by Exam, Year, Tier, or Category
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleForceSyncCloud}
                    disabled={isSyncingCloud}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Re-fetch all documents from Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                    Sync Cloud Data
                  </button>
                </div>
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Exam Filter */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Exam
                  </label>
                  <select
                    value={explorerExam}
                    onChange={(e) => setExplorerExam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="ALL">All Exams ({availableExams.length})</option>
                    {availableExams.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                </div>

                {/* Year Filter */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Year
                  </label>
                  <select
                    value={explorerYear}
                    onChange={(e) => setExplorerYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="ALL">All Years</option>
                    {availableYears.map(yr => (
                      <option key={yr} value={String(yr)}>{yr}</option>
                    ))}
                  </select>
                </div>

                {/* Tier / Stage Filter */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Tier / Stage
                  </label>
                  <select
                    value={explorerTier}
                    onChange={(e) => setExplorerTier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition"
                  >
                    <option value="ALL">All Tiers / Stages</option>
                    {availableTiers.map(tr => (
                      <option key={tr} value={tr}>{tr}</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={explorerCategory}
                    onChange={(e) => setExplorerCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition capitalize"
                  >
                    <option value="ALL">All 4 Categories</option>
                    <option value="synonyms">Synonyms</option>
                    <option value="antonyms">Antonyms</option>
                    <option value="ows">One-Word (OWS)</option>
                    <option value="idioms">Idioms & Phrases</option>
                  </select>
                </div>

                {/* Search Box */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Search Question / Word
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="e.g. Taciturn, CGL, Shift 2..."
                      value={explorerSearch}
                      onChange={(e) => setExplorerSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Active Filter Badges & Reset */}
              {(explorerExam !== 'ALL' || explorerYear !== 'ALL' || explorerTier !== 'ALL' || explorerCategory !== 'ALL' || explorerSearch) && (
                <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                  <span className="text-slate-400 text-[11px]">Active Filters:</span>
                  {explorerExam !== 'ALL' && (
                    <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1">
                      Exam: {explorerExam}
                      <button onClick={() => setExplorerExam('ALL')} className="hover:text-white">×</button>
                    </span>
                  )}
                  {explorerYear !== 'ALL' && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1">
                      Year: {explorerYear}
                      <button onClick={() => setExplorerYear('ALL')} className="hover:text-white">×</button>
                    </span>
                  )}
                  {explorerTier !== 'ALL' && (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1">
                      Tier: {explorerTier}
                      <button onClick={() => setExplorerTier('ALL')} className="hover:text-white">×</button>
                    </span>
                  )}
                  {explorerCategory !== 'ALL' && (
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 capitalize">
                      {explorerCategory}
                      <button onClick={() => setExplorerCategory('ALL')} className="hover:text-white">×</button>
                    </span>
                  )}
                  {explorerSearch && (
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1">
                      "{explorerSearch}"
                      <button onClick={() => setExplorerSearch('')} className="hover:text-white">×</button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setExplorerExam('ALL');
                      setExplorerYear('ALL');
                      setExplorerTier('ALL');
                      setExplorerCategory('ALL');
                      setExplorerSearch('');
                    }}
                    className="text-[11px] text-rose-400 hover:underline ml-1"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Questions List or Initial Search Prompt */}
              {!hasActiveExplorerFilter ? (
                <div className="py-16 px-4 text-center rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto border border-sky-500/20 shadow-inner">
                    <Search className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Search or Filter to Explore Cloud Questions
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                      Select an <b>Exam</b>, <b>Year</b>, <b>Tier</b>, <b>Category</b>, or type keywords in the search bar above to audit questions.
                    </p>
                  </div>

                  {/* Quick Suggestions */}
                  <div className="pt-2 flex items-center justify-center gap-2 flex-wrap max-w-lg mx-auto">
                    <span className="text-[11px] text-slate-500 font-medium">Quick suggestions:</span>
                    {availableExams.slice(0, 3).map(examName => (
                      <button
                        key={examName}
                        onClick={() => setExplorerExam(examName)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700/60 transition flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3 text-sky-400" />
                        {examName}
                      </button>
                    ))}
                    {availableYears.length > 0 && (
                      <button
                        onClick={() => setExplorerYear(String(availableYears[0]))}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700/60 transition flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3 text-amber-400" />
                        Year {availableYears[0]}
                      </button>
                    )}
                    <button
                      onClick={() => setExplorerCategory('synonyms')}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700/60 transition"
                    >
                      Synonyms
                    </button>
                    <button
                      onClick={() => setExplorerCategory('idioms')}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700/60 transition"
                    >
                      Idioms
                    </button>
                  </div>
                </div>
              ) : filteredExplorerQuestions.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredExplorerQuestions.map((q, idx) => {
                    const isExpanded = expandedQuestionId === (q.id || String(idx));
                    return (
                      <div
                        key={q.id || idx}
                        className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 transition space-y-3"
                      >
                        {/* Header info */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {q.category}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              {q.exam || 'SSC'} {q.year || ''} {q.tier ? `• ${q.tier}` : ''} {q.shift ? `• ${q.shift}` : ''}
                            </span>
                            {q.repeatCount && q.repeatCount > 1 && (
                              <span 
                                title={q.repeatCount > 5 ? `Repeated ${q.repeatCount} times` : undefined}
                                className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              >
                                Repeated {formatRepeatCount(q.repeatCount)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <ExamAppearancesBadge
                              appearances={q.appearances}
                              examHistory={q.examHistory}
                              repeatCount={q.repeatCount}
                              examFamily={q.examFamily}
                              year={q.year}
                              tier={q.tier}
                              shift={q.shift}
                              size="sm"
                            />
                            <button
                              onClick={() => setExpandedQuestionId(isExpanded ? null : (q.id || String(idx)))}
                              className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
                              title={isExpanded ? 'Collapse' : 'Expand full details'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Word and Question Text */}
                        <div>
                          <div className="text-[11px] text-slate-400">{q.instruction}</div>
                          <div className="text-base font-extrabold text-white mt-0.5">
                            "{q.wordOrPhrase}"
                          </div>
                        </div>

                        {/* 4 Options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === q.correctIndex;
                            return (
                              <div
                                key={optIdx}
                                className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                                  isCorrect
                                    ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200 font-bold'
                                    : 'bg-slate-900 border border-slate-800 text-slate-300'
                                }`}
                              >
                                <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                                    Correct Answer
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Collapsible Enrichment & Explanation Details */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-slate-800/80 space-y-3 text-xs">
                            {(() => {
                              const breakdown = resolveQuestionMeaningsBreakdown(q);
                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Hindi Meaning (हिन्दी अर्थ)</span>
                                    <div className="text-amber-200 font-medium text-xs leading-relaxed">
                                      <span className="font-bold text-amber-400 capitalize">{breakdown.targetWord}: </span>
                                      <span>{breakdown.targetHindi}</span>
                                    </div>
                                    {breakdown.correctOption && breakdown.correctHindi && (
                                      <div className="text-amber-100/90 font-medium text-xs pt-1.5 border-t border-slate-800/70 leading-relaxed">
                                        <span className="font-bold text-teal-300 capitalize">{breakdown.correctOption}</span>
                                        {breakdown.categoryLabel && (
                                          <span className="text-[9px] text-teal-300 font-semibold uppercase ml-1 px-1 py-0.5 rounded bg-teal-500/15 border border-teal-500/30">
                                            {breakdown.categoryLabel}
                                          </span>
                                        )}
                                        <span>: {breakdown.correctHindi}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">English Meaning</span>
                                    <div className="text-slate-200 text-xs leading-relaxed">
                                      <span className="font-bold text-sky-400 capitalize">{breakdown.targetWord}</span>
                                      <span className="text-slate-400 font-normal"> – </span>
                                      <span>{breakdown.targetMeaning}</span>
                                    </div>
                                    {breakdown.correctOption && breakdown.correctMeaning && (
                                      <div className="text-slate-300 text-xs pt-1.5 border-t border-slate-800/70 leading-relaxed">
                                        <span className="font-bold text-emerald-400 capitalize">{breakdown.correctOption}</span>
                                        {breakdown.categoryLabel && (
                                          <span className="text-[9px] text-emerald-300 font-semibold uppercase ml-1 px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                                            {breakdown.categoryLabel}
                                          </span>
                                        )}
                                        <span className="text-slate-400 font-normal"> – </span>
                                        <span>{breakdown.correctMeaning}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {q.mnemonic && (
                              <div className="bg-amber-950/20 border border-amber-500/30 p-2.5 rounded-lg text-amber-200">
                                <span className="text-amber-400 font-bold block text-[10px] uppercase">Memory Hook / Mnemonic</span>
                                {q.mnemonic}
                              </div>
                            )}

                            {/* Option Explanations */}
                            {q.optionDetails && q.optionDetails.length === 4 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-slate-400 font-bold block text-[10px] uppercase">All 4 Option Breakdowns:</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {q.optionDetails.map((od, odIdx) => (
                                    <div key={odIdx} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-[11px]">
                                      <div className="font-bold text-slate-200 flex items-center justify-between">
                                        <span>{String.fromCharCode(65 + odIdx)}. {od.option}</span>
                                        {od.hindiMeaning && <span className="text-amber-300 font-normal">{od.hindiMeaning}</span>}
                                      </div>
                                      <p className="text-slate-400 text-[10px] mt-0.5">
                                        {od.englishMeaning || od.explanation || od.shortExplanation}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 px-4 text-center rounded-xl bg-slate-950/60 border border-dashed border-slate-800 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    No Questions Found for this Selection
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {explorerExam !== 'ALL' || explorerYear !== 'ALL' || explorerTier !== 'ALL' ? (
                      <>
                        No cloud questions found matching <b>{explorerExam !== 'ALL' ? explorerExam : 'Any Exam'}</b>{' '}
                        {explorerYear !== 'ALL' ? `(${explorerYear})` : ''}{' '}
                        {explorerTier !== 'ALL' ? `[${explorerTier}]` : ''}.
                        <br />
                        You can upload and ingest this exam paper from the <b>JSON Ingest & Publisher</b> tab.
                      </>
                    ) : (
                      <>No questions match your current search or category filter.</>
                    )}
                  </p>
                  <button
                    onClick={() => {
                      setExplorerExam('ALL');
                      setExplorerYear('ALL');
                      setExplorerTier('ALL');
                      setExplorerCategory('ALL');
                      setExplorerSearch('');
                    }}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-sky-400 transition"
                  >
                    Reset Explorer Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: ADAPTIVE REPETITION SIMULATION TESTER */}
        {adminView === 'simulation' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <PlayCircle className="w-5 h-5 text-purple-400" />
                    200-Question Adaptive Repetition Simulator
                  </h3>
                  <p className="text-xs text-slate-400">
                    Simulates 200 real drill rounds to verify minimum concept repeat gap, verified PYQ rate, and category balance.
                  </p>
                </div>

                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                  Run 200-Round Simulation
                </button>
              </div>

              {simulationResult && (
                <div className="space-y-4 pt-3">
                  {/* Pass/Fail Banner */}
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    simulationResult.passedStrictChecks
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                  }`}>
                    {simulationResult.passedStrictChecks ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-black text-sm">
                        {simulationResult.passedStrictChecks
                          ? '✅ Adaptive Repetition V3: All Strict Spacing Criteria Passed'
                          : '⚠️ Repetition Verification Warning: Check Gap Distribution'}
                      </div>
                      <div className="text-xs opacity-90">
                        Minimum repeat gap is <strong>{simulationResult.minRepeatGap}</strong> rounds (V3 Requirement: ≥ 8). Average repeat gap is <strong>{simulationResult.avgRepeatGap}</strong> rounds.
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] text-slate-400 block">Unique Concepts</span>
                      <div className="text-xl font-black text-white font-mono">
                        {simulationResult.uniqueConceptsSeen} / {simulationResult.totalQuestions}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] text-slate-400 block">Min Repeat Gap</span>
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        {simulationResult.minRepeatGap} rounds
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] text-slate-400 block">Avg Repeat Gap</span>
                      <div className="text-xl font-black text-sky-400 font-mono">
                        {simulationResult.avgRepeatGap} rounds
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
                      <span className="text-[11px] text-slate-400 block">Verified PYQ Exposure</span>
                      <div className="text-xl font-black text-amber-400 font-mono">
                        {simulationResult.verifiedPyqPercentage}
                      </div>
                    </div>
                  </div>

                  {/* Category Distribution */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      Category Distribution across 200 Mixed Rounds:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 bg-slate-900 rounded-lg">
                        <span className="text-slate-400 block">Synonyms</span>
                        <b className="text-sky-400 font-mono">{simulationResult.categoryPercentages.synonyms} ({simulationResult.categoryCounts.synonyms})</b>
                      </div>
                      <div className="p-2 bg-slate-900 rounded-lg">
                        <span className="text-slate-400 block">Antonyms</span>
                        <b className="text-indigo-400 font-mono">{simulationResult.categoryPercentages.antonyms} ({simulationResult.categoryCounts.antonyms})</b>
                      </div>
                      <div className="p-2 bg-slate-900 rounded-lg">
                        <span className="text-slate-400 block">One-Word (OWS)</span>
                        <b className="text-emerald-400 font-mono">{simulationResult.categoryPercentages.ows} ({simulationResult.categoryCounts.ows})</b>
                      </div>
                      <div className="p-2 bg-slate-900 rounded-lg">
                        <span className="text-slate-400 block">Idioms</span>
                        <b className="text-amber-400 font-mono">{simulationResult.categoryPercentages.idioms} ({simulationResult.categoryCounts.idioms})</b>
                      </div>
                    </div>
                  </div>

                  {/* Log Details */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
                    <span className="text-xs font-bold text-slate-400 block font-mono">
                      Simulation Logs:
                    </span>
                    {simulationResult.logNotes.map((note, nIdx) => (
                      <div key={nIdx} className="text-xs text-slate-300 font-mono">
                        • {note}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-400" />
                Edit Question & Educational Metadata
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Word/Phrase</label>
                <input
                  type="text"
                  value={editingQuestion.wordOrPhrase}
                  onChange={e => setEditingQuestion({ ...editingQuestion, wordOrPhrase: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select
                  value={editingQuestion.category}
                  onChange={e => setEditingQuestion({ ...editingQuestion, category: e.target.value as QuestionCategory })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="synonyms">Synonyms</option>
                  <option value="antonyms">Antonyms</option>
                  <option value="ows">One-Word (OWS)</option>
                  <option value="idioms">Idioms & Phrases</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Question Prompt</label>
              <textarea
                value={editingQuestion.question}
                onChange={e => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Exam Family</label>
                <select
                  value={editingQuestion.examFamily || 'SSC'}
                  onChange={e => {
                    const fam = e.target.value;
                    const availableExams = EXAMS_BY_FAMILY[fam] || EXAMS_BY_FAMILY.SSC;
                    const newExam = availableExams.includes(editingQuestion.exam) ? editingQuestion.exam : (availableExams[0] || 'SSC CGL');
                    const stageOptions = getStageOptionsForExam(newExam);
                    const tierStillValid = stageOptions.includes(editingQuestion.tier || '');
                    if (!tierStillValid) setModalCustomTier(false);
                    setEditingQuestion({
                      ...editingQuestion,
                      examFamily: fam,
                      exam: newExam,
                      tier: tierStillValid ? editingQuestion.tier : '',
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="SSC">SSC</option>
                  <option value="Banking">Banking</option>
                  <option value="Defence">Defence</option>
                  <option value="Railways">Railways</option>
                  <option value="State">State Govt</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Specific Exam</label>
                <select
                  value={editingQuestion.exam}
                  onChange={e => {
                    const newExam = e.target.value;
                    const stageOptions = getStageOptionsForExam(newExam);
                    const tierStillValid = stageOptions.includes(editingQuestion.tier || '');
                    if (!tierStillValid) setModalCustomTier(false);
                    setEditingQuestion({
                      ...editingQuestion,
                      exam: newExam,
                      tier: tierStillValid ? editingQuestion.tier : '',
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {(() => {
                    const fam = editingQuestion.examFamily || 'SSC';
                    const available = EXAMS_BY_FAMILY[fam] || EXAMS_BY_FAMILY.SSC;
                    const optionsList = available.includes(editingQuestion.exam) ? available : [editingQuestion.exam, ...available];
                    return optionsList.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Exam Year</label>
                <input
                  type="number"
                  value={editingQuestion.year || 2024}
                  onChange={e => setEditingQuestion({ ...editingQuestion, year: parseInt(e.target.value, 10) || 2024 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Stage / Tier / Phase</label>
                <div className="space-y-1">
                  <select
                    value={
                      !editingQuestion.tier
                        ? ''
                        : modalCustomTier || !getStageOptionsForExam(editingQuestion.exam).includes(editingQuestion.tier)
                        ? '__custom__'
                        : editingQuestion.tier
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setModalCustomTier(true);
                        if (getStageOptionsForExam(editingQuestion.exam).includes(editingQuestion.tier || '')) {
                          setEditingQuestion({ ...editingQuestion, tier: '' });
                        }
                      } else {
                        setModalCustomTier(false);
                        setEditingQuestion({ ...editingQuestion, tier: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Not Specified</option>
                    {getStageOptionsForExam(editingQuestion.exam).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    <option value="__custom__">Custom Stage / Tier...</option>
                  </select>

                  {(modalCustomTier || (!getStageOptionsForExam(editingQuestion.exam).includes(editingQuestion.tier || '') && Boolean(editingQuestion.tier))) && (
                    <input
                      type="text"
                      value={editingQuestion.tier || ''}
                      onChange={e => setEditingQuestion({ ...editingQuestion, tier: e.target.value })}
                      placeholder="e.g. Tier-I, Paper-I, Stage-II, Written Exam"
                      className="w-full bg-slate-950 border border-sky-500/50 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-medium"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Question Number (Q#)</label>
                <input
                  type="text"
                  value={editingQuestion.questionNumber || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, questionNumber: e.target.value })}
                  placeholder="e.g. 76"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* 4 Options */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block font-semibold">4 Options (Select radio for correct answer)</label>
              {editingQuestion.options.map((opt, oIdx) => (
                <div key={oIdx} className="space-y-1 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-ans"
                      checked={editingQuestion.correctIndex === oIdx}
                      onChange={() => setEditingQuestion({ ...editingQuestion, correctIndex: oIdx })}
                      className="accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {String.fromCharCode(65 + oIdx)}:
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[oIdx] = e.target.value;
                        const newDetails = editingQuestion.optionDetails ? [...editingQuestion.optionDetails] : [];
                        if (newDetails[oIdx]) {
                          newDetails[oIdx] = { ...newDetails[oIdx], text: e.target.value, option: e.target.value };
                        }
                        setEditingQuestion({ ...editingQuestion, options: newOpts, optionDetails: newDetails.length > 0 ? newDetails : undefined });
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)} text`}
                    />
                  </div>
                  {editingQuestion.optionDetails && editingQuestion.optionDetails[oIdx] && (
                    <div className="grid grid-cols-2 gap-2 pl-6 pt-1">
                      <input
                        type="text"
                        value={editingQuestion.optionDetails[oIdx].hindiMeaning || ''}
                        onChange={e => {
                          const newDetails = [...(editingQuestion.optionDetails || [])];
                          newDetails[oIdx] = { ...newDetails[oIdx], hindiMeaning: e.target.value };
                          setEditingQuestion({ ...editingQuestion, optionDetails: newDetails });
                        }}
                        placeholder="Hindi meaning"
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-emerald-300"
                      />
                      <input
                        type="text"
                        value={(editingQuestion.optionDetails[oIdx] as any).englishMeaning || editingQuestion.optionDetails[oIdx].meaning || ''}
                        onChange={e => {
                          const newDetails = [...(editingQuestion.optionDetails || [])];
                          newDetails[oIdx] = { 
                            ...newDetails[oIdx], 
                            meaning: e.target.value, 
                            englishMeaning: e.target.value,
                            explanation: e.target.value
                          };
                          setEditingQuestion({ ...editingQuestion, optionDetails: newDetails });
                        }}
                        placeholder="English meaning"
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Rich Educational Fields */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <span className="text-xs font-bold text-amber-400 block">Educational Learning Fields</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target English Meaning</label>
                  <input
                    type="text"
                    value={editingQuestion.meaning || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, meaning: e.target.value })}
                    placeholder="Clear definition"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Hindi Meaning</label>
                  <input
                    type="text"
                    value={editingQuestion.hindiMeaning || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, hindiMeaning: e.target.value })}
                    placeholder="हिन्दी अर्थ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Memory Hook / Mnemonic</label>
                  <input
                    type="text"
                    value={editingQuestion.mnemonic || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, mnemonic: e.target.value })}
                    placeholder="e.g. sounds like..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Root Word / Etymology</label>
                  <input
                    type="text"
                    value={editingQuestion.rootWordInfo || ''}
                    onChange={e => setEditingQuestion({ ...editingQuestion, rootWordInfo: e.target.value })}
                    placeholder="e.g. Latin 'bene' meaning well"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Example Sentence</label>
                <input
                  type="text"
                  value={editingQuestion.exampleSentence || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, exampleSentence: e.target.value })}
                  placeholder="Example sentence using the target word"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Explanation / Rationale</label>
                <textarea
                  value={editingQuestion.explanation || ''}
                  onChange={e => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  rows={2}
                  placeholder="Explain why the correct answer fits and others do not"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editingQuestion)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
