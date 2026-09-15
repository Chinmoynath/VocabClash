import { SubscriptionPlanId } from '../types';

/**
 * Central Google Play Products Configuration
 * ONE Google Play product ID per subscription duration / one-time tier
 */
export const PLAY_PRODUCTS = {
  monthly: 'vocabclash_monthly',
  quarterly: 'vocabclash_quarterly',
  halfYearly: 'vocabclash_half_yearly',
  yearly: 'vocabclash_yearly',
  lifetime: 'vocabclash_lifetime',
} as const;

export interface PlayPlanMapping {
  itemType: 'subscription' | 'one_time';
  sku: string;
  productId: string;
}

/**
 * Maps internal VocabClash SubscriptionPlanId to Google Play Product
 */
export function mapPlanToGooglePlay(planId: SubscriptionPlanId): PlayPlanMapping {
  switch (planId) {
    case 'monthly':
      return {
        itemType: 'subscription',
        sku: PLAY_PRODUCTS.monthly,
        productId: PLAY_PRODUCTS.monthly,
      };
    case 'quarterly':
      return {
        itemType: 'subscription',
        sku: PLAY_PRODUCTS.quarterly,
        productId: PLAY_PRODUCTS.quarterly,
      };
    case 'six_months':
      return {
        itemType: 'subscription',
        sku: PLAY_PRODUCTS.halfYearly,
        productId: PLAY_PRODUCTS.halfYearly,
      };
    case 'annual':
      return {
        itemType: 'subscription',
        sku: PLAY_PRODUCTS.yearly,
        productId: PLAY_PRODUCTS.yearly,
      };
    case 'lifetime':
      return {
        itemType: 'one_time',
        sku: PLAY_PRODUCTS.lifetime,
        productId: PLAY_PRODUCTS.lifetime,
      };
    default:
      return {
        itemType: 'subscription',
        sku: PLAY_PRODUCTS.quarterly,
        productId: PLAY_PRODUCTS.quarterly,
      };
  }
}

