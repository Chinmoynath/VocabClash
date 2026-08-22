import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const publicDir = path.join(process.cwd(), 'public');
const filesToTest = [
  { file: 'icon-192.png', expectedW: 192, expectedH: 192 },
  { file: 'icon-512.png', expectedW: 512, expectedH: 512 },
  { file: 'favicon.png', expectedW: 512, expectedH: 512 },
  { file: 'screenshot-mobile.png', expectedW: 512, expectedH: 512 },
  { file: 'screenshot-wide.png', expectedW: 1024, expectedH: 512 },
];

let allPassed = true;

for (const item of filesToTest) {
  const filePath = path.join(publicDir, item.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing: ${item.file}`);
    allPassed = false;
    continue;
  }
  const buffer = fs.readFileSync(filePath);
  
  // Check PNG Magic Bytes (89 50 4E 47 0D 0A 1A 0A)
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
                buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
  
  if (!isPng) {
    console.error(`❌ ${item.file} is NOT a valid PNG binary file!`);
    allPassed = false;
    continue;
  }

  try {
    const parsed = PNG.sync.read(buffer);
    if (parsed.width !== item.expectedW || parsed.height !== item.expectedH) {
      console.error(`❌ ${item.file} size mismatch: got ${parsed.width}x${parsed.height}, expected ${item.expectedW}x${item.expectedH}`);
      allPassed = false;
    } else {
      console.log(`✅ ${item.file}: Valid PNG (${parsed.width}x${parsed.height}), ${buffer.length} bytes`);
    }
  } catch (err) {
    console.error(`❌ Failed to decode ${item.file}:`, err);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n🎉 ALL PNG ASSETS ARE 100% VALID AND DECODABLE!');
} else {
  process.exit(1);
}
