import { SubscriptionPlanId } from '../types';

/**
 * Central Google Play Products Configuration
 *
 * Subscription: vocabclash_pro (Active base plans: monthly, quarterly, half-yearly, yearly01)
 * Lifetime: vocabclash_lifetime (One-time product)
 */
export const PLAY_PRODUCTS = {
  subscription: {
    productId: 'vocabclash_pro',
    basePlans: {
      monthly: 'monthly',
      quarterly: 'quarterly',
      halfYearly: 'half-yearly',
      yearly: 'yearly01',
    },
  },
  monthlyTest: {
    productId: 'vocabclash_monthly',
  },
  lifetime: {
    productId: 'vocabclash_lifetime',
  },
} as const;

export interface PlayPlanMapping {
  itemType: 'subscription' | 'one_time';
  sku: string;
  productId: string;
  basePlanId?: string;
  targetPeriod?: string;
}

/**
 * Maps internal VocabClash SubscriptionPlanId to Google Play Product & Base Plan
 */
export function mapPlanToGooglePlay(planId: SubscriptionPlanId): PlayPlanMapping {
  switch (planId) {
    case 'monthly':
      return {
        itemType: 'subscription',
        sku: PLAY_PRODUCTS.monthlyTest.productId,
        productId: PLAY_PRODUCTS.monthlyTest.productId,
        targetPeriod: 'P1M',
      };
    case 'quarterly':
      return {
        itemType: 'subscription',
        sku: `${PLAY_PRODUCTS.subscription.productId}:${PLAY_PRODUCTS.subscription.basePlans.quarterly}`,
        productId: PLAY_PRODUCTS.subscription.productId,
        basePlanId: PLAY_PRODUCTS.subscription.basePlans.quarterly,
        targetPeriod: 'P3M',
      };
    case 'six_months':
      return {
        itemType: 'subscription',
        sku: `${PLAY_PRODUCTS.subscription.productId}:${PLAY_PRODUCTS.subscription.basePlans.halfYearly}`,
        productId: PLAY_PRODUCTS.subscription.productId,
        basePlanId: PLAY_PRODUCTS.subscription.basePlans.halfYearly,
        targetPeriod: 'P6M',
      };
    case 'annual':
      return {
        itemType: 'subscription',
        sku: `${PLAY_PRODUCTS.subscription.productId}:${PLAY_PRODUCTS.subscription.basePlans.yearly}`,
        productId: PLAY_PRODUCTS.subscription.productId,
        basePlanId: PLAY_PRODUCTS.subscription.basePlans.yearly,
        targetPeriod: 'P1Y',
      };
    case 'lifetime':
      return {
        itemType: 'one_time',
        sku: PLAY_PRODUCTS.lifetime.productId,
        productId: PLAY_PRODUCTS.lifetime.productId,
      };
    default:
      return {
        itemType: 'subscription',
        sku: `${PLAY_PRODUCTS.subscription.productId}:${PLAY_PRODUCTS.subscription.basePlans.quarterly}`,
        productId: PLAY_PRODUCTS.subscription.productId,
        basePlanId: PLAY_PRODUCTS.subscription.basePlans.quarterly,
        targetPeriod: 'P3M',
      };
  }
}
