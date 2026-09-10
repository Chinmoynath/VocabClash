import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Flame, 
  Target, 
  Megaphone, 
  X, 
  Check, 
  AlertCircle, 
  ExternalLink,
  Info,
  Settings,
  ArrowLeft,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  getUserNotificationPreferences,
  saveUserNotificationPreferences,
  registerFcmToken,
  getNotificationPermission,
  isRunningInIframe,
  getStoredNotifications,
  markAllNotificationsAsRead,
  deleteStoredNotification,
  clearAllStoredNotifications,
  InAppNotification,
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../services/fcmNotificationService';
import { soundManager } from '../utils/audio';

export interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid?: string;
  targetExam?: string;
  onNavigateTab?: (tab: string) => void;
  initialTab?: 'inbox' | 'settings';
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 2) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  uid,
  targetExam,
  onNavigateTab,
  initialTab = 'inbox',
}) => {
  const [activeView, setActiveView] = useState<'inbox' | 'settings'>(initialTab);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [prefs, setPrefs] = useState<UserNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveView(initialTab);
      setPermission(getNotificationPermission());
      setIsIframe(isRunningInIframe());
      getUserNotificationPreferences(uid).then((p) => setPrefs(p));
      
      // Load stored notifications and mark as read so red dot goes back to normal
      const loaded = getStoredNotifications();
      setNotifications(loaded);
      markAllNotificationsAsRead();
      setFeedback(null);
    }
  }, [isOpen, uid, initialTab]);

  if (!isOpen) return null;

  const handleToggle = async (key: keyof UserNotificationPreferences) => {
    soundManager.playTap();
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await saveUserNotificationPreferences(updated, uid);
    } catch (err) {
      console.warn('Failed to save preferences:', err);
    }
  };

  const handleEnableDevicePush = async () => {
    soundManager.playTap();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await registerFcmToken(uid, targetExam);
      setPermission(res.permission);
      if (res.success) {
        soundManager.playVictory();
        setFeedback({ 
          type: 'success', 
          message: 'Notifications enabled successfully! You will now receive daily exam practice alerts in your notification bar.' 
        });
        const updated = { ...prefs, enabled: true };
        setPrefs(updated);
        await saveUserNotificationPreferences(updated, uid);
      } else {
        if (res.isIframeBlocked) {
          setFeedback({
            type: 'info',
            message: 'Preview sandboxes restrict native prompts. Open VocabClash in a new browser tab to click Allow.',
          });
        } else {
          setFeedback({ 
            type: 'error', 
            message: res.error || 'Notification permission was denied. Please allow notifications in your browser settings.' 
          });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to request notification permission' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    soundManager.playTap();
    deleteStoredNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    soundManager.playTap();
    clearAllStoredNotifications();
    setNotifications([]);
  };

  const handleNotificationClick = (item: InAppNotification) => {
    soundManager.playTap();
    onClose();
    if (onNavigateTab) {
      const url = item.url || '';
      if (url.includes('vault') || url.includes('mistakes')) {
        onNavigateTab('mistakes');
      } else if (url.includes('leaderboard') || url.includes('ranks')) {
        onNavigateTab('leaderboard');
      } else if (url.includes('1v1') || url.includes('arena')) {
        onNavigateTab('arena');
      } else {
        onNavigateTab('practice');
      }
    }
  };

  const handleOpenFullTab = () => {
    soundManager.playTap();
    window.open(window.location.href, '_blank');
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'morning':
        return <Target className="w-4 h-4 text-amber-400" />;
      case 'evening_streak':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'announcements':
        return <Megaphone className="w-4 h-4 text-sky-400" />;
      default:
        return <Bell className="w-4 h-4 text-amber-400" />;
    }
  };

  const getNotificationBadgeLabel = (type?: string) => {
    switch (type) {
      case 'morning':
        return '9:00 AM Goal';
      case 'evening_streak':
        return '7:00 PM Streak';
      case 'announcements':
        return 'Exam Update';
      default:
        return 'Alert';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-6 relative flex flex-col min-h-[460px] sm:min-h-[500px] h-[520px] max-h-[88vh] sm:max-h-[85vh] my-auto overflow-hidden"
      >
        {/* Header with seamless Back / Settings navigation */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            {activeView === 'settings' ? (
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveView('inbox');
                }}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
                title="Back to notifications"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-tight">
                {activeView === 'inbox' ? 'Notifications' : 'Notification Settings'}
              </h3>
              {activeView === 'inbox' && notifications.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 rounded-full">
                  {notifications.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeView === 'inbox' ? (
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveView('settings');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-amber-400 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                title="Notification Settings"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400/90" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            ) : null}

            <button
              onClick={() => {
                soundManager.playTap();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain pr-1 -mr-1 py-3 space-y-3 flex flex-col">
          
          {/* TAB 1: NOTIFICATIONS INBOX */}
          {activeView === 'inbox' && (
            <div className="space-y-3 flex-1 flex flex-col">
              {notifications.length === 0 ? (
                <div className="my-auto py-10 px-4 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
                    <Bell className="w-7 h-7 text-slate-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">All caught up!</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                      Daily 9:00 AM practice reminders and 7:00 PM streak saver alerts will appear here.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      soundManager.playTap();
                      setActiveView('settings');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>Notification Settings</span>
                  </button>
                </div>
              ) : (
                notifications.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleNotificationClick(item)}
                    className="p-3.5 bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 hover:border-amber-500/40 rounded-2xl transition-all cursor-pointer group flex items-start justify-between gap-3 relative"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 mt-0.5">
                        {getNotificationIcon(item.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300">
                            {getNotificationBadgeLabel(item.type)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-amber-300 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                          {item.body}
                        </p>

                        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                          <span>Practice Now</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteNotification(e, item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900/60 transition-colors opacity-60 hover:opacity-100 shrink-0 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: NOTIFICATION SETTINGS */}
          {activeView === 'settings' && (
            <div className="space-y-4">
              
              {/* Feedback message banner */}
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : feedback.type === 'info'
                      ? 'bg-sky-500/10 border border-sky-500/30 text-sky-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {feedback.type === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />}
                  {feedback.type === 'info' && <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />}
                  {feedback.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />}
                  <div className="flex-1 leading-relaxed">
                    <span>{feedback.message}</span>
                    {feedback.type === 'info' && (
                      <div className="mt-2">
                        <button
                          onClick={handleOpenFullTab}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-[11px] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open in New Tab</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* If blocked in browser, show helpful unblock guidance */}
              {permission === 'denied' && (
                <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>How to allow notifications in your browser:</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside pl-1">
                    <li><strong>Chrome/Edge:</strong> Tap lock 🔒 in address bar → Toggle <strong>Notifications</strong> to <em>Allow</em>.</li>
                    <li><strong>Mobile/iOS:</strong> Go to Settings → Safari/Chrome → Notifications → Allow.</li>
                    {isIframe && (
                      <li><strong>Embedded Preview:</strong> Tap below to open in full tab.</li>
                    )}
                  </ul>
                  {isIframe && (
                    <div className="pt-1.5">
                      <button
                        onClick={handleOpenFullTab}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-750 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-xl text-xs font-bold transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open App in New Tab</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Preferences Toggles */}
              <div className="space-y-3 pt-1">
                {/* Master Push Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-slate-800/50 border border-slate-700/60 rounded-2xl">
                  <div className="pr-2">
                    <div className="font-bold text-xs sm:text-sm text-slate-100">Master Push Notifications</div>
                    <div className="text-[11px] text-slate-400">Receive VocabClash updates, goals & streak alerts</div>
                  </div>
                  <button
                    onClick={() => handleToggle('enabled')}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      prefs.enabled ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                    aria-label="Toggle all notifications"
                  >
                    <div
                      className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        prefs.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Morning Practice Kickoff */}
                <div className={`flex items-center justify-between p-3.5 bg-slate-800/30 border border-slate-700/30 rounded-2xl transition-opacity ${!prefs.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-start gap-3 pr-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-200 truncate">Morning Kickoff (9:00 AM IST)</div>
                      <div className="text-[11px] text-slate-400">Daily 30-question target kickoff for exam aspirants</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle('morningReminder')}
                    disabled={!prefs.enabled}
                    className={`w-11 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      prefs.morningReminder ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                    aria-label="Toggle morning practice reminder"
                  >
                    <div
                      className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        prefs.morningReminder ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Evening Streak Saver */}
                <div className={`flex items-center justify-between p-3.5 bg-slate-800/30 border border-slate-700/30 rounded-2xl transition-opacity ${!prefs.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-start gap-3 pr-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-200 truncate">Evening Streak Saver (7:00 PM IST)</div>
                      <div className="text-[11px] text-slate-400">Never lose your study streak before midnight</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle('eveningStreakReminder')}
                    disabled={!prefs.enabled}
                    className={`w-11 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      prefs.eveningStreakReminder ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                    aria-label="Toggle evening streak reminder"
                  >
                    <div
                      className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        prefs.eveningStreakReminder ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Announcements */}
                <div className={`flex items-center justify-between p-3.5 bg-slate-800/30 border border-slate-700/30 rounded-2xl transition-opacity ${!prefs.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div className="flex items-start gap-3 pr-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Megaphone className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-200 truncate">Exam & Bank Updates</div>
                      <div className="text-[11px] text-slate-400">New PYQs releases, feature launches, and contest alerts</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle('announcements')}
                    disabled={!prefs.enabled}
                    className={`w-11 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      prefs.announcements ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                    aria-label="Toggle exam updates"
                  >
                    <div
                      className={`bg-slate-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        prefs.announcements ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between shrink-0">
          {activeView === 'inbox' ? (
            <>
              {notifications.length > 0 ? (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">
                  IST (Asia/Kolkata)
                </span>
              )}
              <button
                onClick={() => {
                  soundManager.playTap();
                  onClose();
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  soundManager.playTap();
                  setActiveView('inbox');
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Back to Notifications
              </button>
              <button
                onClick={() => {
                  soundManager.playTap();
                  onClose();
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Save & Done
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
