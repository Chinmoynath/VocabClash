import { QuestionCategory, ExamType } from '../types';

export interface BattleShareData {
  playerName: string;
  playerAvatar?: string;
  playerScore: number;
  playerLpChange: number;
  opponentName: string;
  opponentAvatar?: string;
  opponentScore: number;
  isWinner: boolean;
  isDraw: boolean;
  exam?: ExamType | string;
  category?: QuestionCategory | string;
  accuracyPct?: number;
  totalQuestions?: number;
  customCta?: string;
}

// Get dynamic competitive CTA based on battle outcome
export function getBattleShareCta(data: BattleShareData): { mainCta: string; subCta: string; shareText: string } {
  const { isWinner, isDraw, playerScore, opponentScore } = data;
  const scoreFormatted = playerScore.toLocaleString();

  if (isWinner) {
    const ctas = [
      `I scored ${scoreFormatted}. Your move.`,
      `Think you can beat ${scoreFormatted}?`,
      `I just dominated this VocabClash duel. Your turn!`,
      `Think your English vocab is better than mine?`,
      `Can you beat ${scoreFormatted} points in a 1v1 duel?`,
    ];
    // Pick deterministic or random
    const mainCta = data.customCta || ctas[0];
    const subCta = 'Challenge me on VocabClash • Real PYQs';
    const shareText = `I scored ${scoreFormatted} points in a VocabClash 1v1 Vocabulary Battle 🏆 Think you can beat me? Challenge me now at https://vocabclash.in`;
    return { mainCta, subCta, shareText };
  } else if (isDraw) {
    const mainCta = `Tied at ${scoreFormatted}! Can you break the deadlock?`;
    const subCta = 'Take the VocabClash challenge →';
    const shareText = `Tied with ${scoreFormatted} points in a VocabClash 1v1 Vocabulary Battle 🤝 Think you can score higher? Play at https://vocabclash.in`;
    return { mainCta, subCta, shareText };
  } else {
    const ctas = [
      `I scored ${scoreFormatted}. Can you do better?`,
      `Can you score higher than ${scoreFormatted}?`,
      `I battled hard. Take the challenge and beat this score!`,
      `Think you know more vocabulary? Try beating ${scoreFormatted}.`,
    ];
    const mainCta = data.customCta || ctas[0];
    const subCta = 'Next battle. Next comeback. Take the challenge →';
    const shareText = `I scored ${scoreFormatted} points in a VocabClash Vocabulary Duel ⚔️ Can you do better? Try it now at https://vocabclash.in`;
    return { mainCta, subCta, shareText };
  }
}

/**
 * Generates an ultra-crisp high-DPI HTML5 Canvas share card (1080 x 1350, 4:5 ratio)
 * Styled to perfectly match the VocabClash 1v1 battle result screen theme & colors
 */
export async function generateBattleShareCardCanvas(data: BattleShareData): Promise<HTMLCanvasElement> {
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context from canvas');

  const { isWinner, isDraw, playerScore, opponentScore, playerLpChange, playerName, opponentName, playerAvatar } = data;
  const { mainCta, subCta } = getBattleShareCta(data);

  // 1. Base Dark Canvas Background (Matching 1v1 Result Arena: #070c1b -> #0b132b)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#060b18');
  bgGrad.addColorStop(0.5, '#091024');
  bgGrad.addColorStop(1, '#050914');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Radial Ambient Glow (Golden amber for victory, Ruby rose for defeat, Sky blue for draw)
  const topGlow = ctx.createRadialGradient(width / 2, 180, 20, width / 2, 180, 550);
  if (isWinner) {
    topGlow.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
    topGlow.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)');
    topGlow.addColorStop(1, 'rgba(6, 11, 24, 0)');
  } else if (isDraw) {
    topGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
    topGlow.addColorStop(0.5, 'rgba(14, 165, 233, 0.1)');
    topGlow.addColorStop(1, 'rgba(6, 11, 24, 0)');
  } else {
    // Defeat glow - Deep Rose / Ruby
    topGlow.addColorStop(0, 'rgba(244, 63, 94, 0.26)');
    topGlow.addColorStop(0.5, 'rgba(225, 29, 72, 0.1)');
    topGlow.addColorStop(1, 'rgba(6, 11, 24, 0)');
  }
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 750);

  // Bottom subtle glow
  const bottomGlow = ctx.createRadialGradient(width / 2, height - 80, 20, width / 2, height - 80, 450);
  bottomGlow.addColorStop(0, isWinner ? 'rgba(245, 158, 11, 0.14)' : 'rgba(14, 165, 233, 0.12)');
  bottomGlow.addColorStop(1, 'rgba(6, 11, 24, 0)');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, height - 400, width, 400);

  // 3. Outer Framing Border (Subtle slate border with gold/rose corner accents)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 35, 35, width - 70, height - 70, 36);
  ctx.stroke();

  // Corner Accent Lines
  ctx.strokeStyle = isWinner ? 'rgba(245, 158, 11, 0.6)' : isDraw ? 'rgba(56, 189, 248, 0.6)' : 'rgba(244, 63, 94, 0.6)';
  ctx.lineWidth = 3.5;
  // Top-left
  ctx.beginPath();
  ctx.arc(75, 75, 40, Math.PI, 1.5 * Math.PI);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.arc(width - 75, height - 75, 40, 0, 0.5 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // 4. HEADER: VocabClash Brand Pill
  ctx.save();
  ctx.fillStyle = 'rgba(11, 19, 43, 0.9)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, width / 2 - 180, 68, 360, 52, 26);
  ctx.fill();
  ctx.stroke();

  ctx.font = '900 23px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('⚔️  VOCABCLASH  ⚔️', width / 2, 94);
  ctx.restore();

  // Exam Subtitle Badge
  ctx.save();
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#94a3b8';
  const examText = (data.exam ? `${data.exam.toString().toUpperCase()} • ` : 'SSC CGL • ') + '1v1 ENGLISH VOCABULARY DUEL';
  ctx.fillText(examText, width / 2, 142);
  ctx.restore();

  // 5. OUTCOME EMBLEM & TITLE (Matching Result Screen Exactly)
  ctx.save();
  let titleColor = '#fbbf24';
  let titleText = 'VICTORY!';
  let emblemIcon = '🏆';
  let subtitleText = 'Splendid Performance! Promoted higher on Leaderboard.';

  if (!isWinner && !isDraw) {
    titleColor = '#fb7185'; // Rose-400
    titleText = 'DEFEAT';
    emblemIcon = '💔';
    subtitleText = 'Close fight! Next battle, next comeback.';
  } else if (isDraw) {
    titleColor = '#f1f5f9';
    titleText = 'DRAW MATCH';
    emblemIcon = '🤝';
    subtitleText = 'Well fought duel! Both aspirants scored equally.';
  }

  // Outcome Emblem Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = isWinner ? 'rgba(245, 158, 11, 0.5)' : isDraw ? 'rgba(148, 163, 184, 0.5)' : 'rgba(244, 63, 94, 0.5)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, width / 2 - 32, 172, 64, 54, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = '32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emblemIcon, width / 2, 200);

  // Title Text
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = titleColor;
  ctx.shadowColor = isWinner ? 'rgba(251, 191, 36, 0.5)' : isDraw ? 'rgba(255, 255, 255, 0.3)' : 'rgba(244, 63, 94, 0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText(titleText, width / 2, 255);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(subtitleText, width / 2, 290);
  ctx.restore();

  // 6. HERO "YOU" PLAYER CARD (Exact Visual Pattern from the Result Screen!)
  // Box Container (with golden border #f59e0b)
  const cardX = width / 2 - 380;
  const cardY = 325;
  const cardW = 760;
  const cardH = 390;
  const cardR = 30;

  ctx.save();
  // Card background
  const pCardBg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  pCardBg.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
  pCardBg.addColorStop(1, 'rgba(10, 16, 32, 0.98)');
  ctx.fillStyle = pCardBg;

  // Golden Amber border (border-2 border-amber-500)
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fill();
  ctx.stroke();

  // Top "YOU" Pill Badge (Sitting cleanly on the top border like in result page)
  const youBadgeW = 110;
  const youBadgeH = 32;
  const youBadgeX = width / 2 - youBadgeW / 2;
  const youBadgeY = cardY - youBadgeH / 2;

  ctx.fillStyle = '#f59e0b';
  drawRoundedRect(ctx, youBadgeX, youBadgeY, youBadgeW, youBadgeH, 16);
  ctx.fill();

  ctx.font = '900 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#020617';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU', width / 2, youBadgeY + youBadgeH / 2);

  // Avatar Icon Box (Rounded with gold border and amber tint)
  const avatarBoxSize = 74;
  const avatarBoxX = width / 2 - avatarBoxSize / 2;
  const avatarBoxY = cardY + 28;

  ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, avatarBoxX, avatarBoxY, avatarBoxSize, avatarBoxSize, 22);
  ctx.fill();
  ctx.stroke();

  ctx.font = '40px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerAvatar || '👨‍💼', width / 2, avatarBoxY + avatarBoxSize / 2);

  // Player Name
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const displayPlayerName = truncateText(playerName || 'Govt Aspirant', 18);
  ctx.fillText(displayPlayerName, width / 2, avatarBoxY + avatarBoxSize + 22);

  // Subtitle "Govt Job Aspirant" in Amber/Gold
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('Govt Job Aspirant', width / 2, avatarBoxY + avatarBoxSize + 46);

  // Inner Score Container (Deep dark midnight slate: #030712)
  const scoreBoxW = 680;
  const scoreBoxH = 145;
  const scoreBoxX = width / 2 - scoreBoxW / 2;
  const scoreBoxY = cardY + cardH - scoreBoxH - 22;

  ctx.fillStyle = '#030712';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 20);
  ctx.fill();
  ctx.stroke();

  // Big Golden Score Number
  ctx.font = '900 78px system-ui, -apple-system, monospace';
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
  ctx.shadowBlur = 20;
  ctx.fillText(playerScore.toLocaleString(), width / 2, scoreBoxY + 54);
  ctx.shadowBlur = 0;

  // LP Change Badge / Text (-15 LP in rose #fb7185, +30 LP in emerald #34d399)
  const lpColor = playerLpChange >= 0 ? '#34d399' : '#fb7185';
  const lpString = playerLpChange >= 0 ? `+${playerLpChange} LP` : `${playerLpChange} LP`;
  
  ctx.font = '900 24px system-ui, -apple-system, monospace';
  ctx.fillStyle = lpColor;
  ctx.fillText(lpString, width / 2, scoreBoxY + 112);
  ctx.restore();

  // 7. HEAD-TO-HEAD OPPONENT COMPARISON BAR (Matching 1v1 Result Head-to-Head)
  ctx.save();
  const vsBarY = 740;
  const vsBarH = 110;
  const vsBarW = 760;
  const vsBarX = width / 2 - vsBarW / 2;

  ctx.fillStyle = 'rgba(10, 16, 32, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, vsBarX, vsBarY, vsBarW, vsBarH, 22);
  ctx.fill();
  ctx.stroke();

  // Player Side (Left)
  const pColX = width / 2 - 200;
  ctx.font = '800 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${truncateText(playerName || 'YOU', 12)} (YOU)`, pColX, vsBarY + 34);

  ctx.font = '900 36px system-ui, -apple-system, monospace';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(playerScore.toLocaleString(), pColX, vsBarY + 74);

  // VS Emblem (Middle)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, width / 2 - 32, vsBarY + 28, 64, 54, 16);
  ctx.fill();
  ctx.stroke();

  ctx.font = '900 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('⚔️', width / 2, vsBarY + 55);

  // Opponent Side (Right)
  const oColX = width / 2 + 200;
  ctx.font = '800 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(truncateText(opponentName || 'Opponent', 14), oColX, vsBarY + 34);

  ctx.font = '900 36px system-ui, -apple-system, monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(opponentScore.toLocaleString(), oColX, vsBarY + 74);
  ctx.restore();

  // 8. PROVOCATIVE CHALLENGE CTA SECTION
  ctx.save();
  const ctaBoxY = 870;
  const ctaBoxH = 160;
  const ctaBoxW = 760;
  const ctaBoxX = width / 2 - ctaBoxW / 2;

  const ctaBg = ctx.createLinearGradient(ctaBoxX, ctaBoxY, ctaBoxX + ctaBoxW, ctaBoxY + ctaBoxH);
  ctaBg.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
  ctaBg.addColorStop(0.5, 'rgba(11, 19, 43, 0.98)');
  ctaBg.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = ctaBg;
  ctx.strokeStyle = isWinner ? 'rgba(245, 158, 11, 0.4)' : isDraw ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, ctaBoxX, ctaBoxY, ctaBoxW, ctaBoxH, 24);
  ctx.fill();
  ctx.stroke();

  // Quotation Marks / Dynamic CTA
  ctx.font = '900 38px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`“ ${mainCta} ”`, width / 2, ctaBoxY + 55);

  // Sub CTA
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = isWinner ? '#fbbf24' : isDraw ? '#38bdf8' : '#38bdf8';
  ctx.fillText(subCta, width / 2, ctaBoxY + 115);
  ctx.restore();

  // 9. FOOTER: Acquisition URL Button & Badges
  ctx.save();
  const urlBtnY = 1055;
  const urlBtnH = 82;
  const urlBtnW = 540;
  const urlBtnX = width / 2 - urlBtnW / 2;

  const urlGradient = ctx.createLinearGradient(urlBtnX, urlBtnY, urlBtnX + urlBtnW, urlBtnY + urlBtnH);
  urlGradient.addColorStop(0, '#0284c7');
  urlGradient.addColorStop(1, '#4f46e5');
  ctx.fillStyle = urlGradient;
  ctx.shadowColor = 'rgba(2, 132, 199, 0.45)';
  ctx.shadowBlur = 22;
  drawRoundedRect(ctx, urlBtnX, urlBtnY, urlBtnW, urlBtnH, 41);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Domain Text
  ctx.font = '900 35px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡  vocabclash.in  ⚡', width / 2, urlBtnY + urlBtnH / 2);

  // Bottom Tagline
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Real-Time 1v1 English Vocabulary Arena for Govt Exams', width / 2, 1175);

  // SSC / Banking Badges
  ctx.font = '700 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('SSC CGL • CHSL • CPO • IBPS PO • CDS • NDA • STATE PSC', width / 2, 1215);
  ctx.restore();

  return canvas;
}

/**
 * Helper to generate PNG Blob and Data URL
 */
export async function generateBattleShareCardBlob(data: BattleShareData): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = await generateBattleShareCardCanvas(data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate image blob'));
        return;
      }
      const dataUrl = canvas.toDataURL('image/png', 0.95);
      resolve({ blob, dataUrl });
    }, 'image/png', 0.95);
  });
}

/**
 * Downloads the card directly to the user's device
 */
export function downloadBattleShareCard(dataUrl: string, filename = 'vocabclash-battle-result.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Native Web Share API trigger with fallback
 */
export async function shareBattleResultNative(
  data: BattleShareData, 
  blob?: Blob
): Promise<{ success: boolean; sharedFile: boolean }> {
  const { shareText } = getBattleShareCta(data);
  const title = `VocabClash 1v1 Battle Result (${data.playerScore} Pts)`;
  const url = 'https://vocabclash.in';

  let imageFile: File | null = null;
  if (blob && typeof File !== 'undefined') {
    try {
      imageFile = new File([blob], `vocabclash-${data.playerScore}-score.png`, { type: 'image/png' });
    } catch (e) {
      console.warn('Could not construct File object for share', e);
    }
  }

  // Check if navigator.share exists
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // 1. Try file share first if supported
      if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          title,
          text: shareText,
          url,
          files: [imageFile],
        });
        return { success: true, sharedFile: true };
      }

      // 2. Fallback to standard text + url share
      await navigator.share({
        title,
        text: shareText,
        url,
      });
      return { success: true, sharedFile: false };
    } catch (err: any) {
      // User cancelled share or aborted
      if (err.name === 'AbortError') {
        return { success: false, sharedFile: false };
      }
      console.warn('Navigator share error:', err);
    }
  }

  return { success: false, sharedFile: false };
}

// Utility: Canvas Rounded Rect
function drawRoundedRect(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Utility: Truncate string for canvas
function truncateText(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}
