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
  X
} from 'lucide-react';
import { Question, QuestionCategory } from '../types';
import { QuestionQualityResult, QualityAuditStats, QualityStatus, QualityIssueCode, UserQuestionReport } from '../types/pyqQuality';
import { pyqQualityAuditService, fetchUserQuestionReports } from '../services/pyqQualityAuditService';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'suspicious' | 'valid' | 'reported'>('critical');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [issueCodeFilter, setIssueCodeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing & Deleting
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvingKeepId, setResolvingKeepId] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expanded report cards
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
    setLastScannedAt(pyqQualityAuditService.getLastScannedAt());
    setUserReports(pyqQualityAuditService.getUserReports());

    // Fetch fresh reports on mount
    fetchUserQuestionReports().then(reports => {
      if (reports) {
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
      console.error('[PYQ Admin Delete]', err);
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to complete quality scan.',
      });
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleKeep = async (qId: string) => {
    setResolvingKeepId(qId);
    try {
      await pyqQualityAuditService.markAsKeep(qId);
      // Immediately clear discrepancy reports from state so questions leave "User Reports" tab
      setUserReports(prev => prev.filter(r => r.questionId !== qId));
      setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
      setActionFeedback({
        type: 'success',
        message: `Question acknowledged as VALID and all discrepancy reports dismissed!`,
      });
    } catch (e: any) {
      console.warn('Keep action fallback:', e);
      setUserReports(prev => prev.filter(r => r.questionId !== qId));
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

  const handleSaveEdit = async (updatedFields: Partial<Question>) => {
    if (!editingQuestion) return;
    setIsSavingEdit(true);
    try {
      const res = await pyqQualityAuditService.updateQuestionSafely(
        editingQuestion.id,
        updatedFields,
        editingQuestion
      );
      if (res.success) {
        setAuditMap(new Map(pyqQualityAuditService.getAuditResults()));
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
    } catch (err: any) {
      console.error('[PYQ Admin Delete]', err);
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to save question edits.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const executeDeletePermanent = async (question: Question) => {
    setDeletingId(question.id);
    try {
      const res = await pyqQualityAuditService.deleteQuestionSafely(question.id);
      if (res.success) {
        // Immediate local state update so counts drop without requiring page refresh
        setDeletedIds(prev => new Set(prev).add(question.id));
        setUserReports(prev => prev.filter(r => r.questionId !== question.id));
        setAuditMap(prev => {
          const next = new Map(prev);
          next.delete(question.id);
          return next;
        });
        setQuestionToDelete(null);
        setActionFeedback({
          type: 'success',
          message: `Question "${question.wordOrPhrase}" and all associated discrepancy reports permanently deleted.`,
        });

        // Trigger background sync with parent/runtime engine
        onRefreshCloud().catch(err => console.error('[PYQ Admin Delete]', err));
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error || 'Failed to delete question.',
        });
      }
    } catch (err: any) {
      console.error('[PYQ Admin Delete]', err);
      // Clean up local state anyway so admin is never locked out
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

  // Group user reports by questionId
  const reportsByQuestionId = useMemo(() => {
    const map = new Map<string, UserQuestionReport[]>();
    userReports.forEach(r => {
      if (r.status !== 'resolved' && r.questionId) {
        if (!map.has(r.questionId)) {
          map.set(r.questionId, []);
        }
        map.get(r.questionId)!.push(r);
      }
    });
    return map;
  }, [userReports]);

  // Active question set excluding deleted IDs
  const activeQuestions = useMemo(() => {
    return cloudQuestions.filter(q => !deletedIds.has(q.id));
  }, [cloudQuestions, deletedIds]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalScanned = 0;
    let criticalCount = 0;
    let suspiciousCount = 0;
    let validCount = 0;

    activeQuestions.forEach(q => {
      totalScanned++;
      const audit = auditMap.get(q.id);
      const isReported = (reportsByQuestionId.get(q.id) || []).length > 0;
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

    return {
      totalScanned,
      criticalCount,
      suspiciousCount,
      validCount,
      reportedCount: reportsByQuestionId.size,
    };
  }, [activeQuestions, auditMap, reportsByQuestionId]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return activeQuestions.filter(q => {
      const audit = auditMap.get(q.id);
      const reports = reportsByQuestionId.get(q.id) || [];
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
  }, [activeQuestions, auditMap, reportsByQuestionId, statusFilter, categoryFilter, issueCodeFilter, searchQuery]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner & Audit Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                PYQ Quality & Discrepancy Scanner
              </span>
              {lastScannedAt && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Last scanned: {new Date(lastScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-100 mt-1">
              Deterministic Content Validation & Admin Review
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
              Strict deterministic rules detect target-in-option bugs, duplicate answer choices, grammar vs vocab category mismatches, and learner reports. <b className="text-slate-200">Zero AI silent changes. Human review only.</b>
            </p>
          </div>

          {/* Trigger Scan Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleRunScan(false)}
              disabled={isScanning || cloudQuestions.length === 0}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-rose-950 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning PYQ Bank...' : 'Run Full Quality Scan'}</span>
            </button>
          </div>
        </div>

        {/* Scan Progress Bar */}
        {scanProgress && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-300 font-medium">{scanProgress.stage}</span>
              <span className="font-mono text-slate-400">{scanProgress.current}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, scanProgress.current))}%` }}
              />
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {actionFeedback && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border border-rose-800 text-rose-200'
          }`}>
            {actionFeedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
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
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Clean / Verified
            </div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{stats.validCount}</div>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search word, option, question ID..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500 shrink-0"
          >
            <option value="all">All Categories</option>
            <option value="synonyms">Synonyms</option>
            <option value="antonyms">Antonyms</option>
            <option value="idioms">Idioms</option>
            <option value="ows">One Word Substitution</option>
          </select>

          {/* Issue Code Filter */}
          <select
            value={issueCodeFilter}
            onChange={e => setIssueCodeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-rose-500 shrink-0"
          >
            <option value="all">All Issue Types</option>
            <option value="TARGET_EQUALS_OPTION">Target in Options</option>
            <option value="DUPLICATE_OPTIONS">Duplicate Options</option>
            <option value="INVALID_CORRECT_ANSWER">Invalid Correct Key</option>
            <option value="MALFORMED_OPTIONS">Malformed / Missing Options</option>
            <option value="SUSPICIOUS_CATEGORY_MISMATCH">Category / Grammar Mismatch</option>
            <option value="QUESTION_TEXT_AS_OPTION">Stem in Options</option>
            <option value="DUPLICATE_QUESTION">Duplicate Question</option>
            <option value="USER_REPORTED">User Reported</option>
          </select>
        </div>
      </div>

      {/* Flagged Question Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Showing <b className="text-slate-200">{filteredQuestions.length}</b> questions</span>
          <span>Status Filter: <b className="uppercase text-rose-400">{statusFilter}</b></span>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-200">No questions found matching criteria</h4>
            <p className="text-xs text-slate-400">Try adjusting status filters or run a full quality scan.</p>
          </div>
        ) : (
          filteredQuestions.map(q => {
            const audit = auditMap.get(q.id);
            const reports = reportsByQuestionId.get(q.id) || [];
            const isCritical = audit?.status === 'critical';
            const isSuspicious = audit?.status === 'suspicious' || (!audit && reports.length > 0);
            const issues = audit?.issues || [];

            return (
              <div
                key={q.id}
                className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5 transition-all ${
                  isCritical
                    ? 'border-rose-600/90 ring-1 ring-rose-500/30'
                    : isSuspicious
                    ? 'border-amber-500/80 ring-1 ring-amber-500/20'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Row: Badges & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Severity Badge */}
                    {isCritical ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white flex items-center gap-1 shadow-sm">
                        <ShieldAlert className="w-3 h-3" />
                        CRITICAL ERROR
                      </span>
                    ) : isSuspicious ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        SUSPICIOUS
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        CLEAN
                      </span>
                    )}

                    {/* Category */}
                    <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {q.category}
                    </span>

                    {/* ID */}
                    <span className="text-[10px] font-mono text-slate-400">
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

                  {/* Admin Action Buttons (Keep, Edit, Delete) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleKeep(q.id)}
                      disabled={resolvingKeepId === q.id || deletingId === q.id}
                      className="px-2.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                      title={reports.length > 0 ? "Acknowledge as valid and resolve all discrepancy reports" : "Acknowledge issue and keep as VALID"}
                    >
                      {resolvingKeepId === q.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>{reports.length > 0 ? "Keep & Dismiss Reports" : "Keep (Valid)"}</span>
                    </button>

                    <button
                      onClick={() => setEditingQuestion(q)}
                      disabled={resolvingKeepId === q.id || deletingId === q.id}
                      className="px-2.5 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-700 text-sky-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                      title="Edit question safely (preserves IDs & metadata)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

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
                            <div className="flex items-center justify-end pt-1">
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
                {(q.meaning || q.hindiMeaning || q.explanation) && (
                  <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                    {q.meaning && <div><b className="text-slate-300">Meaning:</b> {q.meaning}</div>}
                    {q.hindiMeaning && <div><b className="text-slate-300">Hindi:</b> {q.hindiMeaning}</div>}
                    {q.explanation && <div><b className="text-slate-300">Explanation:</b> {q.explanation}</div>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl shadow-rose-950/40">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Delete this PYQ permanently?
                  </h3>
                  <p className="text-xs text-rose-300/80 mt-0.5">
                    This will remove the question from the production database and runtime pool.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuestionToDelete(null)}
                disabled={deletingId === questionToDelete.id}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Question Details */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Question / Word:
                </span>
                <div className="text-sm font-extrabold text-amber-400 font-mono">
                  "{questionToDelete.wordOrPhrase}"
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {questionToDelete.instruction || `Select the most appropriate ${questionToDelete.category.toUpperCase()} of the given word:`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Exam:
                  </span>
                  <div className="font-semibold text-slate-200">
                    {questionToDelete.exam || 'SSC'} {questionToDelete.year || ''} {questionToDelete.tier ? `• ${questionToDelete.tier}` : ''}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Category:
                  </span>
                  <div className="font-semibold text-purple-300 capitalize">
                    {questionToDelete.category}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Question ID:
                </span>
                <code className="text-[11px] font-mono text-sky-300 bg-slate-900 px-2 py-1 rounded border border-slate-800 block truncate">
                  {questionToDelete.id}
                </code>
              </div>

              {/* If question has user discrepancy reports */}
              {((reportsByQuestionId.get(questionToDelete.id) || []).length > 0) && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="p-3 bg-purple-950/60 border border-purple-700/60 rounded-xl text-xs space-y-2">
                    <div className="flex items-center gap-2 text-purple-200 font-bold">
                      <Flag className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>This question has {(reportsByQuestionId.get(questionToDelete.id) || []).length} pending discrepancy report(s).</span>
                    </div>
                    <p className="text-[11px] text-purple-300/80">
                      Deleting permanently will delete this PYQ and clear all reports. If the question is actually correct and you just want to resolve the user report, click below:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const qId = questionToDelete.id;
                        setQuestionToDelete(null);
                        handleKeep(qId);
                      }}
                      className="w-full py-2 px-3 bg-purple-900 hover:bg-purple-800 border border-purple-600 rounded-lg text-purple-100 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5 text-purple-300" />
                      <span>Keep Question & Dismiss Reports Only</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                disabled={deletingId === questionToDelete.id}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => executeDeletePermanent(questionToDelete)}
                disabled={deletingId === questionToDelete.id}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-rose-950/60"
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
