import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateAssets() {
  const publicDir = path.resolve(process.cwd(), 'public');

  // 1. Base 512x512 Icon
  const iconBase = sharp(path.join(publicDir, 'icon-512.png'));
  const iconBaseBuffer = await iconBase.toBuffer();

  // Generate 192x192 clean PNG
  await sharp(iconBaseBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-192.png'));

  // Generate 512x512 clean PNG
  await sharp(iconBaseBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-512.png'));

  // Generate favicon.png (512x512 and smaller if needed)
  await sharp(iconBaseBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'favicon.png'));

  // Generate Maskable 512x512 (Safe-zone padded with background)
  // Maskable icons need the core artwork within the center 80% circle (safe zone: 400x400 centered inside 512x512)
  const innerArtwork = await sharp(iconBaseBuffer)
    .resize(410, 410, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    }
  })
  .composite([{ input: innerArtwork, top: 51, left: 51 }])
  .png({ compressionLevel: 9, quality: 100 })
  .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  // Maskable 192x192
  await sharp(path.join(publicDir, 'icon-maskable-512.png'))
    .resize(192, 192)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));

  // 2. Mobile Screenshot: 1080 x 1920 (or resize existing high-res mobile view cleanly)
  // Let's create a crisp, perfectly dimensioned 1080x1920 mobile screenshot
  const existingMobile = sharp(path.join(publicDir, 'screenshot-mobile.png'));
  await existingMobile
    .resize(1080, 1920, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'screenshot-mobile-temp.png'));

  fs.renameSync(
    path.join(publicDir, 'screenshot-mobile-temp.png'),
    path.join(publicDir, 'screenshot-mobile.png')
  );

  // 3. Wide Screenshot: 1920 x 1080 (Landscape for desktop form_factor: wide)
  // Create a stunning wide arena desktop layout screenshot
  const existingWide = sharp(path.join(publicDir, 'screenshot-wide.png'));
  const wideBuffer = await existingWide
    .resize(800, 1000, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .toBuffer();

  // Composite into a clean 1920x1080 desktop canvas with dark theme and subtle arena glow
  const desktopSvg = `
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#020617"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#fbbf24"/>
      </linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#bg)"/>
    
    <!-- Header bar -->
    <rect x="0" y="0" width="1920" height="80" fill="#090d16" opacity="0.9"/>
    <line x1="0" y1="80" x2="1920" y2="80" stroke="#1e293b" stroke-width="2"/>
    
    <!-- Title and Brand -->
    <text x="120" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#fbbf24">⚔️ VOCABCLASH ARENA</text>
    <text x="470" y="50" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="#94a3b8">GOVT EXAM VOCABULARY BATTLEGROUND</text>
    
    <!-- Left Hero Card -->
    <rect x="120" y="140" width="800" height="820" rx="28" fill="#0b1120" stroke="#334155" stroke-width="2"/>
    <text x="170" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff">Real-Time 1v1 English Duels</text>
    <text x="170" y="300" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="500" fill="#cbd5e1">Master 15,000+ High-Frequency Exam PYQs</text>
    <text x="170" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#94a3b8">SSC CGL • CHSL • CPO • CDS • Banking • NDA</text>
    
    <!-- Features Grid -->
    <rect x="170" y="390" width="340" height="140" rx="16" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <text x="200" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#38bdf8">⚡ Instant Matchmaking</text>
    <text x="200" y="480" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#94a3b8">Play against serious aspirants</text>
    
    <rect x="540" y="390" width="340" height="140" rx="16" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <text x="570" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#f59e0b">🎯 20-Round Duels</text>
    <text x="570" y="480" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#94a3b8">Synonyms, Antonyms, Idioms &amp; OWS</text>

    <rect x="170" y="560" width="340" height="140" rx="16" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <text x="200" y="610" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#a855f7">🧠 AI Mnemonics &amp; Roots</text>
    <text x="200" y="650" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#94a3b8">Instant Hindi hooks for every word</text>

    <rect x="540" y="560" width="340" height="140" rx="16" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
    <text x="570" y="610" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#22c55e">🏆 National Leaderboard</text>
    <text x="570" y="650" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#94a3b8">Climb All-India aspirant ranks</text>

    <!-- CTA Button -->
    <rect x="170" y="760" width="710" height="80" rx="20" fill="url(#gold)"/>
    <text x="525" y="810" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" fill="#0f172a">ENTER THE 1V1 ARENA NOW ⚔️</text>
  </svg>
  `;

  const svgBuffer = Buffer.from(desktopSvg);

  await sharp(svgBuffer)
    .composite([{ input: wideBuffer, top: 40, left: 1000 }])
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(path.join(publicDir, 'screenshot-wide.png'));

  console.log('✅ All PWA icons, maskable icons, and desktop/mobile screenshots generated successfully!');
}

generateAssets().catch(err => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
