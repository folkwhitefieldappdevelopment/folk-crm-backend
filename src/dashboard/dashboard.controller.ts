import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('targetFolkGuideId') targetFolkGuideId?: string,
  ) {
    return this.dashboardService.getStats({ userId, from, to, targetFolkGuideId });
  }
}
