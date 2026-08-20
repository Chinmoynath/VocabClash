import React, { useState } from 'react';
import { soundManager } from '../utils/audio';
import { 
  X, 
  Mail, 
  Copy, 
  Check, 
  LifeBuoy, 
  CreditCard, 
  AlertTriangle, 
  Lightbulb, 
  MessageSquare, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  Send
} from 'lucide-react';
import { PlayerProfile, UserSubscription } from '../types';

interface SupportModalProps {
  onClose: () => void;
  player?: PlayerProfile;
  subscription?: UserSubscription;
  prefilledSubject?: string;
  prefilledBody?: string;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  onClose,
  player,
  subscription,
  prefilledSubject,
  prefilledBody,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('general');
  const [customMessage, setCustomMessage] = useState<string>(prefilledBody || '');
  const [sentToast, setSentToast] = useState<boolean>(false);

  const SUPPORT_EMAIL = 'support@vocabclash.in';

  const handleCopyEmail = () => {
    soundManager.playTap();
    navigator.clipboard?.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getSubject = () => {
    if (prefilledSubject) return prefilledSubject;
    switch (selectedTopic) {
      case 'payment':
        return `[Payment / VIP Issue] VocabClash - User: ${player?.name || 'Aspirant'}`;
      case 'question':
        return `[Question Error / PYQ Report] VocabClash`;
      case 'feature':
        return `[Feature Suggestion] VocabClash`;
      case 'bug':
        return `[Bug Report] VocabClash`;
      default:
        return `[General Support] VocabClash - ${player?.name || 'Aspirant'}`;
    }
  };

  const getBody = () => {
    const baseInfo = `
--------------------------------------
Aspirant Name: ${player?.name || 'Guest'}
Target Exam: ${player?.targetExam || 'Govt Exam'}
Rank / LP: ${player?.rankPoints || 0} LP (${player?.tierTitle || 'Aspirant'})
VIP Status: ${subscription?.isPremium ? 'Active VIP' : 'Free Tier'}
Date: ${new Date().toLocaleDateString('en-IN')}
--------------------------------------
    `.trim();

    return `${customMessage ? customMessage + '\n\n' : ''}${baseInfo}`;
  };

  const handleSendEmail = () => {
    soundManager.playTap();
    const subject = encodeURIComponent(getSubject());
    const body = encodeURIComponent(getBody());
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    setSentToast(true);
    setTimeout(() => setSentToast(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                VocabClash Help & Support
              </h3>
              <p className="text-[11px] text-slate-400">Direct assistance for all Govt Exam aspirants</p>
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

        {/* Support Email Card */}
        <div className="bg-gradient-to-r from-sky-950/80 via-slate-850 to-indigo-950/80 border border-sky-500/30 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              Official Support Email
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Response: &lt; 24 hrs</span>
          </div>

          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2">
            <span className="text-xs font-mono font-bold text-slate-100 select-all">
              {SUPPORT_EMAIL}
            </span>
            <button
              onClick={handleCopyEmail}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Topic Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300">How can we help you today?</label>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[
              { id: 'payment', label: 'Payment / VIP Pass', icon: CreditCard, color: 'text-amber-400' },
              { id: 'question', label: 'Report Question / PYQ', icon: AlertTriangle, color: 'text-rose-400' },
              { id: 'bug', label: 'Report Bug / Glitch', icon: MessageSquare, color: 'text-sky-400' },
              { id: 'feature', label: 'Suggest New Feature', icon: Lightbulb, color: 'text-emerald-400' },
            ].map(topic => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  onClick={() => {
                    soundManager.playTap();
                    setSelectedTopic(topic.id);
                  }}
                  className={`p-2 rounded-xl border flex items-center gap-2 text-left font-medium transition-all ${
                    selectedTopic === topic.id
                      ? 'bg-sky-600/20 border-sky-400 text-slate-100 shadow-sm'
                      : 'bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-400'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${topic.color} shrink-0`} />
                  <span className="text-[11px] leading-tight font-semibold">{topic.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Message Field */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300">
            Details / Explanation (Optional):
          </label>
          <textarea
            rows={3}
            value={customMessage}
            onChange={e => setCustomMessage(e.target.value)}
            placeholder="Describe what happened or how we can help..."
            className="w-full bg-slate-850 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 resize-none shadow-inner"
          />
        </div>

        {/* 1-Click Send Email Action */}
        <div className="space-y-2">
          <button
            onClick={handleSendEmail}
            className="w-full bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-extrabold p-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-950 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Open Email Client ({SUPPORT_EMAIL})</span>
          </button>

          {sentToast && (
            <div className="text-center text-[11px] text-emerald-400 font-bold animate-fadeIn">
              Opening your default email app with pre-filled details...
            </div>
          )}
        </div>

        {/* Frequently Asked Questions */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Common Aspirant Queries
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            <details className="bg-slate-850/80 border border-slate-750 rounded-xl p-2.5 group">
              <summary className="font-bold text-slate-200 cursor-pointer list-none flex items-center justify-between text-[11px]">
                <span>💳 Amount deducted but VIP Pass not showing?</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                Razorpay payments activate automatically within 30 seconds. If it takes longer, tap "Sign In with Google" to sync your subscription or email your Payment ID to <b>support@vocabclash.in</b> for instant activation.
              </p>
            </details>

            <details className="bg-slate-850/80 border border-slate-750 rounded-xl p-2.5 group">
              <summary className="font-bold text-slate-200 cursor-pointer list-none flex items-center justify-between text-[11px]">
                <span>❓ Found an error in question or answer key?</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                Click the <b>"Report Question"</b> button on any PYQ drill card to send us the exact question ID. Our English exam subject experts review and fix discrepancies within 24 hours.
              </p>
            </details>

            <details className="bg-slate-850/80 border border-slate-750 rounded-xl p-2.5 group">
              <summary className="font-bold text-slate-200 cursor-pointer list-none flex items-center justify-between text-[11px]">
                <span>🔄 How to save my streak across different devices?</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                Simply sign in with Google in your Aspirant Profile. Your LP, Rank, 24,000+ mastery statistics, and Mistake Vault will sync automatically.
              </p>
            </details>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Official Support Team • VocabClash India</span>
        </div>
      </div>
    </div>
  );
};
