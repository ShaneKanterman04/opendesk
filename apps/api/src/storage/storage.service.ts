import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucketName = 'opendesk-files';

  constructor(private configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = Number(this.configService.get<number>('MINIO_PORT') || 9000);
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin';
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true' ? true : false;

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    // Optional signing-only client that uses the public endpoint (used to generate presigned URLs
    // that are valid from outside the docker network). We don't call network operations on this
    // client during module init so it doesn't need to resolve the host at startup.
    const publicEndpoint = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT');
    if (publicEndpoint) {
      try {
        const parsed = new URL(publicEndpoint);
        const publicHost = parsed.hostname;
        const publicPort = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
        const publicUseSSL = parsed.protocol === 'https:';
        this.signingClient = new Minio.Client({
          endPoint: publicHost,
          port: publicPort,
          useSSL: publicUseSSL,
          accessKey,
          secretKey,
        });
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  private signingClient?: Minio.Client;

  async onModuleInit() {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
    }
  }

  async getPresignedPutUrl(objectName: string): Promise<string> {
    try {
      const client = (this as any).signingClient || this.minioClient;
      return await client.presignedPutObject(this.bucketName, objectName, 24 * 60 * 60);
    } catch (e) {
      // Fallback to internal client if signing client fails for any reason
      try {
        // eslint-disable-next-line no-console
        console.warn('Signing client presign failed, falling back to internal minio client:', e);
        return await this.minioClient.presignedPutObject(this.bucketName, objectName, 24 * 60 * 60);
      } catch (err) {
        throw err;
      }
    }
  }

  async getPresignedGetUrl(objectName: string): Promise<string> {
    try {
      const client = (this as any).signingClient || this.minioClient;
      return await client.presignedGetObject(this.bucketName, objectName, 24 * 60 * 60);
    } catch (e) {
      // Fallback
      return await this.minioClient.presignedGetObject(this.bucketName, objectName, 24 * 60 * 60);
    }
  }

  async putObject(objectName: string, body: any, contentType?: string) {
    const meta = contentType ? { 'Content-Type': contentType } : undefined;
    // Use a dynamic call to avoid strict Node types mismatch between Readable and ReadableStream
    const size = Buffer.isBuffer(body) ? body.length : undefined;
    await (this.minioClient as any).putObject(this.bucketName, objectName, body, size, meta);
  }

  async getObjectStream(objectName: string) {
    return await (this.minioClient as any).getObject(this.bucketName, objectName);
  }
}
