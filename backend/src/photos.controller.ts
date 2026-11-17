import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { R2Service } from './r2.service';
import { PhotoItem, StorageService } from './storage.service';
import { WatermarkService } from './watermark.service';

@Controller('api/photos')
export class PhotosController {
  constructor(
    private readonly storage: StorageService,
    private readonly watermark: WatermarkService,
    private readonly r2: R2Service,
  ) {}

  @Get()
  listPhotos(
    @Query('eventId') eventId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '36',
    @Query('includeDescriptors') includeDescriptors?: string,
  ) {
    let list = this.storage.getData().photos;

    if (eventId) {
      list = list.filter((p) => p.eventId === eventId);
    }
    if (category && category !== 'Todas') {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase().replace(/^#/, '');
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.originalFilename.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    const sorted = [...list].reverse();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(60, Math.max(1, parseInt(limit, 10) || 36));
    const start = (pageNum - 1) * limitNum;
    const items = sorted.slice(start, start + limitNum);

    return {
      total: sorted.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(sorted.length / limitNum) || 1,
      items: items.map((p) => ({
        id: p.id,
        code: p.code,
        eventId: p.eventId,
        category: p.category,
        width: p.width,
        height: p.height,
        thumbUrl: p.thumbUrl,
        ...(includeDescriptors === '1' ? { faceDescriptors: p.faceDescriptors || [] } : {}),
        createdAt: p.createdAt,
      })),
    };
  }

  @Get('thumb/:id')
  async serveThumbnail(@Param('id') id: string, @Res() res: Response) {
    const photo = this.storage.getData().photos.find((p) => p.id === id);
    if (!photo || !photo.thumbUrl) {
      throw new NotFoundException('Foto no encontrada');
    }
    return res.redirect(301, photo.thumbUrl);
  }

  /**
   * 1. Zero-RAM Presigned PUT Flow:
   * Returns 2 Presigned PUT URLs (public/thumbs/... and private/hd/...) so the Next.js browser
   * uploads both <canvas>-processed blobs directly to Cloudflare R2 without touching NestJS RAM.
   */
  @Post('presign/:eventId')
  async createPresignedUploadUrls(
    @Param('eventId') eventId: string,
    @Body() body: { filename: string; category?: string },
  ) {
    if (!this.r2.isEnabled()) {
      throw new BadRequestException('Cloudflare R2 no está configurado en el servidor');
    }

    const db = this.storage.getData();
    const existingCount = db.photos.filter((p) => p.eventId === eventId).length;
    const id = uuidv4();
    const secretOrigUuid = `${uuidv4()}-${uuidv4()}`;
    const code = String(existingCount + 1).padStart(4, '0');

    const thumbKey = `public/thumbs/${eventId}/thumb-${id}.webp`;
    const hdKey = `private/hd/${eventId}/orig-${secretOrigUuid}.jpg`;

    const [thumbPutUrl, hdPutUrl] = await Promise.all([
      this.r2.getSignedPutUrl(thumbKey, 'image/webp', 900),
      this.r2.getSignedPutUrl(hdKey, 'image/jpeg', 900),
    ]);

    return {
      id,
      code,
      eventId,
      category: body.category || 'Festejos',
      originalFilename: body.filename || `foto-${code}.jpg`,
      thumbKey,
      hdKey,
      thumbPutUrl,
      hdPutUrl,
      thumbPublicUrl: this.r2.getPublicUrlForKey(thumbKey),
    };
  }

  /**
   * 2. Confirms direct browser -> R2 upload and stores metadata in db.json
   */
  @Post('confirm/:eventId')
  async confirmDirectUpload(
    @Param('eventId') eventId: string,
    @Body()
    body: {
      id: string;
      code: string;
      category: string;
      originalFilename: string;
      thumbKey: string;
      hdKey: string;
      width: number;
      height: number;
    },
  ) {
    const db = this.storage.getData();
    const thumbUrl = this.r2.getPublicUrlForKey(body.thumbKey);

    const photoItem: PhotoItem = {
      id: body.id,
      code: body.code,
      eventId,
      category: body.category || 'Festejos',
      originalFilename: body.originalFilename,
      hdFile: body.hdKey,
      thumbFile: body.thumbKey,
      thumbUrl,
      storageProvider: 'r2',
      width: Number(body.width) || 1000,
      height: Number(body.height) || 1000,
      createdAt: new Date().toISOString(),
    };

    db.photos.push(photoItem);
    this.storage.save();

    return {
      confirmed: true,
      photo: {
        id: photoItem.id,
        code: photoItem.code,
        eventId: photoItem.eventId,
        category: photoItem.category,
        thumbUrl: photoItem.thumbUrl,
      },
    };
  }

  /**
   * 3. Low-RAM Fallback Upload (max 2 photos per batch):
   * Used if R2 bucket CORS is not enabled yet for direct browser PUT, or when uploading via API.
   * Uses sharp.concurrency(1) and sharp.cache(false) and uploads directly to R2 (`public/thumbs/...` & `private/hd/...`).
   */
  @Post('upload/:eventId')
  @UseInterceptors(
    FilesInterceptor('photos', 4, {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadBatch(
    @Param('eventId') eventId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('category') category = 'Festejos',
  ) {
    if (!files || files.length === 0) {
      return { uploaded: [] };
    }
    if (!this.r2.isEnabled()) {
      throw new BadRequestException('Cloudflare R2 no está configurado.');
    }

    const db = this.storage.getData();
    const existingCount = db.photos.filter((p) => p.eventId === eventId).length;
    const created: PhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = uuidv4();
      const secretOrigUuid = `${uuidv4()}-${uuidv4()}`;
      const seqNum = existingCount + i + 1;
      const code = String(seqNum).padStart(4, '0');

      const { thumbBuffer, width, height } =
        await this.watermark.createWatermarkedThumbnailBuffer(file.buffer, code);

      const thumbFileKey = `public/thumbs/${eventId}/thumb-${id}.webp`;
      const hdFileKey = `private/hd/${eventId}/orig-${secretOrigUuid}.jpg`;

      const [, publicThumbUrl] = await Promise.all([
        this.r2.uploadBuffer(hdFileKey, file.buffer, 'image/jpeg', 'private, max-age=31536000'),
        this.r2.uploadBuffer(
          thumbFileKey,
          thumbBuffer,
          'image/webp',
          'public, max-age=31536000, immutable',
        ),
      ]);

      const photoItem: PhotoItem = {
        id,
        code,
        eventId,
        category: category || 'Festejos',
        originalFilename: file.originalname,
        hdFile: hdFileKey,
        thumbFile: thumbFileKey,
        thumbUrl: publicThumbUrl,
        storageProvider: 'r2',
        width,
        height,
        createdAt: new Date().toISOString(),
      };

      db.photos.push(photoItem);
      created.push(photoItem);
    }

    this.storage.save();

    return {
      uploadedCount: created.length,
      uploaded: created.map((p) => ({
        id: p.id,
        code: p.code,
        eventId: p.eventId,
        category: p.category,
        thumbUrl: p.thumbUrl,
      })),
    };
  }

  @Delete(':id')
  async deletePhoto(@Param('id') id: string) {
    const db = this.storage.getData();
    const idx = db.photos.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new NotFoundException('Foto no encontrada');
    }
    const [removed] = db.photos.splice(idx, 1);
    this.storage.save();

    if (this.r2.isEnabled()) {
      await Promise.all([
        this.r2.deleteObject(removed.hdFile),
        this.r2.deleteObject(removed.thumbFile),
      ]);
    }

    return { deleted: true, id };
  }
}
