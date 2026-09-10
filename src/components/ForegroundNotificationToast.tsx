import React from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ForegroundNotificationProps {
  notification: {
    title: string;
    body: string;
    url?: string;
    type?: string;
  } | null;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

export const ForegroundNotificationToast: React.FC<ForegroundNotificationProps> = ({
  notification,
  onClose,
  onNavigate,
}) => {
  if (!notification) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 bg-slate-900/95 border border-amber-500/40 shadow-2xl shadow-amber-500/10 rounded-2xl p-4 backdrop-blur-xl text-slate-100"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-md">
            <Bell className="w-5 h-5 text-slate-950 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                VocabClash Alert
              </span>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 p-1 -mr-1 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h4 className="font-bold text-sm text-slate-100 leading-snug line-clamp-1">
              {notification.title}
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
              {notification.body}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  onNavigate(notification.url || '/pyq-drill');
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors"
              >
                <span>Practice Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
