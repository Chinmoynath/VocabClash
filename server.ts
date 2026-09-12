import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { processPyqEnrichmentBatch } from './server/pyqEnrichmentLogic';

dotenv.config();

const app = express();
const PORT = 3000;

// Lazy initialization for Gemini AI SDK
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

app.use(express.json());

// Create reusable Nodemailer Transporter
let mailTransporter: nodemailer.Transporter | null = null;

async function getMailTransporter(): Promise<nodemailer.Transporter> {
  if (mailTransporter) return mailTransporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (smtpHost && smtpUser && smtpPass) {
    mailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
    console.log(`[EMAIL SERVICE] Initialized SMTP transporter for host: ${smtpHost} as ${smtpUser}`);
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    console.log(`[EMAIL SERVICE] Initialized Gmail transporter for ${process.env.GMAIL_USER}`);
  } else {
    // If no custom SMTP credentials in environment, generate test SMTP account
    try {
      const testAccount = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[EMAIL SERVICE] Created development SMTP transporter (${testAccount.user})`);
    } catch (e) {
      // Fallback direct transporter
      mailTransporter = nodemailer.createTransport({
        host: 'localhost',
        port: 1025,
        ignoreTLS: true,
      });
    }
  }

  return mailTransporter;
}

// In-memory OTP Store for email verification
interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}
const otpStore = new Map<string, OtpEntry>();

// Clean up expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);

// Endpoint: Send OTP for Email Signup
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = otpStore.get(normalizedEmail);
    const now = Date.now();

    // Enforce 30-second rate limit between resends
    if (existing && now - existing.lastSentAt < 30 * 1000) {
      const waitSec = Math.ceil((30 * 1000 - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({ 
        error: `Please wait ${waitSec} seconds before requesting a new OTP.` 
      });
    }

    // Generate secure 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

    otpStore.set(normalizedEmail, {
      otp: otpCode,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
    });

    const senderName = 'VocabClash Arena';
    const senderEmail = process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@vocabclash.app';
    const aspirantName = name?.trim() || 'Aspirant';

    // HTML Email Template
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VocabClash Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d0b18; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #f1f5f9;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 30px auto; background-color: #151224; border-radius: 16px; border: 1px solid #312e81; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <!-- Header -->
        <tr>
          <td style="padding: 28px 24px 20px; background: linear-gradient(135deg, #1e1b4b 0%, #311042 100%); text-align: center; border-bottom: 1px solid #4338ca;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #fbbf24; margin-bottom: 4px;">
              ⚡ VOCABCLASH ARENA
            </div>
            <div style="font-size: 12px; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
              Govt Exams Battleground • SSC • Banking • CDS • UPSC
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 32px 28px;">
            <p style="font-size: 16px; line-height: 1.5; color: #e2e8f0; margin: 0 0 16px 0;">
              Hello <strong style="color: #60a5fa;">${aspirantName}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0;">
              Thank you for registering on VocabClash! Use the official 6-digit verification code below to complete your account setup and secure your battle rank:
            </p>

            <!-- OTP Box -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
              <tr>
                <td style="background-color: #0f0d1b; border: 2px solid #f59e0b; border-radius: 12px; padding: 16px 36px; text-align: center; box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #fbbf24; display: block;">
                    ${otpCode}
                  </span>
                </td>
              </tr>
            </table>

            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0 0 24px 0;">
              ⏱️ This code is valid for <strong>10 minutes</strong>.
            </p>

            <div style="background-color: #1e1b4b; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
              <p style="font-size: 12px; color: #cbd5e1; margin: 0; line-height: 1.5;">
                🔒 <strong>Security Tip:</strong> Never share this OTP with anyone. VocabClash staff will never ask for your verification code.
              </p>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 24px 0 0 0;">
              If you did not request this verification, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 18px 24px; background-color: #0a0814; text-align: center; border-top: 1px solid #1e1b4b;">
            <p style="font-size: 11px; color: #64748b; margin: 0;">
              VocabClash Arena &copy; 2026. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    try {
      const transporter = await getMailTransporter();
      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: normalizedEmail,
        subject: `Your VocabClash Verification Code: ${otpCode}`,
        text: `Hello ${aspirantName},\n\nYour VocabClash verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nNever share this code with anyone.`,
        html: htmlContent,
      });

      console.log(`[EMAIL DISPATCHED] Verification email sent to ${normalizedEmail}. MessageId: ${info.messageId}`);
      if (nodemailer.getTestMessageUrl(info)) {
        console.log(`[ETHEREAL PREVIEW URL] ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (mailErr: any) {
      console.error('[EMAIL DISPATCH ERROR]', mailErr);
      // Even if SMTP server encounters transient network, we still have the OTP registered
    }

    res.json({
      success: true,
      message: `A 6-digit verification code was sent to ${normalizedEmail}. Please check your inbox and spam folder.`,
      expiresInMinutes: 10,
    });
  } catch (error: any) {
    console.error('Error in send-otp:', error);
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
});

// Endpoint: Verify OTP for Email Signup
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = otpStore.get(normalizedEmail);
    const now = Date.now();

    if (!entry) {
      return res.status(400).json({ 
        error: 'No OTP found for this email or it has expired. Please request a new code.' 
      });
    }

    if (entry.expiresAt < now) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ 
        error: 'Verification code has expired. Please request a new one.' 
      });
    }

    if (entry.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({ 
        error: 'Too many incorrect attempts. Please request a new verification code.' 
      });
    }

    const providedOtp = String(otp).trim();
    if (entry.otp !== providedOtp) {
      entry.attempts += 1;
      const remaining = 5 - entry.attempts;
      return res.status(400).json({ 
        error: `Incorrect verification code. ${remaining} attempt(s) remaining.` 
      });
    }

    // OTP is valid! Consume it.
    otpStore.delete(normalizedEmail);

    res.json({
      success: true,
      message: 'Email successfully verified!',
    });
  } catch (error: any) {
    console.error('Error in verify-otp:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// Lazy-init Razorpay client
function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// Config endpoint: return public Key ID and status
app.get('/api/payment/config', (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || null;
  res.json({
    enabled: Boolean(keyId),
    keyId: keyId || null,
    currency: 'INR',
  });
});

// Create Order endpoint
app.post('/api/payment/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const rzp = getRazorpay();
    if (!rzp) {
      // If Razorpay keys aren't configured yet in server environment, provide a mock test order ID for development preview
      const fallbackKeyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder';
      return res.json({
        id: `order_sim_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `rec_${Date.now()}`,
        status: 'created',
        isSimulation: true,
        keyId: fallbackKeyId,
      });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    };

    const order = await rzp.orders.create(options);
    res.json({
      ...order,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      error: error.message || 'Failed to create Razorpay order',
    });
  }
});

// Verify Payment endpoint
app.post('/api/payment/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      // In development simulation mode without keySecret
      return res.json({
        success: true,
        message: 'Payment verified in development simulation mode',
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing verification parameters' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = generatedSignature === razorpay_signature;
    if (isValid) {
      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: error.message || 'Verification failed' });
  }
});

// ==========================================
// Custom 6-Digit Friend Lobby Server Endpoints
// ==========================================
interface ServerFriendLobby {
  code: string;
  roomId: string;
  host: any;
  guest?: any;
  category: string;
  exam: string;
  roundCount: number;
  status: 'waiting' | 'ready' | 'starting' | 'in_progress' | 'cancelled' | 'expired';
  questions?: any[];
  hostReady: boolean;
  guestReady: boolean;
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
}

const serverLobbies = new Map<string, ServerFriendLobby>();
const serverLiveRooms = new Map<string, any>();

// Realtime 1v1 Random Matchmaking In-Memory Queue (Zero Latency Dual-Channel Coordinator)
interface ServerQueueEntry {
  uid: string;
  player: any;
  category: string;
  exam: string;
  roundCount: number;
  questions: any[];
  status: 'waiting' | 'matched' | 'cancelled';
  createdAt: number;
  heartbeatAt: number;
  matchedRoomId?: string;
  matchedOpponent?: any;
  matchedQuestions?: any[];
}

const serverMatchmakingQueue = new Map<string, ServerQueueEntry>();

// Periodic cleanup of stale lobbies & matchmaking queue (> 10s old)
setInterval(() => {
  const now = Date.now();
  for (const [code, lobby] of serverLobbies.entries()) {
    if (lobby.expiresAt < now || lobby.status === 'cancelled') {
      serverLobbies.delete(code);
    }
  }
  for (const [roomId, room] of serverLiveRooms.entries()) {
    if (room.updatedAt && now - room.updatedAt > 3600000) {
      serverLiveRooms.delete(roomId);
    }
  }
  for (const [uid, entry] of serverMatchmakingQueue.entries()) {
    if (entry.status === 'cancelled' || now - entry.heartbeatAt > 12000 || now - entry.createdAt > 20000) {
      serverMatchmakingQueue.delete(uid);
    }
  }
}, 5000);

// Fast 1v1 Matchmaking Join / Match Endpoint
app.post('/api/matchmaking/join', (req, res) => {
  try {
    const { player, category = 'mixed', exam = 'SSC CGL', roundCount = 10, questions = [] } = req.body;
    if (!player || !player.id) {
      return res.status(400).json({ success: false, error: 'Player profile with id is required' });
    }

    const uid = player.id;
    const now = Date.now();

    // Look for another waiting human candidate in queue (excluding current player, active within last 12s, matching category)
    let matchedCandidate: ServerQueueEntry | null = null;
    for (const [cId, candidate] of serverMatchmakingQueue.entries()) {
      if (
        cId !== uid &&
        candidate.status === 'waiting' &&
        now - candidate.heartbeatAt < 12000
      ) {
        const matchesCategory =
          category === 'mixed' ||
          candidate.category === 'mixed' ||
          candidate.category === category;
        if (matchesCategory) {
          matchedCandidate = candidate;
          break;
        }
      }
    }

    if (matchedCandidate) {
      // Instant Match Found!
      const sortedPair = [uid, matchedCandidate.uid].sort();
      const matchId = `duel_1v1_${sortedPair[0].slice(0, 6)}_${sortedPair[1].slice(0, 6)}_${Date.now()}`;
      
      const sharedQuestions = (matchedCandidate.questions && matchedCandidate.questions.length > 0)
        ? matchedCandidate.questions
        : (questions && questions.length > 0 ? questions : []);

      // Update matched candidate in queue
      matchedCandidate.status = 'matched';
      matchedCandidate.matchedRoomId = matchId;
      matchedCandidate.matchedOpponent = player;
      matchedCandidate.matchedQuestions = sharedQuestions;
      serverMatchmakingQueue.set(matchedCandidate.uid, matchedCandidate);

      // Register the live room on the server
      const liveRoomData = {
        id: matchId,
        roomId: matchId,
        mode: roundCount === 10 ? 'quick_duel' : '1v1_ranked',
        category,
        exam,
        roundCount,
        player1: player,
        player2: matchedCandidate.player,
        questions: sharedQuestions,
        status: 'in_progress',
        scores: {
          [player.id]: 0,
          [matchedCandidate.player.id]: 0,
        },
        combos: {
          [player.id]: 0,
          [matchedCandidate.player.id]: 0,
        },
        answers: {
          [player.id]: [],
          [matchedCandidate.player.id]: [],
        },
        completedPlayers: [],
        activeEmotes: [],
        createdAt: now,
        updatedAt: now,
      };
      serverLiveRooms.set(matchId, liveRoomData);

      console.log(`[MATCHMAKING-SERVER] Instant match created: ${player.name} (${uid}) vs ${matchedCandidate.player.name} (${matchedCandidate.uid}) in room ${matchId}`);

      return res.json({
        success: true,
        matched: true,
        roomId: matchId,
        opponent: matchedCandidate.player,
        questions: sharedQuestions,
        isRealPlayer: true,
      });
    }

    // No immediate match: register in waiting queue
    const myEntry: ServerQueueEntry = {
      uid,
      player,
      category,
      exam,
      roundCount,
      questions,
      status: 'waiting',
      createdAt: now,
      heartbeatAt: now,
    };
    serverMatchmakingQueue.set(uid, myEntry);

    console.log(`[MATCHMAKING-SERVER] Player entered queue: ${player.name} (${uid}). Waiting pool size: ${serverMatchmakingQueue.size}`);

    return res.json({
      success: true,
      matched: false,
      waiting: true,
    });
  } catch (error: any) {
    console.error('Error in matchmaking join:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fast Matchmaking Poll Endpoint (checks every 300-400ms)
app.post('/api/matchmaking/poll', (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'uid is required' });
    }

    const entry = serverMatchmakingQueue.get(uid);
    if (!entry) {
      return res.json({ success: true, matched: false, queueExpired: true });
    }

    // Refresh heartbeat
    entry.heartbeatAt = Date.now();
    serverMatchmakingQueue.set(uid, entry);

    if (entry.status === 'matched' && entry.matchedRoomId && entry.matchedOpponent) {
      console.log(`[MATCHMAKING-SERVER] Poll returned match for ${uid} -> room ${entry.matchedRoomId}`);
      return res.json({
        success: true,
        matched: true,
        roomId: entry.matchedRoomId,
        opponent: entry.matchedOpponent,
        questions: entry.matchedQuestions || [],
        isRealPlayer: true,
      });
    }

    return res.json({
      success: true,
      matched: false,
      status: entry.status,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Matchmaking Cancel / Leave Endpoint
app.post('/api/matchmaking/leave', (req, res) => {
  try {
    const { uid } = req.body;
    if (uid) {
      serverMatchmakingQueue.delete(uid);
      console.log(`[MATCHMAKING-SERVER] Player ${uid} left matchmaking queue`);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or Register Lobby Endpoint
app.post('/api/lobby/create', (req, res) => {
  try {
    const { 
      code: customCode, 
      roomId: customRoomId, 
      host, 
      category = 'mixed', 
      exam = 'SSC_CGL', 
      roundCount = 20, 
      questions = [] 
    } = req.body;

    if (!host || !host.id) {
      return res.status(400).json({ success: false, error: 'Host player profile is required' });
    }

    // Use requested code if provided and valid, otherwise generate unique 6-digit code
    let code = (customCode && typeof customCode === 'string') 
      ? customCode.trim().replace(/\D/g, '') 
      : '';
    
    if (code.length !== 6) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      while (serverLobbies.has(code)) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
      }
    }

    const roomId = customRoomId || `duel_friend_${code}_${Date.now()}`;
    const now = Date.now();
    const lobby: ServerFriendLobby = {
      code,
      roomId,
      host,
      category,
      exam,
      roundCount,
      status: 'waiting',
      questions,
      hostReady: true,
      guestReady: false,
      createdAt: now,
      expiresAt: now + 3600000, // 1 hour TTL
      updatedAt: now,
    };

    serverLobbies.set(code, lobby);
    console.log(`[LOBBY] Created/Registered 6-digit lobby ${code} by ${host.name} (${host.id})`);
    res.json({ success: true, code, roomId, lobby });
  } catch (error: any) {
    console.error('Error creating lobby:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create lobby' });
  }
});

// Join Lobby Endpoint
app.post('/api/lobby/join', (req, res) => {
  try {
    const { code, guest } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: '6-digit room code is required' });
    }
    if (!guest || !guest.id) {
      return res.status(400).json({ success: false, error: 'Guest player profile is required' });
    }

    const cleanCode = code.trim().replace(/\D/g, '');
    const lobby = serverLobbies.get(cleanCode);

    if (!lobby) {
      return res.status(404).json({ success: false, error: `Room #${cleanCode} not found on server. Please check the code with your friend.` });
    }

    if (lobby.status !== 'waiting' && lobby.guest?.id !== guest.id) {
      return res.status(400).json({ success: false, error: 'Lobby is already full or battle is already in progress.' });
    }

    if (lobby.expiresAt < Date.now()) {
      serverLobbies.delete(cleanCode);
      return res.status(410).json({ success: false, error: 'This lobby has expired. Ask your friend to create a new one.' });
    }

    // Join player as guest
    lobby.guest = guest;
    lobby.guestReady = true;
    lobby.status = 'ready';
    lobby.updatedAt = Date.now();
    serverLobbies.set(cleanCode, lobby);

    console.log(`[LOBBY] Player ${guest.name} (${guest.id}) joined lobby ${cleanCode}`);
    res.json({ success: true, lobby });
  } catch (error: any) {
    console.error('Error joining lobby:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to join lobby' });
  }
});

// Get Lobby Status Endpoint
app.get('/api/lobby/:code', (req, res) => {
  const code = (req.params.code || '').trim().replace(/\D/g, '');
  const lobby = serverLobbies.get(code);
  if (!lobby) {
    return res.status(404).json({ success: false, error: 'Lobby not found' });
  }
  res.json({ success: true, lobby });
});

// Start Match in Lobby Endpoint
app.post('/api/lobby/start', (req, res) => {
  try {
    const { code, hostId, questions } = req.body;
    const cleanCode = (code || '').trim().replace(/\D/g, '');
    const lobby = serverLobbies.get(cleanCode);

    if (!lobby) {
      return res.status(404).json({ success: false, error: 'Lobby not found' });
    }

    if (lobby.host.id !== hostId) {
      return res.status(403).json({ success: false, error: 'Only the host can start the duel' });
    }

    if (!lobby.guest) {
      return res.status(400).json({ success: false, error: 'Waiting for friend to join before starting' });
    }

    lobby.status = 'in_progress';
    if (questions && Array.isArray(questions) && questions.length > 0) {
      lobby.questions = questions;
    }
    lobby.updatedAt = Date.now();
    serverLobbies.set(cleanCode, lobby);

    // Also initialize serverLiveRoom
    const liveRoomData = {
      id: lobby.roomId,
      roomId: lobby.roomId,
      mode: 'friend_lobby',
      category: lobby.category,
      exam: lobby.exam,
      roundCount: lobby.roundCount,
      player1: lobby.host,
      player2: lobby.guest,
      questions: lobby.questions || questions || [],
      status: 'in_progress',
      scores: {
        [lobby.host.id]: 0,
        [lobby.guest.id]: 0,
      },
      combos: {
        [lobby.host.id]: 0,
        [lobby.guest.id]: 0,
      },
      answers: {
        [lobby.host.id]: [],
        [lobby.guest.id]: [],
      },
      completedPlayers: [],
      activeEmotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    serverLiveRooms.set(lobby.roomId, liveRoomData);

    console.log(`[LOBBY] Match started for room ${cleanCode} (RoomId: ${lobby.roomId})`);
    res.json({ success: true, lobby, liveRoom: liveRoomData });
  } catch (error: any) {
    console.error('Error starting lobby:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to start match' });
  }
});

// Live Room Sync Endpoint (Score, Answers, Emotes fallback)
app.post('/api/match/room/sync', (req, res) => {
  try {
    const { roomId, playerId, score, combo, answerRecord, emote, isLastQuestion } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'roomId is required' });
    }

    let room = serverLiveRooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        roomId,
        scores: {},
        combos: {},
        answers: {},
        completedPlayers: [],
        activeEmotes: [],
        updatedAt: Date.now(),
      };
      serverLiveRooms.set(roomId, room);
    }

    if (playerId) {
      if (typeof score === 'number') {
        room.scores = room.scores || {};
        room.scores[playerId] = score;
      }
      if (typeof combo === 'number') {
        room.combos = room.combos || {};
        room.combos[playerId] = combo;
      }
      if (answerRecord) {
        room.answers = room.answers || {};
        room.answers[playerId] = room.answers[playerId] || [];
        // Avoid duplicate answers
        const exists = room.answers[playerId].some((a: any) => a.questionId === answerRecord.questionId);
        if (!exists) {
          room.answers[playerId].push(answerRecord);
        }
      }
      if (isLastQuestion) {
        room.completedPlayers = room.completedPlayers || [];
        if (!room.completedPlayers.includes(playerId)) {
          room.completedPlayers.push(playerId);
        }
      }
    }

    if (emote) {
      room.activeEmotes = room.activeEmotes || [];
      room.activeEmotes.push({
        ...emote,
        timestamp: Date.now(),
      });
      // Keep only last 10 seconds of emotes
      room.activeEmotes = room.activeEmotes.filter((e: any) => Date.now() - e.timestamp < 10000);
    }

    room.updatedAt = Date.now();
    serverLiveRooms.set(roomId, room);
    res.json({ success: true, room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Live Room Forfeit Endpoint (Player leaves, match continues for opponent)
app.post('/api/match/room/forfeit', (req, res) => {
  try {
    const { roomId, forfeitingPlayerId } = req.body;
    if (!roomId) {
      return res.status(400).json({ success: false, error: 'roomId is required' });
    }
    const room = serverLiveRooms.get(roomId);
    if (room) {
      room.forfeitedBy = forfeitingPlayerId;
      room.updatedAt = Date.now();
      serverLiveRooms.set(roomId, room);
    }
    res.json({ success: true, room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Live Room Get Endpoint
app.get('/api/match/room/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const room = serverLiveRooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  res.json({ success: true, room });
});

// Cancel / Leave Lobby Endpoint
app.post('/api/lobby/leave', (req, res) => {
  try {
    const { code, playerId } = req.body;
    const cleanCode = (code || '').trim();
    const lobby = serverLobbies.get(cleanCode);

    if (lobby) {
      if (lobby.host.id === playerId) {
        lobby.status = 'cancelled';
        serverLobbies.delete(cleanCode);
      } else if (lobby.guest?.id === playerId) {
        lobby.guest = undefined;
        lobby.guestReady = false;
        lobby.status = 'waiting';
        lobby.updatedAt = Date.now();
        serverLobbies.set(cleanCode, lobby);
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gemini AI Batch Educational Enrichment Endpoint for PYQs (supports /enrich-pyq and /enrich-pyq-batch)
const handleEnrichmentRequest = async (req: express.Request, res: express.Response) => {
  try {
    let questionsList: any[] = [];
    if (Array.isArray(req.body.questions)) {
      questionsList = req.body.questions;
    } else if (req.body.question && typeof req.body.question === 'object') {
      questionsList = [req.body.question];
    } else if (req.body.wordOrPhrase) {
      questionsList = [req.body];
    }

    if (questionsList.length === 0) {
      return res.status(400).json({ error: 'Array of questions or question object is required' });
    }

    const ai = getGenAI();
    const enrichedList = await processPyqEnrichmentBatch(questionsList, ai);

    return res.json({
      success: true,
      enrichedQuestions: enrichedList,
      // For single question requests:
      enrichedQuestion: enrichedList[0] || null,
    });
  } catch (error: any) {
    console.error('Error in PYQ enrichment handler:', error);
    res.status(500).json({ success: false, error: error.message || 'Enrichment failed' });
  }
};

app.post('/api/gemini/enrich-pyq', handleEnrichmentRequest);
app.post('/api/gemini/enrich-pyq-batch', handleEnrichmentRequest);

// Gemini AI Tutor Vocabulary Explanation Endpoint
const handleExplainRequest = async (req: express.Request, res: express.Response) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const wordOrPhrase = req.method === 'POST' ? req.body?.wordOrPhrase : (req.query?.wordOrPhrase || req.query?.word);
  const category = req.method === 'POST' ? req.body?.category : req.query?.category;
  const meaning = req.method === 'POST' ? req.body?.meaning : req.query?.meaning;
  const examHistory = req.method === 'POST' ? req.body?.examHistory : req.query?.examHistory;

  if (!wordOrPhrase || typeof wordOrPhrase !== 'string') {
    return res.status(400).json({ error: 'Word or phrase is required' });
  }

  const prompt = `You are an expert English Faculty for SSC CGL, CHSL, CPO, CDS & Banking Govt examinations in India.
Analyze the following English vocabulary term for an aspirant preparing for SSC/Govt exams:
Word/Phrase: "${wordOrPhrase}"
Category: "${category || 'General Vocabulary'}"
Context Meaning: "${meaning || ''}"
Past Exam Appearances: "${Array.isArray(examHistory) ? examHistory.join(', ') : (examHistory || 'SSC CGL')}"

Respond strictly with a JSON object in this exact schema without markdown formatting or code fences:
{
  "meaning": "clear, precise, and complete English dictionary and exam definition of the word/phrase",
  "hindiMeaning": "accurate Hindi meaning with Devanagari script and clear explanation (e.g. अल्पभाषी / कम बोलने वाला)",
  "partOfSpeech": "part of speech (e.g. Adjective, Noun, Verb, Adverb, Idiom/Phrase)",
  "rootEtymology": "concise root word origin, Latin/Greek components and meanings in 1-2 lines",
  "mnemonicHook": "a clever, humorous, or highly effective memory trick / Hinglish trick (like how KD Campus / Neetu Singh / Jaideep Sir teach) to never forget this word",
  "examTrapTip": "common traps set by exam paper setters (e.g. confuse with similar sounding words, synonym vs antonym trap, trap risk)",
  "sampleUsage": "a crisp sentence demonstrating authentic usage in an administrative / exam context",
  "relatedWords": ["word1", "word2", "word3", "word4"]
}`;

  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({
      success: false,
      error: 'Gemini AI API key not configured',
      aiEnrichmentAvailable: false,
    });
  }

  // Model candidates with fallback if a model experiences high traffic (503)
  const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastErrorStatus = 500;
  let lastErrorMessage = 'Gemini AI unavailable';

  for (const modelName of modelCandidates) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.text || '';
        if (responseText) {
          let parsedData: any = null;
          try {
            parsedData = JSON.parse(responseText.trim());
          } catch {
            const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            try {
              parsedData = JSON.parse(cleaned);
            } catch {
              const firstBrace = cleaned.indexOf('{');
              const lastBrace = cleaned.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                  parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
                } catch {}
              }
            }
          }
          if (parsedData && (parsedData.mnemonicHook || parsedData.rootEtymology || parsedData.meaning)) {
            return res.json({ success: true, analysis: parsedData, source: 'gemini' });
          }
        }
      } catch (err: any) {
        const isQuota = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuota) {
          console.warn(`[GEMINI EXPLAIN] Model ${modelName} hit quota limit (429).`);
          return res.status(429).json({
            success: false,
            status: 429,
            error: 'Gemini rate limit exceeded',
            aiEnrichmentAvailable: false,
          });
        }

        const isTransient = err?.status === 503 || err?.message?.includes('503');
        if (attempt === 1 && isTransient) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        lastErrorStatus = err?.status || 500;
        lastErrorMessage = err?.message || 'Gemini error';
        console.warn(`[GEMINI EXPLAIN] Model ${modelName} unavailable (${err?.status || err?.message}), trying next candidate...`);
        break;
      }
    }
  }

  // Do NOT return fake placeholder content. Return truthful status so client uses dictionary fallback.
  return res.status(lastErrorStatus).json({
    success: false,
    status: lastErrorStatus,
    error: lastErrorMessage,
    aiEnrichmentAvailable: false,
  });
};

app.post('/api/gemini/explain', handleExplainRequest);
app.get('/api/gemini/explain', handleExplainRequest);
app.options('/api/gemini/explain', (_req, res) => {
  res.setHeader('Allow', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

// Gemini AI Vocab Mentor Personalized Coaching Insight Endpoint
app.post('/api/gemini/mentor-insight', async (req, res) => {
  const {
    analytics,
    targetExam,
    overallAccuracy,
    weakestCategory,
    weakestCategoryAccuracy,
    strongestCategory,
    strongestCategoryAccuracy,
    mistakesCount,
    totalSolved,
  } = req.body;

  // Extract from unified analytics object if provided
  const target = (analytics?.targetExam || targetExam || 'SSC CGL').trim();
  const periodLabel = analytics?.periodLabel || 'This Week';
  const solved = typeof analytics?.totalAttempted === 'number' ? analytics.totalAttempted : (totalSolved || 0);
  const correct = typeof analytics?.totalCorrect === 'number' ? analytics.totalCorrect : 0;
  const overallAcc = typeof analytics?.overallAccuracy === 'number' 
    ? `${analytics.overallAccuracy}%` 
    : (overallAccuracy ? `${overallAccuracy}%` : (solved > 0 ? `${Math.round((correct / solved) * 100)}%` : 'Not enough data'));
  
  const weakCat = analytics?.weakestCategory || (weakestCategory ? String(weakestCategory).toLowerCase() : null);
  const strongCat = analytics?.strongestCategory || (strongestCategory ? String(strongestCategory).toLowerCase() : null);

  const weakStat = weakCat && analytics?.categoryStats?.[weakCat];
  const weakAccStr = weakStat && typeof weakStat.accuracy === 'number' 
    ? `${weakStat.accuracy}% (${weakStat.correct}/${weakStat.attempted})` 
    : (typeof weakestCategoryAccuracy === 'number' ? `${weakestCategoryAccuracy}%` : 'Not enough data');

  const strongStat = strongCat && analytics?.categoryStats?.[strongCat];
  const strongAccStr = strongStat && typeof strongStat.accuracy === 'number'
    ? `${strongStat.accuracy}% (${strongStat.correct}/${strongStat.attempted})`
    : (typeof strongestCategoryAccuracy === 'number' ? `${strongestCategoryAccuracy}%` : 'Not enough data');

  const mistakes = typeof analytics?.unresolvedMistakesCount === 'number' 
    ? analytics.unresolvedMistakesCount 
    : (mistakesCount || 0);
  const dueReviews = typeof analytics?.dueReviews === 'number' ? analytics.dueReviews : 0;
  const repeatedWords = Array.isArray(analytics?.repeatedMistakes)
    ? analytics.repeatedMistakes.slice(0, 5).map((m: any) => `${m.wordOrPhrase} (missed ${m.wrongCount}x)`).join(', ')
    : '';

  const deltaStr = typeof analytics?.accuracyDeltaPp === 'number'
    ? `${analytics.accuracyDeltaPp >= 0 ? '+' : ''}${analytics.accuracyDeltaPp} percentage points vs previous period`
    : 'No previous period comparison available';

  // Category summary string
  let categorySummary = '';
  if (analytics?.categoryStats) {
    categorySummary = Object.entries(analytics.categoryStats).map(([cat, stat]: [string, any]) => {
      const acc = typeof stat.accuracy === 'number' ? `${stat.accuracy}%` : 'Not attempted';
      return `${cat.toUpperCase()}: ${acc} (${stat.correct || 0}/${stat.attempted || 0} correct)`;
    }).join('; ');
  }

  const prompt = `You are an elite, objective Senior English Vocabulary Mentor for Indian Competitive Exams (${target}).
Here is the student's real, deterministic performance analytics on VocabClash:
- Target Exam: ${target}
- Period: ${periodLabel}
- Questions Attempted: ${solved} (Correct: ${correct})
- Overall Accuracy: ${overallAcc}
- Accuracy Trend: ${deltaStr}
- Category Breakdown: ${categorySummary || 'N/A'}
- Weakest Category: ${weakCat ? `${weakCat.toUpperCase()} at ${weakAccStr}` : 'Not enough category data yet (<5 questions)'}
- Strongest Category: ${strongCat ? `${strongCat.toUpperCase()} at ${strongAccStr}` : 'Not enough category data yet (<5 questions)'}
- Repeatedly Missed Words: ${repeatedWords || 'None recorded'}
- Concepts Due for Spaced Repetition Review: ${dueReviews}
- Active Mistakes in Vault: ${mistakes}

STRICT GROUNDING RULES:
1. You may ONLY make claims strictly supported by the supplied analytics.
2. NEVER invent accuracy percentages, question counts, marks, exam patterns, user behavior or question statistics.
3. NEVER make unsupported claims like "examiners frequently put synonyms in Option A" or promises like "This will increase your score by 4-6 marks".
4. If a metric is "Not enough data" or "Not attempted", state that clearly rather than assuming 0% or fabricating a reason.
5. Provide a crisp, professional coaching report strictly in JSON format without markdown code blocks:
{
  "diagnosis": "2 sharp, objective sentences diagnosing their current vocabulary performance and accuracy based strictly on the provided numbers.",
  "whatImproved": "1-2 sentences highlighting positive trends or areas with solid accuracy, referencing actual figures if applicable.",
  "mainWeakness": "1-2 sentences describing their lowest-accuracy category or repeated mistakes without making ungrounded claims.",
  "whatToDoNext": ["Actionable step 1 based on weakest category or due reviews", "Actionable step 2", "Actionable step 3"],
  "encouragement": "1 crisp, uplifting competitive exam mantra (10-15 words)."
}`;

  const ai = getGenAI();
  if (ai) {
    const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    for (const modelName of modelCandidates) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const responseText = response.text || '';
          if (responseText) {
            let parsedData: any = null;
            try {
              parsedData = JSON.parse(responseText.trim());
            } catch {
              const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
              try {
                parsedData = JSON.parse(cleaned);
              } catch {
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  try {
                    parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
                  } catch {}
                }
              }
            }
            if (parsedData && parsedData.diagnosis) {
              const report = {
                diagnosis: parsedData.diagnosis,
                whatImproved: parsedData.whatImproved || 'Keep practicing daily to build steady vocabulary recall.',
                mainWeakness: parsedData.mainWeakness || (weakCat ? `${weakCat.toUpperCase()} is currently your lowest-scoring area.` : 'Continue practicing all categories to identify specific patterns.'),
                whatToDoNext: Array.isArray(parsedData.whatToDoNext) ? parsedData.whatToDoNext : ['Practice questions in your weakest category', 'Clear due spaced repetition reviews', 'Review repeatedly missed words'],
                encouragement: parsedData.encouragement || parsedData.motivationalQuote || 'Consistent daily vocabulary practice builds long-term exam mastery.',
                // Legacy compatibility fields
                recommendedFocus: Array.isArray(parsedData.whatToDoNext) ? parsedData.whatToDoNext : ['Root words and prefixes', 'High-frequency exam words', 'Daily mistake vault review'],
                tacticalTip: parsedData.mainWeakness || 'Analyze question context and eliminate wrong options systematically.',
                motivationalQuote: parsedData.encouragement || 'Consistent daily revision separates the aspirants from the selected officers.',
              };
              return res.json({ insight: report, report });
            }
          }
        } catch (err: any) {
          const isTransient = err?.status === 503 || err?.status === 429 || err?.message?.includes('503') || err?.message?.includes('429');
          if (attempt === 1 && isTransient) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          console.warn(`[GEMINI MENTOR INSIGHT] Model ${modelName} unavailable, trying next candidate...`);
          break;
        }
      }
    }
  }

  // Strictly grounded deterministic fallback if Gemini is offline or unavailable
  const fallbackDiagnosis = weakCat && weakStat && typeof weakStat.accuracy === 'number'
    ? `Your ${weakCat.toUpperCase()} accuracy is currently ${weakStat.accuracy}% across ${weakStat.attempted} questions, while overall accuracy is ${overallAcc}.`
    : solved > 0 
    ? `You have completed ${solved} vocabulary questions with an overall accuracy of ${overallAcc}.`
    : `Complete at least 20 vocabulary questions across categories to establish detailed diagnostics.`;

  const fallbackImproved = typeof analytics?.accuracyDeltaPp === 'number' && analytics.accuracyDeltaPp > 0
    ? `Your accuracy improved by ${analytics.accuracyDeltaPp} percentage points compared to the previous period.`
    : strongCat && strongStat && typeof strongStat.accuracy === 'number'
    ? `${strongCat.toUpperCase()} is your strongest category at ${strongStat.accuracy}% accuracy (${strongStat.correct}/${strongStat.attempted} correct).`
    : `Daily consistent practice creates durable memory traces.`;

  const fallbackWeakness = weakCat && weakStat && typeof weakStat.accuracy === 'number'
    ? `${weakCat.toUpperCase()} requires targeted focus (${weakStat.wrong} incorrect answers recorded).`
    : repeatedWords
    ? `Repeatedly missed words like ${repeatedWords} need focused revision.`
    : `More category attempts are needed to isolate specific weaknesses.`;

  const fallbackReport = {
    diagnosis: fallbackDiagnosis,
    whatImproved: fallbackImproved,
    mainWeakness: fallbackWeakness,
    whatToDoNext: [
      weakCat ? `Complete a 10-question Weak Areas Drill in ${weakCat.toUpperCase()}` : 'Complete questions across all 4 categories',
      dueReviews > 0 ? `Review your ${dueReviews} due spaced repetition concepts` : 'Check your Mistake Vault for unresolved words',
      'Maintain your daily practice streak to consolidate long-term retention',
    ],
    encouragement: 'Consistent daily vocabulary practice builds steady long-term exam mastery.',
    // Legacy fields
    recommendedFocus: [
      'Negative prefixes: IN-, IM-, DIS-, UN-',
      'Root morphology: LOQ-, BENE-, MAL-, CHRON-',
      'Frequently repeated exam concepts'
    ],
    tacticalTip: 'Verify word polarity and context before confirming your choice.',
    motivationalQuote: 'Consistency in revision converts weak areas into strengths.',
  };

  res.json({ insight: fallbackReport, report: fallbackReport });
});

// Monetag Service Worker Verification & Ad Delivery Endpoint
app.get(['/sw.js', '/service-worker.js'], (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`self.options = {\n    "domain": "5gvci.com",\n    "zoneId": 11591217\n};\nself.lary = "";\nimportScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');\n`);
});

// Google AdSense ads.txt explicit endpoint
app.get('/ads.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send('google.com, pub-6402582146558440, DIRECT, f08c47fec0942fa0\n');
});

// XML Sitemap Endpoint for Google Search Console
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>https://vocabclash.in/</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-vocabulary</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-cgl-vocabulary</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-chsl-vocabulary</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/synonyms</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/antonyms</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/one-word-substitution</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/idioms-and-phrases</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/ssc-english-pyq</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/articles</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/articles/top-50-ssc-cgl-repeated-synonyms</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/articles/how-to-score-50-in-ssc-english-vocabulary</loc>
    <lastmod>2026-09-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/privacy.html</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://vocabclash.in/terms.html</loc>
    <lastmod>2026-09-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>`;
  res.send(sitemapXml);
});

// robots.txt Endpoint
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/\nDisallow: /api/\nDisallow: /.well-known/\n\nSitemap: https://vocabclash.in/sitemap.xml\n');
});

// Service Worker Endpoints (sw.js and service-worker.js) with proper PWA & TWA headers
const serveServiceWorker = (req: express.Request, res: express.Response) => {
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(swPath);
};

app.get('/sw.js', serveServiceWorker);
app.get('/service-worker.js', serveServiceWorker);

// Digital Asset Links Endpoint for Android TWA APK (Removes Chrome URL bar)
app.get('/.well-known/assetlinks.json', (req, res) => {
  const assetLinksPath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(assetLinksPath);
});

// Web App Manifest Endpoint
app.get('/manifest.json', (req, res) => {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(manifestPath);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
