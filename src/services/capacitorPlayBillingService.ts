import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { SubscriptionPlan, UserSubscription } from '../types';
import { mapPlanToGooglePlay, PLAY_PRODUCTS } from '../config/playProducts';
import { isAndroidCapacitor } from '../utils/platform';
import { verifyGooglePlayPurchaseOnBackend } from './googlePlayBillingService';

/**
 * Checks whether native Google Play Billing via Capgo Native Purchases is supported on this device
 */
export async function isCapacitorPlayBillingSupported(): Promise<boolean> {
  if (!isAndroidCapacitor()) {
    return false;
  }
  try {
    const result = await NativePurchases.isBillingSupported();
    return !!result?.isBillingSupported;
  } catch (err) {
    console.warn('[CapacitorPlayBilling] Billing support check failed:', err);
    return false;
  }
}

/**
 * Initiates a purchase for a given plan via Native Google Play Billing.
 * Enforces mandatory server-side verification of purchaseToken before granting entitlement.
 */
export async function purchaseWithCapacitorPlay(
  plan: SubscriptionPlan,
  userEmail?: string,
  userId?: string
): Promise<{ success: boolean; subscription?: UserSubscription; error?: string }> {
  try {
    if (!isAndroidCapacitor()) {
      return { success: false, error: 'Native Google Play Billing is only available on Android devices.' };
    }

    const mapping = mapPlanToGooglePlay(plan.id);
    const productType = mapping.itemType === 'subscription' ? PURCHASE_TYPE.SUBS : PURCHASE_TYPE.INAPP;

    console.log(`[CapacitorPlayBilling] Initiating purchase for SKU: ${mapping.sku} (Type: ${productType})`);

    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: mapping.sku,
      productType,
      planIdentifier: productType === PURCHASE_TYPE.SUBS ? mapping.sku : undefined,
      appAccountToken: userId || userEmail || undefined,
    });

    if (!transaction || !transaction.purchaseToken) {
      return { success: false, error: 'Purchase was completed but no valid purchase token was returned.' };
    }

    // MANDATORY BACKEND TOKEN VERIFICATION:
    // Entitlements are NEVER granted solely based on client-side transaction returns.
    console.log('[CapacitorPlayBilling] Verifying purchaseToken with backend...');
    const verifyResult = await verifyGooglePlayPurchaseOnBackend({
      purchaseToken: transaction.purchaseToken,
      sku: mapping.sku,
      productId: mapping.sku,
      planId: plan.id,
      userId,
      userEmail,
    });

    if (!verifyResult.success || !verifyResult.verified || !verifyResult.subscription) {
      console.error('[CapacitorPlayBilling] Backend verification failed:', verifyResult.error);
      return {
        success: false,
        error: verifyResult.error || 'Server-side Google Play verification failed. No entitlement granted.',
      };
    }

    // Acknowledge purchase with Google Play
    try {
      await NativePurchases.acknowledgePurchase({
        purchaseToken: transaction.purchaseToken,
      });
      console.log('[CapacitorPlayBilling] Native purchase acknowledged successfully.');
    } catch (ackErr: any) {
      console.warn('[CapacitorPlayBilling] Acknowledge note (may already be acknowledged):', ackErr?.message);
    }

    const subscription: UserSubscription = {
      ...verifyResult.subscription,
      planId: plan.id,
      isPremium: true,
      provider: 'google_play',
      orderId: transaction.orderId || transaction.transactionId || verifyResult.subscription.orderId || `GPA-${Date.now()}`,
    };

    return {
      success: true,
      subscription,
    };
  } catch (err: any) {
    console.error('[CapacitorPlayBilling] Purchase error:', err);
    return {
      success: false,
      error: err?.message || 'An error occurred during Google Play checkout.',
    };
  }
}

/**
 * Restores previous Google Play purchases via Native Purchases.
 * SECURITY: A restore action NEVER grants Premium simply because catalog products exist or
 * restore() returns. Entitlement requires authenticated server verification of an active purchase token.
 */
export async function restoreCapacitorPlayPurchases(
  userId?: string,
  userEmail?: string
): Promise<UserSubscription | null> {
  try {
    if (!isAndroidCapacitor()) {
      return null;
    }

    console.log('[CapacitorPlayBilling] Synchronizing purchases with Google Play...');
    await NativePurchases.restorePurchases();
    
    // Security Rule: Without a verified active purchase token confirmed by /api/payments/google/verify,
    // client must never construct or assign unverified local premium entitlements.
    // If no verifiable active purchase exists, return null so user remains on the free tier.
    return null;
  } catch (err) {
    console.warn('[CapacitorPlayBilling] Restore purchases check failed:', err);
    return null;
  }
}

/**
 * Loads product details from Google Play Store
 */
export async function loadCapacitorPlayProducts(): Promise<Map<string, any>> {
  try {
    if (!isAndroidCapacitor()) {
      return new Map();
    }
    const skus = Object.values(PLAY_PRODUCTS);
    const result = await NativePurchases.getProducts({
      productIdentifiers: skus,
      productType: PURCHASE_TYPE.SUBS,
    });
    
    const productMap = new Map<string, any>();
    if (result && result.products) {
      result.products.forEach(p => {
        productMap.set(p.identifier, p);
      });
    }
    return productMap;
  } catch (err) {
    console.warn('[CapacitorPlayBilling] Failed to load products:', err);
    return new Map();
  }
}

/**
 * Opens Google Play Subscription Management page in browser/app
 */
export async function openCapacitorPlaySubscriptionManagement(): Promise<void> {
  try {
    window.open('https://play.google.com/store/account/subscriptions', '_system');
  } catch (err) {
    console.warn('[CapacitorPlayBilling] Failed to open subscription manager:', err);
  }
}
