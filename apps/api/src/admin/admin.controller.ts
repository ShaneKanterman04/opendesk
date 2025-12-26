import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @UseGuards(JwtAuthGuard)
  @Get('users/stats')
  async usersStats(@Req() req: any) {
    const userId = req.user?.userId;
    await this.adminService.ensureIsAdmin(userId);
    return this.adminService.getUsersStats();
  }
}
