import React, { useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  MessageCircle, 
  Send, 
  ExternalLink,
  Sparkles,
  Trophy,
  Swords,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { 
  BattleShareData, 
  generateBattleShareCardBlob, 
  downloadBattleShareCard, 
  shareBattleResultNative,
  getBattleShareCta
} from '../utils/shareCardGenerator';
import { soundManager } from '../utils/audio';

interface ShareBattleResultModalProps {
  data: BattleShareData;
  onClose: () => void;
}

export const ShareBattleResultModal: React.FC<ShareBattleResultModalProps> = ({
  data,
  onClose,
}) => {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isSharingNative, setIsSharingNative] = useState<boolean>(false);

  const { isWinner, isDraw, playerScore, opponentScore, playerLpChange, playerName } = data;
  const { mainCta, subCta, shareText } = getBattleShareCta(data);

  // Generate the Canvas image on mount
  useEffect(() => {
    let isMounted = true;
    async function renderCard() {
      try {
        setIsGenerating(true);
        const res = await generateBattleShareCardBlob(data);
        if (isMounted) {
          setImageBlob(res.blob);
          setImageDataUrl(res.dataUrl);
        }
      } catch (err) {
        console.error('Failed to generate share card:', err);
      } finally {
        if (isMounted) {
          setIsGenerating(false);
        }
      }
    }
    renderCard();
    return () => {
      isMounted = false;
    };
  }, [data]);

  // Handle Native Mobile Share
  const handleNativeShare = async () => {
    soundManager.playTap();
    setIsSharingNative(true);
    try {
      await shareBattleResultNative(data, imageBlob || undefined);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSharingNative(false);
    }
  };

  // Handle WhatsApp Share
  const handleWhatsAppShare = () => {
    soundManager.playTap();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Telegram Share
  const handleTelegramShare = () => {
    soundManager.playTap();
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent('https://vocabclash.in')}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle X (Twitter) Share
  const handleTwitterShare = () => {
    soundManager.playTap();
    const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle Download Image PNG
  const handleDownload = () => {
    soundManager.playTap();
    if (imageDataUrl) {
      downloadBattleShareCard(imageDataUrl, `vocabclash-score-${playerScore}.png`);
      soundManager.playCorrect();
    }
  };

  // Handle Copy Link
  const handleCopyLink = () => {
    soundManager.playTap();
    navigator.clipboard.writeText('https://vocabclash.in');
    setCopiedLink(true);
    soundManager.playCorrect();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Handle Copy Challenge Text
  const handleCopyChallengeText = () => {
    soundManager.playTap();
    navigator.clipboard.writeText(shareText);
    setCopiedText(true);
    soundManager.playCorrect();
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shadow-inner">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">Share Battle Result</h2>
              <p className="text-[11px] text-slate-400">Branded challenge banner for WhatsApp, Insta & X</p>
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Card Preview Container */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-inner max-w-xs mx-auto aspect-[4/5] flex items-center justify-center">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <div className="text-xs font-bold text-slate-300">Rendering HD Share Banner...</div>
                <div className="text-[10px] text-slate-500">Generating ultra-crisp resolution card</div>
              </div>
            ) : imageDataUrl ? (
              <img 
                src={imageDataUrl} 
                alt="VocabClash Battle Result"
                className="w-full h-full object-contain drop-shadow-md rounded-2xl select-none"
              />
            ) : (
              <div className="text-xs text-rose-400">Failed to render preview.</div>
            )}
          </div>

          {/* Quick Challenge Caption Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                Challenge Message
              </span>
              <p className="truncate text-slate-200 font-medium text-xs">
                {shareText}
              </p>
            </div>
            <button
              onClick={handleCopyChallengeText}
              title="Copy text"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold shrink-0 border border-slate-700 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Primary Quick Social Action Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer group shadow-sm"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">WhatsApp</span>
            </button>

            {/* Telegram */}
            <button
              onClick={handleTelegramShare}
              className="bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 hover:text-sky-200 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer group shadow-sm"
            >
              <Send className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Telegram</span>
            </button>

            {/* X / Twitter */}
            <button
              onClick={handleTwitterShare}
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer group shadow-sm"
            >
              <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform text-white" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-xs font-bold">Post on X</span>
            </button>
          </div>

          {/* Action Row: Native Share & Download */}
          <div className="space-y-2 pt-1">
            {/* Native Mobile Share Sheet */}
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                disabled={isGenerating || isSharingNative}
                onClick={handleNativeShare}
                className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer text-xs sm:text-sm"
              >
                <Share2 className="w-4 h-4 text-slate-950" />
                <span>Share Image to Apps (Instagram, Stories, Chats)</span>
              </button>
            )}

            {/* Secondary Actions: Download & Copy Link */}
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={isGenerating || !imageDataUrl}
                onClick={handleDownload}
                className="bg-slate-800 hover:bg-slate-700/90 text-white font-bold py-2.5 px-3 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer text-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Save HD Image</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="bg-slate-800 hover:bg-slate-700/90 text-white font-bold py-2.5 px-3 rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer text-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Web Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-950/70 border-t border-slate-800/80 text-center text-[10px] text-slate-500 font-medium">
          vocabclash.in • Real-Time 1v1 English Vocabulary Arena for Govt Exams
        </div>

      </div>
    </div>
  );
};
