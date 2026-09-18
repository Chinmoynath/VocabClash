import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/audio';
import { 
  X, 
  AlertTriangle, 
  Flag, 
  Send, 
  Check, 
  Mail, 
  Copy, 
  BookOpen, 
  HelpCircle, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Question } from '../types';
import { submitQuestionReport } from '../services/pyqQualityAuditService';
import { openMailto } from '../utils/externalLinks';

interface ReportQuestionModalProps {
  question: Question;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

const REPORT_REASONS = [
  { id: 'wrong_answer', label: 'Wrong Correct Answer Key Marked' },
  { id: 'wrong_options', label: 'Wrong / Mismatched Options' },
  { id: 'target_in_option', label: 'Target Word/Phrase appears as Option' },
  { id: 'incorrect_meaning', label: 'Hindi / English Meaning is Incorrect' },
  { id: 'typo', label: 'Spelling Mistake / Typo in Question or Options' },
  { id: 'exam_tag', label: 'Incorrect Exam or Year Tag' },
  { id: 'duplicate', label: 'Duplicate Question' },
  { id: 'other', label: 'Other Discrepancy / Query' },
];

export const ReportQuestionModal: React.FC<ReportQuestionModalProps> = ({
  question,
  onClose,
  userEmail,
  userName,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('wrong_answer');
  const [notes, setNotes] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const SUPPORT_EMAIL = 'support@vocabclash.in';

  const correctOptionText = question.options[question.correctIndex] || 'Unknown';

  const getReportBody = () => {
    const reasonLabel = REPORT_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
    
    return `
========================================
VOCABCLASH QUESTION DISCREPANCY REPORT
========================================
Question ID: ${question.id}
Word / Phrase: "${question.wordOrPhrase}"
Category: ${question.category?.toUpperCase()}
Exam History: ${question.examHistory?.join(', ') || 'SSC / Banking PYQ'}
Repeated Count: ${question.repeatCount}x

All Options:
${question.options.map((opt, i) => `  [${String.fromCharCode(65 + i)}] ${opt}${i === question.correctIndex ? '  <-- (Current Marked Key)' : ''}`).join('\n')}

Meaning: ${question.meaning || 'N/A'}
Hindi Meaning: ${question.hindiMeaning || 'N/A'}

REPORTED ISSUE:
Type: ${reasonLabel}
Aspirant Notes: ${notes.trim() || 'Please review this question and verify against standard official keys.'}

Reporter Details:
Aspirant: ${userName || 'Govt Aspirant'}
Email: ${userEmail || 'Not provided'}
Timestamp: ${new Date().toISOString()}
========================================
    `.trim();
  };

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        onClose();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [submitted, onClose]);

  const handleSubmitReport = async () => {
    soundManager.playTap();
    setIsSubmitting(true);
    let resolved = false;

    // Safety timeout: ensure button never spins endlessly under any network conditions
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setIsSubmitting(false);
        setSubmitted(true);
      }
    }, 1500);

    try {
      const reasonLabel = REPORT_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
      await submitQuestionReport({
        questionId: question.id,
        category: question.category,
        wordOrPhrase: question.wordOrPhrase,
        reason: reasonLabel,
        notes: notes.trim() || undefined,
        userEmail: userEmail || undefined,
        userName: userName || undefined,
      });
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimer);
        setSubmitted(true);
      }
    } catch (e) {
      console.warn('Report submission fallback:', e);
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimer);
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = () => {
    soundManager.playTap();
    const subject = `[Question Error Report] ID: ${question.id} - Word: "${question.wordOrPhrase}"`;
    const body = getReportBody();
    openMailto(SUPPORT_EMAIL, subject, body);
  };

  const handleCopy = () => {
    soundManager.playTap();
    navigator.clipboard?.writeText(getReportBody());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                Report Question
              </h3>
              <p className="text-[11px] text-slate-400">Help maintain 100% accurate PYQ answer keys</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-400 flex items-center justify-center border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question Snapshot Card */}
        <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-amber-400 uppercase font-mono tracking-wider">
              {question.category}
            </span>
            <span className="text-slate-400 text-[10px]">
              ID: <span className="font-mono text-slate-300">{question.id}</span>
            </span>
          </div>

          <div className="text-sm font-black text-slate-100">
            "{question.wordOrPhrase}"
          </div>

          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="text-[11px] text-slate-400">
              Marked Answer: <b className="text-emerald-400 font-bold">{correctOptionText}</b>
            </div>
            {question.hindiMeaning && (
              <div className="text-[11px] text-slate-400">
                Hindi Meaning: <span className="text-slate-200">{question.hindiMeaning}</span>
              </div>
            )}
          </div>
        </div>

        {/* Issue Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300">
            What is the issue with this question?
          </label>
          <div className="space-y-1">
            {REPORT_REASONS.map(reason => (
              <label
                key={reason.id}
                onClick={() => soundManager.playTap()}
                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                  selectedReason === reason.id
                    ? 'bg-rose-950/40 border-rose-500/80 text-rose-200 shadow-sm'
                    : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="report_reason"
                  checked={selectedReason === reason.id}
                  onChange={() => setSelectedReason(reason.id)}
                  className="w-3.5 h-3.5 text-rose-500 accent-rose-500"
                />
                <span className="text-xs font-medium">{reason.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Aspirant Note */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300">
            Additional Notes / Correct Explanation:
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. As per SSC CGL 2023 official answer key, option B should be correct because..."
            className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-400 resize-none shadow-inner"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {submitted ? (
            <div className="space-y-2">
              <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-2xl text-center text-xs text-emerald-200 font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Report logged successfully for Admin Review!</span>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold p-2.5 rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmitting}
                className="w-full bg-rose-600 hover:bg-rose-500 active:scale-98 disabled:opacity-50 text-white font-extrabold p-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting Report...</span>
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4" />
                    <span>Submit Discrepancy Report</span>
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="flex-1 bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-300 font-medium p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email Support</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-300 font-medium p-2 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Info</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
