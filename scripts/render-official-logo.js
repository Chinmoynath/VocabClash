import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SVG_LOGO = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradients -->
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#2d1b69"/>
      <stop offset="50%" stop-color="#150f3d"/>
      <stop offset="100%" stop-color="#070417"/>
    </radialGradient>

    <linearGradient id="blueGloveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="40%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#034694"/>
    </linearGradient>

    <linearGradient id="purpleGloveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e879f9"/>
      <stop offset="40%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#581c87"/>
    </linearGradient>

    <linearGradient id="goldLightning" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#facc15"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>

    <linearGradient id="goldClashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="35%" stop-color="#facc15"/>
      <stop offset="70%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>

    <linearGradient id="whiteVocabGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#f1f5f9"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>

    <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>

    <filter id="glowGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <filter id="strongGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Clip Path for Squircle Icon -->
    <clipPath id="squircleClip">
      <rect x="12" y="12" width="488" height="488" rx="108" ry="108" />
    </clipPath>
  </defs>

  <!-- Squircle Canvas with Clip -->
  <g clip-path="url(#squircleClip)">
    <!-- Background -->
    <rect x="0" y="0" width="512" height="512" fill="url(#bgGrad)" />

    <!-- Ambient Glow Orbs -->
    <circle cx="180" cy="180" r="140" fill="#0284c7" opacity="0.35" filter="url(#strongGlow)"/>
    <circle cx="340" cy="180" r="140" fill="#9333ea" opacity="0.35" filter="url(#strongGlow)"/>
    <circle cx="256" cy="160" r="90" fill="#facc15" opacity="0.25" filter="url(#strongGlow)"/>

    <!-- Floating Background Details -->
    <!-- Top Left Floating Book -->
    <g transform="translate(68, 70) rotate(-18) scale(0.65)" opacity="0.85">
      <path d="M 0 30 Q 30 15 60 30 L 60 75 Q 30 60 0 75 Z" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/>
      <path d="M 60 30 Q 90 15 120 30 L 120 75 Q 90 60 60 75 Z" fill="none" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/>
      <line x1="60" y1="30" x2="60" y2="75" stroke="#38bdf8" stroke-width="6"/>
      <line x1="15" y1="45" x2="48" y2="45" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <line x1="15" y1="58" x2="48" y2="58" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <line x1="72" y1="45" x2="105" y2="45" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
      <line x1="72" y1="58" x2="105" y2="58" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    </g>

    <!-- Top Right Floating Trophy -->
    <g transform="translate(380, 68) rotate(16) scale(0.62)" opacity="0.85">
      <path d="M 20 20 L 70 20 C 70 55 58 70 45 75 L 45 92 L 65 92 L 65 102 L 25 102 L 25 92 L 45 92 L 45 75 C 32 70 20 55 20 20 Z" fill="none" stroke="#c084fc" stroke-width="6" stroke-linejoin="round"/>
      <path d="M 20 30 C 5 30 5 50 20 52" fill="none" stroke="#c084fc" stroke-width="5" stroke-linecap="round"/>
      <path d="M 70 30 C 85 30 85 50 70 52" fill="none" stroke="#c084fc" stroke-width="5" stroke-linecap="round"/>
      <!-- Star inside trophy -->
      <polygon points="45,34 48,43 57,43 50,49 53,58 45,52 37,58 40,49 33,43 42,43" fill="#c084fc"/>
    </g>

    <!-- Floating Confetti / Shards -->
    <polygon points="35,280 48,272 42,290" fill="#facc15" opacity="0.8"/>
    <polygon points="465,170 480,185 460,195" fill="#f43f5e" opacity="0.8"/>
    <polygon points="370,105 382,95 378,110" fill="#38bdf8" opacity="0.7"/>
    <polygon points="120,60 128,72 115,70" fill="#a855f7" opacity="0.7"/>
    <polygon points="450,285 462,275 456,292" fill="#fb923c" opacity="0.8"/>

    <!-- Flanking Badges: Left [W] and Right [?] -->
    <!-- Left Tile [W] -->
    <g transform="translate(30, 185) rotate(-14)">
      <rect x="0" y="0" width="60" height="60" rx="14" fill="#1d4ed8" stroke="#60a5fa" stroke-width="4"/>
      <text x="30" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">W</text>
    </g>

    <!-- Right Tile [?] -->
    <g transform="translate(422, 205) rotate(14)">
      <rect x="0" y="0" width="58" height="58" rx="14" fill="#7e22ce" stroke="#c084fc" stroke-width="4"/>
      <text x="29" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="900" fill="#ffffff" text-anchor="middle">?</text>
    </g>

    <!-- Center Clash Sparks & Central Lightning -->
    <g filter="url(#glowGlow)">
      <!-- Main Lightning Bolt -->
      <polygon points="256,40 236,130 262,130 240,210 274,120 248,120 266,40" fill="url(#goldLightning)"/>
      <polygon points="256,40 236,130 262,130 240,210 274,120 248,120 266,40" fill="#ffffff" opacity="0.4"/>
      
      <!-- Energy Burst Center -->
      <circle cx="256" cy="175" r="28" fill="#fef08a" opacity="0.9"/>
      <circle cx="256" cy="175" r="14" fill="#ffffff"/>
      
      <!-- Spark Rays -->
      <line x1="256" y1="175" x2="210" y2="135" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
      <line x1="256" y1="175" x2="302" y2="135" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
      <line x1="256" y1="175" x2="200" y2="185" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
      <line x1="256" y1="175" x2="312" y2="185" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
    </g>

    <!-- Left Blue Boxing Glove [A] -->
    <g transform="translate(100, 105)">
      <!-- Glove Shadow / Outline -->
      <path d="M 45 95 C 10 75 10 30 45 10 C 80 -10 120 5 140 35 C 152 52 148 85 130 102 C 105 125 70 120 45 95 Z" fill="#022c54" transform="translate(6, 8)"/>
      
      <!-- Glove Main Body -->
      <path d="M 45 95 C 10 75 10 30 45 10 C 80 -10 120 5 140 35 C 152 52 148 85 130 102 C 105 125 70 120 45 95 Z" fill="url(#blueGloveGrad)" stroke="#38bdf8" stroke-width="4"/>
      
      <!-- Glove Thumb -->
      <path d="M 125 45 C 145 42 162 60 152 80 C 142 92 125 85 120 75 Z" fill="url(#blueGloveGrad)" stroke="#38bdf8" stroke-width="3"/>
      
      <!-- Wrist Cuff / Strap -->
      <g transform="translate(18, 80) rotate(-35)">
        <rect x="0" y="0" width="34" height="60" rx="8" fill="#0369a1" stroke="#38bdf8" stroke-width="3"/>
        <line x1="8" y1="12" x2="26" y2="12" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="8" y1="28" x2="26" y2="28" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="8" y1="44" x2="26" y2="44" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      </g>

      <!-- Gloss Highlight -->
      <path d="M 50 22 C 75 5 105 18 118 38" fill="none" stroke="#bae6fd" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
      
      <!-- Letter "A" on Glove -->
      <text x="100" y="76" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" transform="rotate(12 100 76)" filter="url(#glowGlow)">A</text>
      <text x="100" y="76" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" transform="rotate(12 100 76)">A</text>
    </g>

    <!-- Right Purple Boxing Glove [Z] -->
    <g transform="translate(262, 105)">
      <!-- Glove Shadow / Outline -->
      <path d="M 105 95 C 140 75 140 30 105 10 C 70 -10 30 5 10 35 C -2 52 2 85 20 102 C 45 125 80 120 105 95 Z" fill="#2e0854" transform="translate(-6, 8)"/>
      
      <!-- Glove Main Body -->
      <path d="M 105 95 C 140 75 140 30 105 10 C 70 -10 30 5 10 35 C -2 52 2 85 20 102 C 45 125 80 120 105 95 Z" fill="url(#purpleGloveGrad)" stroke="#e879f9" stroke-width="4"/>
      
      <!-- Glove Thumb -->
      <path d="M 25 45 C 5 42 -12 60 -2 80 C 8 92 25 85 30 75 Z" fill="url(#purpleGloveGrad)" stroke="#e879f9" stroke-width="3"/>
      
      <!-- Wrist Cuff / Strap -->
      <g transform="translate(104, 60) rotate(35)">
        <rect x="0" y="0" width="34" height="60" rx="8" fill="#7e22ce" stroke="#e879f9" stroke-width="3"/>
        <line x1="8" y1="12" x2="26" y2="12" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="8" y1="28" x2="26" y2="28" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="8" y1="44" x2="26" y2="44" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      </g>

      <!-- Gloss Highlight -->
      <path d="M 100 22 C 75 5 45 18 32 38" fill="none" stroke="#f5d0fe" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
      
      <!-- Letter "Z" on Glove -->
      <text x="50" y="76" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" transform="rotate(-12 50 76)" filter="url(#glowGlow)">Z</text>
      <text x="50" y="76" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" transform="rotate(-12 50 76)">Z</text>
    </g>

    <!-- Open Book Under Gloves -->
    <g transform="translate(76, 226)">
      <!-- Book Glow Behind -->
      <path d="M 180 80 C 120 25 40 25 0 65 L 180 105 L 360 65 C 320 25 240 25 180 80 Z" fill="#38bdf8" opacity="0.3" filter="url(#glowGlow)"/>

      <!-- Lower Base Pages / Spine -->
      <path d="M 180 96 C 110 32 30 36 0 74 L 0 88 C 30 50 110 46 180 108 C 250 46 330 50 360 88 L 360 74 C 330 36 250 32 180 96 Z" fill="#0f172a" stroke="#475569" stroke-width="3"/>
      
      <!-- Middle Stack Pages -->
      <path d="M 180 90 C 115 30 35 34 8 68 C 35 40 115 38 180 96 C 245 38 325 40 352 68 C 325 34 245 30 180 90 Z" fill="#cbd5e1"/>

      <!-- Top Open Pages Left -->
      <path d="M 180 84 C 125 24 45 28 14 62 L 180 86 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
      <path d="M 180 78 C 130 18 55 22 22 56 L 180 80 Z" fill="#ffffff"/>
      <!-- Text Lines Left -->
      <path d="M 45 46 Q 100 28 160 62" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
      <path d="M 50 56 Q 105 38 160 70" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" opacity="0.6"/>

      <!-- Top Open Pages Right -->
      <path d="M 180 84 C 235 24 315 28 346 62 L 180 86 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
      <path d="M 180 78 C 230 18 305 22 338 56 L 180 80 Z" fill="#ffffff"/>
      <!-- Text Lines Right -->
      <path d="M 315 46 Q 260 28 200 62" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
      <path d="M 310 56 Q 255 38 200 70" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    </g>

    <!-- Main Title: VocabClash 3D Display Typography -->
    <g transform="translate(256, 385)">
      <!-- 3D Shadow Layers (Heavy Dark Navy Extrusion) -->
      <text x="0" y="8" font-family="system-ui, -apple-system, 'Montserrat', 'Impact', sans-serif" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="-2">
        <tspan fill="#060919" stroke="#060919" stroke-width="26" stroke-linejoin="round">Vocab</tspan>
        <tspan fill="#060919" stroke="#060919" stroke-width="26" stroke-linejoin="round">Clash</tspan>
      </text>
      <text x="0" y="4" font-family="system-ui, -apple-system, 'Montserrat', 'Impact', sans-serif" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="-2">
        <tspan fill="#0b132b" stroke="#0b132b" stroke-width="18" stroke-linejoin="round">Vocab</tspan>
        <tspan fill="#0b132b" stroke="#0b132b" stroke-width="18" stroke-linejoin="round">Clash</tspan>
      </text>

      <!-- Main Face Layers -->
      <!-- "Vocab" in pure white / silver gradient with subtle cyan accent -->
      <!-- "Clash" in vibrant gold / amber / orange gradient -->
      <text x="0" y="0" font-family="system-ui, -apple-system, 'Montserrat', 'Impact', sans-serif" font-size="82" font-weight="900" text-anchor="middle" letter-spacing="-2">
        <tspan fill="url(#whiteVocabGrad)" stroke="#ffffff" stroke-width="2">Vocab</tspan>
        <tspan fill="url(#goldClashGrad)" stroke="#fef08a" stroke-width="2">Clash</tspan>
      </text>
    </g>

    <!-- Bottom Slogan Ribbon: LEARN • PLAY • DOMINATE -->
    <g transform="translate(80, 418)">
      <!-- Ribbon Outer Gold Border & Navy Fill -->
      <path d="M 20 0 L 332 0 L 352 18 L 332 36 L 20 36 L 0 18 Z" fill="url(#ribbonGrad)" stroke="#f59e0b" stroke-width="4.5" stroke-linejoin="round"/>
      
      <!-- Inner Thin Gold Accent -->
      <path d="M 24 5 L 328 5 L 343 18 L 328 31 L 24 31 L 9 18 Z" fill="none" stroke="#facc15" stroke-width="1.5" opacity="0.6"/>

      <!-- Slogan Text -->
      <text x="176" y="24.5" font-family="system-ui, -apple-system, 'Montserrat', sans-serif" font-size="16" font-weight="900" fill="#fde047" text-anchor="middle" letter-spacing="3.5">
        LEARN  <tspan fill="#f59e0b" font-size="20">•</tspan>  PLAY  <tspan fill="#f59e0b" font-size="20">•</tspan>  DOMINATE
      </text>
    </g>

    <!-- Outer Squircle Metallic Gold / Indigo Border -->
    <rect x="12" y="12" width="488" height="488" rx="108" ry="108" fill="none" stroke="url(#goldLightning)" stroke-width="6" opacity="0.8"/>
  </g>
</svg>
`;

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');

  console.log('Rendering official 512x512 PNG from SVG blueprint using Sharp...');
  const svgBuffer = Buffer.from(SVG_LOGO.trim());

  // 1. Generate 512x512 Master Buffer
  const png512Buffer = await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // 2. Generate 192x192 Buffer from 512x512
  console.log('Downsampling to exact 192x192 PNG...');
  const png192Buffer = await sharp(png512Buffer)
    .resize(192, 192, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // 3. Write to public/
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512Buffer);
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192Buffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), png512Buffer);

  // If dist/ exists, write directly to dist/ as well
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'icon-512.png'), png512Buffer);
    fs.writeFileSync(path.join(distDir, 'icon-192.png'), png192Buffer);
    fs.writeFileSync(path.join(distDir, 'favicon.png'), png512Buffer);
  }

  console.log('✅ Generated public/icon-512.png (512x512):', png512Buffer.length, 'bytes');
  console.log('✅ Generated public/icon-192.png (192x192):', png192Buffer.length, 'bytes');
  console.log('✅ Generated public/favicon.png (512x512):', png512Buffer.length, 'bytes');
}

main().catch(err => {
  console.error('Error generating official icons:', err);
  process.exit(1);
});
