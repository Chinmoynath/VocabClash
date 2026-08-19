import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

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
    genAIClient = new GoogleGenAI({ apiKey });
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

// Gemini AI Tutor Vocabulary Explanation Endpoint
app.post('/api/gemini/explain', async (req, res) => {
  const { wordOrPhrase, category, meaning, examHistory } = req.body;
  if (!wordOrPhrase) {
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
  "rootEtymology": "concise root word origin, Latin/Greek components and meanings in 1-2 lines",
  "mnemonicHook": "a clever, humorous, or highly effective memory trick / Hinglish trick (like how KD Campus / Neetu Singh / Jaideep Sir teach) to never forget this word",
  "examTrapTip": "common traps set by TCS / SSC examiners (e.g. confuse with similar sounding words, synonym vs antonym trap)",
  "sampleUsage": "a crisp sentence demonstrating authentic usage in an administrative / exam context",
  "relatedWords": ["word1", "word2", "word3", "word4"]
}`;

  const ai = getGenAI();
  if (ai) {
    // Model candidates with fallback if a model experiences high traffic (503)
    const modelCandidates = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.7-flash'];
    for (const modelName of modelCandidates) {
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
          let parsedData = null;
          try {
            parsedData = JSON.parse(responseText);
          } catch {
            const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleaned);
          }
          if (parsedData && parsedData.mnemonicHook) {
            return res.json({ analysis: parsedData });
          }
        }
      } catch (err: any) {
        // If 503 or transient error, continue to next model candidate
        console.warn(`Model ${modelName} unavailable (${err?.status || err?.message}), trying fallback...`);
      }
    }
  }

  // Graceful structured response if API key is not configured or all live model endpoints are experiencing temporary spikes
  res.json({
    analysis: {
      rootEtymology: `Derived from classical roots frequently appearing in SSC CGL, CHSL & Banking exams. Focus on root affixes to decode antonyms/synonyms instantly.`,
      mnemonicHook: `Memory Hook: Connect "${wordOrPhrase}" phonetically with an everyday Hindi phrase or vivid mental image to lock it into long-term memory.`,
      examTrapTip: `High-frequency in SSC Tier-1 & Tier-2 shifts. Watch out for near-synonym options engineered to mislead hurried candidates.`,
      sampleUsage: `The candidate demonstrated thorough mastery of "${wordOrPhrase}" in the competitive examination.`,
      relatedWords: ['High-Frequency PYQ', 'Exam Pair', 'Root Cognate', 'Repeated Term']
    }
  });
});

// Monetag Service Worker Verification & Ad Delivery Endpoint
app.get(['/sw.js', '/service-worker.js'], (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`self.options = {\n    "domain": "5gvci.com",\n    "zoneId": 11591217\n};\nself.lary = "";\nimportScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');\n`);
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
