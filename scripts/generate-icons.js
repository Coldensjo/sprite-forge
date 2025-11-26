import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import toIco from 'to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconDir = join(__dirname, '../src-tauri/icons');
const sourceImage = join(__dirname, '../public/sprite-forge.png');

const generateIcons = async () => {
  await sharp(sourceImage)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(iconDir, '32x32.png'));
  
  await sharp(sourceImage)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(iconDir, '128x128.png'));
  
  await sharp(sourceImage)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(iconDir, '128x128@2x.png'));
  
  const png16 = await sharp(sourceImage)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  const png32 = await sharp(sourceImage)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  const png48 = await sharp(sourceImage)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  const png256 = await sharp(sourceImage)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  const icoBuffer = await toIco([png16, png32, png48, png256]);
  writeFileSync(join(iconDir, 'icon.ico'), icoBuffer);
  
  const icnsBuffer = await sharp(sourceImage)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(join(iconDir, 'icon.icns'), icnsBuffer);
  
  console.log('Icons generated successfully!');
};

generateIcons().catch(console.error);

