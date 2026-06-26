import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { AuditsService } from './audits.service';

@Controller('audits')
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  async findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.auditsService.findAll(skip ? parseInt(skip) : 0, take ? parseInt(take) : 100);
  }

  @Post()
  async create(@Body() data: { userId?: string; userName?: string; action: string; details?: string }) {
    return this.auditsService.create(data);
  }
}
