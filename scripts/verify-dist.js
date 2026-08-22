import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const distDir = path.join(process.cwd(), 'dist');
const filesToTest = [
  { file: 'icon-192.png', expectedW: 192, expectedH: 192 },
  { file: 'icon-512.png', expectedW: 512, expectedH: 512 },
  { file: 'favicon.png', expectedW: 512, expectedH: 512 },
  { file: 'screenshot-mobile.png', expectedW: 512, expectedH: 512 },
  { file: 'screenshot-wide.png', expectedW: 1024, expectedH: 512 },
];

console.log('--- Verifying dist/ static assets ---');
for (const item of filesToTest) {
  const filePath = path.join(distDir, item.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing in dist/: ${item.file}`);
    process.exit(1);
  }
  const buffer = fs.readFileSync(filePath);
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (!isPng) {
    console.error(`❌ dist/${item.file} is NOT a valid PNG!`);
    process.exit(1);
  }
  const parsed = PNG.sync.read(buffer);
  if (parsed.width !== item.expectedW || parsed.height !== item.expectedH) {
    console.error(`❌ dist/${item.file} dimension mismatch!`);
    process.exit(1);
  }
  console.log(`✅ dist/${item.file}: Valid binary PNG (${parsed.width}x${parsed.height}), ${buffer.length} bytes`);
}

// Verify manifest.json in dist
const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf-8'));
console.log(`✅ dist/manifest.json: Valid JSON (name: "${manifest.name}", icons: ${manifest.icons.length})`);
