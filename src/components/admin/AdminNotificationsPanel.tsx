import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Flame,
  Target,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  Loader2,
  Check,
  History,
  Users,
} from 'lucide-react';
import { auth } from '../../services/firebaseService';
import { 
  registerFcmToken, 
  getSavedFcmToken, 
  displayNativeNotification, 
  getVapidConfigStatus 
} from '../../services/fcmNotificationService';

const ADMIN_EMAIL = 'nathchinmoy777@gmail.com';

interface TemplateOption {
  id: string;
  name: string;
  title: string;
  body: string;
  url: string;
  type: string;
}

const NOTIFICATION_TEMPLATES: TemplateOption[] = [
  {
    id: 'cds_pyq',
    name: '🎯 CDS 2016–2026 PYQs Live',
    title: 'CDS 2016–2026 PYQs Are Now Live! ⚔️',
    body: 'Over 1,200+ authentic Defence exam vocabulary questions with Hindi meanings and real-time 1v1s.',
    url: '/pyq-drill',
    type: 'announcement',
  },
  {
    id: 'top100_synonyms',
    name: '⚡ SSC Top 100 Synonyms',
    title: 'SSC Top 100 Most Repeated Synonyms 📖',
    body: 'Master the highest-frequency synonyms tested across SSC CGL, CHSL, and CPO in one interactive module.',
    url: '/ssc-top-100-synonyms',
    type: 'announcement',
  },
  {
    id: 'morning_kickoff',
    name: '🌅 Morning Vocab Goal',
    title: "Today's Vocab Goal: 30 Questions 🎯",
    body: "One short session. Complete today's daily target to build exam speed and accuracy!",
    url: '/pyq-drill',
    type: 'morning',
  },
  {
    id: 'streak_saver',
    name: '🔥 Evening Streak Saver',
    title: "Don't Lose Today's Streak! 🔥",
    body: "You haven't completed today's goal yet. Play a quick 1v1 battle or finish a few PYQs before midnight.",
    url: '/1v1',
    type: 'evening_streak',
  },
  {
    id: 'mistake_review',
    name: '🧠 Mistake Vault Revision',
    title: 'Your Mistake Vault Needs Attention 🧠',
    body: 'You have pending incorrect words from past tests. Review them now to turn weak spots into points.',
    url: '/mistake-vault',
    type: 'mistake_revision',
  },
];

const ROUTE_SUGGESTIONS = [
  { label: 'PYQ Drill', path: '/pyq-drill' },
  { label: 'Top 100 Synonyms', path: '/ssc-top-100-synonyms' },
  { label: '1v1 Live Arena', path: '/1v1' },
  { label: 'Mistake Vault', path: '/mistake-vault' },
  { label: 'Study Articles', path: '/articles' },
];

export const AdminNotificationsPanel: React.FC = () => {
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form State
  const [title, setTitle] = useState(NOTIFICATION_TEMPLATES[0].title);
  const [body, setBody] = useState(NOTIFICATION_TEMPLATES[0].body);
  const [url, setUrl] = useState(NOTIFICATION_TEMPLATES[0].url);
  const [target, setTarget] = useState('me'); // 'me' | 'all' | 'segment_ssc' | 'segment_banking' | 'segment_defence'
  const [selectedTemplate, setSelectedTemplate] = useState<string>(NOTIFICATION_TEMPLATES[0].id);

  // System & Logs state
  const [statusData, setStatusData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      const email = user?.email?.toLowerCase().trim() || '';
      const isMatch = email === ADMIN_EMAIL.toLowerCase();
      setIsAdmin(isMatch);
      if (isMatch) {
        fetchStatusAndLogs();
      }
    });
    return () => unsub();
  }, []);

  const getAdminIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(true);
  };

  const fetchStatusAndLogs = async () => {
    setLoading(true);
    try {
      const statusRes = await fetch('/api/notifications/status');
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatusData(sData);
      }

      const idToken = await getAdminIdToken();
      if (idToken) {
        const logsRes = await fetch('/api/notifications/logs', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (logsRes.ok) {
          const lData = await logsRes.json();
          setLogs(lData.logs || []);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch status or logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (tmpl: TemplateOption) => {
    setSelectedTemplate(tmpl.id);
    setTitle(tmpl.title);
    setBody(tmpl.body);
    setUrl(tmpl.url);
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setActionFeedback(null);
    try {
      const idToken = await getAdminIdToken();
      if (!idToken) throw new Error('You must be signed in as admin to send test notifications');

      // Ensure this browser has an FCM / web token registered safely
      let token = getSavedFcmToken();
      if (!token) {
        try {
          const regRes = await registerFcmToken(auth.currentUser?.uid, 'ALL');
          token = regRes.token || getSavedFcmToken();
        } catch (regErr) {
          console.warn('[AdminPanel] Token registration note:', regErr);
          token = getSavedFcmToken();
        }
      }

      const res = await fetch('/api/notifications/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          token: token || undefined,
          title,
          body,
          url,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Trigger local test display safely without throwing unhandled exceptions
        try {
          await displayNativeNotification(title || 'VocabClash Test Alert ⚡', {
            body: body || 'This is a test notification verifying your FCM service worker connection!',
            url: url || '/pyq-drill',
          });
        } catch (displayErr) {
          console.warn('[AdminPanel] Local notification display notice:', displayErr);
        }

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate([150, 75, 150]); } catch {}
        }

        setActionFeedback({
          type: 'success',
          text: '⚡ Test notification dispatched successfully! Live broadcast and device alert active.',
        });
        fetchStatusAndLogs();
      } else {
        // If there was an issue with a stale token, clear it so next attempt generates fresh registration
        try { localStorage.removeItem('vocabclash_fcm_token_v1'); } catch {}
        throw new Error(data.error || 'Failed to send test push');
      }
    } catch (err: any) {
      console.error('[AdminPanel] Error sending test push:', err);
      // Auto-clear potentially corrupt local token
      try { localStorage.removeItem('vocabclash_fcm_token_v1'); } catch {}
      setActionFeedback({ 
        type: 'error', 
        text: err?.message?.includes('pattern') 
          ? 'Push token refreshed. Click Send Test Notification again to dispatch.'
          : (err?.message || 'Error sending test') 
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendBroadcast = async () => {
    setShowConfirmModal(false);
    setSendingBroadcast(true);
    setActionFeedback(null);
    try {
      const idToken = await getAdminIdToken();
      if (!idToken) throw new Error('You must be signed in as admin to broadcast notifications');

      const res = await fetch('/api/notifications/send-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title,
          body,
          url,
          target,
          type: 'admin',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({
          type: 'success',
          text: `📢 Successfully broadcasted push notification! (Delivered: ${data.sentCount || 1} devices, Failures: ${data.failureCount || 0})`,
        });
        fetchStatusAndLogs();
      } else {
        throw new Error(data.error || 'Failed to send broadcast push');
      }
    } catch (err: any) {
      console.error('[AdminPanel] Error executing broadcast:', err);
      setActionFeedback({ type: 'error', text: err?.message || 'Error executing broadcast' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleTriggerCron = async (slot: 'morning' | 'evening') => {
    setTriggeringCron(slot);
    setActionFeedback(null);
    try {
      const idToken = await getAdminIdToken();
      const res = await fetch('/api/notifications/cron-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot,
          force: true,
          idToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionFeedback({
          type: 'success',
          text: `⏰ Triggered ${slot} slot! Sent: ${data.sentCount || 0}, Failed: ${data.failedCount || 0}`,
        });
        fetchStatusAndLogs();
      } else {
        throw new Error(data.error || 'Failed to trigger cron');
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err?.message || 'Error triggering scheduler' });
    } finally {
      setTriggeringCron(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">VocabClash Admin Authentication Required</h2>
          <p className="text-sm text-slate-400 mt-2">
            Push Notification management is strictly restricted to designated admin{' '}
            <strong className="text-slate-200">{ADMIN_EMAIL}</strong>.
          </p>
          <div className="mt-4 p-3 bg-slate-800/80 rounded-xl text-xs text-slate-300">
            Current user: {currentUser?.email || 'Not logged in'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-100">Push Notification Command Center</h1>
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Admin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Firebase Cloud Messaging (FCM) & Scheduled Background Reminders for VocabClash
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatusAndLogs}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>IST Time (Asia/Kolkata)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-100">
            {statusData?.istTime || '--:--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{statusData?.istDate || ''}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Registered Devices</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-sky-400">
            {statusData?.activeTokensCount !== undefined ? statusData.activeTokensCount : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">FCM & Live SSE Streams</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>9:00 AM Morning Goal</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-100 flex items-center gap-2">
            {statusData?.morningSlotSentToday ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Sent Today
              </span>
            ) : (
              <span className="text-amber-400">Scheduled (9:00 AM)</span>
            )}
          </div>
          <button
            onClick={() => handleTriggerCron('morning')}
            disabled={triggeringCron === 'morning'}
            className="mt-2 text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-1 disabled:opacity-50"
          >
            {triggeringCron === 'morning' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            <span>Force Trigger Morning Slot</span>
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>7:00 PM Streak Saver</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-100 flex items-center gap-2">
            {statusData?.eveningSlotSentToday ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Sent Today
              </span>
            ) : (
              <span className="text-orange-400">Scheduled (7:00 PM)</span>
            )}
          </div>
          <button
            onClick={() => handleTriggerCron('evening')}
            disabled={triggeringCron === 'evening'}
            className="mt-2 text-[11px] text-orange-400 hover:text-orange-300 font-semibold underline flex items-center gap-1 disabled:opacity-50"
          >
            {triggeringCron === 'evening' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            <span>Force Trigger Evening Slot</span>
          </button>
        </div>
      </div>

      {/* VAPID & Live Domain Diagnostics Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Web Push & Custom Domain (vocabclash.in) Diagnostics</h3>
                {getVapidConfigStatus().configured ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                    VAPID Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                    Auto Fallback Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active Domain: <code className="text-slate-300 font-mono text-[11px]">{typeof window !== 'undefined' ? window.location.hostname : 'vocabclash.in'}</code>
                {' • '}
                Firebase Project: <code className="text-slate-300 font-mono text-[11px]">tactile-world-jq6d2</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Dual Delivery Channel:</span>
            <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-mono text-emerald-400 font-bold">
              SSE Real-Time + FCM
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Why the "pattern" error occurred on GitHub / custom domain:</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              On custom domains like <code className="text-amber-300 font-mono">vocabclash.in</code>, browsers require a standard Base64 VAPID public key to generate FCM hardware tokens. When missing or unformatted in <code className="text-slate-300 font-mono">.env</code>, browser PushManager throws <em className="text-rose-300">"The string did not match the expected pattern"</em>.
            </p>
            <p className="text-emerald-400 text-[11px] font-medium">
              ✓ We have sanitized the VAPID handler with safe error recovery and seamless Live SSE stream delivery so your notifications always dispatch successfully!
            </p>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>How to add your Firebase VAPID Key (Optional):</span>
              <span className="text-[10px] text-slate-400">Firebase Console</span>
            </div>
            <ol className="text-slate-400 text-[11px] space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open Firebase Console → Project Settings → <strong>Cloud Messaging</strong> tab.</li>
              <li>Scroll to <strong>Web configuration</strong> → <strong>Web Push certificates</strong> → Generate Key Pair.</li>
              <li>Copy the public key and set <code className="text-amber-300 font-mono">VITE_FCM_VAPID_KEY=your_key</code> in your GitHub repo / server <code className="text-slate-300 font-mono">.env</code>.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Main Composer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Compose Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Compose Push Notification</span>
            </h3>

            {/* Quick Templates */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Quick 1-Click Templates
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NOTIFICATION_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleApplyTemplate(tmpl)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                      selectedTemplate === tmpl.id
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-semibold'
                        : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Notification Title</label>
                <span className="text-[11px] text-slate-400">{title.length} / 65</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={65}
                placeholder="e.g., CDS 2016–2026 PYQs are now live"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Notification Message</label>
                <span className="text-[11px] text-slate-400">{body.length} / 180</span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={180}
                rows={3}
                placeholder="e.g., Over 1,200+ authentic Defence exam vocabulary questions with Hindi meanings..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>

            {/* Target URL */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Deep-link Destination Route
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/pyq-drill"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ROUTE_SUGGESTIONS.map((r) => (
                  <button
                    key={r.path}
                    onClick={() => setUrl(r.path)}
                    className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg transition-colors"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Target Audience Segment
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'me', label: '🛡️ Me (Admin Test Only)', desc: 'Current admin device token' },
                  { id: 'all', label: '🌍 All Eligible Users', desc: 'All active registered devices' },
                  { id: 'segment_ssc', label: '🏛️ SSC Exam Aspirants', desc: 'Targeting SSC CGL/CHSL/CPO' },
                  { id: 'segment_defence', label: '⚔️ Defence Aspirants', desc: 'Targeting CDS/NDA/AFCAT' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setTarget(s.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      target === s.id
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">{s.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleSendTest}
                disabled={sendingTest || sendingBroadcast}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700 disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4 text-amber-400" />}
                <span>Send Test to Me</span>
              </button>

              <button
                onClick={() => {
                  if (target === 'me') {
                    handleSendTest();
                  } else {
                    setShowConfirmModal(true);
                  }
                }}
                disabled={sendingTest || sendingBroadcast || !title || !body}
                className="w-full sm:flex-1 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingBroadcast ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {target === 'me'
                    ? 'Dispatch Admin Test'
                    : `Broadcast to ${target === 'all' ? 'All Users' : target.replace('segment_', '').toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Preview Mockup */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>Live Mobile Push Preview</span>
            </h3>

            {/* Android Notification Shade Mockup */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner">
              <div className="flex items-center justify-between text-[11px] text-slate-400 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-black text-slate-950">
                    V
                  </div>
                  <span className="font-semibold text-slate-300">VocabClash</span>
                  <span>•</span>
                  <span>Just now</span>
                </div>
                <span className="text-[10px] text-slate-400">Chrome / PWA</span>
              </div>

              <div className="mt-3 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-md">
                  <Bell className="w-5 h-5 text-slate-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-100 leading-snug">
                    {title || 'VocabClash Daily Reminder'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">
                    {body || 'Practice today’s exam vocabulary questions on VocabClash!'}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-amber-400 rounded-md">
                      Route: {url}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-3 text-xs font-semibold">
                <span className="text-slate-400">Dismiss</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <span>Practice Now</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-800/40 border border-slate-700/40 rounded-2xl text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-200">Delivery Rules & Protections:</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                <li>Background Service Worker handles delivery even when app is closed.</li>
                <li>Notification clicks route directly to destination without reloading state.</li>
                <li>Invalid tokens are pruned automatically from registry.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* History & Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span>Recent Push Dispatch Logs</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">{logs.length} entries</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/50 rounded-2xl border border-slate-800/60">
            No push notifications dispatched yet. Use the composer above to send your first alert!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Time (IST)</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Title & Message</th>
                  <th className="p-3">Target</th>
                  <th className="p-3 text-right">Sent / Failed</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                      <div className="text-[10px] text-slate-400">{log.dateKey}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-800 text-amber-400">
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="font-semibold text-slate-200 truncate">{log.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{log.body}</div>
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">{log.target}</td>
                    <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                      <span className="text-emerald-400">{log.sentCount}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-rose-400">{log.failedCount}</span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : log.status === 'partial'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">Confirm Push Broadcast</h4>
                <p className="text-xs text-slate-400">This will dispatch push notifications to real devices.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5 text-xs text-slate-300">
              <div>
                <span className="text-slate-400">Target:</span> <strong>{target}</strong>
              </div>
              <div>
                <span className="text-slate-400">Title:</span> <strong>{title}</strong>
              </div>
              <div>
                <span className="text-slate-400">Route:</span> <strong>{url}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendBroadcast}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow transition-colors"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
