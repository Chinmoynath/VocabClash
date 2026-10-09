import { SubscriptionPlan, UserSubscription } from '../types';
import { mapPlanToGooglePlay, PLAY_PRODUCTS, PlayPlanMapping } from '../config/playProducts';
import { isAndroidCapacitor } from '../utils/platform';
import { restoreCapacitorPlayPurchases } from './capacitorPlayBillingService';
import { auth } from './firebaseService';

const PLAY_BILLING_METHOD = 'https://play.google.com/billing';

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>;
    PaymentRequest?: any;
  }
}

export interface DigitalGoodsItemDetails {
  itemId: string;
  title: string;
  description: string;
  price: {
    currency: string;
    value: string;
  };
  subscriptionPeriod?: string;
  freeTrialPeriod?: string;
}

export interface DigitalGoodsPurchaseDetails {
  itemId: string;
  purchaseToken: string;
  acknowledged: boolean;
  purchaseTime?: number;
  purchaseState?: 'purchased' | 'pending';
}

export interface DigitalGoodsService {
  getDetails: (itemIds: string[]) => Promise<DigitalGoodsItemDetails[]>;
  listPurchases: () => Promise<DigitalGoodsPurchaseDetails[]>;
  listPurchaseHistory?: () => Promise<DigitalGoodsPurchaseDetails[]>;
  acknowledge: (purchaseToken: string, purchaseType: 'repeatable' | 'onetime') => Promise<void>;
  consume?: (purchaseToken: string) => Promise<void>;
}

let cachedDigitalGoodsService: DigitalGoodsService | null = null;
let digitalGoodsCheckDone = false;

/**
 * Check if the Google Play Digital Goods Service is available (Play-distributed TWA)
 */
export async function getPlayDigitalGoodsService(): Promise<DigitalGoodsService | null> {
  if (digitalGoodsCheckDone && cachedDigitalGoodsService) {
    return cachedDigitalGoodsService;
  }

  if (typeof window === 'undefined' || !('getDigitalGoodsService' in window) || typeof window.getDigitalGoodsService !== 'function') {
    digitalGoodsCheckDone = true;
    cachedDigitalGoodsService = null;
    return null;
  }

  try {
    const service = await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
    if (service && typeof service.getDetails === 'function') {
      cachedDigitalGoodsService = service;
      digitalGoodsCheckDone = true;
      return service;
    }
  } catch (err) {
    // Digital Goods API not available or origin not trusted
  }

  digitalGoodsCheckDone = true;
  cachedDigitalGoodsService = null;
  return null;
}

/**
 * Fetch localized details for Google Play products
 */
export async function getGooglePlayProductDetails(skus: string[]): Promise<DigitalGoodsItemDetails[]> {
  const service = await getPlayDigitalGoodsService();
  if (!service) return [];

  try {
    return await service.getDetails(skus);
  } catch (err) {
    console.warn('[Payments] Failed to fetch Google Play item details:', err);
    return [];
  }
}

export interface GooglePlayVerificationResult {
  success: boolean;
  verified: boolean;
  message?: string;
  error?: string;
  subscription?: {
    isPremium: boolean;
    planId: string;
    planName: string;
    subscribedAt: number;
    renewalDate: string;
    autoRenew: boolean;
    provider: 'google_play';
    orderId?: string;
    purchaseToken?: string;
    purchaseType: 'subscription' | 'one_time';
    expiresAt?: number;
    verifiedAt: number;
  };
}

/**
 * Securely verify Google Play purchase token via backend endpoint
 */
export async function verifyGooglePlayPurchaseOnBackend(params: {
  purchaseToken: string;
  sku: string;
  productId: string;
  basePlanId?: string;
  planId: string;
  userId?: string;
  userEmail?: string;
  orderId?: string;
}): Promise<GooglePlayVerificationResult> {
  try {
    // 1. Authenticate caller with fresh Firebase ID token
    let idToken = '';
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        idToken = await currentUser.getIdToken(true);
      } catch (tokErr) {
        console.warn('[Payments] Fresh token retrieval notice:', tokErr);
        idToken = await currentUser.getIdToken();
      }
    }

    if (!idToken) {
      return {
        success: false,
        verified: false,
        error: 'Please sign in with your VocabClash account first to verify and link your VIP subscription.',
      };
    }

    // 2. Resolve target URL:
    // In native Capacitor Android, local WebView cannot resolve relative /api routes; use absolute production domain.
    const verifyEndpoints = isAndroidCapacitor()
      ? ['https://www.vocabclash.in/api/payments/google/verify']
      : ['/api/payments/google/verify', 'https://www.vocabclash.in/api/payments/google/verify'];

    let lastError = '';

    for (const url of verifyEndpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify(params),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.subscription) {
            return data;
          }
        }

        const errData = await res.json().catch(() => ({}));
        lastError = errData.error || `Server verification returned status ${res.status}`;
        if (res.status === 401 || res.status === 400) {
          // Client or auth error, don't retry alternative host
          break;
        }
      } catch (fetchErr: any) {
        lastError = fetchErr?.message || 'Network connection failure';
      }
    }

    return {
      success: false,
      verified: false,
      error: lastError || 'Server verification failed',
    };
  } catch (err: any) {
    console.error('[Payments] Exception during Google Play backend verification:', err);
    return {
      success: false,
      verified: false,
      error: err?.message || 'Network connection failure during purchase verification',
    };
  }
}

/**
 * Executes a purchase through Google Play Billing (TWA Payment Request API + Digital Goods)
 * Uses the proven single-SKU PaymentRequest model for both standalone subscriptions and one-time purchases.
 */
export async function purchaseWithGooglePlay(
  plan: SubscriptionPlan,
  userId?: string,
  userEmail?: string
): Promise<UserSubscription> {
  const service = await getPlayDigitalGoodsService();
  if (!service) {
    console.error('[Play Billing] Digital Goods service NOT obtained');
    throw new Error('Google Play Digital Goods service is not available on this device/environment.');
  }

  const playMapping = mapPlanToGooglePlay(plan.id);

  console.log(`[Play Billing] Selected plan: ${plan.id}`);
  console.log(`[Play Billing] SKU: ${playMapping.sku}`);

  // 1. Fetch item details (safe diagnostics)
  try {
    const details = await service.getDetails([playMapping.sku]);
    console.log(`[Play Billing] Details returned for ${playMapping.sku}:\n`, JSON.stringify(details, null, 2));
  } catch (detailsErr: any) {
    console.warn(`[Play Billing] getDetails notice for ${playMapping.sku}:`, detailsErr?.message);
  }

  // 2. Create PaymentRequest using standard SKU payload
  if (typeof window === 'undefined' || typeof window.PaymentRequest === 'undefined') {
    const err = new Error('Payment Request API is not available on this browser.');
    (err as any).name = 'NotSupportedError';
    throw err;
  }

  const paymentMethodData = [
    {
      supportedMethods: PLAY_BILLING_METHOD,
      data: {
        sku: playMapping.sku,
      },
    },
  ];

  const paymentDetails = {
    total: {
      label: `VocabClash • ${plan.name} (${plan.displayPrice})`,
      amount: {
        currency: 'INR',
        value: String(plan.price),
      },
    },
  };

  const request = new window.PaymentRequest(paymentMethodData, paymentDetails);

  // 3. Show Google Play native purchase sheet
  let paymentResponse: any = null;
  try {
    paymentResponse = await request.show();
    console.log(`[Play Billing] Google Play sheet opened for ${playMapping.sku}`);
  } catch (err: any) {
    const errStr = (err?.message || String(err)).toLowerCase();
    const isAlreadyOwned = errStr.includes('already owned') || 
      errStr.includes('already subscribed') || 
      errStr.includes('item_already_owned');

    if (isAlreadyOwned) {
      console.log(`[Play Billing] Item ${playMapping.sku} already owned in Google Play ledger. Initiating auto-recovery...`);
      const restored = await restoreGooglePlayPurchases(userId, userEmail);
      if (restored && restored.isPremium) {
        return restored;
      }
      throw new Error("We found your Google Play subscription but couldn't verify cloud entitlement yet. Please tap Restore Purchases or log in.");
    }

    console.error(`[Play Billing] paymentRequest.show() error for ${playMapping.sku}:`, err);
    throw err;
  }

  if (!paymentResponse) {
    throw new Error('Payment was not completed.');
  }

  const details = paymentResponse.details || {};
  const purchaseToken = details.token || details.purchaseToken || details.orderId;

  if (!purchaseToken) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error('No purchase token was returned from Google Play.');
  }

  // 4. Verify purchase with secure backend
  const verifyResult = await verifyGooglePlayPurchaseOnBackend({
    purchaseToken,
    sku: playMapping.sku,
    productId: playMapping.productId,
    planId: plan.id,
    userId,
    userEmail,
    orderId: details.orderId,
  });

  if (!verifyResult.success || !verifyResult.verified || !verifyResult.subscription || !verifyResult.subscription.isPremium) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error(verifyResult.error || 'Google Play purchase verification failed on server. No entitlement granted.');
  }

  await paymentResponse.complete('success').catch(() => {});

  // 5. Acknowledge purchase in Play Billing
  const isOneTime = playMapping.itemType === 'one_time';
  try {
    await service.acknowledge(purchaseToken, isOneTime ? 'onetime' : 'repeatable');
    console.log(`[Play Billing] Purchase acknowledged successfully for ${playMapping.sku}`);
  } catch (ackErr: any) {
    console.warn('[Play Billing] Acknowledge notice (may already be acknowledged):', ackErr?.message);
  }

  return {
    ...verifyResult.subscription,
    isPremium: true,
    provider: 'google_play',
  } as UserSubscription;
}

/**
 * Restores or reconciles existing Google Play purchases
 */
export async function restoreGooglePlayPurchases(
  userId?: string,
  userEmail?: string
): Promise<UserSubscription | null> {
  if (isAndroidCapacitor()) {
    console.log('[Payments] Restoring purchases via Native Capacitor Google Play Billing...');
    return restoreCapacitorPlayPurchases(userId, userEmail);
  }

  const service = await getPlayDigitalGoodsService();
  if (!service) {
    throw new Error('Google Play Billing is not available on this device.');
  }

  const purchases = await service.listPurchases();
  if (!purchases || purchases.length === 0) {
    return null;
  }

  const priorityProductIds = [
    PLAY_PRODUCTS.lifetime,
    PLAY_PRODUCTS.yearly,
    PLAY_PRODUCTS.halfYearly,
    PLAY_PRODUCTS.quarterly,
    PLAY_PRODUCTS.monthly,
  ];

  // Check the most relevant active purchase in priority order
  for (const targetId of priorityProductIds) {
    const p = purchases.find(item => item.itemId === targetId && item.purchaseToken);
    if (p && p.purchaseToken) {
      let matchedPlanId = 'quarterly';
      if (p.itemId === PLAY_PRODUCTS.monthly) matchedPlanId = 'monthly';
      else if (p.itemId === PLAY_PRODUCTS.quarterly) matchedPlanId = 'quarterly';
      else if (p.itemId === PLAY_PRODUCTS.halfYearly) matchedPlanId = 'six_months';
      else if (p.itemId === PLAY_PRODUCTS.yearly) matchedPlanId = 'annual';
      else if (p.itemId === PLAY_PRODUCTS.lifetime) matchedPlanId = 'lifetime';

      const isLifetime = matchedPlanId === 'lifetime';

      const verifyResult = await verifyGooglePlayPurchaseOnBackend({
        purchaseToken: p.purchaseToken,
        sku: p.itemId,
        productId: p.itemId,
        planId: matchedPlanId,
        userId,
        userEmail,
      });

      if (verifyResult.success && verifyResult.verified && verifyResult.subscription && verifyResult.subscription.isPremium) {
        if (!p.acknowledged) {
          try {
            await service.acknowledge(p.purchaseToken, isLifetime ? 'onetime' : 'repeatable');
            console.log(`[Play Billing] Acknowledged restored purchase for ${p.itemId}`);
          } catch (ackErr) {
            console.warn('[Play Billing] Acknowledge note during restore:', ackErr);
          }
        }
        return {
          ...verifyResult.subscription,
          isPremium: true,
          provider: 'google_play',
        } as UserSubscription;
      }
    }
  }

  return null;
}
