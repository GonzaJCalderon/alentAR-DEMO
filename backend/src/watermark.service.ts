import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

// Strict memory limits for 1 GB RAM VPS
sharp.concurrency(1);
sharp.cache(false);

@Injectable()
export class WatermarkService {
  /**
   * Generates a lightweight WebP thumbnail (max 1000px) in memory with strict RAM limits
   * and a burned-in repeating diagonal watermark.
   */
  async createWatermarkedThumbnailBuffer(
    originalBuffer: Buffer,
    photoCode: string,
  ): Promise<{ thumbBuffer: Buffer; width: number; height: number }> {
    const image = sharp(originalBuffer).rotate();
    const metadata = await image.metadata();

    const origWidth = metadata.width || 1200;
    const origHeight = metadata.height || 900;

    const MAX_DIM = 1000;
    let width = origWidth;
    let height = origHeight;

    if (width > height && width > MAX_DIM) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else if (height >= width && height > MAX_DIM) {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }

    const svgOverlay = this.buildWatermarkSvg(width, height, photoCode);

    const thumbBuffer = await image
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .webp({ quality: 78 })
      .toBuffer();

    return { thumbBuffer, width, height };
  }

  private buildWatermarkSvg(width: number, height: number, photoCode: string): string {
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wm" width="260" height="160" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
            <text x="15" y="65" font-family="Arial, sans-serif" font-weight="900" font-size="24" fill="rgba(255, 255, 255, 0.34)" stroke="rgba(0,0,0,0.45)" stroke-width="1">
              ALENTAR
            </text>
            <text x="15" y="95" font-family="Arial, sans-serif" font-weight="700" font-size="14" fill="rgba(255, 191, 0, 0.38)" stroke="rgba(0,0,0,0.4)" stroke-width="0.6">
              #${photoCode} • MUESTRA
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm)" />
        <rect x="${Math.max(8, width - 135)}" y="${Math.max(8, height - 38)}" width="125" height="28" rx="6" fill="rgba(0,0,0,0.72)" />
        <text x="${Math.max(20, width - 72)}" y="${Math.max(26, height - 19)}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="#ffbf00">
          FOTO #${photoCode}
        </text>
      </svg>
    `;
  }
}
