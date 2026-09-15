import { SubscriptionPlan, UserSubscription } from '../types';
import { mapPlanToGooglePlay, PLAY_PRODUCTS, PlayPlanMapping } from '../config/playProducts';

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
 * Executes a purchase for the one-time Lifetime product (Known-good reference)
 */
async function purchaseLifetimeProduct(
  plan: SubscriptionPlan,
  userId: string | undefined,
  userEmail: string | undefined,
  service: DigitalGoodsService
): Promise<UserSubscription> {
  const productId = PLAY_PRODUCTS.lifetime.productId;
  console.log('[Play Billing] Lifetime purchase clicked');
  console.log(`[Play Billing] Product ID: ${productId}`);

  // 1. Fetch item details
  try {
    const details = await service.getDetails([productId]);
    console.log('[Play Billing] Lifetime details returned:\n', JSON.stringify(details, null, 2));
  } catch (detailsErr: any) {
    console.warn('[Play Billing] Lifetime getDetails notice:', detailsErr?.message);
  }

  // 2. Create PaymentRequest
  if (typeof window === 'undefined' || typeof window.PaymentRequest === 'undefined') {
    const err = new Error('Payment Request API is not available on this browser.');
    (err as any).name = 'NotSupportedError';
    throw err;
  }

  const paymentMethodData = [
    {
      supportedMethods: PLAY_BILLING_METHOD,
      data: {
        sku: productId,
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

  // 3. Show PaymentRequest
  let paymentResponse: any = null;
  try {
    paymentResponse = await request.show();
    console.log('[Play Billing] Lifetime Google Play sheet opened');
  } catch (err: any) {
    console.error('[Play Billing] Lifetime paymentRequest.show() error:', err);
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

  const verifyResult = await verifyGooglePlayPurchaseOnBackend({
    purchaseToken,
    sku: productId,
    productId,
    planId: plan.id,
    userId,
    userEmail,
  });

  if (!verifyResult.success || !verifyResult.verified) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error(verifyResult.error || 'Google Play purchase verification failed on server.');
  }

  await paymentResponse.complete('success').catch(() => {});

  try {
    await service.acknowledge(purchaseToken, 'onetime');
    console.log('[Play Billing] Lifetime purchase acknowledged successfully');
  } catch (ackErr: any) {
    console.warn('[Play Billing] Lifetime acknowledge notice:', ackErr?.message);
  }

  return {
    isPremium: true,
    planId: plan.id,
    planName: plan.name,
    subscribedAt: Date.now(),
    renewalDate: 'Lifetime Active',
    autoRenew: false,
    provider: 'google_play',
    purchaseToken,
    orderId: details.orderId || undefined,
    purchaseType: 'one_time',
    verifiedAt: Date.now(),
  };
}

/**
 * Executes a purchase for active subscriptions (vocabclash_pro)
 */
async function purchaseSubscriptionProduct(
  plan: SubscriptionPlan,
  userId: string | undefined,
  userEmail: string | undefined,
  service: DigitalGoodsService,
  playMapping: PlayPlanMapping
): Promise<UserSubscription> {
  const productId = PLAY_PRODUCTS.subscription.productId; // vocabclash_pro
  const requestedBasePlan = playMapping.basePlanId || 'monthly';

  console.log('[Play Billing][Subscription] Purchase clicked');
  console.log(`[Play Billing][Subscription] Product ID: ${productId}`);
  console.log(`[Play Billing][Subscription] Requested base plan: ${requestedBasePlan}`);

  console.log('[Play Billing][Subscription] Getting Digital Goods service');
  console.log(`[Play Billing][Subscription] Fetching details for:\n${productId}`);

  let itemDetailsResult: DigitalGoodsItemDetails[] = [];
  try {
    itemDetailsResult = await service.getDetails([productId]);
    console.log('[Play Billing][Subscription] Product details returned:\n', JSON.stringify(itemDetailsResult, null, 2));
  } catch (detailsErr: any) {
    console.error('[Play Billing][Subscription] ERROR fetching details:', detailsErr);
    console.error('name:', detailsErr?.name);
    console.error('message:', detailsErr?.message);
  }

  // Log available subscription offers/base plans safely
  const offersSummary = itemDetailsResult.map((item: any, idx) => ({
    index: idx,
    itemId: item.itemId,
    title: item.title,
    price: item.price,
    subscriptionPeriod: item.subscriptionPeriod,
    basePlanId: item.basePlanId,
    offerId: item.offerId,
    offerToken: item.offerToken ? `${String(item.offerToken).slice(0, 10)}...` : undefined,
  }));
  console.log('[Play Billing][Subscription] Available subscription offers/base plans:\n', JSON.stringify(offersSummary, null, 2));

  console.log(`[Play Billing][Subscription] Looking for base plan:\n${requestedBasePlan}`);

  // Find matching offer by basePlanId, itemId, offerId, or period
  let matchingOffer: any = null;
  if (itemDetailsResult && itemDetailsResult.length > 0) {
    matchingOffer = itemDetailsResult.find((item: any) => {
      if (item.basePlanId && item.basePlanId.toLowerCase() === requestedBasePlan.toLowerCase()) return true;
      if (item.itemId && (
        item.itemId === `${productId}:${requestedBasePlan}` ||
        item.itemId.endsWith(`:${requestedBasePlan}`) ||
        item.itemId.toLowerCase() === requestedBasePlan.toLowerCase()
      )) return true;
      if (item.offerId && item.offerId.toLowerCase() === requestedBasePlan.toLowerCase()) return true;
      if (playMapping.targetPeriod && item.subscriptionPeriod === playMapping.targetPeriod) return true;
      return false;
    });
  }

  if (matchingOffer) {
    console.log('[Play Billing][Subscription] Matching offer found:\n', JSON.stringify({
      itemId: matchingOffer.itemId,
      title: matchingOffer.title,
      price: matchingOffer.price,
      basePlanId: matchingOffer.basePlanId,
      subscriptionPeriod: matchingOffer.subscriptionPeriod,
      offerToken: matchingOffer.offerToken ? `${String(matchingOffer.offerToken).slice(0, 10)}...` : undefined,
    }, null, 2));
  } else {
    console.log(`[Play Billing][Subscription] No direct match from getDetails for ${requestedBasePlan}, constructing standard Digital Goods subscription payload`);
  }

  console.log('[Play Billing][Subscription] Creating PaymentRequest');

  if (typeof window === 'undefined' || typeof window.PaymentRequest === 'undefined') {
    const err = new Error('Payment Request API is not available on this browser.');
    (err as any).name = 'NotSupportedError';
    throw err;
  }

  const offerToken = matchingOffer?.offerToken || (matchingOffer as any)?.token;
  const skuToPass = matchingOffer?.itemId || (offerToken ? productId : `${productId}:${requestedBasePlan}`);

  const paymentMethodData = [
    {
      supportedMethods: PLAY_BILLING_METHOD,
      data: {
        sku: skuToPass,
        ...(offerToken ? { offerToken } : {}),
        basePlanId: requestedBasePlan,
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
    console.log('[Play Billing][Subscription] PaymentRequest created');
  } catch (createErr: any) {
    console.error('[Play Billing][Subscription] ERROR:', createErr);
    console.error('name:', createErr?.name);
    console.error('message:', createErr?.message);
    throw createErr;
  }

  console.log('[Play Billing][Subscription] Calling paymentRequest.show()');

  let paymentResponse: any = null;
  try {
    paymentResponse = await request.show();
    console.log('[Play Billing][Subscription] Google Play sheet opened');
  } catch (err: any) {
    console.error('[Play Billing][Subscription] ERROR:', err);
    console.error('name:', err?.name);
    console.error('message:', err?.message);
    if (err?.stack) {
      console.error('stack:', err.stack);
    }
    throw err;
  }

  if (!paymentResponse) {
    throw new Error('Payment was not completed.');
  }

  const details = paymentResponse.details || {};
  const purchaseToken = details.token || details.purchaseToken || details.orderId;

  console.log('[Play Billing][Subscription] Purchase token received, proceeding with verification');

  if (!purchaseToken) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error('No purchase token was returned from Google Play.');
  }

  const verifyResult = await verifyGooglePlayPurchaseOnBackend({
    purchaseToken,
    sku: skuToPass,
    productId,
    basePlanId: requestedBasePlan,
    planId: plan.id,
    userId,
    userEmail,
  });

  if (!verifyResult.success || !verifyResult.verified) {
    await paymentResponse.complete('fail').catch(() => {});
    throw new Error(verifyResult.error || 'Google Play purchase verification failed on server.');
  }

  await paymentResponse.complete('success').catch(() => {});

  try {
    await service.acknowledge(purchaseToken, 'repeatable');
    console.log('[Play Billing][Subscription] Purchase acknowledged successfully');
  } catch (ackErr: any) {
    console.warn('[Play Billing][Subscription] Purchase acknowledge notice:', ackErr?.message);
  }

  const renewDate = `Renews ${new Date(Date.now() + (plan.periodDurationDays || 30) * 86400000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

  return {
    isPremium: true,
    planId: plan.id,
    planName: plan.name,
    subscribedAt: Date.now(),
    renewalDate: renewDate,
    autoRenew: true,
    provider: 'google_play',
    purchaseToken,
    orderId: details.orderId || undefined,
    purchaseType: 'subscription',
    verifiedAt: Date.now(),
    expiresAt: Date.now() + (plan.periodDurationDays || 30) * 86400000,
  };
}

/**
 * Executes a purchase through Google Play Billing (TWA Payment Request API + Digital Goods)
 */
export async function purchaseWithGooglePlay(
  plan: SubscriptionPlan,
  userId?: string,
  userEmail?: string
): Promise<UserSubscription> {
  const service = await getPlayDigitalGoodsService();
  if (!service) {
    throw new Error('Google Play Digital Goods service is not available on this device/environment.');
  }

  const playMapping = mapPlanToGooglePlay(plan.id);

  if (plan.id === 'lifetime') {
    return await purchaseLifetimeProduct(plan, userId, userEmail, service);
  }

  return await purchaseSubscriptionProduct(plan, userId, userEmail, service, playMapping);
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
