import { Controller, Get, Post, Body, Param, Put, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocsService } from './docs.service';

@Controller('docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private docsService: DocsService) {}

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
