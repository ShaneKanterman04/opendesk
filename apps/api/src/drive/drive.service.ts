import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DriveService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async listContents(userId: string, folderId?: string) {
    const folders = await this.prisma.folder.findMany({
      where: { ownerId: userId, parentId: folderId || null },
    });
    const files = await this.prisma.file.findMany({
      where: { ownerId: userId, folderId: folderId || null },
    });
    
    // Generate presigned URLs for files
    const filesWithUrls = await Promise.all(files.map(async (file) => ({
      ...file,
      url: await this.storage.getPresignedGetUrl(file.key),
    })));

    // Include documents in the drive listing for the folder
    const docs = await this.prisma.document.findMany({
      where: { ownerId: userId, folderId: folderId || null },
      orderBy: { updatedAt: 'desc' },
    });

    return { folders, files: filesWithUrls, docs };
  }

  async createFolder(userId: string, name: string, parentId?: string) {
    return this.prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        ownerId: userId,
      },
    });
  }

  async initUpload(userId: string, data: { name: string; size: number; mimeType: string; folderId?: string }) {
    const key = `${userId}/${uuidv4()}-${data.name}`;
    const uploadUrl = await this.storage.getPresignedPutUrl(key);

    const file = await this.prisma.file.create({
      data: {
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        key,
        folderId: data.folderId || null,
        ownerId: userId,
      },
    });

    return { file, uploadUrl };
  }

  async uploadFile(userId: string, fileId: string, buffer: Buffer, mimeType?: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== userId) {
      throw new NotFoundException('File not found');
    }

    await this.storage.putObject(file.key, buffer, mimeType);

    return { status: 'ok' };
  }

  async findFileForUser(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== userId) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  async getObjectStreamForUser(userId: string, fileId: string) {
    const file = await this.findFileForUser(userId, fileId);
    return this.storage.getObjectStream(file.key);
  }
}
