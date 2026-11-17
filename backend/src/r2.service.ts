import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private client: S3Client | null = null;
  public readonly bucketName = process.env.R2_BUCKET_NAME || 'fotos-cancha';
  public readonly publicUrl = (
    process.env.R2_PUBLIC_URL || 'https://pub-7b1a6e96662f43cc89302e1634da8477.r2.dev'
  ).replace(/\/$/, '');

  constructor() {
    const endpoint =
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : '');
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log(`☁️ Cloudflare R2 conectado al bucket "${this.bucketName}"`);
    } else {
      console.warn('⚠️ Credenciales R2 no detectadas.');
    }
  }

  public isEnabled(): boolean {
    return this.client !== null;
  }

  public getPublicUrlForKey(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Generates a Presigned PUT URL so the Next.js admin browser can upload directly to R2
   * without passing image bytes through the NestJS VPS RAM.
   */
  public async getSignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('R2 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Direct buffer upload from NestJS (used as fallback if browser CORS is not enabled on R2 bucket
   * or for db.json backup).
   */
  public async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
    cacheControl = 'public, max-age=31536000, immutable',
  ): Promise<string> {
    if (!this.client) {
      throw new Error('R2 client not initialized');
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  /**
   * Generates a 15-minute (900s) Presigned GET URL for post-payment HD download
   */
  public async getSignedDownloadUrl(
    key: string,
    downloadFilename: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('R2 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  public async getObjectBuffer(key: string): Promise<Buffer | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      if (!res.Body) return null;
      const byteArray = await res.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch {
      return null;
    }
  }

  public async deleteObject(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (e) {
      console.error('Error borrando objeto de R2:', key, e);
    }
  }
}
