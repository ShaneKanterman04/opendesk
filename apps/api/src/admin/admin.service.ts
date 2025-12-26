import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsersStats() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        _count: { select: { documents: true, files: true } },
      },
      orderBy: { email: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      totalDocuments: u._count.documents,
      totalFiles: u._count.files,
    }));
  }

  async ensureIsAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!user || !user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
