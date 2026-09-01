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
  Wand2
} from 'lucide-react';
import { ExtractedQuestion, ImportBatch, ReviewStatus } from '../types/pyqImport';
import { parseAndValidatePyqJSON, SkippedQuestionItem, extractJsonMetadata, formatExamTag, normalizeExamDate } from '../services/jsonPyqParser';
import { questionBankEngine } from '../services/questionBankEngine';
import { publishApprovedQuestionsToFirestore, isUserAdmin, ADMIN_EMAIL } from '../services/pyqFirestoreService';
import { 
  enrichQuestionBatch, 
  enrichSingleQuestion, 
  enrichFirestoreQuestions, 
  backfillQuestionBankEnrichment,
  needsEnrichment 
} from '../services/pyqEnrichmentService';
import { Question, QuestionCategory } from '../types';
import { EXAMS_BY_FAMILY, EXAM_STAGE_OPTIONS, getStageOptionsForExam, normalizeTier } from '../config/examMetadataConfig';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';

interface AdminPyqImporterProps {
  userEmail?: string | null;
  onClose: () => void;
}

export const AdminPyqImporter: React.FC<AdminPyqImporterProps> = ({ userEmail, onClose }) => {
  const isAdmin = isUserAdmin(userEmail) || (typeof window !== 'undefined' && window.location.hostname === 'localhost');

  // Navigation mode
  const [adminView, setAdminView] = useState<'importer' | 'health' | 'simulation'>('importer');

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
  const [enrichProgress, setEnrichProgress] = useState<{ processed: number; total: number; stage: string } | null>(null);
  const [isBackfilling, setIsBackfilling] = useState<boolean>(false);
  const [backfillProgress, setBackfillProgress] = useState<{ processed: number; total: number; updated: number; currentExam?: string } | null>(null);
  const [backfillSummary, setBackfillSummary] = useState<{ totalChecked: number; totalUpdated: number; durationMs: number } | null>(null);
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

  // Simulation State
  const [simulationResult, setSimulationResult] = useState<ReturnType<typeof questionBankEngine.runRepetitionSimulation> | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  useEffect(() => {
    setHealthData(questionBankEngine.getCloudVsRuntimeCounts());
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

  const handleEnrichBatch = async (questionsToEnrich?: ExtractedQuestion[]) => {
    const list = questionsToEnrich || extractedQuestions;
    if (list.length === 0) return;

    setIsEnriching(true);
    setErrorMessage(null);
    setEnrichProgress({ processed: 0, total: list.length, stage: 'Starting AI Enrichment for Hindi, Mnemonics & 4-Option Details...' });

    try {
      const { enrichedQuestions } = await enrichQuestionBatch(
        list,
        (progress) => {
          setEnrichProgress({ processed: progress.current, total: progress.total, stage: progress.stage });
        }
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
      const enriched = await enrichSingleQuestion(target);
      setExtractedQuestions(prev => prev.map(q => q.tempId === tempId ? { ...enriched, reviewStatus: q.reviewStatus } : q));
    } catch (err: any) {
      setErrorMessage(`Single question enrichment error: ${err?.message}`);
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
      // Ensure all approved questions have full educational enrichment before saving
      let readyToPublish = [...approved];
      const pendingEnrichment = readyToPublish.filter(q => needsEnrichment(q));

      if (pendingEnrichment.length > 0) {
        setIsEnriching(true);
        setEnrichProgress({
          processed: 0,
          total: pendingEnrichment.length,
          stage: `Completing full AI enrichment for ${pendingEnrichment.length} questions before saving...`,
        });

        const { enrichedQuestions } = await enrichQuestionBatch(pendingEnrichment, (prog) => {
          setEnrichProgress({
            processed: prog.current,
            total: prog.total,
            stage: prog.stage,
          });
        });

        const enrichedMap = new Map(enrichedQuestions.map(eq => [eq.tempId, eq]));
        readyToPublish = readyToPublish.map(q => enrichedMap.get(q.tempId) || q);
        setExtractedQuestions(prev => prev.map(q => enrichedMap.get(q.tempId) || q));
        setEnrichProgress(null);
        setIsEnriching(false);
      }

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

        const examHistoryItem = formatExamTag(resolvedExam, resolvedYear, resolvedExamDate, resolvedShift, resolvedTier);

        return {
          id: `pyq-${q.category}-${resolvedYear}-${q.wordOrPhrase.toLowerCase().replace(/[^a-z0-9]/g, '_')}-${Math.random().toString(36).slice(2, 6)}`,
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
          examFamily: resolvedFamily,
          exam: resolvedExam,
          year: resolvedYear,
          tier: resolvedTier,
          shift: resolvedShift,
          examDate: resolvedExamDate,
          questionNumber: resolvedQNo,
          examHistory: q.examHistory && q.examHistory.length > 0 ? q.examHistory : [examHistoryItem],
          repeatCount: q.repeatCount || 1,
          importanceLevel: q.importanceLevel || 'high',
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Admin Navigation Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white flex items-center gap-2">
              VocabClash Admin Question Engine V3
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                Production Engine
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Deterministic 4-Category Filter • Firestore Cloud Synchronization • Adaptive Repetition Diagnostics
            </p>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdminView('importer')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              adminView === 'health'
                ? 'bg-sky-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Question Bank Health ({healthData.totalCloud} Cloud)
          </button>

          <button
            onClick={() => setAdminView('simulation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              adminView === 'simulation'
                ? 'bg-purple-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Repetition Simulator
          </button>

          <button
            onClick={onClose}
            className="ml-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition"
          >
            Exit Admin Mode
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl w-full mx-auto">
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
                      onClick={() => handleEnrichBatch()}
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
                        const isEnriched = Boolean(q.hindiMeaning && q.meaning && q.optionDetails && q.optionDetails.length === 4);
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
                                      <Sparkles className="w-2.5 h-2.5" /> Enriched
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium border border-amber-500/30">
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

                                  {q.duplicateConfidence && q.duplicateConfidence !== 'none' && !q.matchedExistingQuestion && (
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
                                  className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition"
                                  title="Re-enrich with AI"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
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
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <span className="text-slate-500 font-bold uppercase text-[10px] block">English Meaning</span>
                                  <span className="text-slate-200">{q.meaning || <em className="text-slate-600">Pending AI enrichment</em>}</span>
                                </div>
                                <div>
                                  <span className="text-emerald-400/90 font-bold uppercase text-[10px] block">Hindi Meaning (हिन्दी अर्थ)</span>
                                  <span className="text-emerald-200 font-medium">{q.hindiMeaning || <em className="text-slate-600">Pending AI enrichment</em>}</span>
                                </div>
                              </div>

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
                                      {q.optionDetails.map((optDetail, oIdx) => (
                                        <div 
                                          key={oIdx} 
                                          className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                                            oIdx === q.correctIndex
                                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                                              : 'bg-slate-950 border-slate-800/80 text-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between font-bold">
                                            <span>Option {String.fromCharCode(65 + oIdx)}: {optDetail.text}</span>
                                            {oIdx === q.correctIndex && (
                                              <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 py-0.2 rounded uppercase">
                                                Correct
                                              </span>
                                            )}
                                          </div>
                                          {optDetail.hindiMeaning && (
                                            <div className="text-emerald-300 font-medium">
                                              हिन्दी: {optDetail.hindiMeaning}
                                            </div>
                                          )}
                                          {optDetail.meaning && (
                                            <div className="text-slate-300">
                                              Meaning: {optDetail.meaning}
                                            </div>
                                          )}
                                          {optDetail.mnemonic && (
                                            <div className="text-amber-300/80 text-[10px]">
                                              Hook: {optDetail.mnemonic}
                                            </div>
                                          )}
                                        </div>
                                      ))}
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

                    <span className="text-xs text-amber-400 font-bold">
                      Repeated {previewQuestion.repeatCount}x in Govt Exams
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
                          newDetails[oIdx] = { ...newDetails[oIdx], text: e.target.value };
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
                        value={editingQuestion.optionDetails[oIdx].meaning || ''}
                        onChange={e => {
                          const newDetails = [...(editingQuestion.optionDetails || [])];
                          newDetails[oIdx] = { ...newDetails[oIdx], meaning: e.target.value };
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
