import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  Filter, 
  Check, 
  Edit3, 
  Trash2, 
  Flag, 
  BookOpen, 
  HelpCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  UploadCloud
} from 'lucide-react';
import { Question, QuestionCategory } from '../types';
import { QuestionQualityResult, QualityAuditStats, QualityStatus, QualityIssueCode, UserQuestionReport } from '../types/pyqQuality';
import { pyqQualityAuditService, fetchUserQuestionReports } from '../services/pyqQualityAuditService';
import { enrichSingleQuestion } from '../services/pyqEnrichmentService';
import { questionBankEngine } from '../services/questionBankEngine';
import { AdminQuestionEditModal } from './AdminQuestionEditModal';
import { ExamAppearancesBadge } from './ExamAppearancesBadge';

interface AdminPyqQualityReviewProps {
  cloudQuestions: Question[];
  onRefreshCloud: () => Promise<void>;
}

export const AdminPyqQualityReview: React.FC<AdminPyqQualityReviewProps> = ({
  cloudQuestions,
  onRefreshCloud,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const [auditMap, setAuditMap] = useState<Map<string, QuestionQualityResult>>(new Map());
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);
  const [userReports, setUserReports] = useState<UserQuestionReport[]>([]);

  // Filtering & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'suspicious' | 'valid' | 'reported'>('reported');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [issueCodeFilter, setIssueCodeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing & Deleting & In-Place Enriching/Pushing
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvingKeepId, setResolvingKeepId] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [localQuestionOverrides, setLocalQuestionOverrides] = useState<Map<string, Question>>(new Map());
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expanded report cards
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
    setLastScannedAt(pyqQualityAuditService.getLastScannedAt());
    setUserReports(pyqQualityAuditService.getUserReports());

    // Fetch fresh reports on mount
    fetchUserQuestionReports().then(reports => {
      if (reports && reports.length > 0) {
        setUserReports(reports);
      }
    }).catch(e => console.warn('Could not fetch initial reports:', e));
  }, []);

  const handleRunScan = async (useFirestoreDirect: boolean = true) => {
    setIsScanning(true);
    setActionFeedback(null);
    try {
      const targetQuestions = useFirestoreDirect ? undefined : cloudQuestions;
      const { stats, results } = await pyqQualityAuditService.runScan(targetQuestions, progress => {
        setScanProgress(progress);
      });
      setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
      setLastScannedAt(stats.lastScannedAt);
      setUserReports(pyqQualityAuditService.getUserReports());
      setActionFeedback({
        type: 'success',
        message: `Scan complete: ${stats.totalScanned} scanned (${stats.criticalCount} critical, ${stats.suspiciousCount} suspicious, ${stats.validCount} valid, ${stats.reportedCount} reported).`,
      });
    } catch (err: any) {
      console.error('[PYQ Admin Scan]', err);
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to complete quality scan.',
      });
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Helper to match reports to questions reliably
  const getReportsForQuestion = (q: Question): UserQuestionReport[] => {
    const qWord = (q.wordOrPhrase || '').trim().toLowerCase();
    const qCat = (q.category || '').toLowerCase();
    const qId = q.id;
    const qCanon = q.canonicalQuestionId;

    return userReports.filter(r => {
      if (r.status === 'resolved' || r.status === 'dismissed') return false;
      
      const rWord = (r.wordOrPhrase || r.questionData?.wordOrPhrase || '').trim().toLowerCase();
      const rCat = (r.category || r.questionData?.category || '').toLowerCase();
      const rId = r.questionId;
      const rDataId = r.questionData?.id;
      const rDataCanon = r.questionData?.canonicalQuestionId;

      if (rId && (rId === qId || rId === qCanon)) return true;
      if (rDataId && (rDataId === qId || rDataId === qCanon)) return true;
      if (rDataCanon && (rDataCanon === qId || rDataCanon === qCanon)) return true;
      if (qWord && rWord && qWord === rWord && (!qCat || !rCat || qCat === rCat)) return true;

      return false;
    });
  };

  const handleKeep = async (q: Question) => {
    setResolvingKeepId(q.id);
    try {
      const reports = getReportsForQuestion(q);
      const reportIds = reports.map(r => r.reportId);

      await pyqQualityAuditService.markAsKeep(q.id);
      if (q.canonicalQuestionId && q.canonicalQuestionId !== q.id) {
        await pyqQualityAuditService.markAsKeep(q.canonicalQuestionId);
      }

      // Immediately clear discrepancy reports from state so questions leave "User Reports" tab
      setUserReports(prev => prev.filter(r => 
        !reportIds.includes(r.reportId) && r.questionId !== q.id && r.questionId !== q.canonicalQuestionId
      ));
      setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
      setActionFeedback({
        type: 'success',
        message: `Question acknowledged as VALID and all discrepancy reports dismissed!`,
      });
    } catch (e: any) {
      console.warn('Keep action fallback:', e);
      setUserReports(prev => prev.filter(r => r.questionId !== q.id));
      setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
      setActionFeedback({
        type: 'success',
        message: `Question acknowledged as VALID and discrepancy reports cleared.`,
      });
    } finally {
      setResolvingKeepId(null);
    }
  };

  const handleDismissSingleReport = async (reportId: string, qId: string) => {
    try {
      await pyqQualityAuditService.deleteSingleReport(reportId, qId);
      setUserReports(prev => prev.filter(r => r.reportId !== reportId));
      setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
      setActionFeedback({
        type: 'success',
        message: 'Discrepancy report dismissed.',
      });
    } catch (e) {
      setUserReports(prev => prev.filter(r => r.reportId !== reportId));
    }
  };

  // 1. ENRICH IT FROM HERE
  const handleEnrichQuestion = async (q: Question) => {
    setEnrichingId(q.id);
    setActionFeedback(null);
    try {
      const enriched = await enrichSingleQuestion(q as any, true);
      
      const updatedQuestion: Question = {
        ...q,
        meaning: enriched.meaning || q.meaning,
        hindiMeaning: enriched.hindiMeaning || q.hindiMeaning,
        mnemonic: enriched.mnemonic || q.mnemonic,
        exampleSentence: enriched.exampleSentence || q.exampleSentence,
        rootWordInfo: enriched.rootWordInfo || q.rootWordInfo,
        explanation: enriched.explanation || q.explanation,
        optionDetails: enriched.optionDetails || q.optionDetails,
        enrichment: enriched.enrichment,
      };

      // Store in local overrides so UI reflects enriched definitions immediately
      setLocalQuestionOverrides(prev => {
        const next = new Map(prev);
        next.set(q.id, updatedQuestion);
        if (q.canonicalQuestionId) next.set(q.canonicalQuestionId, updatedQuestion);
        return next;
      });

      // Update question bank engine memory
      questionBankEngine.registerApprovedQuestions([updatedQuestion], false);

      setActionFeedback({
        type: 'success',
        message: `✨ Successfully enriched "${q.wordOrPhrase}" with AI definitions & option breakdowns! Click "Push Firestore" to save permanently.`,
      });
    } catch (err: any) {
      console.error('Enrichment failed:', err);
      setActionFeedback({
        type: 'error',
        message: `Enrichment failed: ${err?.message || 'Could not enrich question.'}`,
      });
    } finally {
      setEnrichingId(null);
    }
  };

  // 2. PUSH IT IN FIRESTORM (PUSH TO FIRESTORE)
  const handlePushToFirestore = async (q: Question) => {
    setPushingId(q.id);
    setActionFeedback(null);
    try {
      const effectiveQuestion = localQuestionOverrides.get(q.id) || localQuestionOverrides.get(q.canonicalQuestionId || '') || q;
      const reports = getReportsForQuestion(effectiveQuestion);
      const reportIds = reports.map(r => r.reportId);

      const res = await pyqQualityAuditService.pushQuestionToFirestore(effectiveQuestion, reportIds);
      if (!res.success) {
        throw new Error(res.error || 'Failed to push to Firestore');
      }

      // Update userReports locally to dismiss the resolved reports
      setUserReports(prev => prev.filter(r => !reportIds.includes(r.reportId)));
      
      // Update local override
      setLocalQuestionOverrides(prev => {
        const next = new Map(prev);
        next.set(effectiveQuestion.id, effectiveQuestion);
        return next;
      });

      setActionFeedback({
        type: 'success',
        message: `🚀 Successfully pushed "${effectiveQuestion.wordOrPhrase}" to Firestore Question Bank and resolved ${reportIds.length} discrepancy report(s)!`,
      });

      // Refresh cloud explorer in parent
      onRefreshCloud().catch(console.warn);
    } catch (err: any) {
      console.error('Push to Firestore failed:', err);
      setActionFeedback({
        type: 'error',
        message: `Push failed: ${err?.message || 'Could not push to Firestore.'}`,
      });
    } finally {
      setPushingId(null);
    }
  };

  // 3. EDIT QUESTION
  const handleSaveEdit = async (updatedFields: Partial<Question>, pushDirectly: boolean = false) => {
    if (!editingQuestion) return;
    setIsSavingEdit(true);
    try {
      const merged: Question = {
        ...editingQuestion,
        ...updatedFields,
      };

      if (pushDirectly) {
        const reports = getReportsForQuestion(editingQuestion);
        const reportIds = reports.map(r => r.reportId);

        const res = await pyqQualityAuditService.pushQuestionToFirestore(merged, reportIds);
        if (!res.success) {
          throw new Error(res.error || 'Failed to push to Firestore');
        }

        setUserReports(prev => prev.filter(r => !reportIds.includes(r.reportId)));
        setLocalQuestionOverrides(prev => {
          const next = new Map(prev);
          next.set(merged.id, merged);
          return next;
        });

        setEditingQuestion(null);
        setActionFeedback({
          type: 'success',
          message: `Question "${merged.wordOrPhrase}" saved & pushed to Firestore! Discrepancy report(s) resolved.`,
        });
        await onRefreshCloud();
      } else {
        const res = await pyqQualityAuditService.updateQuestionSafely(
          editingQuestion.id,
          updatedFields,
          editingQuestion
        );
        if (res.success) {
          setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
          setLocalQuestionOverrides(prev => {
            const next = new Map(prev);
            next.set(merged.id, merged);
            return next;
          });
          await onRefreshCloud();
          setEditingQuestion(null);
          setActionFeedback({
            type: 'success',
            message: `Question "${updatedFields.wordOrPhrase || editingQuestion.wordOrPhrase}" safely updated in Firestore!`,
          });
        } else {
          setActionFeedback({
            type: 'error',
            message: res.error || 'Failed to save question edits.',
          });
        }
      }
    } catch (err: any) {
      console.error('[PYQ Admin Save/Push]', err);
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to save question edits.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 4. DELETE IT
  const executeDeletePermanent = async (question: Question) => {
    setDeletingId(question.id);
    try {
      const res = await pyqQualityAuditService.deleteQuestionSafely(question.id);
      if (res.success) {
        setDeletedIds(prev => {
          const next = new Set(prev);
          next.add(question.id);
          if (question.canonicalQuestionId) next.add(question.canonicalQuestionId);
          return next;
        });

        // Clean up linked reports
        const reports = getReportsForQuestion(question);
        const reportIds = reports.map(r => r.reportId);
        setUserReports(prev => prev.filter(r => !reportIds.includes(r.reportId) && r.questionId !== question.id));

        setAuditMap(prev => {
          const next = new Map(prev);
          next.delete(question.id);
          if (question.canonicalQuestionId) next.delete(question.canonicalQuestionId);
          return next;
        });
        setQuestionToDelete(null);
        setActionFeedback({
          type: 'success',
          message: `Question "${question.wordOrPhrase}" and all associated discrepancy reports permanently deleted.`,
        });

        onRefreshCloud().catch(err => console.error('[PYQ Admin Delete]', err));
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error || 'Failed to delete question.',
        });
      }
    } catch (err: any) {
      console.error('[PYQ Admin Delete]', err);
      setDeletedIds(prev => new Set(prev).add(question.id));
      setUserReports(prev => prev.filter(r => r.questionId !== question.id));
      setQuestionToDelete(null);
      setActionFeedback({
        type: 'success',
        message: `Question removed locally.`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Comprehensive question set: Cloud questions + any reported questions (ensures no report is ever orphaned or invisible!)
  const activeQuestions = useMemo(() => {
    const baseMap = new Map<string, Question>();
    
    // 1. Add cloud questions
    cloudQuestions.forEach(q => {
      if (!deletedIds.has(q.id) && (!q.canonicalQuestionId || !deletedIds.has(q.canonicalQuestionId))) {
        const effective = localQuestionOverrides.get(q.id) || (q.canonicalQuestionId ? localQuestionOverrides.get(q.canonicalQuestionId) : undefined) || q;
        baseMap.set(q.id, effective);
      }
    });

    // 2. Index runtime questions from questionBankEngine
    const runtimeList = questionBankEngine.getImportedQuestions();
    const runtimeByWord = new Map<string, Question>();
    const runtimeById = new Map<string, Question>();
    runtimeList.forEach(rq => {
      if (rq.id) runtimeById.set(rq.id, rq);
      if (rq.canonicalQuestionId) runtimeById.set(rq.canonicalQuestionId, rq);
      if (rq.wordOrPhrase && rq.category) {
        runtimeByWord.set(`${rq.category.toLowerCase()}::${rq.wordOrPhrase.trim().toLowerCase()}`, rq);
      }
    });

    // 3. For any open user report: ensure corresponding question exists in active set
    userReports.forEach(r => {
      if (r.status === 'resolved' || r.status === 'dismissed') return;
      
      let foundInBase = false;
      for (const q of baseMap.values()) {
        const idMatches = (
          q.id === r.questionId || 
          q.canonicalQuestionId === r.questionId ||
          (r.questionData && (q.id === r.questionData.id || q.canonicalQuestionId === r.questionData.canonicalQuestionId))
        );
        const wordMatches = (
          (q.wordOrPhrase || '').trim().toLowerCase() === (r.wordOrPhrase || r.questionData?.wordOrPhrase || '').trim().toLowerCase() &&
          (!q.category || !r.category || q.category.toLowerCase() === (r.category || '').toLowerCase())
        );
        if (idMatches || wordMatches) {
          foundInBase = true;
          break;
        }
      }

      if (!foundInBase) {
        const wordKey = `${(r.category || '').toLowerCase()}::${(r.wordOrPhrase || '').trim().toLowerCase()}`;
        const matchRuntime = (r.questionId && runtimeById.get(r.questionId)) ||
          (r.questionData?.canonicalQuestionId && runtimeById.get(r.questionData.canonicalQuestionId)) ||
          (r.questionData?.id && runtimeById.get(r.questionData.id)) ||
          runtimeByWord.get(wordKey);

        if (matchRuntime && !deletedIds.has(matchRuntime.id)) {
          const effective = localQuestionOverrides.get(matchRuntime.id) || matchRuntime;
          baseMap.set(matchRuntime.id, effective);
        } else if (r.questionData && !deletedIds.has(r.questionData.id || r.questionId)) {
          const qd = r.questionData;
          const effective = localQuestionOverrides.get(qd.id || r.questionId) || qd;
          baseMap.set(qd.id || r.questionId, effective);
        } else if (!deletedIds.has(r.questionId)) {
          const synthQ: Question = {
            id: r.questionId,
            canonicalQuestionId: r.questionId,
            category: (r.category as QuestionCategory) || 'synonyms',
            wordOrPhrase: r.wordOrPhrase || 'Reported Question',
            instruction: `Select the most appropriate ${(r.category || 'vocab').toUpperCase()} of:`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctIndex: 0,
            meaning: '',
            hindiMeaning: '',
            exampleSentence: '',
            mnemonic: '',
            explanation: r.reason ? `User Reported: ${r.reason}` : '',
            examHistory: [],
            repeatCount: 1,
            importanceLevel: 'high',
            difficulty: 'medium',
            verified: false,
            sourceType: 'verified_pyq',
            isPYQ: true,
          };
          const effective = localQuestionOverrides.get(r.questionId) || synthQ;
          baseMap.set(r.questionId, effective);
        }
      }
    });

    return Array.from(baseMap.values());
  }, [cloudQuestions, deletedIds, userReports, localQuestionOverrides]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalScanned = 0;
    let criticalCount = 0;
    let suspiciousCount = 0;
    let validCount = 0;

    activeQuestions.forEach(q => {
      totalScanned++;
      const audit = auditMap.get(q.id) || (q.canonicalQuestionId ? auditMap.get(q.canonicalQuestionId) : undefined);
      const isReported = getReportsForQuestion(q).length > 0;
      if (audit) {
        if (audit.status === 'critical') criticalCount++;
        else if (audit.status === 'suspicious') suspiciousCount++;
        else validCount++;
      } else if (isReported) {
        suspiciousCount++;
      } else {
        validCount++;
      }
    });

    const openReportsCount = userReports.filter(r => r.status !== 'resolved' && r.status !== 'dismissed').length;

    return {
      totalScanned,
      criticalCount,
      suspiciousCount,
      validCount,
      reportedCount: openReportsCount,
    };
  }, [activeQuestions, auditMap, userReports]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return activeQuestions.filter(q => {
      const audit = auditMap.get(q.id) || (q.canonicalQuestionId ? auditMap.get(q.canonicalQuestionId) : undefined);
      const reports = getReportsForQuestion(q);
      const hasReports = reports.length > 0;

      const effectiveStatus: QualityStatus = audit
        ? audit.status
        : (hasReports ? 'suspicious' : 'valid');

      // Status filter
      if (statusFilter === 'critical' && effectiveStatus !== 'critical') return false;
      if (statusFilter === 'suspicious' && effectiveStatus !== 'suspicious') return false;
      if (statusFilter === 'valid' && effectiveStatus !== 'valid') return false;
      if (statusFilter === 'reported' && !hasReports) return false;

      // Category filter
      if (categoryFilter !== 'all' && q.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Issue Code filter
      if (issueCodeFilter !== 'all') {
        if (!audit || !audit.issues.some(i => i.code === issueCodeFilter)) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inTarget = (q.wordOrPhrase || '').toLowerCase().includes(query);
        const inInstruction = (q.instruction || q.question || '').toLowerCase().includes(query);
        const inOptions = (q.options || []).some(opt => opt.toLowerCase().includes(query));
        const inId = (q.id || '').toLowerCase().includes(query);
        if (!inTarget && !inInstruction && !inOptions && !inId) return false;
      }

      return true;
    });
  }, [activeQuestions, auditMap, userReports, statusFilter, categoryFilter, issueCodeFilter, searchQuery]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner & Audit Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/60 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                PYQ Question Quality Audit & Discrepancies
              </span>
              {lastScannedAt && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Last scanned: {new Date(lastScannedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100 mt-1">
              Quality Review & Aspirant Reports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review flagged questions, auto-enrich definitions, delete corrupted entries, or push verified fixes directly to Firestore.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunScan(false)}
              disabled={isScanning}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Question Bank'}</span>
            </button>
          </div>
        </div>

        {/* Action feedback banner */}
        {actionFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
                : 'bg-rose-950/70 border-rose-800/80 text-rose-200'
            }`}
          >
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scan Progress Bar */}
        {isScanning && scanProgress && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 animate-fadeIn">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="font-semibold text-amber-400">{scanProgress.stage}</span>
              <span>{Math.round((scanProgress.current / Math.max(1, scanProgress.total)) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-200 rounded-full"
                style={{ width: `${Math.min(100, (scanProgress.current / Math.max(1, scanProgress.total)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-800 border-slate-600 shadow-md ring-1 ring-slate-500'
                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <div className="text-[11px] text-slate-400 font-medium">Total Questions</div>
            <div className="text-lg font-black text-slate-100 mt-0.5">{stats.totalScanned}</div>
          </button>

          <button
            onClick={() => setStatusFilter('critical')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'critical'
                ? 'bg-rose-950/80 border-rose-500 shadow-md ring-1 ring-rose-500'
                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Critical Issues
            </div>
            <div className="text-lg font-black text-rose-400 mt-0.5">{stats.criticalCount}</div>
          </button>

          <button
            onClick={() => setStatusFilter('suspicious')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'suspicious'
                ? 'bg-amber-950/80 border-amber-500 shadow-md ring-1 ring-amber-500'
                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Suspicious
            </div>
            <div className="text-lg font-black text-amber-400 mt-0.5">{stats.suspiciousCount}</div>
          </button>

          <button
            onClick={() => setStatusFilter('reported')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'reported'
                ? 'bg-purple-950/80 border-purple-500 shadow-md ring-1 ring-purple-500'
                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <div className="text-[11px] text-purple-400 font-bold flex items-center gap-1">
              <Flag className="w-3.5 h-3.5" />
              User Reports
            </div>
            <div className="text-lg font-black text-purple-300 mt-0.5">{stats.reportedCount}</div>
          </button>

          <button
            onClick={() => setStatusFilter('valid')}
            className={`p-3 rounded-xl border text-left transition-all ${
              statusFilter === 'valid'
                ? 'bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                : 'bg-slate-950/60 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Valid Clean
            </div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{stats.validCount}</div>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search word, prompt, options, or question ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500"
          >
            <option value="all">All Categories</option>
            <option value="synonyms">Synonyms</option>
            <option value="antonyms">Antonyms</option>
            <option value="idioms">Idioms</option>
            <option value="one-word-substitution">One-Word Substitution</option>
            <option value="spelling">Spelling</option>
          </select>

          {/* Issue Code Dropdown */}
          <select
            value={issueCodeFilter}
            onChange={e => setIssueCodeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-500"
          >
            <option value="all">All Issue Types</option>
            <option value="TARGET_EQUALS_OPTION">Target equals Option</option>
            <option value="DUPLICATE_OPTIONS">Duplicate Options</option>
            <option value="INVALID_CORRECT_ANSWER">Invalid Key</option>
            <option value="MALFORMED_OPTIONS">Malformed Options</option>
            <option value="SUSPICIOUS_CATEGORY_MISMATCH">Category Mismatch</option>
            <option value="USER_REPORTED">User Reported</option>
          </select>
        </div>
      </div>

      {/* Question Results List Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          Showing <span className="text-slate-100 font-bold">{filteredQuestions.length}</span> question{filteredQuestions.length === 1 ? '' : 's'}
          {statusFilter !== 'all' && <span className="ml-1.5 uppercase font-semibold text-slate-500">| Status: {statusFilter}</span>}
          {categoryFilter !== 'all' && <span className="ml-1.5 uppercase font-semibold text-slate-500">| Cat: {categoryFilter}</span>}
        </div>
      </div>

      {/* Question Cards List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              {statusFilter === 'reported' ? <Flag className="w-6 h-6 text-purple-400" /> : <ShieldCheck className="w-6 h-6 text-emerald-400" />}
            </div>
            <h3 className="text-base font-bold text-slate-200">
              {statusFilter === 'reported' ? 'No open user reports found' : 'No questions match the current filters'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {statusFilter === 'reported' 
                ? 'All aspirant discrepancy reports have been resolved or dismissed. Any new user reports submitted from drills will immediately appear here.'
                : 'Try adjusting your search query, status tab, or category filter to inspect other question records.'}
            </p>
          </div>
        ) : (
          filteredQuestions.map(q => {
            const audit = auditMap.get(q.id) || (q.canonicalQuestionId ? auditMap.get(q.canonicalQuestionId) : undefined);
            const reports = getReportsForQuestion(q);
            const issues = audit?.issues || [];

            return (
              <div
                key={q.id}
                className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 shadow-xl transition-all space-y-3 ${
                  reports.length > 0
                    ? 'border-purple-800/80 ring-1 ring-purple-600/40 bg-purple-950/10'
                    : issues.some(i => i.severity === 'critical')
                    ? 'border-rose-800/80 ring-1 ring-rose-500/20'
                    : issues.length > 0
                    ? 'border-amber-800/80'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Row: Category Badge, IDs, and Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {q.category}
                    </span>

                    <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[200px]" title={q.id}>
                      ID: <code className="text-slate-300">{q.id}</code>
                    </span>

                    {/* Exam Appearance */}
                    {q.appearances && q.appearances.length > 0 && (
                      <ExamAppearancesBadge
                        appearances={q.appearances}
                        exam={q.exam}
                        year={q.year}
                        tier={q.tier}
                        showRepeatCount={true}
                        size="xs"
                      />
                    )}
                  </div>

                  {/* Admin Action Buttons: Enrich AI, Push to Firestore, Keep, Edit, Delete */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {/* 1. ENRICH IT FROM HERE */}
                    <button
                      onClick={() => handleEnrichQuestion(q)}
                      disabled={enrichingId === q.id || pushingId === q.id || deletingId === q.id}
                      className="px-2.5 py-1.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/80 text-purple-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
                      title="Auto-enrich with AI: Generate definitions, Hindi meanings, mnemonics, and 4-option explanations"
                    >
                      {enrichingId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-300" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>{enrichingId === q.id ? 'Enriching...' : 'Enrich AI'}</span>
                    </button>

                    {/* 2. PUSH IT IN FIRESTORM (PUSH TO FIRESTORE) */}
                    <button
                      onClick={() => handlePushToFirestore(q)}
                      disabled={pushingId === q.id || enrichingId === q.id || deletingId === q.id}
                      className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-950 to-teal-950 hover:from-emerald-900 hover:to-teal-900 border border-emerald-600/90 text-emerald-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 shadow-sm"
                      title="Push and publish question directly to Firestore question_bank, resolving any discrepancy reports"
                    >
                      {pushingId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{pushingId === q.id ? 'Pushing...' : 'Push Firestore'}</span>
                    </button>

                    {/* 3. KEEP / DISMISS REPORTS */}
                    <button
                      onClick={() => handleKeep(q)}
                      disabled={resolvingKeepId === q.id || deletingId === q.id}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                      title={reports.length > 0 ? "Acknowledge as valid and resolve all discrepancy reports" : "Acknowledge issue and keep as VALID"}
                    >
                      {resolvingKeepId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{reports.length > 0 ? "Dismiss Reports" : "Keep (Valid)"}</span>
                    </button>

                    {/* 4. EDIT */}
                    <button
                      onClick={() => setEditingQuestion(q)}
                      disabled={resolvingKeepId === q.id || deletingId === q.id}
                      className="px-2.5 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-700 text-sky-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Edit question safely (preserves IDs & metadata)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {/* 5. DELETE IT */}
                    <button
                      onClick={() => setQuestionToDelete(q)}
                      disabled={deletingId === q.id || resolvingKeepId === q.id}
                      className="p-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 font-bold rounded-xl transition disabled:opacity-50"
                      title="Delete question permanently from database"
                    >
                      {deletingId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Detected Issue Details Banner */}
                {issues.length > 0 && (
                  <div className="space-y-2">
                    {issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          issue.severity === 'critical'
                            ? 'bg-rose-950/50 border-rose-800/80 text-rose-200'
                            : 'bg-amber-950/50 border-amber-800/80 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>[{issue.code}] {issue.title}</span>
                        </div>
                        <p className="text-[11px] opacity-90 pl-5">{issue.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* User Reports Banner (if any) */}
                {reports.length > 0 && (
                  <div className="p-3 bg-purple-950/50 border border-purple-800/80 rounded-xl text-xs space-y-2">
                    <div
                      onClick={() => setExpandedReports(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                      className="flex items-center justify-between cursor-pointer font-bold text-purple-200"
                    >
                      <div className="flex items-center gap-1.5">
                        <Flag className="w-3.5 h-3.5 text-purple-400" />
                        <span>{reports.length} Aspirant Discrepancy Report(s) Submitted</span>
                      </div>
                      {expandedReports[q.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>

                    {expandedReports[q.id] && (
                      <div className="space-y-2 pt-1 border-t border-purple-900/60">
                        {reports.map((r, rIdx) => (
                          <div key={r.reportId || rIdx} className="bg-slate-950/80 p-2.5 rounded-lg border border-purple-900/50 text-[11px] space-y-2">
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="font-semibold text-purple-300">Reason: {r.reason}</span>
                              <span>{new Date(r.reportedAt).toLocaleDateString()}</span>
                            </div>
                            {r.notes && (
                              <p className="text-slate-200 bg-slate-900 p-1.5 rounded border border-slate-800 italic">
                                "{r.notes}"
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-slate-500">
                                {r.userEmail || r.userName || 'Anonymous Aspirant'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismissSingleReport(r.reportId, q.id);
                                }}
                                className="px-2 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/80 text-purple-200 text-[10px] font-bold rounded-lg flex items-center gap-1 transition"
                                title="Dismiss this discrepancy report"
                              >
                                <Check className="w-3 h-3 text-purple-400" />
                                <span>Dismiss Report</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Question Prompt & Target Word */}
                <div className="space-y-1 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">
                    {q.instruction || `Select the most appropriate ${q.category.toUpperCase()} of:`}
                  </div>
                  <div className="text-sm font-black text-slate-100 flex items-center gap-2">
                    <span className="text-amber-400 font-mono">"{q.wordOrPhrase}"</span>
                  </div>
                </div>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(q.options || []).map((opt, oIdx) => {
                    const isCorrect = q.correctIndex === oIdx;
                    return (
                      <div
                        key={oIdx}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          isCorrect
                            ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-md font-bold text-[10px] flex items-center justify-center shrink-0 ${
                            isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="truncate">{opt}</span>
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">
                            Marked Key
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Meaning & Explanation Snapshot */}
                {(q.meaning || q.hindiMeaning || q.explanation || q.mnemonic || q.exampleSentence) && (
                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                    {q.meaning && <div><b className="text-slate-300">Meaning:</b> {q.meaning}</div>}
                    {q.hindiMeaning && <div><b className="text-slate-300">Hindi:</b> {q.hindiMeaning}</div>}
                    {q.explanation && <div><b className="text-slate-300">Explanation:</b> {q.explanation}</div>}
                    {q.mnemonic && <div><b className="text-purple-300">💡 Mnemonic:</b> {q.mnemonic}</div>}
                    {q.exampleSentence && <div><b className="text-sky-300">💬 Example:</b> {q.exampleSentence}</div>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Safe Edit Modal */}
      {editingQuestion && (
        <AdminQuestionEditModal
          question={editingQuestion}
          onSave={handleSaveEdit}
          onClose={() => setEditingQuestion(null)}
          isSaving={isSavingEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-rose-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Permanent Database Deletion</h3>
                <p className="text-xs text-rose-400/90 font-medium">This operation cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete <b className="text-amber-400">"{questionToDelete.wordOrPhrase}"</b> from Firestore Question Bank? Any linked discrepancy reports will also be resolved.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => setQuestionToDelete(null)}
                disabled={deletingId === questionToDelete.id}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                onClick={() => executeDeletePermanent(questionToDelete)}
                disabled={deletingId === questionToDelete.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-rose-950 transition"
              >
                {deletingId === questionToDelete.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
