// Vercel Serverless Function: POST /api/payments/google/verify
// Strict production Google Play verification with cryptographic Firebase ID token verification,
// Google Play Developer API (Android Publisher v3) inspection, and token replay protection.

import crypto from 'crypto';
import { getVercelOidcToken } from '@vercel/oidc';

const PROJECT_ID = 'tactile-world-jq6d2';
const DATABASE_ID = 'ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3';
const GOOGLE_CLOUD_PROJECT_NUMBER = process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '970204579955';
const GOOGLE_WIF_POOL_ID = process.env.GOOGLE_WIF_POOL_ID || 'vercel';
const GOOGLE_WIF_PROVIDER_ID = process.env.GOOGLE_WIF_PROVIDER_ID || 'vercel';
const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL =
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL ||
  'vocabclash-play-billing@tactile-world-jq6d2.iam.gserviceaccount.com';
const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'in.vocabclash.twa';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

// Public certificates cache for Firebase Auth ID token verification
let cachedPublicKeys: { [kid: string]: string } = {};
let keysExpiry = 0;

async function getFirebasePublicKeys(): Promise<{ [kid: string]: string }> {
  const now = Date.now();
  if (cachedPublicKeys && keysExpiry > now) {
    return cachedPublicKeys;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

    cachedPublicKeys = await res.json();
    keysExpiry = now + maxAgeSec * 1000;
    return cachedPublicKeys;
  } catch (err) {
    console.error('[Verify] Failed to fetch Firebase public certs:', err);
    if (Object.keys(cachedPublicKeys).length > 0) {
      return cachedPublicKeys;
    }
    throw new Error('Unable to fetch Firebase authentication keys');
  }
}

/**
 * Cryptographically verifies Firebase ID token signature and claims using RS256
 */
async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: any;
  let payload: any;

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid token encoding');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid token header algorithm or missing key ID');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    throw new Error('Token expired');
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    throw new Error('Token issued in the future');
  }
  if (payload.aud !== PROJECT_ID) {
    throw new Error(`Invalid audience: expected ${PROJECT_ID}`);
  }
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new Error('Invalid issuer');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing token subject (UID)');
  }

  // Cryptographic RS256 signature verification
  const publicKeys = await getFirebasePublicKeys();
  const cert = publicKeys[header.kid];
  if (!cert) {
    throw new Error('Unknown key identifier (kid)');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const isSignatureValid = verifier.verify(cert, signatureB64, 'base64url');

  if (!isSignatureValid) {
    throw new Error('Cryptographic signature verification failed');
  }

  return {
    uid: payload.sub,
    email: payload.email,
  };
}

/**
 * Obtains a short-lived Google access token for Android Publisher API
 * using Vercel OIDC + Google Cloud Workload Identity Federation (Keyless).
 */
let cachedPlayAccessToken: string | null = null;
let playTokenExpiry = 0;

async function getGooglePlayAccessToken(req: any): Promise<string | null> {
  const now = Date.now();
  if (cachedPlayAccessToken && playTokenExpiry > now + 60000) {
    return cachedPlayAccessToken;
  }

  // 1. Obtain Vercel OIDC token using official @vercel/oidc helper or request context
  let vercelOidcToken: string | null = null;
  try {
    vercelOidcToken = await getVercelOidcToken();
  } catch {
    // Fall back to request context header or environment variable
    vercelOidcToken =
      req?.headers?.['x-vercel-oidc-token'] ||
      process.env.VERCEL_OIDC_TOKEN ||
      null;
  }

  if (!vercelOidcToken) {
    console.warn('[WIF] Missing Vercel OIDC token in x-vercel-oidc-token header or VERCEL_OIDC_TOKEN env.');
    return null;
  }

  // 2. Exchange Vercel OIDC token with Google Security Token Service (STS)
  const stsAudience = `//iam.googleapis.com/projects/${GOOGLE_CLOUD_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GOOGLE_WIF_POOL_ID}/providers/${GOOGLE_WIF_PROVIDER_ID}`;

  let federatedToken = '';
  try {
    const stsRes = await fetch('https://sts.googleapis.com/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audience: stsAudience,
        grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
        subjectToken: vercelOidcToken,
      }),
    });

    if (!stsRes.ok) {
      const stsErr = await stsRes.text();
      console.error('[WIF] STS token exchange failed:', stsRes.status, stsErr);
      return null;
    }

    const stsData = await stsRes.json();
    federatedToken = stsData.access_token;
  } catch (err: any) {
    console.error('[WIF] STS request network exception:', err?.message || err);
    return null;
  }

  if (!federatedToken) {
    console.error('[WIF] STS response missing access_token');
    return null;
  }

  // 3. Impersonate service account using federated credential
  const impersonateUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL)}:generateAccessToken`;

  let googleAccessToken = '';
  let expireTimeStr: string | null = null;
  try {
    const iamRes = await fetch(impersonateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${federatedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: [
          'https://www.googleapis.com/auth/androidpublisher',
          'https://www.googleapis.com/auth/datastore',
        ],
      }),
    });

    if (!iamRes.ok) {
      const iamErr = await iamRes.text();
      console.error('[WIF] IAM service account impersonation failed:', iamRes.status, iamErr);
      return null;
    }

    const iamData = await iamRes.json();
    googleAccessToken = iamData.accessToken;
    expireTimeStr = iamData.expireTime;
  } catch (err: any) {
    console.error('[WIF] IAM request network exception:', err?.message || err);
    return null;
  }

  if (!googleAccessToken) {
    console.error('[WIF] IAM response missing accessToken');
    return null;
  }

  cachedPlayAccessToken = googleAccessToken;
  playTokenExpiry = expireTimeStr ? new Date(expireTimeStr).getTime() : now + 3600000;
  return cachedPlayAccessToken;
}

function toFsValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFsValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFsValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1. Authenticate caller with cryptographic signature verification
    const authHeader = req.headers.authorization || '';
    const isBearer = authHeader.startsWith('Bearer ');
    const idToken = isBearer ? authHeader.slice(7).trim() : '';

    if (!idToken) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: 'Unauthorized: Missing Firebase ID token in Authorization header',
      });
    }

    let verifiedCaller: { uid: string; email?: string };
    try {
      verifiedCaller = await verifyFirebaseIdToken(idToken);
    } catch (authErr: any) {
      console.warn('[Verify] Authentication failed:', authErr.message);
      return res.status(401).json({
        success: false,
        verified: false,
        error: `Unauthorized: ${authErr.message}`,
      });
    }

    const verifiedUid = verifiedCaller.uid;
    const { purchaseToken, sku, productId, planId } = req.body || {};

    if (!purchaseToken || typeof purchaseToken !== 'string' || purchaseToken.trim().length < 5) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Invalid or missing Google Play purchase token.',
      });
    }

    const candidateProduct = (productId || sku || '').trim();

    // 2. Obtain Trusted Server Access Token via WIF for Google Play & Firestore Operations
    const serverAccessToken = await getGooglePlayAccessToken(req);
    if (!serverAccessToken) {
      console.warn('[Google Play] Keyless Vercel OIDC / WIF authentication could not be completed.');
      return res.status(503).json({
        success: false,
        verified: false,
        error: 'Keyless Vercel OIDC / Workload Identity Federation authentication failed. Please ensure OpenID Connect is enabled in Vercel project settings.',
      });
    }

    // 3. Token Replay Protection (Server Identity): Check if purchaseToken has already been claimed
    const tokenHash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
    const tokenRecordUrl = `${FIRESTORE_BASE_URL}/google_play_purchases/${tokenHash}`;

    try {
      const existingTokenRes = await fetch(tokenRecordUrl, {
        headers: { 'Authorization': `Bearer ${serverAccessToken}` },
      });

      if (existingTokenRes.ok) {
        const tokenDoc = await existingTokenRes.json();
        const claimedBy = tokenDoc?.fields?.claimedByUid?.stringValue;
        if (claimedBy && claimedBy !== verifiedUid) {
          console.warn(`[Token Replay] Purchase token already claimed by ${claimedBy}, caller is ${verifiedUid}`);
          return res.status(409).json({
            success: false,
            verified: false,
            error: 'This Google Play purchase has already been claimed by another account.',
          });
        }
      }
    } catch (replayErr) {
      console.warn('[Token Replay] Check notice:', replayErr);
    }

    // 4. Verify purchase with Google Play Developer API (Android Publisher API)
    let verifiedProductId = candidateProduct;
    let verifiedExpiryTimeMs: number | null = null;
    let verifiedOrderId: string = `GPA-${Date.now()}`;
    let verifiedState: string = 'ACTIVE';
    let isAcknowledged = false;

    // Branch A: Standard Subscription Verification via purchases.subscriptionsv2.get
    if (candidateProduct !== 'vocabclash_lifetime') {
      const playUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
      const playRes = await fetch(playUrl, {
        headers: { 'Authorization': `Bearer ${serverAccessToken}` },
      });

        if (!playRes.ok) {
          const playErr = await playRes.text();
          console.error('[Google Play API] Subscription verification error:', playRes.status, playErr);
          return res.status(400).json({
            success: false,
            verified: false,
            error: `Google Play API rejected purchase verification (${playRes.status})`,
          });
        }

        const subData = await playRes.json();
        const state = subData.subscriptionState; // SUBSCRIPTION_STATE_ACTIVE, SUBSCRIPTION_STATE_CANCELED, etc.
        const lineItem = subData.lineItems?.[0];
        verifiedProductId = lineItem?.productId || candidateProduct;
        isAcknowledged = subData.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
        verifiedOrderId = subData.latestOrderId || verifiedOrderId;

        const expiryTimeIso = lineItem?.expiryTime;
        if (expiryTimeIso) {
          verifiedExpiryTimeMs = new Date(expiryTimeIso).getTime();
        }

        const nowMs = Date.now();
        const isCurrentlyEntitled =
          state === 'SUBSCRIPTION_STATE_ACTIVE' ||
          state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
          (state === 'SUBSCRIPTION_STATE_CANCELED' && verifiedExpiryTimeMs !== null && verifiedExpiryTimeMs > nowMs);

        if (!isCurrentlyEntitled) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: `Subscription is not currently active in Google Play (State: ${state})`,
          });
        }

        verifiedState = state;
      } else {
        // Branch B: One-Time Lifetime Product Verification via purchases.productsv2.getproductpurchasev2
        const playUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`;
        const playRes = await fetch(playUrl, {
          headers: { 'Authorization': `Bearer ${serverAccessToken}` },
        });

        if (!playRes.ok) {
          const playErr = await playRes.text();
          console.error('[Google Play API] Productsv2 verification error:', playRes.status, playErr);
          return res.status(400).json({
            success: false,
            verified: false,
            error: `Google Play API rejected product verification (${playRes.status})`,
          });
        }

        const prodData = await playRes.json();
        
        // 1. Verify purchaseStateContext.purchaseState is PURCHASED (reject CANCELLED or PENDING)
        const purchaseState =
          prodData.purchaseStateContext?.purchaseState ||
          prodData.purchaseState ||
          '';

        if (purchaseState !== 'PURCHASED' && purchaseState !== 0) {
          return res.status(400).json({
            success: false,
            verified: false,
            error: `One-time purchase state is not complete (purchaseState: ${purchaseState || 'UNKNOWN'})`,
          });
        }

        // 2. Verify productLineItem contains productId = vocabclash_lifetime (never trust client claims)
        const lineItems = Array.isArray(prodData.productLineItem)
          ? prodData.productLineItem
          : prodData.productLineItem
          ? [prodData.productLineItem]
          : Array.isArray(prodData.lineItems)
          ? prodData.lineItems
          : [];

        const hasLifetimeProduct = lineItems.some((item: any) => item.productId === 'vocabclash_lifetime');
        if (!hasLifetimeProduct && prodData.productId !== 'vocabclash_lifetime') {
          return res.status(400).json({
            success: false,
            verified: false,
            error: 'Google Play response does not contain the vocabclash_lifetime product.',
          });
        }

        verifiedProductId = 'vocabclash_lifetime';

        // 3. Obtain actual orderId from Google if available
        const matchedItem = lineItems.find((item: any) => item.productId === 'vocabclash_lifetime') || lineItems[0];
        verifiedOrderId = matchedItem?.orderId || prodData.orderId || prodData.latestOrderId || verifiedOrderId;

        // 4. Acknowledgement state from Google's response
        isAcknowledged =
          prodData.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' ||
          prodData.acknowledgementState === 1 ||
          prodData.acknowledgementState === true;

        verifiedExpiryTimeMs = null;
        verifiedState = 'PURCHASED';
      }

    // 4. Map confirmed product to internal VocabClash plan
    const isLifetime = verifiedProductId === 'vocabclash_lifetime';
    let effectivePlanId = planId || 'quarterly';
    if (verifiedProductId === 'vocabclash_monthly') effectivePlanId = 'monthly';
    else if (verifiedProductId === 'vocabclash_quarterly') effectivePlanId = 'quarterly';
    else if (verifiedProductId === 'vocabclash_half_yearly') effectivePlanId = 'six_months';
    else if (verifiedProductId === 'vocabclash_yearly') effectivePlanId = 'annual';
    else if (verifiedProductId === 'vocabclash_lifetime') effectivePlanId = 'lifetime';

    const now = Date.now();
    const planName = isLifetime
      ? 'Life Time'
      : effectivePlanId === 'monthly'
      ? 'Monthly'
      : effectivePlanId === 'six_months'
      ? '6 Months'
      : effectivePlanId === 'annual'
      ? 'Annual'
      : 'Quarterly';

    const renewDate = isLifetime
      ? 'Lifetime Active'
      : verifiedExpiryTimeMs
      ? `Renews ${new Date(verifiedExpiryTimeMs).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} at ${new Date(verifiedExpiryTimeMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : 'Active Subscription';

    const subscriptionPayload = {
      isPremium: true,
      planId: effectivePlanId,
      planName,
      subscribedAt: now,
      renewalDate: renewDate,
      autoRenew: !isLifetime && verifiedState === 'SUBSCRIPTION_STATE_ACTIVE',
      provider: 'google_play',
      orderId: verifiedOrderId,
      purchaseType: isLifetime ? 'one_time' : 'subscription',
      expiresAt: isLifetime ? null : verifiedExpiryTimeMs,
      verifiedAt: now,
    };

    // 5. Atomic Firestore Commit:
    // Write 1: users/{verifiedUid} -> update subscription & updatedAt (safe entitlement)
    // Write 2: google_play_purchases/{tokenHash} -> register ownership binding
    const commitUrl = `${FIRESTORE_BASE_URL}:commit`;
    const commitRes = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serverAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${verifiedUid}`,
              fields: {
                subscription: toFsValue(subscriptionPayload),
                updatedAt: toFsValue(now),
              },
            },
            updateMask: {
              fieldPaths: ['subscription', 'updatedAt'],
            },
          },
          {
            update: {
              name: `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/google_play_purchases/${tokenHash}`,
              fields: {
                claimedByUid: toFsValue(verifiedUid),
                productId: toFsValue(verifiedProductId),
                orderId: toFsValue(verifiedOrderId),
                verifiedAt: toFsValue(now),
                expiresAt: toFsValue(verifiedExpiryTimeMs),
                state: toFsValue(verifiedState),
              },
            },
          },
        ],
      }),
    });

    if (!commitRes.ok) {
      const errorText = await commitRes.text();
      console.error('[Google Play Verify] Firestore commit failed:', commitRes.status, errorText);
      return res.status(commitRes.status).json({
        success: false,
        verified: false,
        error: `Entitlement write failed (${commitRes.status}): ${errorText}`,
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      isAcknowledged,
      message: 'Google Play purchase verified by Developer API and entitlement granted',
      subscription: subscriptionPayload,
    });
  } catch (err: any) {
    console.error('[Google Play Verify] Fatal error:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      error: err?.message || 'Internal server error during verification',
    });
  }
}
