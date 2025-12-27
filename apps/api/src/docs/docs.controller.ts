import { Controller, Get, Post, Body, Param, Put, UseGuards, Request, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocsService } from './docs.service';
import { ExportService } from './export.service';
import { DriveService } from '../drive/drive.service';

@Controller('docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(
    private docsService: DocsService,
    private exportService: ExportService,
    private driveService: DriveService,
  ) {}

  @Post(':id/export')
  async export(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { format: 'pdf' | 'docx' | 'md'; destination: 'local' | 'drive'; folderId?: string; html?: string },
    @Res() res: Response,
  ) {
    const doc = await this.docsService.findOne(req.user.userId, id);
    const html = body.html ? body.html : this.exportService.convertJsonToHtml(doc.content);
    
    let buffer: Buffer;
    let mimeType: string;
    let extension: string;

    switch (body.format) {
      case 'pdf':
        buffer = await this.exportService.exportToPdf(html);
        mimeType = 'application/pdf';
        extension = 'pdf';
        break;
      case 'docx':
        buffer = await this.exportService.exportToDocx(html);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extension = 'docx';
        break;
      case 'md':
        buffer = await this.exportService.exportToMd(html);
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      default:
        throw new Error('Invalid format');
    }

    if (body.destination === 'drive') {
      const filename = `${doc.title}.${extension}`;
      const fileEntry = await this.driveService.initUpload(req.user.userId, {
        name: filename,
        size: buffer.length,
        mimeType,
        folderId: body.folderId,
      });

      await this.driveService.uploadFile(req.user.userId, fileEntry.file.id, buffer, mimeType);
      
      res.json({ status: 'ok', fileId: fileEntry.file.id });
    } else {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.title}.${extension}"`);
      res.setHeader('Content-Length', buffer.length.toString());
      res.send(buffer);
    }
  }

  @Post()
  async create(
    @Request() req,
    @Body() body: { title: string; folderId?: string; settings?: any },
  ) {
    return this.docsService.create(req.user.userId, body.title, body.folderId, body.settings);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.docsService.findOne(req.user.userId, id);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { content?: any; settings?: any },
  ) {
    return this.docsService.update(req.user.userId, id, body.content, body.settings);
  }

  @Get()
  async list(@Request() req, @Query('folderId') folderId?: string) {
    return this.docsService.list(req.user.userId, folderId);
  }
}
