import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  FileText, 
  Info, 
  Mail, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  ArrowLeft,
  AlertTriangle,
  Loader2,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { deleteUserAccountAndData } from '../services/firebaseService';
import { soundManager } from '../utils/audio';

interface LegalAccountModalProps {
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onSignOut: () => void;
  onAccountDeleted: () => void;
  initialTab?: 'menu' | 'privacy' | 'terms' | 'about' | 'contact' | 'delete';
}

export const LegalAccountModal: React.FC<LegalAccountModalProps> = ({
  currentUser,
  onClose,
  onSignOut,
  onAccountDeleted,
  initialTab = 'menu'
}) => {
  const [currentView, setCurrentView] = useState<'menu' | 'privacy' | 'terms' | 'about' | 'contact' | 'delete'>(initialTab);
  
  // Delete account state
  const [deleteStep, setDeleteStep] = useState<'warn' | 'confirm' | 'password' | 'deleting' | 'success'>('warn');
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExecuteDelete = async () => {
    if (!currentUser) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteUserAccountAndData(currentUser, password || undefined);
      if (res.success) {
        setDeleteStep('success');
        soundManager.playCorrect();
        setTimeout(() => {
          onAccountDeleted();
        }, 1800);
      } else if (res.requiresReauth) {
        setDeleteStep('password');
        setDeleteError(res.error || 'Recent login required. Enter password to confirm.');
      } else {
        setDeleteError(res.error || 'Failed to delete account. Please try again.');
      }
    } catch (e: any) {
      setDeleteError(e?.message || 'Error occurred while deleting account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            {currentView !== 'menu' && (
              <button
                onClick={() => {
                  soundManager.playTap();
                  setCurrentView('menu');
                  setDeleteStep('warn');
                  setDeleteError(null);
                }}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center mr-1 cursor-pointer"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">
                {currentView === 'menu' && 'Legal & Account'}
                {currentView === 'privacy' && 'Privacy Policy'}
                {currentView === 'terms' && 'Terms of Service'}
                {currentView === 'about' && 'About VocabClash'}
                {currentView === 'contact' && 'Contact & Support'}
                {currentView === 'delete' && 'Delete Account'}
              </h2>
              <p className="text-[11px] text-slate-400">VocabClash • Independent Educational Platform</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          
          {/* MENU VIEW */}
          {currentView === 'menu' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    soundManager.playTap();
                    setCurrentView('privacy');
                  }}
                  className="w-full bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Privacy Policy</div>
                      <div className="text-[11px] text-slate-500">Data usage, analytics & advertising disclosure</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    setCurrentView('terms');
                  }}
                  className="w-full bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Terms of Service</div>
                      <div className="text-[11px] text-slate-500">Fair play rules & educational guidelines</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    setCurrentView('about');
                  }}
                  className="w-full bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">About VocabClash</div>
                      <div className="text-[11px] text-slate-500">Platform mission & exam coverage</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => {
                    soundManager.playTap();
                    setCurrentView('contact');
                  }}
                  className="w-full bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Contact & Support</div>
                      <div className="text-[11px] text-slate-500">support@vocabclash.in</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Account Section for Authenticated Users */}
              {currentUser && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Account Actions ({currentUser.email || 'Logged In'})
                  </div>

                  <button
                    onClick={() => {
                      soundManager.playTap();
                      onSignOut();
                      onClose();
                    }}
                    className="w-full bg-slate-950/40 hover:bg-slate-800 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-left text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut className="w-4 h-4 text-slate-400" />
                      <span>Sign Out</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>

                  <button
                    onClick={() => {
                      soundManager.playTap();
                      setCurrentView('delete');
                      setDeleteStep('warn');
                    }}
                    className="w-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 rounded-2xl p-3 flex items-center justify-between text-left text-xs font-bold text-rose-400 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Delete Account</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-rose-500/50" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PRIVACY POLICY VIEW */}
          {currentView === 'privacy' && (
            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed pr-1">
              <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 shrink-0">
                <span className="text-[11px] text-slate-400">Last updated: August 2026</span>
                <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-sky-400 text-[11px] hover:underline flex items-center gap-1 font-medium">
                  Web Page <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Privacy Overview Banner */}
              <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded-xl text-[11px] text-sky-200 leading-normal">
                <strong className="text-sky-300 block mb-0.5 font-bold">Privacy Commitment</strong>
                VocabClash is committed to transparent data stewardship. We only collect the minimal account and gameplay data necessary to maintain your competitive ranking, study statistics, and cloud synchronization.
              </div>

              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">1. Information We Collect</h4>
                <p className="text-slate-400">
                  When you register or sign in, we process basic profile credentials such as your email address, display name, profile avatar, and chosen target exam category. During gameplay, we store match history, League Points (LP), win streaks, accuracy metrics, and vocabulary items saved to your Mistake Vault.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">2. How We Use Your Data</h4>
                <p className="text-slate-400">
                  Your data is used strictly to power core gameplay: calculating leaderboard rankings, synchronizing progress across devices, matching opponents with similar skill ratings, providing personalized root-word review via AI Tutor, and maintaining account security.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">3. Third-Party Services & Integrations</h4>
                <p className="text-slate-400">
                  We partner with industry-standard cloud providers:
                </p>
                <ul className="text-slate-400 text-[11px] list-disc list-inside space-y-1 mt-1 pl-1">
                  <li><strong>Google Firebase:</strong> Secure authentication and real-time Firestore database storage.</li>
                  <li><strong>Google AdSense & AdMob:</strong> Serving contextual, non-intrusive advertisements to support free access.</li>
                  <li><strong>Google AI / Gemini:</strong> Generating contextual root-word explanations and Hindi mnemonics for study assistance.</li>
                  <li><strong>Razorpay:</strong> Encrypted payment gateway processing for optional VIP upgrades. No payment card details are stored by VocabClash.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">4. Data Retention & Security</h4>
                <p className="text-slate-400">
                  All communications between the app and backend services are encrypted via SSL/TLS. Your data is stored securely in Firebase Cloud Infrastructure and retained only as long as your account remains active.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">5. Account & Data Deletion Rights</h4>
                <p className="text-slate-400">
                  Under Google Play Data Safety guidelines, you have the full right to delete your account and all associated Firestore records. You can initiate this at any time in the app via{' '}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setCurrentView('delete');
                    }}
                    className="text-rose-400 hover:underline font-bold inline-flex items-center cursor-pointer"
                  >
                    Delete Account
                  </button>{' '}
                  or by visiting <a href="/delete-account.html" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">/delete-account</a>.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1 mt-2">
                <h4 className="font-bold text-white text-xs">6. Contact Data Privacy Officer</h4>
                <p className="text-slate-400 text-[11px]">
                  For any questions or requests regarding your personal data, contact us at{' '}
                  <a href="mailto:support@vocabclash.in" className="text-amber-400 hover:underline font-mono font-bold">
                    support@vocabclash.in
                  </a>.
                </p>
              </div>
            </div>
          )}

          {/* TERMS VIEW */}
          {currentView === 'terms' && (
            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed pr-1">
              <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 shrink-0">
                <span className="text-[11px] text-slate-400">Last updated: August 2026</span>
                <a 
                  href="/terms.html" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-sky-400 text-[11px] hover:underline flex items-center gap-1 font-medium"
                >
                  Web Page <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Prominent Educational & Government Affiliation Disclaimer Card */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-[11px] text-amber-200 leading-normal">
                <strong className="text-amber-300 block mb-0.5 font-bold">Official Platform Disclaimer</strong>
                VocabClash is an independent educational platform and is not affiliated with, endorsed by, or connected to SSC, IBPS, Banking boards, Defence recruitment authorities (CDS, AFCAT), Railways, DSSSB, or any government examination authority.
              </div>

              {/* Section 1: Acceptance of Terms */}
              <div className="pt-1">
                <h4 className="font-bold text-white mb-0.5 text-xs">1. Acceptance of Terms</h4>
                <p className="text-slate-400">
                  By accessing, creating an account on, or using VocabClash, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree with any part of these Terms, you should discontinue using the platform.
                </p>
              </div>

              {/* Section 2: Educational Purpose */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">2. Educational Purpose & No Guarantees</h4>
                <p className="text-slate-400">
                  VocabClash is an independent educational and exam-preparation platform providing vocabulary practice, PYQ drills, learning tools, competitive gameplay, revision tools, and AI-assisted features. VocabClash does not guarantee examination success, marks, rank, selection, interview qualification, government employment, or any particular examination outcome. Users should verify official examination information through the relevant official authorities.
                </p>
              </div>

              {/* Section 3: User Accounts */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">3. User Accounts</h4>
                <p className="text-slate-400">
                  Users may use certain functionality in Guest Mode and may create a VocabClash account to access account-based functionality and cloud synchronization. Users are responsible for maintaining access to and security of their account. Users must not impersonate another person, abuse authentication systems, or intentionally provide information for fraudulent purposes.
                </p>
              </div>

              {/* Section 4: 1v1 Arena & Fair Play */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">4. 1v1 Arena & Fair Play</h4>
                <p className="text-slate-400">
                  To maintain fair play, users must not use automated scripts/bots to gain an unfair advantage, exploit bugs, manipulate scores or LP, manipulate matchmaking, intentionally interfere with another user's gameplay, abuse room systems, or deliberately circumvent gameplay restrictions. Existing gameplay penalties, such as LP penalties for quitting active matches (-15 LP), apply according to current game rules. VocabClash may invalidate suspicious results or restrict accounts involved in deliberate manipulation or abuse.
                </p>
              </div>

              {/* Section 5: PYQs & Educational Content */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">5. PYQs & Educational Content</h4>
                <p className="text-slate-400">
                  VocabClash provides educational material and previous-year-question-based practice for exam preparation. Reasonable efforts are made to maintain accuracy, but errors, formatting differences, or outdated information may occasionally occur. Users should rely on official examination notifications, answer keys, syllabi, and authorities when official information is required.
                </p>
              </div>

              {/* Section 6: AI-Powered Features */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">6. AI-Powered Features</h4>
                <p className="text-slate-400">
                  Some VocabClash features use Google AI / Gemini or other AI-assisted functionality. AI-generated explanations, mnemonics, translations, hints, or educational responses may occasionally contain inaccuracies. Users should treat AI output as a learning aid rather than official examination information.
                </p>
              </div>

              {/* Section 7: VocabClash VIP */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">7. VocabClash VIP</h4>
                <p className="text-slate-400">
                  VocabClash offers optional paid VIP features such as an ad-free experience, unlimited AI Tutor root-word analyses, and full arena access. Core gameplay remains accessible for free users. VIP features may evolve as the product develops.
                </p>
              </div>

              {/* Section 8: Payments */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">8. Payments</h4>
                <p className="text-slate-400">
                  Payment processing for VIP passes is handled securely through third-party payment providers such as Razorpay. VocabClash does not store complete card numbers, CVVs, or sensitive banking credentials. Users are subject to the payment provider's applicable terms and policies.
                </p>
              </div>

              {/* Section 9: Cancellations & Refunds */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">9. Cancellations & Refunds</h4>
                <p className="text-slate-400">
                  Purchases, cancellations, and refund eligibility are handled according to applicable purchase terms, payment platform requirements, and applicable law. Where purchases are made through an app store, applicable app-store billing/refund policies may also apply. For billing assistance, users may contact <span className="text-amber-400 font-mono">support@vocabclash.in</span>.
                </p>
              </div>

              {/* Section 10: Advertising */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">10. Advertising</h4>
                <p className="text-slate-400">
                  Free versions and features of VocabClash may display advertising. VocabClash currently uses advertising services including Google AdSense and/or Google AdMob where applicable. Advertising and data practices are further explained in the{' '}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setCurrentView('privacy');
                    }}
                    className="text-sky-400 hover:underline font-bold inline-flex items-center cursor-pointer"
                  >
                    Privacy Policy (/privacy)
                  </button>.
                </p>
              </div>

              {/* Section 11: Acceptable Use */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">11. Acceptable Use</h4>
                <p className="text-slate-400">
                  Users must not use VocabClash to attack or disrupt the service, attempt unauthorized access, scrape the platform using abusive automated methods, distribute malicious software, exploit vulnerabilities, harass other users, manipulate competitive systems, or interfere with normal operation.
                </p>
              </div>

              {/* Section 12: Intellectual Property */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">12. Intellectual Property</h4>
                <p className="text-slate-400">
                  VocabClash's original branding, interface, software, graphics, audio synthesizer, and original platform materials are protected by applicable intellectual-property laws. Past exam public questions are referenced solely for educational mock practice under fair use.
                </p>
              </div>

              {/* Section 13: Third-Party Services */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">13. Third-Party Services</h4>
                <p className="text-slate-400">
                  VocabClash relies on third-party technology and services including Google / Firebase (Auth & Database), Google Analytics, Google AdSense, Google AdMob, Razorpay, and Google AI / Gemini. Third-party services operate under their respective terms and privacy policies.
                </p>
              </div>

              {/* Section 14: Service Availability */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">14. Service Availability</h4>
                <p className="text-slate-400">
                  VocabClash aims to keep the service available but does not guarantee uninterrupted availability. Temporary interruptions may occur because of maintenance, updates, internet/network issues, third-party service outages, or technical problems. Features may also evolve over time.
                </p>
              </div>

              {/* Section 15: Suspension & Termination */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">15. Suspension & Termination</h4>
                <p className="text-slate-400">
                  VocabClash may restrict or suspend access where reasonably necessary for cheating, abuse, fraud, security threats, deliberate exploitation, or serious/repeated violations of these Terms.
                </p>
              </div>

              {/* Section 16: Account & Data Deletion */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">16. Account & Data Deletion</h4>
                <p className="text-slate-400">
                  Registered users may request deletion of their VocabClash account and associated personal data directly within the app via{' '}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setCurrentView('delete');
                    }}
                    className="text-rose-400 hover:underline font-bold inline-flex items-center cursor-pointer"
                  >
                    Delete Account (→ /delete-account)
                  </button>{' '}
                  or by navigating to Aspirant Profile → Legal & Account → Delete Account. For assistance: <span className="text-amber-400 font-mono">support@vocabclash.in</span>.
                </p>
              </div>

              {/* Section 17: Privacy */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">17. Privacy</h4>
                <p className="text-slate-400">
                  Information about how VocabClash collects, uses, and protects information is available in our{' '}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setCurrentView('privacy');
                    }}
                    className="text-sky-400 hover:underline font-bold inline-flex items-center cursor-pointer"
                  >
                    Privacy Policy (→ /privacy)
                  </button>.
                </p>
              </div>

              {/* Section 18: Disclaimer */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">18. Disclaimer</h4>
                <p className="text-slate-400">
                  VocabClash is provided as an educational preparation service. While reasonable efforts are made to provide accurate and useful material, VocabClash cannot guarantee that every question, explanation, AI response, answer, ranking, or piece of educational information will always be error-free. Users should verify important examination information with official sources.
                </p>
              </div>

              {/* Section 19: Limitation of Liability */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">19. Limitation of Liability</h4>
                <p className="text-slate-400">
                  To the extent permitted by applicable law, VocabClash is not responsible for losses arising solely from reliance on educational content, AI-generated content, rankings, temporary service interruptions, or unofficial exam-preparation information.
                </p>
              </div>

              {/* Section 20: Changes to the Service */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">20. Changes to the Service</h4>
                <p className="text-slate-400">
                  VocabClash may add, remove, improve, or modify features as the platform develops. Where appropriate, significant changes affecting users may be communicated through the service.
                </p>
              </div>

              {/* Section 21: Changes to These Terms */}
              <div>
                <h4 className="font-bold text-white mb-0.5 text-xs">21. Changes to These Terms</h4>
                <p className="text-slate-400">
                  These Terms may be updated periodically. Continued use of VocabClash after changes take effect indicates acceptance. Last updated: August 2026.
                </p>
              </div>

              {/* Section 22: Contact & Support */}
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl space-y-1 mt-2">
                <h4 className="font-bold text-white text-xs">22. Contact & Support</h4>
                <p className="text-slate-400 text-[11px]">
                  For questions about these Terms or VocabClash, email{' '}
                  <a href="mailto:support@vocabclash.in" className="text-amber-400 hover:underline font-mono font-bold">
                    support@vocabclash.in
                  </a>{' '}
                  or visit{' '}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playTap();
                      setCurrentView('contact');
                    }}
                    className="text-sky-400 hover:underline font-bold inline-flex items-center cursor-pointer"
                  >
                    Contact & Support (→ /contact)
                  </button>.
                </p>
              </div>
            </div>
          )}

          {/* ABOUT VIEW */}
          {currentView === 'about' && (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p className="text-slate-200">
                "Government exam English doesn't have to feel like memorising an endless word list."
              </p>
              <p className="text-slate-400">
                VocabClash turns vocabulary preparation into interactive 1v1 practice with authentic Previous Years' Questions (PYQs), Mistake Vault revision, LP rankings, and AI-assisted root-word insights for SSC CGL, CHSL, CPO, Banking (IBPS, SBI), CDS, AFCAT, and Defence exams.
              </p>
              <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                VocabClash is an independent educational platform and is not affiliated with or endorsed by SSC, IBPS, Railway Recruitment Boards, Defence boards, or any government examination authority.
              </div>
            </div>
          )}

          {/* CONTACT VIEW */}
          {currentView === 'contact' && (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Support & Inquiries</h4>
                    <p className="text-[11px] text-slate-400">Official assistance channel</p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono text-amber-400 font-bold">support@vocabclash.in</span>
                  <a
                    href="mailto:support@vocabclash.in?subject=VocabClash%20Support%20Request"
                    className="text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg"
                  >
                    Email Us
                  </a>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1">
                  <p>• Account & Login Issues</p>
                  <p>• Question Correction Suggestions</p>
                  <p>• Account Deletion & Privacy Requests</p>
                </div>
              </div>
            </div>
          )}

          {/* DELETE ACCOUNT FLOW */}
          {currentView === 'delete' && (
            <div className="space-y-4">
              {deleteStep === 'warn' && (
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                  </div>

                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-white">Delete your VocabClash account?</h3>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      This action is permanent. Deleting your account will remove your profile, LP rank, win streak, Mistake Vault saved words, and personalized study records.
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
                    <p>• Account email: <strong className="text-slate-200">{currentUser?.email}</strong></p>
                    <p>• Progress & Vault: <strong className="text-rose-400">Permanently Erased</strong></p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setCurrentView('menu')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setDeleteStep('confirm')}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2.5 rounded-xl text-xs shadow-lg shadow-rose-950 cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {deleteStep === 'confirm' && (
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-rose-400">Final Confirmation</h3>
                    <p className="text-slate-400 text-[11px]">
                      Are you sure you want to permanently delete your account? You cannot undo this.
                    </p>
                  </div>

                  {deleteError && (
                    <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-[11px]">
                      {deleteError}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      disabled={isDeleting}
                      onClick={handleExecuteDelete}
                      className="w-full bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950 cursor-pointer disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Deleting Account & Data...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Delete My Account</span>
                        </>
                      )}
                    </button>

                    <button
                      disabled={isDeleting}
                      onClick={() => setCurrentView('menu')}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      Cancel & Keep Account
                    </button>
                  </div>
                </div>
              )}

              {deleteStep === 'password' && (
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="text-center space-y-1">
                    <h3 className="text-sm font-black text-white">Confirm Password</h3>
                    <p className="text-slate-400 text-[11px]">
                      For security, enter your account password to confirm deletion.
                    </p>
                  </div>

                  {deleteError && (
                    <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-[11px]">
                      {deleteError}
                    </div>
                  )}

                  <input
                    type="password"
                    placeholder="Account Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setCurrentView('menu')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!password || isDeleting}
                      onClick={handleExecuteDelete}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2 rounded-xl text-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                    </button>
                  </div>
                </div>
              )}

              {deleteStep === 'success' && (
                <div className="text-center space-y-2 py-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-black text-white">Account Successfully Deleted</h3>
                  <p className="text-[11px] text-slate-400">Returning you to guest mode...</p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
