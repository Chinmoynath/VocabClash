import { SubscriptionPlan, UserSubscription } from '../types';
import { getPlayDigitalGoodsService, purchaseWithGooglePlay } from './googlePlayBillingService';
import { 
  isCapacitorPlayBillingSupported, 
  purchaseWithCapacitorPlay 
} from './capacitorPlayBillingService';
import { createRazorpayOrder, openRazorpayCheckout } from './razorpayService';
import { isAndroidCapacitor } from '../utils/platform';

export type PaymentProvider = 
  | 'google_play' 
  | 'razorpay' 
  | 'capacitor_google_play' 
  | 'capacitor_google_play_unavailable';

let detectedProviderCache: PaymentProvider | null = null;

/**
 * Detects the appropriate payment provider:
 * 1. Native Capacitor Android -> Native Google Play Billing (NEVER Razorpay)
 * 2. Play-distributed TWA -> Digital Goods API / Google Play Billing
 * 3. Standard Web Browser -> Razorpay
 *
 * NOTE: Does NOT rely on Android user-agent string. Checks actual platform capabilities.
 */
export async function detectPaymentProvider(): Promise<PaymentProvider> {
  if (detectedProviderCache) {
    return detectedProviderCache;
  }

  console.log('[Payments] Detecting payment environment');

  // BRANCH 1: CAPACITOR ANDROID NATIVE SHELL
  // When running inside native Capacitor Android, NEVER fall back to Razorpay or TWA Digital Goods.
  if (isAndroidCapacitor()) {
    console.log('[Payments] Platform: Native Capacitor Android');
    try {
      const isSupported = await isCapacitorPlayBillingSupported();
      if (isSupported) {
        console.log('[Payments] Provider: CAPACITOR_GOOGLE_PLAY (Ready)');
        detectedProviderCache = 'capacitor_google_play';
        return 'capacitor_google_play';
      }
      console.warn('[Payments] Provider: CAPACITOR_GOOGLE_PLAY_UNAVAILABLE (Play Services or Billing unavailable)');
      detectedProviderCache = 'capacitor_google_play_unavailable';
      return 'capacitor_google_play_unavailable';
    } catch (err) {
      console.warn('[Payments] Error checking native billing availability:', err);
      detectedProviderCache = 'capacitor_google_play_unavailable';
      return 'capacitor_google_play_unavailable';
    }
  }

  // BRANCH 2: TWA (DIGITAL GOODS API)
  const playService = await getPlayDigitalGoodsService();

  if (playService) {
    console.log('[Payments] Digital Goods API available');
    console.log('[Payments] Provider: GOOGLE_PLAY');
    detectedProviderCache = 'google_play';
    return 'google_play';
  }

  // BRANCH 3: STANDARD WEB BROWSER
  console.log('[Payments] Digital Goods API unavailable');
  console.log('[Payments] Provider: RAZORPAY');
  detectedProviderCache = 'razorpay';
  return 'razorpay';
}

/**
 * Resets detection cache (useful for testing or state resets)
 */
export function resetPaymentProviderCache() {
  detectedProviderCache = null;
}

/**
 * Unified Purchase Entrypoint
 * Automatically directs to Native Google Play (Capacitor), Digital Goods API (TWA), or Razorpay (Web).
 */
export async function purchasePlan(params: {
  plan: SubscriptionPlan;
  userEmail?: string;
  userName?: string;
  userId?: string;
  onSuccess: (subscription: UserSubscription) => void;
  onError: (error: Error) => void;
}): Promise<void> {
  const { plan, userEmail, userName, userId, onSuccess, onError } = params;

  try {
    const provider = await detectPaymentProvider();

    // 1. Native Capacitor Android
    if (provider === 'capacitor_google_play_unavailable') {
      throw new Error('Google Play Billing is currently unavailable on this device. Please check Google Play Services or network connection.');
    }

    if (provider === 'capacitor_google_play') {
      console.log('[Payments] Executing Native Google Play Billing flow...');
      const result = await purchaseWithCapacitorPlay(plan, userEmail, userId);
      if (result.success && result.subscription && result.subscription.isPremium) {
        onSuccess(result.subscription);
      } else {
        throw new Error(result.error || 'Google Play checkout was cancelled or failed.');
      }
      return;
    }

    // 2. Play-distributed TWA
    if (provider === 'google_play') {
      // Execute Google Play Billing flow
      const updatedSub = await purchaseWithGooglePlay(plan, userId, userEmail);
      if (updatedSub && updatedSub.isPremium) {
        onSuccess(updatedSub);
      } else {
        throw new Error('Google Play subscription verification failed. Entitlement not granted.');
      }
      return;
    }

    // 3. Normal Web Browser: Execute Razorpay flow
    const order = await createRazorpayOrder(plan, userEmail, userName);

    await openRazorpayCheckout({
      plan,
      order,
      userEmail,
      userName,
      onSuccess: () => {
        const renewDate = plan.id === 'lifetime'
          ? 'Lifetime Active'
          : `Renews ${new Date(Date.now() + (plan.periodDurationDays || 30) * 86400000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

        const updatedSub: UserSubscription = {
          isPremium: true,
          planId: plan.id,
          planName: plan.name,
          subscribedAt: Date.now(),
          renewalDate: renewDate,
          autoRenew: plan.id !== 'lifetime',
          provider: 'razorpay',
          orderId: order.id,
          purchaseType: plan.id === 'lifetime' ? 'one_time' : 'subscription',
          verifiedAt: Date.now(),
          expiresAt: plan.id === 'lifetime' ? undefined : Date.now() + (plan.periodDurationDays || 30) * 86400000,
        };

        onSuccess(updatedSub);
      },
      onError: (err: any) => {
        const errorMsg = err?.reason || err?.description || err?.message || 'Payment was not completed.';
        onError(new Error(errorMsg));
      },
    });
  } catch (err: any) {
    onError(err instanceof Error ? err : new Error(err?.message || 'Payment initiation failed'));
  }
}
