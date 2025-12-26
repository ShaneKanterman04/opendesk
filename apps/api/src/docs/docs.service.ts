import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DocsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, title: string, folderId?: string, settings?: any) {
    return this.prisma.document.create({
      data: {
        title,
        ownerId: userId,
        content: {}, // Empty TipTap doc
        folderId: folderId || null,
        settings: settings || null,
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
      orderBy: { updatedAt: 'desc' },
    });
  }
}
