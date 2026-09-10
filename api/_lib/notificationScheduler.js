// api/_lib/notificationScheduler.ts
import { EventEmitter } from "events";

// api/_lib/firebaseAdmin.ts
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
var ADMIN_EMAIL = "nathchinmoy777@gmail.com";
var DEFAULT_PROJECT_ID = "tactile-world-jq6d2";
function checkFirebaseAdminCredentials() {
  const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID).trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  let rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  let keyFormat = "none";
  if (rawPrivateKey) {
    if (rawPrivateKey.includes("\\n")) {
      keyFormat = "escaped_newlines";
    } else if (rawPrivateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      keyFormat = "pem";
    } else {
      keyFormat = "invalid";
    }
  }
  let authType = "none";
  let hasPrivilegedCredentials = false;
  if (clientEmail && rawPrivateKey) {
    authType = "service_account_env";
    hasPrivilegedCredentials = true;
  } else if (serviceAccountKey) {
    authType = "service_account_json";
    hasPrivilegedCredentials = true;
  } else if (googleAppCreds) {
    authType = "google_app_credentials";
    hasPrivilegedCredentials = true;
  } else {
    authType = "project_id_only";
    hasPrivilegedCredentials = false;
  }
  return {
    projectId,
    hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasClientEmail: Boolean(clientEmail),
    hasPrivateKey: Boolean(rawPrivateKey),
    hasServiceAccountKey: Boolean(serviceAccountKey),
    hasGoogleAppCredentials: Boolean(googleAppCreds),
    keyFormat,
    authType,
    hasPrivilegedCredentials
  };
}
function sanitizePrivateKey(rawKey) {
  if (!rawKey) return "";
  let key = rawKey.trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1).trim();
  }
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  return key;
}
function getFirebaseAdminApp() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  const credStatus = checkFirebaseAdminCredentials();
  const projectId = credStatus.projectId;
  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const formattedKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      console.log(`[Firebase Admin] Initializing with FIREBASE_CLIENT_EMAIL and formatted private key (${projectId})`);
      initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey: formattedKey
        }),
        projectId
      });
      return getApps()[0];
    }
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let saString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
      if (saString.startsWith("ey")) {
        try {
          saString = Buffer.from(saString, "base64").toString("utf8");
        } catch {
        }
      }
      const sa = JSON.parse(saString);
      if (sa.private_key) {
        sa.private_key = sanitizePrivateKey(sa.private_key);
      }
      console.log(`[Firebase Admin] Initializing with FIREBASE_SERVICE_ACCOUNT_KEY (${sa.project_id || projectId})`);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || projectId
      });
      return getApps()[0];
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log(`[Firebase Admin] Initializing with applicationDefault credentials (${projectId})`);
      initializeApp({
        credential: applicationDefault(),
        projectId
      });
      return getApps()[0];
    }
    console.warn(`[Firebase Admin] No service account credentials detected in environment. Initializing default project instance for: ${projectId}`);
    initializeApp({
      projectId
    });
    return getApps()[0];
  } catch (err) {
    const apps = getApps();
    if (apps.length > 0) {
      return apps[0];
    }
    console.error("[Firebase Admin] Error initializing privileged credential:", {
      name: err?.name,
      message: err?.message,
      code: err?.code
    });
    initializeApp({ projectId });
    return getApps()[0];
  }
}
function getAdminFirestoreDatabaseId() {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (raw.firestoreDatabaseId) {
        return raw.firestoreDatabaseId;
      }
    }
  } catch {
  }
  return "ai-studio-vocabclashgovtex-f49a3d8d-a36c-4264-be13-35bd86c794c3";
}
var adminDbInstance = null;
var firestoreSettingsApplied = false;
function getAdminFirestore() {
  if (adminDbInstance) {
    return adminDbInstance;
  }
  const app = getFirebaseAdminApp();
  const databaseId = getAdminFirestoreDatabaseId();
  try {
    const db = getFirestore(app, databaseId);
    if (!firestoreSettingsApplied) {
      try {
        db.settings({ ignoreUndefinedProperties: true });
        firestoreSettingsApplied = true;
      } catch {
      }
    }
    adminDbInstance = db;
    return db;
  } catch {
    const db = getFirestore(app);
    if (!firestoreSettingsApplied) {
      try {
        db.settings({ ignoreUndefinedProperties: true });
        firestoreSettingsApplied = true;
      } catch {
      }
    }
    adminDbInstance = db;
    return db;
  }
}
function getAdminMessaging() {
  const app = getFirebaseAdminApp();
  return getMessaging(app);
}
async function sendPushToToken(token, payload) {
  if (!token) {
    return { token, success: false, error: "Empty token" };
  }
  if (token.startsWith("web_") || token.startsWith("client_") || token.startsWith("local_") || token.length < 35) {
    return {
      token,
      success: true,
      messageId: `client_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    };
  }
  const title = payload.title || "VocabClash Daily Reminder";
  const body = payload.body || "Practice today\u2019s exam vocabulary questions on VocabClash!";
  const url = payload.url || "/pyq-drill";
  const type = payload.type || "general";
  const icon = payload.icon || "https://vocabclash.in/icon-192.png";
  const message = {
    token,
    notification: {
      title,
      body
    },
    data: {
      title,
      body,
      url,
      type,
      click_action: url,
      icon,
      timestamp: String(Date.now())
    },
    webpush: {
      headers: {
        Urgency: "high"
      },
      notification: {
        title,
        body,
        icon,
        badge: "https://vocabclash.in/icon-192.png",
        tag: payload.tag || `vocabclash_${type}`,
        renotify: true,
        data: {
          url,
          type
        }
      },
      fcmOptions: {
        link: url
      }
    }
  };
  try {
    console.log(`[push] firebase admin initialized - sending FCM to token (...${token.slice(-8)})`);
    const messaging = getAdminMessaging();
    const response = await messaging.send(message);
    console.log(`[push] FCM send completed, messageId: ${response}`);
    return { token, success: true, messageId: response };
  } catch (err) {
    const errMsg = err?.message || String(err);
    const errCode = err?.code || err?.errorInfo?.code || "";
    console.error(`[push] FCM send failed for token (...${token.slice(-8)}):`, {
      name: err?.name,
      code: errCode,
      message: errMsg
    });
    const isUnregistered = errCode.includes("registration-token-not-registered") || errCode.includes("invalid-registration-token") || errMsg.includes("not registered") || errMsg.includes("Requested entity was not found");
    return {
      token,
      success: false,
      error: errMsg,
      isUnregistered
    };
  }
}
async function sendMulticastPush(tokens, payload) {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, unregisteredTokens: [], results: [] };
  }
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  const results = [];
  const unregisteredTokens = [];
  let successCount = 0;
  let failureCount = 0;
  const realFcmTokens = [];
  for (const t of uniqueTokens) {
    if (t.startsWith("web_") || t.startsWith("client_") || t.startsWith("local_") || t.length < 35) {
      successCount++;
      results.push({
        token: t,
        success: true,
        messageId: `client_sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      });
    } else {
      realFcmTokens.push(t);
    }
  }
  if (realFcmTokens.length === 0) {
    return {
      successCount,
      failureCount: 0,
      unregisteredTokens: [],
      results
    };
  }
  const BATCH_SIZE = 500;
  for (let i = 0; i < realFcmTokens.length; i += BATCH_SIZE) {
    const batch = realFcmTokens.slice(i, i + BATCH_SIZE);
    try {
      const messaging = getAdminMessaging();
      const multicastMessage = {
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body
        },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || "/pyq-drill",
          type: payload.type || "general",
          click_action: payload.url || "/pyq-drill"
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: "https://vocabclash.in/icon-192.png",
            badge: "https://vocabclash.in/icon-192.png",
            data: {
              url: payload.url || "/pyq-drill",
              type: payload.type || "general"
            }
          },
          fcmOptions: {
            link: payload.url || "/pyq-drill"
          }
        }
      };
      const res = await messaging.sendEachForMulticast(multicastMessage);
      res.responses.forEach((r, idx) => {
        const token = batch[idx];
        if (r.success) {
          successCount++;
          results.push({ token, success: true, messageId: r.messageId });
        } else {
          failureCount++;
          const errCode = r.error?.code || "";
          const errMsg = r.error?.message || "Unknown send error";
          const isUnregistered = errCode.includes("registration-token-not-registered") || errCode.includes("invalid-registration-token") || errMsg.includes("not registered");
          if (isUnregistered) {
            unregisteredTokens.push(token);
          }
          results.push({ token, success: false, error: errMsg, isUnregistered });
        }
      });
    } catch {
      const batchPromises = batch.map((t) => sendPushToToken(t, payload));
      const batchResults = await Promise.all(batchPromises);
      for (const br of batchResults) {
        if (br.success) {
          successCount++;
        } else {
          failureCount++;
          if (br.isUnregistered) {
            unregisteredTokens.push(br.token);
          }
        }
        results.push(br);
      }
    }
  }
  return {
    successCount,
    failureCount,
    unregisteredTokens,
    results
  };
}

// api/_lib/notificationScheduler.ts
var notificationBroadcastBus = new EventEmitter();
notificationBroadcastBus.setMaxListeners(500);
var recentBroadcastEvents = [];
function emitLiveNotification(event) {
  const fullEvent = {
    id: event.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: event.title,
    body: event.body,
    url: event.url || "/pyq-drill",
    type: event.type || "general",
    target: event.target || "all",
    timestamp: event.timestamp || Date.now()
  };
  recentBroadcastEvents.unshift(fullEvent);
  if (recentBroadcastEvents.length > 50) {
    recentBroadcastEvents.pop();
  }
  notificationBroadcastBus.emit("broadcast", fullEvent);
  return fullEvent;
}
function getRecentBroadcastEvents(since) {
  if (!since) return recentBroadcastEvents.slice(0, 15);
  return recentBroadcastEvents.filter((e) => e.timestamp > since);
}
var memoryTokens = /* @__PURE__ */ new Map();
var memoryPreferences = /* @__PURE__ */ new Map();
var memoryLogs = [];
var sentDailySlots = /* @__PURE__ */ new Set();
function getIstDateString(date = /* @__PURE__ */ new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}
function getIstTime(date = /* @__PURE__ */ new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const formatted = formatter.format(date);
  const [h, m] = formatted.split(":").map(Number);
  return { hour: h || 0, minute: m || 0, formatted };
}
async function registerDeviceToken(record) {
  if (!record.token) return;
  const now = Date.now();
  const tokenRecord = {
    token: record.token,
    uid: record.uid || "anonymous",
    platform: record.platform || "web",
    enabled: true,
    timezone: record.timezone || "Asia/Kolkata",
    targetExam: record.targetExam || "ALL",
    userAgent: record.userAgent || "",
    createdAt: memoryTokens.get(record.token)?.createdAt || now,
    updatedAt: now,
    lastSeenAt: now
  };
  memoryTokens.set(record.token, tokenRecord);
  try {
    const db = getAdminFirestore();
    if (record.uid && record.uid !== "anonymous") {
      const tokenDocRef = db.collection("users").doc(record.uid).collection("notificationTokens").doc(encodeURIComponent(record.token.slice(-32)));
      await tokenDocRef.set({
        token: tokenRecord.token,
        uid: tokenRecord.uid,
        platform: tokenRecord.platform,
        enabled: tokenRecord.enabled,
        timezone: tokenRecord.timezone,
        targetExam: tokenRecord.targetExam || "ALL",
        userAgent: tokenRecord.userAgent || "",
        createdAt: tokenRecord.createdAt,
        updatedAt: tokenRecord.updatedAt,
        lastSeenAt: tokenRecord.lastSeenAt
      }, { merge: true });
    }
  } catch (err) {
    if (err?.code !== 7) {
      console.log("[Scheduler] Token registered in server memory registry (Firestore sync deferred).");
    }
  }
}
async function removeDeviceToken(token) {
  const existing = memoryTokens.get(token);
  memoryTokens.delete(token);
  if (existing?.uid && existing.uid !== "anonymous") {
    try {
      const db = getAdminFirestore();
      const tokenDocRef = db.collection("users").doc(existing.uid).collection("notificationTokens").doc(encodeURIComponent(token.slice(-32)));
      await tokenDocRef.delete();
    } catch {
    }
  }
}
async function saveUserPreferences(uid, prefs) {
  const current = memoryPreferences.get(uid) || {
    enabled: true,
    morningReminder: true,
    eveningStreakReminder: true,
    announcements: true,
    updatedAt: Date.now()
  };
  const updated = {
    ...current,
    ...prefs,
    updatedAt: Date.now()
  };
  memoryPreferences.set(uid, updated);
  try {
    const db = getAdminFirestore();
    await db.collection("users").doc(uid).collection("preferences").doc("notifications").set({
      enabled: updated.enabled ?? true,
      morningReminder: updated.morningReminder ?? true,
      eveningStreakReminder: updated.eveningStreakReminder ?? true,
      announcements: updated.announcements ?? true,
      updatedAt: updated.updatedAt || Date.now()
    }, { merge: true });
  } catch (err) {
    if (err?.code !== 7) {
      console.log("[Scheduler] User preferences saved in server memory registry.");
    }
  }
  return updated;
}
async function logNotification(log) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item = { ...log, id };
  memoryLogs.unshift(item);
  if (memoryLogs.length > 200) {
    memoryLogs.pop();
  }
  try {
    const db = getAdminFirestore();
    await db.collection("notification_logs").doc(id).set(item);
  } catch {
  }
  return item;
}
async function getRecentNotificationLogs(limit = 30) {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("notification_logs").orderBy("sentAt", "desc").limit(limit).get();
    if (!snap.empty) {
      return snap.docs.map((d) => d.data());
    }
  } catch (err) {
  }
  return memoryLogs.slice(0, limit);
}
async function getTokensForTarget(target, adminUid) {
  if (memoryTokens.size === 0) {
    try {
      const db = getAdminFirestore();
      const usersSnap = await db.collection("users").limit(100).get();
      for (const userDoc of usersSnap.docs) {
        const tokensSnap = await userDoc.ref.collection("notificationTokens").get();
        for (const tDoc of tokensSnap.docs) {
          const data = tDoc.data();
          if (data.token) {
            memoryTokens.set(data.token, data);
          }
        }
      }
    } catch {
    }
  }
  const allRecords = Array.from(memoryTokens.values()).filter((r) => r.enabled);
  const matchedTokens = [];
  const matchedUids = [];
  for (const record of allRecords) {
    const prefs = memoryPreferences.get(record.uid);
    if (prefs && !prefs.enabled) {
      continue;
    }
    if (target === "me") {
      if (record.uid === adminUid) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else if (target === "all" || target === "all_users") {
      matchedTokens.push(record.token);
      matchedUids.push(record.uid);
    } else if (target === "segment_ssc") {
      if (!record.targetExam || record.targetExam.toUpperCase().includes("SSC")) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else if (target === "segment_banking") {
      if (record.targetExam && record.targetExam.toUpperCase().includes("BANK")) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else if (target === "segment_defence") {
      if (record.targetExam && (record.targetExam.toUpperCase().includes("DEF") || record.targetExam.toUpperCase().includes("CDS") || record.targetExam.toUpperCase().includes("NDA"))) {
        matchedTokens.push(record.token);
        matchedUids.push(record.uid);
      }
    } else {
      matchedTokens.push(record.token);
      matchedUids.push(record.uid);
    }
  }
  return {
    tokens: Array.from(new Set(matchedTokens)),
    uids: Array.from(new Set(matchedUids))
  };
}
async function dispatchMorningReminder(force = false) {
  const dateKey = getIstDateString();
  const slotKey = `global_${dateKey}_morning`;
  if (!force && sentDailySlots.has(slotKey)) {
    console.log(`[Scheduler] Morning reminder already sent for ${dateKey}, skipping.`);
    return { success: true, sentCount: 0, failedCount: 0, skipped: true };
  }
  console.log(`[Scheduler] \u{1F305} Starting 9:00 AM IST Morning Vocab Goal dispatch for ${dateKey}...`);
  const { tokens } = await getTokensForTarget("all");
  if (tokens.length === 0) {
    console.log("[Scheduler] No active push tokens registered for morning reminder.");
    sentDailySlots.add(slotKey);
    return { success: true, sentCount: 0, failedCount: 0, skipped: false };
  }
  const payload = {
    title: "\u{1F3AF} Today's Vocab Goal: 30 Questions",
    body: "One short session. Complete today's daily target to build exam accuracy!",
    url: "/pyq-drill",
    type: "morning",
    tag: `vocabclash_morning_${dateKey}`
  };
  emitLiveNotification({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/pyq-drill",
    type: "morning",
    target: "all_users"
  });
  const result = await sendMulticastPush(tokens, payload);
  for (const deadToken of result.unregisteredTokens) {
    await removeDeviceToken(deadToken);
  }
  sentDailySlots.add(slotKey);
  await logNotification({
    type: "morning",
    dateKey,
    slot: "morning",
    title: payload.title,
    body: payload.body,
    url: payload.url || "/pyq-drill",
    target: "all_users",
    sentCount: result.successCount,
    failedCount: result.failureCount,
    status: result.failureCount === 0 ? "success" : result.successCount > 0 ? "partial" : "failed",
    sentAt: Date.now()
  });
  console.log(`[Scheduler] \u{1F305} Morning reminder dispatched. Success: ${result.successCount}, Failed: ${result.failureCount}`);
  return {
    success: result.successCount > 0 || tokens.length === 0,
    sentCount: result.successCount,
    failedCount: result.failureCount,
    skipped: false
  };
}
async function dispatchEveningReminder(force = false) {
  const dateKey = getIstDateString();
  const slotKey = `global_${dateKey}_evening`;
  if (!force && sentDailySlots.has(slotKey)) {
    console.log(`[Scheduler] Evening reminder already sent for ${dateKey}, skipping.`);
    return { success: true, sentCount: 0, failedCount: 0, skipped: true };
  }
  console.log(`[Scheduler] \u{1F319} Starting 7:00 PM IST Evening Streak / Revision dispatch for ${dateKey}...`);
  const { tokens } = await getTokensForTarget("all");
  if (tokens.length === 0) {
    console.log("[Scheduler] No active push tokens registered for evening reminder.");
    sentDailySlots.add(slotKey);
    return { success: true, sentCount: 0, failedCount: 0, skipped: false };
  }
  const payload = {
    title: "\u{1F525} Don't Lose Today's Streak!",
    body: "You haven't completed today's goal yet. Play a quick 1v1 or finish a few PYQs before midnight.",
    url: "/pyq-drill",
    type: "evening_streak",
    tag: `vocabclash_evening_${dateKey}`
  };
  emitLiveNotification({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/pyq-drill",
    type: "evening_streak",
    target: "all_users"
  });
  const result = await sendMulticastPush(tokens, payload);
  for (const deadToken of result.unregisteredTokens) {
    await removeDeviceToken(deadToken);
  }
  sentDailySlots.add(slotKey);
  await logNotification({
    type: "evening_streak",
    dateKey,
    slot: "evening",
    title: payload.title,
    body: payload.body,
    url: payload.url || "/pyq-drill",
    target: "all_users",
    sentCount: result.successCount,
    failedCount: result.failureCount,
    status: result.failureCount === 0 ? "success" : result.successCount > 0 ? "partial" : "failed",
    sentAt: Date.now()
  });
  console.log(`[Scheduler] \u{1F319} Evening reminder dispatched. Success: ${result.successCount}, Failed: ${result.failureCount}`);
  return {
    success: result.successCount > 0 || tokens.length === 0,
    sentCount: result.successCount,
    failedCount: result.failureCount,
    skipped: false
  };
}
var schedulerTimer = null;
function startBackgroundNotificationScheduler() {
  if (schedulerTimer) {
    return;
  }
  console.log("[Scheduler] Background notification scheduler started. Monitoring IST time for 09:00 and 19:00 slots.");
  const checkSchedule = async () => {
    try {
      const ist = getIstTime();
      if (ist.hour === 9 && ist.minute <= 2) {
        await dispatchMorningReminder(false);
      }
      if (ist.hour === 19 && ist.minute <= 2) {
        await dispatchEveningReminder(false);
      }
    } catch (err) {
      console.error("[Scheduler] Error in schedule check:", err);
    }
  };
  checkSchedule();
  schedulerTimer = setInterval(checkSchedule, 60 * 1e3);
}
function getNotificationSystemStatus() {
  const istTime = getIstTime();
  const istDate = getIstDateString();
  return {
    istTime: istTime.formatted,
    istDate,
    activeTokensCount: memoryTokens.size,
    adminEmail: ADMIN_EMAIL,
    morningSlotSentToday: sentDailySlots.has(`global_${istDate}_morning`),
    eveningSlotSentToday: sentDailySlots.has(`global_${istDate}_evening`),
    nextMorningSlot: `${istDate} 09:00 AM IST`,
    nextEveningSlot: `${istDate} 07:00 PM IST`,
    logsCount: memoryLogs.length
  };
}
export {
  dispatchEveningReminder,
  dispatchMorningReminder,
  emitLiveNotification,
  getIstDateString,
  getIstTime,
  getNotificationSystemStatus,
  getRecentBroadcastEvents,
  getRecentNotificationLogs,
  getTokensForTarget,
  logNotification,
  notificationBroadcastBus,
  registerDeviceToken,
  removeDeviceToken,
  saveUserPreferences,
  startBackgroundNotificationScheduler
};
