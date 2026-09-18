import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { SubscriptionPlan, UserSubscription } from '../types';
import { mapPlanToGooglePlay, PLAY_PRODUCTS } from '../config/playProducts';
import { isAndroidCapacitor } from '../utils/platform';

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
 * Initiates a purchase for a given plan via Native Google Play Billing
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
      return { success: false, error: 'Purchase was completed but no purchase token was returned.' };
    }

    const isLifetime = plan.id === 'lifetime';
    const expiresAt = isLifetime 
      ? Date.now() + 100 * 365 * 24 * 60 * 60 * 1000
      : Date.now() + (plan.periodDurationDays || 30) * 24 * 60 * 60 * 1000;

    const subscription: UserSubscription = {
      planId: plan.id,
      subscribedAt: Date.now(),
      expiresAt: expiresAt,
      autoRenew: !isLifetime,
      isPremium: true,
      provider: 'google_play',
      orderId: transaction.orderId || transaction.transactionId || `GPA-${Date.now()}`,
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
 * Restores previous Google Play purchases via Native Purchases
 */
export async function restoreCapacitorPlayPurchases(
  userId?: string,
  userEmail?: string
): Promise<UserSubscription | null> {
  try {
    if (!isAndroidCapacitor()) {
      return null;
    }

    console.log('[CapacitorPlayBilling] Restoring native purchases...');
    await NativePurchases.restorePurchases();
    
    // Check available products / purchases
    const res = await NativePurchases.getProducts({
      productIdentifiers: Object.values(PLAY_PRODUCTS),
      productType: PURCHASE_TYPE.SUBS,
    });

    if (res && res.products && res.products.length > 0) {
      // Create restored subscription
      const restoredSub: UserSubscription = {
        planId: 'quarterly',
        subscribedAt: Date.now(),
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        autoRenew: true,
        isPremium: true,
        provider: 'google_play',
        orderId: `RESTORED-${Date.now()}`,
      };
      return restoredSub;
    }
    return null;
  } catch (err) {
    console.warn('[CapacitorPlayBilling] Restore purchases failed:', err);
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
