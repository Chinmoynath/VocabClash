import { SubscriptionPlan, UserSubscription } from '../types';
import { getPlayDigitalGoodsService, purchaseWithGooglePlay } from './googlePlayBillingService';
import { createRazorpayOrder, openRazorpayCheckout } from './razorpayService';

export type PaymentProvider = 'google_play' | 'razorpay';

let detectedProviderCache: PaymentProvider | null = null;

/**
 * Detects whether the user is in a Play-distributed TWA (Google Play Billing)
 * or normal web browser (Razorpay).
 *
 * NOTE: Does NOT rely on Android user-agent string. Checks actual Digital Goods API capability.
 */
export async function detectPaymentProvider(): Promise<PaymentProvider> {
  if (detectedProviderCache) {
    return detectedProviderCache;
  }

  console.log('[Payments] Detecting payment environment');

  const playService = await getPlayDigitalGoodsService();

  if (playService) {
    console.log('[Payments] Digital Goods API available');
    console.log('[Payments] Provider: GOOGLE_PLAY');
    detectedProviderCache = 'google_play';
    return 'google_play';
  }

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
 * Automatically directs to Google Play Billing (if inside Play TWA) or Razorpay (if normal web).
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

    if (provider === 'google_play') {
      // Execute Google Play Billing flow
      const updatedSub = await purchaseWithGooglePlay(plan, userId, userEmail);
      onSuccess(updatedSub);
      return;
    }

    // Normal Web: Execute Razorpay flow
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
