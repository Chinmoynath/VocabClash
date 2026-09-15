import { SubscriptionPlan, UserSubscription } from '../types';
import { mapPlanToGooglePlay, PLAY_PRODUCTS } from '../config/playProducts';

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
}): Promise<GooglePlayVerificationResult> {
  try {
    const res = await fetch('/api/payments/google/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      verified: false,
      error: errData.error || `Server verification returned status ${res.status}`,
    };
  } catch (err: any) {
    console.error('[Payments] Network error during Google Play backend verification:', err);
    return {
      success: false,
      verified: false,
      error: err?.message || 'Network connection failure during purchase verification',
    };
  }
}

/**
 * Executes a purchase through Google Play Billing (TWA Payment Request API + Digital Goods)
 */
export async function purchaseWithGooglePlay(
  plan: SubscriptionPlan,
  userId?: string,
  userEmail?: string
): Promise<UserSubscription> {
  const playMapping = mapPlanToGooglePlay(plan.id);

  console.log('[Play Billing] Checking Digital Goods API');

  let service: DigitalGoodsService | null = null;
  try {
    service = await getPlayDigitalGoodsService();
  } catch (serviceErr: any) {
    console.error('[Play Billing] Error getting Digital Goods service:', serviceErr?.name, serviceErr?.message);
  }

  if (!service) {
    console.error('[Play Billing] Digital Goods service NOT obtained (service is null/undefined)');
    throw new Error('Google Play Digital Goods service is not available on this device/environment.');
  }

  console.log('[Play Billing] Digital Goods service obtained');

  // Fetch item details
  console.log('[Play Billing] Fetching item details');
  let itemDetailsResult: DigitalGoodsItemDetails[] = [];
  const skusToQuery = Array.from(new Set([playMapping.sku, playMapping.productId]));

  try {
    itemDetailsResult = await service.getDetails(skusToQuery);
    console.log('[Play Billing] Item details result:', JSON.stringify(itemDetailsResult, null, 2));
  } catch (detailsErr: any) {
    console.warn('[Play Billing] getDetails error:', detailsErr?.name, detailsErr?.message);
  }

  // Determine SKU for PaymentRequest
  let skuToUse = playMapping.sku;
  if (itemDetailsResult && itemDetailsResult.length > 0) {
    const exactMatch = itemDetailsResult.find(item => item.itemId === playMapping.sku);
    const baseMatch = itemDetailsResult.find(item => item.itemId === playMapping.productId);
    if (exactMatch) {
      skuToUse = exactMatch.itemId;
    } else if (baseMatch && playMapping.itemType === 'one_time') {
      skuToUse = baseMatch.itemId;
    }
  }

  console.log('[Play Billing] Creating PaymentRequest');

  if (typeof window === 'undefined' || typeof window.PaymentRequest === 'undefined') {
    console.error('[Play Billing] PaymentRequest API is undefined on window');
    throw new Error('Payment Request API is not available on this browser.');
  }

  const paymentMethodData = [
    {
      supportedMethods: PLAY_BILLING_METHOD,
      data: {
        sku: skuToUse,
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

  let request: any = null;
  try {
    request = new window.PaymentRequest(paymentMethodData, paymentDetails);
    console.log('[Play Billing] PaymentRequest created');
  } catch (createErr: any) {
    console.error('[Play Billing] PaymentRequest creation FAILED');
    console.error('error.name:', createErr?.name);
    console.error('error.message:', createErr?.message);
    throw createErr;
  }

  console.log('[Play Billing] Calling paymentRequest.show()');

  let paymentResponse: any = null;
  try {
    paymentResponse = await request.show();
    console.log('[Play Billing] Payment sheet opened');
  } catch (err: any) {
    console.error('[Play Billing] paymentRequest.show() FAILED');
    console.error('error.name:', err?.name);
    console.error('error.message:', err?.message);
    if (err?.stack) {
      console.error('error.stack:', err.stack);
    }

    if (err.name === 'AbortError' || err.message?.includes('AbortError') || err.message?.includes('cancel')) {
      throw new Error('Payment was cancelled.');
    }
    throw new Error(`Google Play Billing error (${err.name || 'Error'}): ${err.message || 'Payment initiation failed'}`);
  }

  if (!paymentResponse) {
    throw new Error('Payment was not completed.');
  }

  const details = paymentResponse.details || {};
  const purchaseToken = details.token || details.purchaseToken || details.orderId;

  console.log('[Play Billing] Purchase token received, proceeding with verification');

  if (!purchaseToken) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error('No purchase token was returned from Google Play.');
  }

  // Verify purchase on secure backend
  const verifyResult = await verifyGooglePlayPurchaseOnBackend({
    purchaseToken,
    sku: skuToUse,
    productId: playMapping.productId,
    basePlanId: playMapping.basePlanId,
    planId: plan.id,
    userId,
    userEmail,
  });

  if (!verifyResult.success || !verifyResult.verified) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error(verifyResult.error || 'Google Play purchase verification failed on server.');
  }

  // Complete Payment Request UI
  await paymentResponse.complete('success').catch(() => {});

  // Acknowledge the purchase if not already acknowledged
  try {
    const ackType = playMapping.itemType === 'one_time' ? 'onetime' : 'repeatable';
    await service.acknowledge(purchaseToken, ackType);
    console.log('[Play Billing] Purchase acknowledged successfully');
  } catch (ackErr: any) {
    console.warn('[Play Billing] Purchase acknowledge notice (may already be acknowledged):', ackErr?.message);
  }

  // Construct verified UserSubscription
  const renewDate = plan.id === 'lifetime'
    ? 'Lifetime Active'
    : `Renews ${new Date(Date.now() + (plan.periodDurationDays || 30) * 86400000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

  const subscriptionResult: UserSubscription = {
    isPremium: true,
    planId: plan.id,
    planName: plan.name,
    subscribedAt: Date.now(),
    renewalDate: renewDate,
    autoRenew: plan.id !== 'lifetime',
    provider: 'google_play',
    purchaseToken,
    orderId: details.orderId || undefined,
    purchaseType: playMapping.itemType,
    verifiedAt: Date.now(),
    expiresAt: plan.id === 'lifetime' ? undefined : Date.now() + (plan.periodDurationDays || 30) * 86400000,
  };

  return subscriptionResult;
}

/**
 * Restores or reconciles existing Google Play purchases
 */
export async function restoreGooglePlayPurchases(
  userId?: string,
  userEmail?: string
): Promise<UserSubscription | null> {
  const service = await getPlayDigitalGoodsService();
  if (!service) {
    throw new Error('Google Play Billing is not available on this device.');
  }

  const purchases = await service.listPurchases();
  if (!purchases || purchases.length === 0) {
    return null;
  }

  // Check the most relevant active purchase
  for (const p of purchases) {
    if (p.purchaseToken) {
      const isLifetime = p.itemId === PLAY_PRODUCTS.lifetime.productId;
      const verifyResult = await verifyGooglePlayPurchaseOnBackend({
        purchaseToken: p.purchaseToken,
        sku: p.itemId,
        productId: isLifetime ? PLAY_PRODUCTS.lifetime.productId : PLAY_PRODUCTS.subscription.productId,
        planId: isLifetime ? 'lifetime' : 'quarterly',
        userId,
        userEmail,
      });

      if (verifyResult.success && verifyResult.verified && verifyResult.subscription) {
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
