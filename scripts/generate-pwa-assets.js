import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// High-fidelity VocabClash Emblem Vector Graphic
function createIconSvg(size, isMaskable = false) {
  // If maskable, standard safe zone is the central 80% circle (radius = size * 0.4)
  const scale = size / 512;
  const padding = isMaskable ? 52 * scale : 20 * scale;
  const innerSize = size - padding * 2;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Rich Theme Gradients -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="40%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e1b4b" />
      </linearGradient>

      <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>

      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="30%" stop-color="#f59e0b" />
        <stop offset="70%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#78350f" />
      </linearGradient>

      <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="50%" stop-color="#cbd5e1" />
        <stop offset="100%" stop-color="#64748b" />
      </linearGradient>

      <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45" />
        <stop offset="60%" stop-color="#f97316" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>

      <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${4 * scale}" stdDeviation="${6 * scale}" flood-color="#000000" flood-opacity="0.7"/>
      </filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="${size}" height="${size}" rx="${isMaskable ? 0 : 36 * scale}" fill="url(#bgGrad)" />

    <!-- Ambient Center Glow -->
    <circle cx="${size / 2}" cy="${size / 2}" r="${180 * scale}" fill="url(#glowGrad)" />

    <!-- Group for scalable icon artwork -->
    <g transform="translate(${size / 2}, ${size / 2}) scale(${scale * (isMaskable ? 0.8 : 0.92)}) translate(-256, -256)">
      
      <!-- Outer Shield Crest -->
      <path d="M 256 50 
               L 410 100 
               C 410 260, 370 380, 256 460 
               C 142 380, 102 260, 102 100 
               Z" 
            fill="url(#shieldGrad)" 
            stroke="url(#goldGrad)" 
            stroke-width="12" 
            stroke-linejoin="round"
            filter="url(#dropShadow)" />

      <!-- Inner Shield Border -->
      <path d="M 256 75 
               L 386 118 
               C 386 248, 352 352, 256 425 
               C 160 352, 126 248, 126 118 
               Z" 
            fill="none" 
            stroke="#f59e0b" 
            stroke-width="3" 
            stroke-opacity="0.6" 
            stroke-dasharray="6,6" />

      <!-- Left Sword -->
      <g transform="translate(256, 250) rotate(-45) translate(-256, -250)">
        <!-- Blade -->
        <path d="M 250 80 L 256 40 L 262 80 L 260 330 L 252 330 Z" fill="url(#bladeGrad)" stroke="#334155" stroke-width="2" />
        <line x1="256" y1="45" x2="256" y2="330" stroke="#ffffff" stroke-width="2" opacity="0.8" />
        <!-- Guard -->
        <path d="M 215 330 L 297 330 L 293 345 L 219 345 Z" fill="url(#goldGrad)" />
        <circle cx="215" cy="337" r="6" fill="#f59e0b" />
        <circle cx="297" cy="337" r="6" fill="#f59e0b" />
        <!-- Handle -->
        <rect x="251" y="345" width="10" height="40" rx="3" fill="#78350f" stroke="#d97706" stroke-width="1" />
        <!-- Pommel -->
        <circle cx="256" cy="395" r="12" fill="url(#goldGrad)" />
      </g>

      <!-- Right Sword -->
      <g transform="translate(256, 250) rotate(45) translate(-256, -250)">
        <!-- Blade -->
        <path d="M 250 80 L 256 40 L 262 80 L 260 330 L 252 330 Z" fill="url(#bladeGrad)" stroke="#334155" stroke-width="2" />
        <line x1="256" y1="45" x2="256" y2="330" stroke="#ffffff" stroke-width="2" opacity="0.8" />
        <!-- Guard -->
        <path d="M 215 330 L 297 330 L 293 345 L 219 345 Z" fill="url(#goldGrad)" />
        <circle cx="215" cy="337" r="6" fill="#f59e0b" />
        <circle cx="297" cy="337" r="6" fill="#f59e0b" />
        <!-- Handle -->
        <rect x="251" y="345" width="10" height="40" rx="3" fill="#78350f" stroke="#d97706" stroke-width="1" />
        <!-- Pommel -->
        <circle cx="256" cy="395" r="12" fill="url(#goldGrad)" />
      </g>

      <!-- Center Vocab Emblem Letter "V" with Crown -->
      <g filter="url(#dropShadow)">
        <!-- Crown on top -->
        <path d="M 224 165 L 232 145 L 256 160 L 280 145 L 288 165 Z" fill="url(#goldGrad)" />
        <circle cx="232" cy="143" r="3.5" fill="#fef08a" />
        <circle cx="256" cy="158" r="4" fill="#fef08a" />
        <circle cx="280" cy="143" r="3.5" fill="#fef08a" />

        <!-- Bold Stylized "V" -->
        <path d="M 205 185 
                 L 235 185 
                 L 256 265 
                 L 277 185 
                 L 307 185 
                 L 272 295 
                 L 240 295 
                 Z" 
              fill="url(#goldGrad)" 
              stroke="#451a03" 
              stroke-width="2" />
      </g>

      <!-- Bottom Banner Ribbon: VOCABCLASH -->
      <g transform="translate(256, 365)" filter="url(#dropShadow)">
        <path d="M -110 -15 L 110 -15 L 120 15 L -120 15 Z" fill="#090d16" stroke="url(#goldGrad)" stroke-width="3" />
        <text x="0" y="6" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="20" font-weight="900" letter-spacing="2" fill="#fbbf24">
          VOCABCLASH
        </text>
      </g>
    </g>
  </svg>
  `;
}

async function run() {
  const publicDir = path.resolve(process.cwd(), 'public');

  console.log('Generating pristine PWA icons...');

  // 1. icon-512.png (512x512)
  const svg512 = Buffer.from(createIconSvg(512, false));
  await sharp(svg512)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated public/icon-512.png');

  // 2. icon-192.png (192x192)
  const svg192 = Buffer.from(createIconSvg(192, false));
  await sharp(svg192)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated public/icon-192.png');

  // 3. favicon.png (512x512)
  await sharp(svg512)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Generated public/favicon.png');

  // 4. icon-maskable-512.png (512x512 maskable with safe zone)
  const svgMaskable512 = Buffer.from(createIconSvg(512, true));
  await sharp(svgMaskable512)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('Generated public/icon-maskable-512.png');

  // 5. icon-maskable-192.png (192x192 maskable with safe zone)
  const svgMaskable192 = Buffer.from(createIconSvg(192, true));
  await sharp(svgMaskable192)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));
  console.log('Generated public/icon-maskable-192.png');

  console.log('All icons generated.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
