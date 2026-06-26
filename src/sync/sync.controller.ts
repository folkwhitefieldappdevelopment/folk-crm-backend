import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  async processBatch(@Body() body: any) {
    return this.syncService.processBatch(body);
  }

  @Get('status')
  async getStatus() {
    return this.syncService.getStatus();
  }
}
