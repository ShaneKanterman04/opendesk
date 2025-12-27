import { Module } from '@nestjs/common';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { ExportService } from './export.service';
import { PrismaService } from '../prisma.service';
import { DriveModule } from '../drive/drive.module';

@Module({
  imports: [DriveModule],
  controllers: [DocsController],
  providers: [DocsService, ExportService, PrismaService],
})
export class DocsModule {}
