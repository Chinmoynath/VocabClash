import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseService';
import { UserSubscription, SubscriptionPlanId } from '../types';

export interface ManualEntitlementGrant {
  uid: string;
  email: string;
  subscription: UserSubscription;
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const GRANT_TIMESTAMP = 1759750746000; // Oct 6, 2026

export const MANUAL_ENTITLEMENT_GRANTS: ManualEntitlementGrant[] = [
  {
    uid: '8jqRHAFvZGhXuXMvVI82Iu1t58F3',
    email: 'technicalrishu737@gmail.com',
    subscription: {
      isPremium: true,
      planId: 'monthly',
      planName: 'Monthly VIP Access (₹19)',
      subscribedAt: GRANT_TIMESTAMP,
      renewalDate: 'Renews Nov 5, 2026 at 11:59 PM',
      autoRenew: false,
      provider: 'razorpay',
      orderId: 'VIP_MANUAL_19_GRANT_8jqRHAFv',
      purchaseType: 'subscription',
      expiresAt: GRANT_TIMESTAMP + ONE_MONTH_MS, // Active for 1 full month
      verifiedAt: GRANT_TIMESTAMP,
    },
  },
];

/**
 * Resolves any manual entitlement grants matching either the user's UID or Email address.
 * Validates that the entitlement has not expired.
 */
export function resolveManualEntitlement(uid?: string | null, email?: string | null): UserSubscription | null {
  if (!uid && !email) return null;
  const cleanEmail = email?.trim().toLowerCase();
  const now = Date.now();

  for (const grant of MANUAL_ENTITLEMENT_GRANTS) {
    const matchesUid = Boolean(uid && grant.uid === uid);
    const matchesEmail = Boolean(cleanEmail && grant.email.toLowerCase() === cleanEmail);

    if (matchesUid || matchesEmail) {
      if (!grant.subscription.expiresAt || grant.subscription.expiresAt > now) {
        return { ...grant.subscription };
      }
    }
  }

  return null;
}

/**
 * Admin action to grant/update a user's subscription directly in Firestore.
 * Requires caller to be an authorized admin (Nathchinmoy777@gmail.com) per firestore.rules.
 */
export async function grantAdminUserSubscription(
  targetUid: string,
  targetEmail: string = '',
  planId: SubscriptionPlanId = 'monthly',
  durationDays: number = 30
): Promise<{ success: boolean; subscription: UserSubscription; error?: string }> {
  try {
    if (!targetUid || targetUid.trim().length === 0) {
      return { success: false, subscription: {} as any, error: 'Target user UID is required.' };
    }

    const now = Date.now();
    const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;
    const renewDate = `Renews ${new Date(expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} at ${new Date(expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    const planName = planId === 'monthly' ? 'Monthly VIP Access (₹19)' : `${planId.toUpperCase()} VIP Access`;

    const newSubscription: UserSubscription = {
      isPremium: true,
      planId,
      planName,
      subscribedAt: now,
      renewalDate: renewDate,
      autoRenew: false,
      provider: 'razorpay',
      orderId: `ADMIN_GRANT_${Date.now()}`,
      purchaseType: planId === 'lifetime' ? 'one_time' : 'subscription',
      expiresAt: planId === 'lifetime' ? undefined : expiresAt,
      verifiedAt: now,
    };

    const userDocRef = doc(db, 'users', targetUid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      await updateDoc(userDocRef, {
        subscription: newSubscription,
        updatedAt: now,
        ...(targetEmail ? { email: targetEmail } : {}),
      });
    } else {
      await setDoc(
        userDocRef,
        {
          uid: targetUid,
          email: targetEmail || null,
          subscription: newSubscription,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    console.log(`[Admin VIP Grant] Successfully granted ${planName} to UID: ${targetUid}`);
    return { success: true, subscription: newSubscription };
  } catch (err: any) {
    console.error('[Admin VIP Grant] Error granting subscription:', err);
    return {
      success: false,
      subscription: {} as any,
      error: err?.message || 'Failed to update Firestore subscription document.',
    };
  }
}
