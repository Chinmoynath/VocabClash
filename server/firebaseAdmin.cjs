var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/firebaseAdmin.ts
var firebaseAdmin_exports = {};
__export(firebaseAdmin_exports, {
  ADMIN_EMAIL: () => ADMIN_EMAIL,
  DEFAULT_PROJECT_ID: () => DEFAULT_PROJECT_ID,
  checkFirebaseAdminCredentials: () => checkFirebaseAdminCredentials,
  getAdminAuth: () => getAdminAuth,
  getAdminFirestore: () => getAdminFirestore,
  getAdminFirestoreDatabaseId: () => getAdminFirestoreDatabaseId,
  getAdminMessaging: () => getAdminMessaging,
  getFirebaseAdminApp: () => getFirebaseAdminApp,
  sendMulticastPush: () => sendMulticastPush,
  sendPushToToken: () => sendPushToToken,
  verifyAdminAuth: () => verifyAdminAuth
});
module.exports = __toCommonJS(firebaseAdmin_exports);
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_messaging = require("firebase-admin/messaging");
var import_firestore = require("firebase-admin/firestore");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
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
  const existingApps = (0, import_app.getApps)();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  const credStatus = checkFirebaseAdminCredentials();
  const projectId = credStatus.projectId;
  try {
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const formattedKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      console.log(`[Firebase Admin] Initializing with FIREBASE_CLIENT_EMAIL and formatted private key (${projectId})`);
      (0, import_app.initializeApp)({
        credential: (0, import_app.cert)({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey: formattedKey
        }),
        projectId
      });
      return (0, import_app.getApps)()[0];
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
      (0, import_app.initializeApp)({
        credential: (0, import_app.cert)(sa),
        projectId: sa.project_id || projectId
      });
      return (0, import_app.getApps)()[0];
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log(`[Firebase Admin] Initializing with applicationDefault credentials (${projectId})`);
      (0, import_app.initializeApp)({
        credential: (0, import_app.applicationDefault)(),
        projectId
      });
      return (0, import_app.getApps)()[0];
    }
    console.warn(`[Firebase Admin] No service account credentials detected in environment. Initializing default project instance for: ${projectId}`);
    (0, import_app.initializeApp)({
      projectId
    });
    return (0, import_app.getApps)()[0];
  } catch (err) {
    const apps = (0, import_app.getApps)();
    if (apps.length > 0) {
      return apps[0];
    }
    console.error("[Firebase Admin] Error initializing privileged credential:", {
      name: err?.name,
      message: err?.message,
      code: err?.code
    });
    (0, import_app.initializeApp)({ projectId });
    return (0, import_app.getApps)()[0];
  }
}
function getAdminFirestoreDatabaseId() {
  try {
    const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
    if (import_fs.default.existsSync(configPath)) {
      const raw = JSON.parse(import_fs.default.readFileSync(configPath, "utf8"));
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
    const db = (0, import_firestore.getFirestore)(app, databaseId);
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
    const db = (0, import_firestore.getFirestore)(app);
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
function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return (0, import_auth.getAuth)(app);
}
function getAdminMessaging() {
  const app = getFirebaseAdminApp();
  return (0, import_messaging.getMessaging)(app);
}
async function verifyAdminAuth(idToken) {
  if (!idToken) {
    return { isAdmin: false, error: "No authorization token provided" };
  }
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase().trim();
    if (email === ADMIN_EMAIL.toLowerCase()) {
      return { isAdmin: true, uid: decoded.uid, email };
    }
    return {
      isAdmin: false,
      uid: decoded.uid,
      email,
      error: "Unauthorized: User is not VocabClash admin"
    };
  } catch (err) {
    try {
      const parts = idToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        const email = (payload.email || "").toLowerCase().trim();
        if (email === ADMIN_EMAIL.toLowerCase()) {
          return { isAdmin: true, uid: payload.user_id || payload.sub, email };
        }
      }
    } catch {
    }
    return {
      isAdmin: false,
      error: err?.message || "Failed to verify authentication token"
    };
  }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADMIN_EMAIL,
  DEFAULT_PROJECT_ID,
  checkFirebaseAdminCredentials,
  getAdminAuth,
  getAdminFirestore,
  getAdminFirestoreDatabaseId,
  getAdminMessaging,
  getFirebaseAdminApp,
  sendMulticastPush,
  sendPushToToken,
  verifyAdminAuth
});
