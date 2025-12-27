import { Controller, Get, Post, Delete, Put, Body, UseGuards, Request, Query, Param, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriveService } from './drive.service';

@Controller('drive')
@UseGuards(JwtAuthGuard)
export class DriveController {
  constructor(private driveService: DriveService) {}

  @Get('list')
  async list(@Request() req, @Query('folderId') folderId?: string) {
    return this.driveService.listContents(req.user.userId, folderId);
  }

  @Get('debug')
  async debug(@Request() req) {
    return this.driveService.debugQuery();
  }

  @Post('folders')
  async createFolder(@Request() req, @Body() body: { name: string; parentId?: string }) {
    return this.driveService.createFolder(req.user.userId, body.name, body.parentId);
  }

  @Post('upload/init')
  async initUpload(@Request() req, @Body() body: { name: string; size: number; mimeType: string; folderId?: string }) {
    return this.driveService.initUpload(req.user.userId, body);
  }

  @Post('upload/finalize')
  async finalizeUpload(@Request() req, @Body() body: { fileId: string }) {
    // In a real app, verify MinIO object exists
    return { status: 'ok' };
  }

  @Post('item/move')
  async moveItem(@Request() req, @Body() body: { itemType: 'file' | 'doc'; itemId: string; folderId?: string }) {
    return this.driveService.moveItem(req.user.userId, body.itemType, body.itemId, body.folderId || null);
  }

  @Post('item/reorder')
  async reorderItems(@Request() req, @Body() body: { itemType: 'file' | 'doc'; folderId?: string; orderedIds: string[] }) {
    return this.driveService.reorderItems(req.user.userId, body.itemType, body.folderId || null, body.orderedIds || []);
  }

  @Post('upload/:fileId')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadFile(@Request() req, @Param('fileId') fileId: string, @UploadedFile() file: any) {
    const buffer = file.buffer || (file.path ? require('fs').readFileSync(file.path) : Buffer.alloc(0));
    return this.driveService.uploadFile(req.user.userId, fileId, buffer, file.mimetype);
  }

  @Get('file/:fileId')
  async downloadFile(@Request() req, @Param('fileId') fileId: string, @Res() res: Response) {
    const file = await this.driveService.findFileForUser(req.user.userId, fileId);
    const stream = await this.driveService.getObjectStreamForUser(req.user.userId, fileId);

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', file.size.toString());
    stream.pipe(res);
  }

  @Delete('file/:fileId')
  async deleteFile(@Request() req, @Param('fileId') fileId: string) {
    return this.driveService.deleteFile(req.user.userId, fileId);
  }

  @Put('file/:fileId')
  async renameFile(@Request() req, @Param('fileId') fileId: string, @Body() body: { name: string }) {
    return this.driveService.renameFile(req.user.userId, fileId, body.name);
  }

  @Delete('folder/:folderId')
  async deleteFolder(@Request() req, @Param('folderId') folderId: string) {
    return this.driveService.deleteFolder(req.user.userId, folderId);
  }

  @Put('folder/:folderId')
  async renameFolder(@Request() req, @Param('folderId') folderId: string, @Body() body: { name: string }) {
    return this.driveService.renameFolder(req.user.userId, folderId, body.name);
  }
}
