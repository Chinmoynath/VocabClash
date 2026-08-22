import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

// Helper to set pixel with blending/anti-aliasing
function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * Math.floor(y) + Math.floor(x)) << 2;
  
  if (a === 255) {
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = 255;
  } else {
    // Alpha blending
    const srcA = a / 255;
    const destA = png.data[idx + 3] / 255;
    const outA = srcA + destA * (1 - srcA);
    if (outA > 0) {
      png.data[idx] = Math.round((r * srcA + png.data[idx] * destA * (1 - srcA)) / outA);
      png.data[idx + 1] = Math.round((g * srcA + png.data[idx + 1] * destA * (1 - srcA)) / outA);
      png.data[idx + 2] = Math.round((b * srcA + png.data[idx + 2] * destA * (1 - srcA)) / outA);
      png.data[idx + 3] = Math.round(outA * 255);
    }
  }
}

function drawCircle(png, cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(png.height - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(png.width - 1, Math.ceil(cx + radius)); x++) {
      const dist2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (dist2 <= r2) {
        setPixel(png, x, y, r, g, b, a);
      }
    }
  }
}

function drawLine(png, x0, y0, x1, y1, width, r, g, b, a = 255) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const steps = Math.ceil(len * 2);
  const halfW = width / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    drawCircle(png, cx, cy, halfW, r, g, b, a);
  }
}

function generateVocabClashIcon(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;

  // 1. Draw rounded squircle / circular background with deep slate gradient
  const bgRadius = size * 0.46;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded corner box / shield shape
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const distFromCenter = Math.hypot(dx, dy);
      
      // Calculate squircle distance
      const cornerRadius = size * 0.22;
      const innerW = size * 0.44 - cornerRadius;
      const innerH = size * 0.44 - cornerRadius;
      
      let inBounds = false;
      if (dx <= innerW && dy <= size * 0.44) inBounds = true;
      else if (dy <= innerH && dx <= size * 0.44) inBounds = true;
      else if (dx > innerW && dy > innerH) {
        const cdx = dx - innerW;
        const cdy = dy - innerH;
        if (cdx * cdx + cdy * cdy <= cornerRadius * cornerRadius) inBounds = true;
      }

      if (inBounds) {
        // Gradient from dark slate/indigo (15, 23, 42) to deep violet-black (8, 12, 28)
        const t = y / size;
        const r = Math.round(18 * (1 - t) + 10 * t);
        const g = Math.round(26 * (1 - t) + 15 * t);
        const b = Math.round(48 * (1 - t) + 32 * t);
        setPixel(png, x, y, r, g, b, 255);
      } else {
        // Transparent outside
        setPixel(png, x, y, 0, 0, 0, 0);
      }
    }
  }

  // 2. Draw glowing golden shield / crest border
  const borderWidth = Math.max(2, size * 0.035);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const cornerRadius = size * 0.22;
      const innerW = size * 0.44 - cornerRadius;
      const innerH = size * 0.44 - cornerRadius;
      
      let distToBorder = 999;
      if (dx > innerW && dy > innerH) {
        const cdx = dx - innerW;
        const cdy = dy - innerH;
        distToBorder = Math.abs(Math.hypot(cdx, cdy) - cornerRadius);
      } else if (dx <= innerW && dy <= size * 0.44) {
        distToBorder = Math.abs(dy - size * 0.44);
      } else if (dy <= innerH && dx <= size * 0.44) {
        distToBorder = Math.abs(dx - size * 0.44);
      }

      if (distToBorder <= borderWidth) {
        // Gold gradient: amber-400 (245, 158, 11) to orange-500 (249, 115, 22)
        const goldT = (x + y) / (size * 2);
        const gr = Math.round(251 * (1 - goldT) + 245 * goldT);
        const gg = Math.round(191 * (1 - goldT) + 158 * goldT);
        const gb = Math.round(36 * (1 - goldT) + 11 * goldT);
        const alpha = Math.max(0, Math.min(255, Math.round((1 - distToBorder / borderWidth) * 255)));
        setPixel(png, x, y, gr, gg, gb, alpha);
      }
    }
  }

  // 3. Draw crossed swords in the background
  const swordLen = size * 0.28;
  const swordW = Math.max(2, size * 0.03);
  
  // Diagonal 1 (Top-Left to Bottom-Right)
  drawLine(png, cx - swordLen, cy - swordLen, cx + swordLen, cy + swordLen, swordW, 226, 232, 240, 220); // Silver Blade
  drawLine(png, cx - swordLen * 0.7, cy - swordLen * 0.9, cx - swordLen * 0.9, cy - swordLen * 0.7, swordW * 1.5, 245, 158, 11, 255); // Crossguard
  drawCircle(png, cx - swordLen * 1.05, cy - swordLen * 1.05, swordW * 1.2, 245, 158, 11, 255); // Pommel

  // Diagonal 2 (Top-Right to Bottom-Left)
  drawLine(png, cx + swordLen, cy - swordLen, cx - swordLen, cy + swordLen, swordW, 226, 232, 240, 220); // Silver Blade
  drawLine(png, cx + swordLen * 0.7, cy - swordLen * 0.9, cx + swordLen * 0.9, cy - swordLen * 0.7, swordW * 1.5, 245, 158, 11, 255); // Crossguard
  drawCircle(png, cx + swordLen * 1.05, cy - swordLen * 1.05, swordW * 1.2, 245, 158, 11, 255); // Pommel

  // 4. Central Emblem: Bold geometric "V" for VocabClash
  const vTopY = cy - size * 0.22;
  const vBottomY = cy + size * 0.22;
  const vSpreadX = size * 0.22;
  const vThick = Math.max(3, size * 0.07);

  // Left wing of V
  drawLine(png, cx - vSpreadX, vTopY, cx, vBottomY, vThick, 245, 158, 11, 255);
  // Right wing of V
  drawLine(png, cx + vSpreadX, vTopY, cx, vBottomY, vThick, 251, 191, 36, 255);
  
  // Highlight core of V
  drawLine(png, cx - vSpreadX + vThick * 0.3, vTopY + vThick * 0.3, cx, vBottomY - vThick * 0.2, vThick * 0.4, 254, 240, 138, 255);
  drawLine(png, cx + vSpreadX - vThick * 0.3, vTopY + vThick * 0.3, cx, vBottomY - vThick * 0.2, vThick * 0.4, 254, 240, 138, 255);

  // 5. Crown / Star atop the V
  const crownY = vTopY - size * 0.05;
  drawCircle(png, cx, crownY, size * 0.045, 251, 191, 36, 255);
  drawCircle(png, cx, crownY, size * 0.025, 255, 255, 255, 255);
  drawCircle(png, cx - size * 0.08, crownY + size * 0.02, size * 0.03, 245, 158, 11, 255);
  drawCircle(png, cx + size * 0.08, crownY + size * 0.02, size * 0.03, 245, 158, 11, 255);

  return png;
}

function generateScreenshot(width, height, isWide) {
  const png = new PNG({ width, height });
  const cx = width / 2;
  const cy = height / 2;

  // Background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = y / height;
      const r = Math.round(15 * (1 - t) + 10 * t);
      const g = Math.round(23 * (1 - t) + 15 * t);
      const b = Math.round(42 * (1 - t) + 28 * t);
      setPixel(png, x, y, r, g, b, 255);
    }
  }

  // Draw Header Bar
  for (let y = 0; y < Math.floor(height * 0.12); y++) {
    for (let x = 0; x < width; x++) {
      setPixel(png, x, y, 30, 41, 59, 255);
    }
  }

  // Draw Mini Logo on Header
  drawCircle(png, width * 0.1, height * 0.06, height * 0.035, 245, 158, 11, 255);
  drawCircle(png, width * 0.1, height * 0.06, height * 0.02, 255, 255, 255, 255);

  // Draw Card Container in the middle
  const cardW = isWide ? width * 0.55 : width * 0.85;
  const cardH = height * 0.65;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2 + height * 0.04;

  for (let y = Math.floor(cardY); y < Math.floor(cardY + cardH); y++) {
    for (let x = Math.floor(cardX); x < Math.floor(cardX + cardW); x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        setPixel(png, x, y, 30, 41, 59, 255);
      }
    }
  }

  // Draw Central Emblem inside the card
  const emblemSize = Math.floor(cardH * 0.45);
  const iconPng = generateVocabClashIcon(emblemSize);
  const startX = Math.floor(cx - emblemSize / 2);
  const startY = Math.floor(cardY + cardH * 0.1);

  for (let y = 0; y < emblemSize; y++) {
    for (let x = 0; x < emblemSize; x++) {
      const srcIdx = (emblemSize * y + x) << 2;
      const a = iconPng.data[srcIdx + 3];
      if (a > 0) {
        setPixel(
          png,
          startX + x,
          startY + y,
          iconPng.data[srcIdx],
          iconPng.data[srcIdx + 1],
          iconPng.data[srcIdx + 2],
          a
        );
      }
    }
  }

  // Draw action buttons inside card
  const btnW = cardW * 0.75;
  const btnH = height * 0.08;
  const btnX = cx - btnW / 2;
  const btnY = cardY + cardH * 0.72;

  for (let y = Math.floor(btnY); y < Math.floor(btnY + btnH); y++) {
    for (let x = Math.floor(btnX); x < Math.floor(btnX + btnW); x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        setPixel(png, x, y, 245, 158, 11, 255); // Amber button
      }
    }
  }

  return png;
}

const publicDir = path.join(process.cwd(), 'public');

// 1. Generate 192x192 PNG
console.log('Generating /public/icon-192.png (192x192)...');
const icon192 = generateVocabClashIcon(192);
const buf192 = PNG.sync.write(icon192);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), buf192);

// 2. Generate 512x512 PNG
console.log('Generating /public/icon-512.png (512x512)...');
const icon512 = generateVocabClashIcon(512);
const buf512 = PNG.sync.write(icon512);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), buf512);

// 3. Generate favicon.png (512x512)
console.log('Generating /public/favicon.png (512x512)...');
fs.writeFileSync(path.join(publicDir, 'favicon.png'), buf512);

// 4. Generate screenshots
console.log('Generating /public/screenshot-mobile.png (512x512)...');
const shotMobile = generateScreenshot(512, 512, false);
fs.writeFileSync(path.join(publicDir, 'screenshot-mobile.png'), PNG.sync.write(shotMobile));

console.log('Generating /public/screenshot-wide.png (1024x512)...');
const shotWide = generateScreenshot(1024, 512, true);
fs.writeFileSync(path.join(publicDir, 'screenshot-wide.png'), PNG.sync.write(shotWide));

console.log('All static PNG icons and screenshots generated successfully!');
