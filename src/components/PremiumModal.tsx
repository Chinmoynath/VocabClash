import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  SubscriptionPlanId, 
  SubscriptionPlan, 
  UserSubscription,
  PlayerProfile
} from '../types';
import { soundManager } from '../utils/audio';
import { createRazorpayOrder, openRazorpayCheckout } from '../services/razorpayService';
import { GoogleAuthCard } from './GoogleAuthCard';
import { VocabClashLogo } from './VocabClashLogo';
import { extractCleanUserName } from '../utils/nameHelper';
import { 
  X, 
  Check, 
  Crown, 
  ShieldCheck, 
  Sparkles, 
  Zap, 
  ChevronRight, 
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowLeft,
  CreditCard,
  Lock,
  UserCheck,
  AlertCircle,
  LogIn
} from 'lucide-react';

interface PremiumModalProps {
  subscription: UserSubscription;
  player?: PlayerProfile;
  currentUser?: FirebaseUser | null;
  currentUserEmail?: string;
  onClose: () => void;
  onUpdateSubscription: (newSub: UserSubscription) => void;
  onOpenProfile?: () => void;
  onUserChange?: (user: FirebaseUser | null) => void;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 19,
    displayPrice: '₹19.00',
    perMonthPrice: '₹19 per month',
    periodDurationDays: 30,
    periodLabel: 'per month',
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    price: 49,
    displayPrice: '₹49.00',
    perMonthPrice: '₹16 per month',
    badge: 'Popular',
    periodDurationDays: 90,
    periodLabel: '/ 3 mo',
  },
  {
    id: 'six_months',
    name: '6 Months',
    price: 89,
    displayPrice: '₹89.00',
    perMonthPrice: '₹15 per month',
    badge: 'Save 25%',
    periodDurationDays: 180,
    periodLabel: '/ 6 mo',
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 139,
    displayPrice: '₹139.00',
    perMonthPrice: '₹11.5 per month',
    badge: 'Save 40%',
    periodDurationDays: 365,
    periodLabel: '/ year',
  },
  {
    id: 'lifetime',
    name: 'Life Time',
    price: 299,
    displayPrice: '₹299.00',
    perMonthPrice: 'Lifetime access',
    badge: 'Best Value',
    periodLabel: 'one-time',
  },
];

export const PremiumModal: React.FC<PremiumModalProps> = ({
  subscription,
  player,
  currentUser,
  currentUserEmail,
  onClose,
  onUpdateSubscription,
  onOpenProfile,
  onUserChange,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>(
    subscription.planId || 'quarterly'
  );
  const [showManageSheet, setShowManageSheet] = useState<boolean>(false);
  const [showAuthGate, setShowAuthGate] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const effectiveEmail = currentUser?.email || currentUserEmail || player?.email;
  const effectiveName = extractCleanUserName(currentUser?.displayName || player?.name, effectiveEmail);

  const selectedPlan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId) || SUBSCRIPTION_PLANS[1];

  const featurePills = [
    { label: 'Always Ad-Free', highlight: true },
    { label: 'Unlimited PYQ Practice' },
    { label: '1v1 Battles' },
    { label: 'Workouts' },
    { label: 'Error Practice' },
    { label: 'Practise session works offline' },
  ];

  const proceedWithPayment = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // Step 1: Create Order on backend
      const order = await createRazorpayOrder(
        selectedPlan,
        effectiveEmail,
        effectiveName
      );

      // Step 2: Open Razorpay Popup
      await openRazorpayCheckout({
        plan: selectedPlan,
        order,
        userEmail: effectiveEmail,
        userName: effectiveName,
        onSuccess: (paymentRes) => {
          soundManager.playCorrect();
          setIsProcessing(false);
          setShowAuthGate(false);

          const renewDate = selectedPlan.id === 'lifetime' 
            ? 'Lifetime Active' 
            : `Renews ${new Date(Date.now() + (selectedPlan.periodDurationDays || 30) * 86400000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

          onUpdateSubscription({
            isPremium: true,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            subscribedAt: Date.now(),
            renewalDate: renewDate,
            autoRenew: selectedPlan.id !== 'lifetime',
          });

          setStatusMessage({
            text: `Payment Successful! VIP Pass activated for ${selectedPlan.name}.`,
            type: 'success',
          });

          setTimeout(() => {
            setStatusMessage(null);
          }, 3500);
        },
        onError: (err) => {
          setIsProcessing(false);
          const errorMsg = err?.reason || err?.description || err?.message || 'Payment was not completed.';
          setStatusMessage({
            text: errorMsg,
            type: 'error',
          });
          setTimeout(() => setStatusMessage(null), 4000);
        },
      });
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage({
        text: err?.message || 'Could not connect to Razorpay payment gateway',
        type: 'error',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleSubscribeWithRazorpay = async () => {
    soundManager.playTap();

    // Payment Guard: Check if user is logged in
    if (!currentUser) {
      setShowAuthGate(true);
      setStatusMessage({
        text: 'Please log in or create an account before making payment so your VIP status is linked to your email.',
        type: 'info',
      });
      return;
    }

    await proceedWithPayment();
  };

  const handleCancelSubscription = () => {
    soundManager.playTap();
    onUpdateSubscription({
      isPremium: false,
      planId: undefined,
      planName: undefined,
      subscribedAt: undefined,
      renewalDate: undefined,
      autoRenew: false,
    });
    setShowManageSheet(false);
    setStatusMessage({
      text: 'Subscription cancelled. Free tier active.',
      type: 'success',
    });
    setTimeout(() => setStatusMessage(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-[#121118] text-slate-100 border border-slate-800/90 rounded-[32px] p-5 shadow-[0_0_50px_rgba(112,0,255,0.2)] relative max-h-[94vh] flex flex-col justify-between overflow-y-auto no-scrollbar">
        {/* Top Controls: Close Button */}
        <div className="flex items-center justify-between z-10">
          <button
            onClick={() => {
              soundManager.playTap();
              if (showAuthGate) {
                setShowAuthGate(false);
              } else {
                onClose();
              }
            }}
            className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="text-[10px] uppercase font-mono tracking-widest text-purple-400 font-bold bg-purple-950/60 border border-purple-800/50 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <Lock className="w-2.5 h-2.5" />
            <span>RAZORPAY SECURE VIP</span>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`my-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 animate-fadeIn border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                : statusMessage.type === 'info'
                ? 'bg-indigo-950/90 border-indigo-500 text-indigo-200'
                : 'bg-rose-950/90 border-rose-500 text-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusMessage.type === 'info' ? (
              <LogIn className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="text-center">{statusMessage.text}</span>
          </div>
        )}

        {/* Auth Gate View when payment clicked without being logged in */}
        {showAuthGate && !currentUser ? (
          <div className="space-y-4 my-auto py-2 animate-fadeIn">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/70 border border-amber-500/60 flex items-center justify-center text-amber-400 mx-auto shadow-lg">
                <LogIn className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">
                Please Log In to Continue
              </h3>
              <p className="text-xs text-slate-300 px-2 leading-relaxed">
                To link your <span className="text-purple-300 font-bold">{selectedPlan.name} VIP Pass ({selectedPlan.displayPrice})</span> securely across all your devices, please log in or create an account with email or Google.
              </p>
            </div>

            {/* Embedded Auth Card with Google 1-Tap & Email/Password */}
            <div className="rounded-2xl border border-purple-500/40 p-1 bg-purple-950/20">
              <GoogleAuthCard
                currentUser={currentUser || null}
                isSyncing={false}
                onUserChange={(newUser) => {
                  if (onUserChange) onUserChange(newUser);
                  if (newUser) {
                    setShowAuthGate(false);
                    setStatusMessage({
                      text: `Logged in as ${newUser.email || newUser.displayName}! You can now proceed with payment.`,
                      type: 'success',
                    });
                  }
                }}
              />
            </div>

            <div className="space-y-2 pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setShowAuthGate(false);
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Back to Plan Selection
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setShowAuthGate(false);
                  proceedWithPayment();
                }}
                className="text-[10px] text-slate-500 hover:text-slate-400 underline transition-colors"
              >
                Skip login and proceed as Guest anyway
              </button>
            </div>
          </div>
        ) : (
          /* Normal Plan Selection & Feature List */
          <>
            {/* Header Hero Section */}
            <div className="text-center space-y-2 mt-2">
              {/* Glowing App Logo */}
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 bg-purple-600/40 rounded-3xl blur-xl animate-pulse" />
                <VocabClashLogo size="lg" className="rounded-2xl ring-2 ring-purple-400/60 shadow-xl relative" />
              </div>

              {/* Title */}
              <div>
                <h2 className="text-xl font-black text-slate-50 tracking-tight">
                  {subscription.isPremium ? 'Premium Active' : 'Go Premium'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {subscription.isPremium && subscription.renewalDate
                    ? subscription.renewalDate
                    : 'Accelerate your Govt Exam English preparation ad-free'}
                </p>
              </div>

              {/* Logged in status pill / Notice */}
              {currentUser ? (
                <div className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-medium">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span className="truncate max-w-[170px]">{currentUser.email || currentUser.displayName}</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthGate(true)}
                  className="inline-flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-600/60 text-indigo-300 px-3 py-1 rounded-full text-[11px] font-bold hover:bg-indigo-900 transition-colors shadow-inner"
                >
                  <LogIn className="w-3 h-3 text-indigo-400" />
                  <span>Log In / Create Account</span>
                </button>
              )}
            </div>

            {/* Feature Pills */}
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {featurePills.map((pill, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    pill.highlight
                      ? 'bg-purple-950/70 border-purple-500/80 text-purple-200 ring-1 ring-purple-500/30'
                      : 'bg-[#1a1824] border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>{pill.label}</span>
                </div>
              ))}
            </div>

            {/* "Choose your plan" Section */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs px-1 text-slate-400 font-bold tracking-wide">
                <span>Choose your plan</span>
                <span className="text-[11px] text-purple-400 font-mono">Verified PYQ Pool</span>
              </div>

              <div className="space-y-2">
                {SUBSCRIPTION_PLANS.map(plan => {
                  const isSelected = selectedPlanId === plan.id;
                  const isCurrentActive = subscription.isPremium && subscription.planId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => {
                        soundManager.playTap();
                        setSelectedPlanId(plan.id);
                      }}
                      className={`relative p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-[#1e1738] border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/40 text-white'
                          : 'bg-[#15141f] border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {/* Left Side: Radio circle & Plan Name */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'border-2 border-slate-600 bg-slate-900/60'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-100">
                              {plan.name}
                            </span>

                            {plan.badge && (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                                  plan.id === 'quarterly'
                                    ? 'bg-purple-900/90 text-purple-200 border border-purple-600/60'
                                    : plan.id === 'lifetime'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-600/60'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-600/60'
                                }`}
                              >
                                {plan.badge}
                              </span>
                            )}

                            {isCurrentActive && (
                              <span className="text-[9px] bg-emerald-900 text-emerald-200 px-1.5 py-0.2 rounded font-bold">
                                Current
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 font-medium">
                            {plan.perMonthPrice}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Price */}
                      <div className="text-right">
                        <div className="text-sm font-black font-mono text-slate-100 tracking-tight">
                          {plan.displayPrice}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {plan.periodLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manage Subscription Overlay sheet when clicked */}
            {showManageSheet && (
              <div className="mt-3 p-3 bg-slate-900 border border-purple-800/60 rounded-2xl space-y-2 animate-fadeIn">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Manage VIP Subscription</span>
                  <button 
                    onClick={() => setShowManageSheet(false)}
                    className="text-slate-400 text-xs hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-[11px] text-slate-400">
                  Active Plan: <span className="text-purple-300 font-bold">{subscription.planName || 'Pro'}</span>
                  <br />
                  Status: <span className="text-emerald-400 font-semibold">{subscription.renewalDate || 'Active'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSubscribeWithRazorpay}
                    className="bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded-xl text-xs"
                  >
                    Switch to {selectedPlan.name}
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    className="bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold py-2 rounded-xl text-xs"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )}

            {/* Bottom CTA Action Button */}
            <div className="mt-5 pt-1 space-y-2">
              {subscription.isPremium ? (
                <button
                  onClick={() => {
                    soundManager.playTap();
                    setShowManageSheet(!showManageSheet);
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-6 rounded-full shadow-[0_0_25px_rgba(147,51,234,0.4)] text-sm flex items-center justify-center gap-2 border border-purple-400/30 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Manage Subscription</span>
                </button>
              ) : (
                <button
                  disabled={isProcessing}
                  onClick={handleSubscribeWithRazorpay}
                  className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] text-white font-extrabold py-3.5 px-6 rounded-full shadow-[0_0_25px_rgba(147,51,234,0.4)] text-sm flex items-center justify-center gap-2 border border-purple-400/30 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting to Razorpay...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pay via Razorpay • {selectedPlan.displayPrice}</span>
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-500" /> UPI / Cards / NetBanking
                </span>
                <span>•</span>
                <span>Instant VIP Unlock</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

