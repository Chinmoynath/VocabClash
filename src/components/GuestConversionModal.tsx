import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  X, 
  Target, 
  Swords, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ArrowLeft
} from 'lucide-react';
import { 
  signInWithGoogle, 
  signInWithGoogleRedirect,
  signInWithEmailPassword,
  registerWithEmailPassword,
  sendPasswordReset,
  getFriendlyAuthErrorMessage 
} from '../services/firebaseService';
import { soundManager } from '../utils/audio';
import { validateProperEmail, validateAspirantName, COMMON_AUTOCOMPLETE_DOMAINS } from '../utils/emailValidator';
import { 
  recordBattleSignupPromptView, 
  recordBattleSignupCompleted 
} from '../services/battleAnalyticsService';

export interface GuestConversionModalProps {
  isOpen: boolean;
  variant: 'pyq_10' | 'battle_review';
  stats?: {
    correctCount?: number;
    mistakeCount?: number;
    accuracy?: number;
    score?: number;
  };
  onClose: () => void;
  onSuccess: (user: FirebaseUser) => void;
  onGoogleClick?: () => void;
}

type EmailAuthMode = 'signin' | 'signup' | 'forgot';

export const GuestConversionModal: React.FC<GuestConversionModalProps> = ({
  isOpen,
  variant,
  stats,
  onClose,
  onSuccess,
  onGoogleClick,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Email auth view states
  const [showEmailForm, setShowEmailForm] = useState<boolean>(false);
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>('signin');
  const [nameInput, setNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Reset local state when modal visibility toggles
  useEffect(() => {
    if (isOpen) {
      setLoading(false);
      setErrorMessage(null);
      setInfoMessage(null);
      setShowEmailForm(false);
      setEmailAuthMode('signin');
      setNameInput('');
      setEmailInput('');
      setPasswordInput('');
      setShowPassword(false);
      if (variant === 'battle_review') {
        recordBattleSignupPromptView(undefined, 'guest_modal');
      }
    }
  }, [isOpen, variant]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    soundManager.playTap();
    onClose();
  };

  const handleGoogleSignIn = async (forceRedirect = false) => {
    try {
      soundManager.playTap();
      if (onGoogleClick) onGoogleClick();
      setLoading(true);
      setErrorMessage(null);
      setInfoMessage(null);

      const user = await signInWithGoogle(forceRedirect);
      if (user) {
        soundManager.playVictory();
        recordBattleSignupCompleted(user.uid, 'google');
        onSuccess(user);
      } else if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('vclash_auth_redirect_pending') === '1') {
        setInfoMessage('Connecting to Google Sign-In...');
      }
    } catch (err: any) {
      console.warn('Guest Conversion Google Sign-In Error:', err);
      setErrorMessage(getFriendlyAuthErrorMessage(err));
    } finally {
      if (typeof sessionStorage === 'undefined' || sessionStorage.getItem('vclash_auth_redirect_pending') !== '1') {
        setLoading(false);
      }
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (emailAuthMode === 'forgot') {
      const emailValidation = validateProperEmail(cleanEmail);
      if (!emailValidation.isValid) {
        setErrorMessage(emailValidation.error || 'Please enter a valid email address.');
        return;
      }
      try {
        soundManager.playTap();
        setLoading(true);
        setErrorMessage(null);
        setInfoMessage(null);
        await sendPasswordReset(cleanEmail);
        soundManager.playCorrect();
        setInfoMessage(`Password reset link sent to ${cleanEmail}! Check your inbox.`);
        setEmailAuthMode('signin');
      } catch (err: any) {
        setErrorMessage(getFriendlyAuthErrorMessage(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (emailAuthMode === 'signup') {
      const nameValidation = validateAspirantName(nameInput);
      if (!nameValidation.isValid) {
        setErrorMessage(nameValidation.error || 'Please enter a valid aspirant name.');
        return;
      }
    }

    const emailValidation = validateProperEmail(cleanEmail);
    if (!emailValidation.isValid) {
      setErrorMessage(emailValidation.error || 'Please enter a valid email address.');
      return;
    }

    if (!passwordInput || passwordInput.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      soundManager.playTap();
      setLoading(true);
      setErrorMessage(null);
      setInfoMessage(null);

      let user: FirebaseUser;
      if (emailAuthMode === 'signin') {
        user = await signInWithEmailPassword(cleanEmail, passwordInput);
      } else {
        user = await registerWithEmailPassword(cleanEmail, passwordInput, nameInput.trim());
      }

      if (user) {
        soundManager.playVictory();
        recordBattleSignupCompleted(user.uid, 'email');
        onSuccess(user);
      }
    } catch (err: any) {
      console.warn('Guest Conversion Email Auth Error:', err);
      setErrorMessage(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isPyq = variant === 'pyq_10';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-conversion-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative text-center space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Circular close button in top-right corner */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700/60 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
          id="guest-conversion-close-btn"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Small Progress Emblem / Graphic */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-sky-500/15 to-purple-500/20 border border-sky-500/30 flex items-center justify-center text-2xl shadow-inner">
          {isPyq ? (
            <Target className="w-7 h-7 text-amber-400" />
          ) : (
            <Swords className="w-7 h-7 text-sky-400" />
          )}
        </div>

        {/* Header Text */}
        <div className="space-y-1">
          <h3 
            id="guest-conversion-title"
            className="text-lg sm:text-xl font-black text-white tracking-tight"
          >
            {isPyq ? 'Your progress is worth saving 🎯' : 'Save this battle ⚔️'}
          </h3>
          <p className="text-xs text-sky-300 font-semibold">
            {isPyq ? "You've completed 10 PYQs" : (
              stats?.score !== undefined 
                ? `Score: ${stats.score} Pts • ${stats.accuracy ?? 0}% Accuracy` 
                : 'Preserve your rank and answers'
            )}
          </p>
        </div>

        {/* Small Stats Grid if available */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 bg-slate-950/70 border border-slate-800/90 rounded-2xl p-2.5 text-center">
            {isPyq ? (
              <>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Correct</span>
                  </div>
                  <div className="text-sm font-black text-emerald-300 font-mono">
                    {stats.correctCount ?? 0}
                  </div>
                </div>

                <div className="space-y-0.5 border-x border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>Mistakes</span>
                  </div>
                  <div className="text-sm font-black text-rose-300 font-mono">
                    {stats.mistakeCount ?? 0}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
                    <Target className="w-3 h-3 text-amber-400" />
                    <span>Accuracy</span>
                  </div>
                  <div className="text-sm font-black text-amber-300 font-mono">
                    {stats.accuracy ?? 0}%
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Score
                  </div>
                  <div className="text-sm font-black text-amber-400 font-mono">
                    {stats.score !== undefined ? `${stats.score > 0 ? '+' : ''}${stats.score}` : '0'}
                  </div>
                </div>

                <div className="space-y-0.5 border-x border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Mistakes
                  </div>
                  <div className="text-sm font-black text-rose-300 font-mono">
                    {stats.mistakeCount ?? 0}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Accuracy
                  </div>
                  <div className="text-sm font-black text-sky-300 font-mono">
                    {stats.accuracy ?? 0}%
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Value Proposition Message */}
        <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
          {isPyq
            ? 'Sign in to save your PYQ progress, mistakes, streaks and performance across devices.'
            : 'Sign in to save your score, mistakes, explanations and progress.'}
        </p>

        {/* Info message banner (e.g., reset email sent) */}
        {infoMessage && (
          <div className="bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 text-xs p-2.5 rounded-xl flex items-start gap-2 text-left animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="flex-1">{infoMessage}</p>
          </div>
        )}

        {/* Error message banner if sign-in fails */}
        {errorMessage && (
          <div className="bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs p-2.5 rounded-xl flex items-start gap-2 text-left animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p>{errorMessage}</p>
              {!showEmailForm && (
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(true)}
                  className="text-[11px] underline text-rose-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Try Google redirect sign-in</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Auth CTAs */}
        <div className="pt-2 space-y-2.5">
          {!showEmailForm ? (
            <>
              {/* Primary CTA: Google Sign-In */}
              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                disabled={loading}
                id="guest-conversion-google-btn"
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-extrabold py-3 px-4 rounded-2xl text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-white/5 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-75"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Subtle divider */}
              <div className="flex items-center gap-2 text-slate-500 py-0.5">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">or</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* Sign in with Email Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setShowEmailForm(true);
                  setErrorMessage(null);
                }}
                id="guest-conversion-email-open-btn"
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 font-bold py-2.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Sign in with Email</span>
              </button>
            </>
          ) : (
            /* Email Sign In / Sign Up Form */
            <form onSubmit={handleEmailAuthSubmit} className="space-y-3 text-left">
              {/* Mode Toggle: Sign In vs Create Account */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    setEmailAuthMode('signin');
                    setErrorMessage(null);
                  }}
                  id="guest-email-mode-signin"
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    emailAuthMode === 'signin'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    setEmailAuthMode('signup');
                    setErrorMessage(null);
                  }}
                  id="guest-email-mode-signup"
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    emailAuthMode === 'signup'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {emailAuthMode === 'forgot' && (
                <p className="text-[11px] text-sky-300">
                  Enter your email address and we will send you a password reset link.
                </p>
              )}

              {/* Name field (Only for sign up) */}
              {emailAuthMode === 'signup' && (
                <div className="space-y-1">
                  <label htmlFor="guest-email-name-input" className="text-[11px] font-semibold text-slate-300 block">
                    Your Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="guest-email-name-input"
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1">
                <label htmlFor="guest-email-address-input" className="text-[11px] font-semibold text-slate-300 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="guest-email-address-input"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="aspirant@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                    required
                  />
                </div>
                {emailInput && !emailInput.includes('@') && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {COMMON_AUTOCOMPLETE_DOMAINS.slice(0, 3).map(dom => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => setEmailInput(`${emailInput.trim()}@${dom}`)}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-sky-950 border border-slate-800 text-[10px] text-sky-400 font-mono transition-colors"
                      >
                        @{dom}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Password field (Not in forgot mode) */}
              {emailAuthMode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="guest-email-password-input" className="text-[11px] font-semibold text-slate-300 block">
                      Password
                    </label>
                    {emailAuthMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playTap();
                          setEmailAuthMode('forgot');
                          setErrorMessage(null);
                        }}
                        id="guest-email-forgot-btn"
                        className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="guest-email-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={emailAuthMode === 'signup' ? 'Min 6 characters' : 'Enter password'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      id="guest-email-toggle-pw-btn"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                id="guest-email-submit-btn"
                className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    {emailAuthMode === 'signin' && 'Sign In with Email'}
                    {emailAuthMode === 'signup' && 'Create Account & Save'}
                    {emailAuthMode === 'forgot' && 'Send Reset Link'}
                  </span>
                )}
              </button>

              {/* Back to Google sign in */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setShowEmailForm(false);
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                id="guest-email-back-to-google-btn"
                className="w-full text-center text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 pt-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Google sign in</span>
              </button>
            </form>
          )}

          {/* Secondary subtle action (Never blocks user from playing/reviewing) */}
          <button
            type="button"
            onClick={handleDismiss}
            disabled={loading}
            id="guest-conversion-secondary-btn"
            className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors pt-2 cursor-pointer font-medium"
          >
            {isPyq ? 'Keep playing as guest' : 'Review without saving'}
          </button>
        </div>

      </div>
    </div>
  );
};

