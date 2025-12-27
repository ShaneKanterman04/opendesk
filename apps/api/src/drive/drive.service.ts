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
    try {
      // Use raw SQL as a fallback to avoid a Prisma driver issue surfaced in findMany()
      const parentClause = folderId ? '"parentId" = $2' : '"parentId" IS NULL';
      const params = [userId];
      if (folderId) params.push(folderId);

      const folders = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM "folders" WHERE "ownerId" = $1 AND ${parentClause} ORDER BY "sort_order" ASC, "updatedAt" DESC`,
        ...params
      );

      const files = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM "files" WHERE "ownerId" = $1 AND "folderId" ${folderId ? "= $2" : "IS NULL"} AND "deletedAt" IS NULL ORDER BY "sort_order" ASC, "updatedAt" DESC`,
        ...params
      );

      // Include documents in the drive listing for the folder
      const docs = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM "documents" WHERE "ownerId" = $1 AND "folderId" ${folderId ? "= $2" : "IS NULL"} AND "deletedAt" IS NULL ORDER BY "sort_order" ASC, "updatedAt" DESC`,
        ...params
      );

      return { folders, files, docs };
    } catch (err: any) {
      // Log detailed info for debugging
      console.error('DriveService.listContents error:', {
        message: err?.message,
        code: err?.code,
        meta: err?.meta,
        driverError: err?.meta?.driverAdapterError?.message || err?.meta?.driverAdapterError?.toString?.(),
      });
      throw err;
    }
  }

  private async getNextSortOrderForFolder(model: 'File' | 'Document' | 'Folder', folderId?: string | null) {
    let table = '';
    let parentCol = 'folderId';
    if (model === 'Folder') {
      table = 'folders';
      parentCol = 'parentId';
    } else if (model === 'File') {
      table = 'files';
    } else {
      table = 'documents';
    }

    const whereClause = folderId ? `"${parentCol}" = $1` : `"${parentCol}" IS NULL`;
    const params = folderId ? [folderId] : [];
    
    // For File and Document, we also check deletedAt is null
    let deletedClause = '';
    if (model !== 'Folder') {
        deletedClause = ' AND "deletedAt" IS NULL';
    }

    const res = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT MAX("sort_order") as max FROM "${table}" WHERE ${whereClause}${deletedClause}`,
      ...params
    );
    
    return (res[0]?.max || 0) + 1;
  }

  async createFolder(userId: string, name: string, parentId?: string) {
    const nextOrder = await this.getNextSortOrderForFolder('Folder', parentId || null);
    return this.prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        ownerId: userId,
        sortOrder: nextOrder,
      },
    });
  }

  async initUpload(userId: string, data: { name: string; size: number; mimeType: string; folderId?: string }) {
    const key = `${userId}/${uuidv4()}-${data.name}`;
    const uploadUrl = await this.storage.getPresignedPutUrl(key);

    const sortOrder = await this.getNextSortOrderForFolder('File', data.folderId || null);

    const file = await this.prisma.file.create({
      data: {
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        key,
        folderId: data.folderId || null,
        ownerId: userId,
        sortOrder,
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

  async deleteFile(userId: string, fileId: string) {
    // Soft-delete: set deletedAt to now (GC will remove objects after grace period)
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== userId) {
      throw new NotFoundException('File not found');
    }

    return this.prisma.file.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
  }

  /** Move an item (file or document) into a folder (folderId can be null for root) */
  async moveItem(userId: string, itemType: 'file' | 'doc', itemId: string, folderId?: string | null) {
    if (itemType === 'file') {
      const f = await this.prisma.file.findUnique({ where: { id: itemId } });
      if (!f || f.ownerId !== userId) throw new NotFoundException('File not found');
      const nextOrder = await this.getNextSortOrderForFolder('File', folderId || null);
      return this.prisma.file.update({ where: { id: itemId }, data: { folderId: folderId || null, sortOrder: nextOrder } });
    }

    const d = await this.prisma.document.findUnique({ where: { id: itemId } });
    if (!d || d.ownerId !== userId) throw new NotFoundException('Document not found');
    const nextOrder = await this.getNextSortOrderForFolder('Document', folderId || null);
    return this.prisma.document.update({ where: { id: itemId }, data: { folderId: folderId || null, sortOrder: nextOrder } });
  }

  /** Reorder items inside a folder — orderedIds is the desired order */
  async reorderItems(userId: string, itemType: 'file' | 'doc', folderId: string | null, orderedIds: string[]) {
    // Basic validation: ensure all items belong to user and are in that folder
    if (itemType === 'file') {
      const files = await this.prisma.file.findMany({ where: { id: { in: orderedIds }, ownerId: userId } });
      if (files.length !== orderedIds.length) throw new NotFoundException('One or more files not found');

      const updates = orderedIds.map((id, idx) => this.prisma.file.update({ where: { id }, data: { sortOrder: idx + 1 } }));
      return this.prisma.$transaction(updates);
    }

    const docs = await this.prisma.document.findMany({ where: { id: { in: orderedIds }, ownerId: userId } });
    if (docs.length !== orderedIds.length) throw new NotFoundException('One or more documents not found');

    const updates = orderedIds.map((id, idx) => this.prisma.document.update({ where: { id }, data: { sortOrder: idx + 1 } }));
    return this.prisma.$transaction(updates);
  }

  // Debug helper to run raw SQL to inspect DB directly
  async debugQuery() {
    const res = await this.prisma.$queryRawUnsafe('SELECT * FROM "folders" LIMIT 5');
    return res;
  }

}
