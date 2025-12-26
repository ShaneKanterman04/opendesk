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
  }

  async onModuleInit() {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
    }
  }

  async getPresignedPutUrl(objectName: string): Promise<string> {
    let url: string;
    try {
      // Always use the internal minioClient for generating presigned URLs
      // since signingClient can fail when trying to connect from inside container
      url = await this.minioClient.presignedPutObject(this.bucketName, objectName, 24 * 60 * 60);
    } catch (err) {
      throw err;
    }

    // Rewrite the URL to use the public endpoint if configured
    const publicEndpoint = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT');
    if (publicEndpoint && publicEndpoint !== 'http://minio:9000' && publicEndpoint !== 'http://minio:9000/') {
      try {
        const publicUrl = new URL(publicEndpoint);
        const currentUrl = new URL(url);
        // Replace the hostname and port with the public endpoint
        currentUrl.hostname = publicUrl.hostname;
        currentUrl.port = publicUrl.port;
        currentUrl.protocol = publicUrl.protocol.replace(':', '');
        return currentUrl.toString();
      } catch (e) {
        // If rewriting fails, return the original URL
        return url;
      }
    }

    return url;
  }

  async getPresignedGetUrl(objectName: string): Promise<string> {
    let url: string;
    try {
      // Always use the internal minioClient for generating presigned URLs
      url = await this.minioClient.presignedGetObject(this.bucketName, objectName, 24 * 60 * 60);
    } catch (err) {
      throw err;
    }

    // Rewrite the URL to use the public endpoint if configured
    const publicEndpoint = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT');
    if (publicEndpoint && publicEndpoint !== 'http://minio:9000' && publicEndpoint !== 'http://minio:9000/') {
      try {
        const publicUrl = new URL(publicEndpoint);
        const currentUrl = new URL(url);
        // Replace the hostname and port with the public endpoint
        currentUrl.hostname = publicUrl.hostname;
        currentUrl.port = publicUrl.port;
        currentUrl.protocol = publicUrl.protocol.replace(':', '');
        return currentUrl.toString();
      } catch (e) {
        // If rewriting fails, return the original URL
        return url;
      }
    }

    return url;
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
