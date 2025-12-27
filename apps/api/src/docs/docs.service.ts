import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DocsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, title: string, folderId?: string, settings?: any) {
    const whereClause = folderId ? '"folderId" = $2' : '"folderId" IS NULL';
    const params = [userId];
    if (folderId) params.push(folderId);

    const res = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT MAX("sort_order") as max FROM "documents" WHERE "ownerId" = $1 AND ${whereClause} AND "deletedAt" IS NULL`,
      ...params
    );
    const nextOrder = (res[0]?.max || 0) + 1;

    return this.prisma.document.create({
      data: {
        title,
        ownerId: userId,
        content: {}, // Empty TipTap doc
        folderId: folderId || null,
        settings: settings || null,
        sortOrder: nextOrder,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, ownerId: userId },
    });
    if (!doc) throw new NotFoundException();
    return doc;
  }

  async update(userId: string, id: string, content?: any, settings?: any) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.ownerId !== userId) throw new NotFoundException();

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(content !== undefined ? { content } : {}),
        ...(settings !== undefined ? { settings } : {}),
      },
    });
  }

  async list(userId: string, folderId?: string) {
    const where: any = { ownerId: userId };
    if (folderId !== undefined) {
      where.folderId = folderId || null;
    }

    return this.prisma.document.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }
}
