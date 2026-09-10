import React, { useState } from 'react';
import { Bell, Flame, Target, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { registerFcmToken, markNotificationPromptDismissed } from '../services/fcmNotificationService';

export interface NotificationPermissionBannerProps {
  onPermissionUpdated?: (granted: boolean) => void;
  targetExam?: string;
  uid?: string;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  onPermissionUpdated,
  targetExam,
  uid,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEnable = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await registerFcmToken(uid, targetExam);
      if (res.success) {
        setSuccess(true);
        if (onPermissionUpdated) onPermissionUpdated(true);
        setTimeout(() => {
          setIsVisible(false);
        }, 2200);
      } else {
        setErrorMsg(res.error || 'Permission was not granted');
        if (onPermissionUpdated) onPermissionUpdated(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    markNotificationPromptDismissed();
    setIsVisible(false);
    if (onPermissionUpdated) onPermissionUpdated(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
              <Bell className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-slate-100">
                  Stay Consistent with Practice Reminders
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                  FCM Push
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <strong>9:00 AM:</strong> Daily Vocab Goal
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <strong>7:00 PM:</strong> Streak Saver Alert
                </span>
              </div>

              {errorMsg && (
                <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {success && (
                <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Notifications enabled! You’re set for daily reminders.</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {!success && (
              <>
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enabling...</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>Enable Reminders</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={loading}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors"
                >
                  Not Now
                </button>
              </>
            )}
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors sm:inline-flex hidden"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
