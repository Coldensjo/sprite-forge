import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toIco from 'to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconDir = join(__dirname, '../src-tauri/icons');

const createIcon = async (size, filename) => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#6366f1"/>
      <text x="50%" y="50%" font-family="Arial" font-size="${size * 0.4}" fill="white" text-anchor="middle" dominant-baseline="middle">SF</text>
    </svg>
  `;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(iconDir, filename));
};

const generateIcons = async () => {
  await createIcon(32, '32x32.png');
  await createIcon(128, '128x128.png');
  await createIcon(256, '128x128@2x.png');
  
  const png16 = await sharp(join(iconDir, '128x128.png'))
    .resize(16, 16)
    .png()
    .toBuffer();
  
  const png32 = await sharp(join(iconDir, '128x128.png'))
    .resize(32, 32)
    .png()
    .toBuffer();
  
  const png48 = await sharp(join(iconDir, '128x128.png'))
    .resize(48, 48)
    .png()
    .toBuffer();
  
  const png256 = await sharp(join(iconDir, '128x128.png'))
    .resize(256, 256)
    .png()
    .toBuffer();
  
  const icoBuffer = await toIco([png16, png32, png48, png256]);
  writeFileSync(join(iconDir, 'icon.ico'), icoBuffer);
  
  const icnsBuffer = await sharp(join(iconDir, '128x128.png'))
    .resize(512, 512)
    .png()
    .toBuffer();
  writeFileSync(join(iconDir, 'icon.icns'), icnsBuffer);
  
  console.log('Icons generated successfully!');
};

generateIcons().catch(console.error);

