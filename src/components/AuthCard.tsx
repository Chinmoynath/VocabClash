import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  signInWithGoogle, 
  signInWithGoogleRedirect,
  logOut, 
  signInWithEmailPassword, 
  registerWithEmailPassword, 
  sendPasswordReset,
  getFriendlyAuthErrorMessage
} from '../services/firebaseService';
import { soundManager } from '../utils/audio';
import { extractCleanUserName } from '../utils/nameHelper';
import { validateProperEmail, validateAspirantName, COMMON_AUTOCOMPLETE_DOMAINS } from '../utils/emailValidator';
import { 
  Cloud, 
  CheckCircle2, 
  LogOut, 
  Loader2,
  RefreshCw,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  UserPlus
} from 'lucide-react';

interface AuthCardProps {
  currentUser: FirebaseUser | null;
  isSyncing?: boolean;
  onUserChange?: (user: FirebaseUser | null) => void;
  onUpdatePlayer?: (updated: { name?: string }) => void;
  onManualSync?: () => void;
  onSignOut?: () => Promise<void>;
  onSuccessClose?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot_password';

export const AuthCard: React.FC<AuthCardProps> = ({
  currentUser,
  isSyncing = false,
  onUserChange,
  onUpdatePlayer,
  onManualSync,
  onSignOut,
  onSuccessClose,
}) => {
  // Mode: Sign In (Email+Password) vs Sign Up (Email+Password) vs Forgot Password
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Form Fields
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // State flags & feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Google 1-Tap Sign In
  const handleGoogleSignIn = async (forceRedirect = false) => {
    if (loading) return;
    try {
      soundManager.playTap();
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const user = await signInWithGoogle(forceRedirect);
      if (user) {
        if (onUserChange) {
          onUserChange(user);
        }
        soundManager.playCorrect();
        setSuccessMsg('Signed in with Google successfully!');
        if (onSuccessClose) {
          setTimeout(onSuccessClose, 1000);
        }
      }
    } catch (err: any) {
      const code = String(err?.code || '').toLowerCase();
      const msg = String(err?.message || err || '').toLowerCase();
      if (
        code.includes('cancelled-popup-request') || 
        msg.includes('cancelled-popup-request') ||
        code.includes('popup-closed-by-user') || 
        msg.includes('popup-closed-by-user')
      ) {
        // User closed or dismissed popup, no error needed
        return;
      }
      console.warn('Google Sign-In notice:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign In with Email & Password (for returning users)
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    try {
      soundManager.playTap();
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      
      const user = await signInWithEmailPassword(email.trim(), password);
      if (onUserChange) {
        onUserChange(user);
      }
      soundManager.playCorrect();
      setSuccessMsg('Welcome back! Signed in successfully.');
      if (onSuccessClose) {
        setTimeout(onSuccessClose, 1000);
      }
    } catch (err: any) {
      console.error('Email Sign-In Error:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Direct Sign Up with Email & Password (no OTP required)
  const handleDirectSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    const nameValidation = validateAspirantName(name);
    if (!nameValidation.isValid) {
      setErrorMsg(nameValidation.error || 'Please enter a valid aspirant name.');
      return;
    }
    const emailValidation = validateProperEmail(cleanEmail);
    if (!emailValidation.isValid) {
      setErrorMsg(emailValidation.error || 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    try {
      soundManager.playTap();
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      // Create Firebase user directly
      const user = await registerWithEmailPassword(cleanEmail, password, name.trim());
      if (onUpdatePlayer) {
        onUpdatePlayer({ name: name.trim() });
      }
      if (onUserChange) {
        onUserChange(user);
      }

      soundManager.playCorrect();
      setSuccessMsg(`Welcome to VocabClash, ${name.trim()}! Account created successfully.`);
      if (onSuccessClose) {
        setTimeout(onSuccessClose, 1200);
      }
    } catch (err: any) {
      console.error('Email Sign Up Error:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Reset Email
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const emailValidation = validateProperEmail(cleanEmail);
    if (!emailValidation.isValid) {
      setErrorMsg(emailValidation.error || 'Please enter a valid email address to receive the password reset link.');
      return;
    }

    try {
      soundManager.playTap();
      setLoading(true);
      setErrorMsg(null);
      await sendPasswordReset(cleanEmail);
      soundManager.playCorrect();
      setSuccessMsg(`Password reset link sent to ${cleanEmail}! Please check your Inbox and Spam/Junk folder, then click the link to reset your password.`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      soundManager.playTap();
      setLoading(true);
      if (onSignOut) {
        await Promise.race([
          onSignOut(),
          new Promise(r => setTimeout(r, 1200))
        ]);
      } else {
        await logOut();
        if (onUserChange) {
          onUserChange(null);
        }
      }
    } catch (err: any) {
      console.error('Sign Out Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#151224] border border-indigo-900/70 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xl">
      {/* Top Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-950/90 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-100">Aspirant Cloud Sync</span>
              {currentUser ? (
                <span className="text-[9px] bg-emerald-950/90 text-emerald-300 border border-emerald-600/60 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Synced
                </span>
              ) : (
                <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-600/50 px-1.5 py-0.2 rounded font-bold">
                  Guest Mode
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              {currentUser
                ? `Logged in as ${extractCleanUserName(currentUser.displayName, currentUser.email)}`
                : 'Sign in or register directly to protect your rank & streak.'}
            </p>
          </div>
        </div>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="bg-rose-950/90 border border-rose-600 text-rose-200 text-[11px] p-2.5 rounded-xl animate-fadeIn space-y-2">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
          {(errorMsg.toLowerCase().includes('popup') || errorMsg.toLowerCase().includes('domain') || errorMsg.toLowerCase().includes('browser') || errorMsg.toLowerCase().includes('dismissed') || errorMsg.toLowerCase().includes('storage')) && (
            <div className="pt-1.5 border-t border-rose-800/60 flex flex-wrap items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => handleGoogleSignIn(true)}
                className="text-[10px] bg-indigo-700 hover:bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all active:scale-95"
              >
                <span>Try Google Full Redirect</span>
              </button>
              <a
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] bg-rose-800 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-[11px] p-2.5 rounded-xl animate-fadeIn flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="leading-tight">{successMsg}</span>
        </div>
      )}

      {/* Authenticated View */}
      {currentUser ? (
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 overflow-hidden">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="avatar"
                  className="w-8 h-8 rounded-full border border-indigo-400 shrink-0 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                  {extractCleanUserName(currentUser.displayName, currentUser.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="truncate">
                <div className="text-xs text-slate-100 font-bold truncate flex items-center gap-1">
                  <span>{extractCleanUserName(currentUser.displayName, currentUser.email)}</span>
                  {currentUser.emailVerified && (
                    <span title="Email Verified">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {currentUser.email || 'Cloud Account Active'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onManualSync && (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    onManualSync();
                  }}
                  disabled={isSyncing}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium flex items-center gap-1 border border-slate-700 active:scale-95 transition-all"
                  title="Force Cloud Sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              )}
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Unauthenticated View: Direct Tabbed Email Auth */
        <div className="space-y-3 pt-1">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 bg-slate-900/90 p-0.5 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                soundManager.playTap();
                setAuthMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                authMode === 'signin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playTap();
                setAuthMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                authMode === 'signup'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Sign Up</span>
            </button>
          </div>

          {/* TAB 1: SIGN IN (Email & Password for existing accounts) */}
          {authMode === 'signin' && (
            <form onSubmit={handleEmailSignIn} className="space-y-2.5">
              <div className="space-y-2">
                {/* Email input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>

                {/* Password input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    setAuthMode('forgot_password');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Email Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Sign In with Email</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: SIGN UP (Direct registration with Name, Email & Password) */}
          {authMode === 'signup' && (
            <form onSubmit={handleDirectSignUp} className="space-y-2.5 animate-fadeIn">
              <div className="space-y-2">
                {/* Name */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Aspirant Full Name"
                    className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                    />
                  </div>

                  {/* Domain Quick Chips if typing prefix */}
                  {email && !email.includes('@') && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {COMMON_AUTOCOMPLETE_DOMAINS.slice(0, 3).map(dom => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() => setEmail(`${email.trim()}@${dom}`)}
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-indigo-900/60 border border-slate-700 text-[10px] text-indigo-300 font-mono transition-colors"
                        >
                          @{dom}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create Password (min 6 chars)"
                    className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Direct Sign Up Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account Instantly</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD */}
          {authMode === 'forgot_password' && (
            <form onSubmit={handlePasswordReset} className="space-y-2.5 animate-fadeIn">
              <div className="space-y-1 text-center">
                <div className="text-xs font-bold text-slate-200">Reset Your Password</div>
                <div className="text-[10px] text-slate-400">
                  Enter your registered email to receive a password reset link.
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your registered email"
                  className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}

          {/* Social Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-[#151224] px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* 1-Tap Google Sign In */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => handleGoogleSignIn(false)}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-800" />
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          </div>
        </div>
      )}
    </div>
  );
};
