import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AdminService, PrismaService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
