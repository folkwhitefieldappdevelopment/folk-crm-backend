import { Controller, Post, Get, Query, Body } from '@nestjs/common';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post()
  async create(@Body() data: { to: string[]; subject: string; html: string }) {
    return this.mailService.create(data);
  }

  @Get()
  async findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.mailService.findAll(
      skip ? parseInt(skip) : 0,
      take ? parseInt(take) : 50,
    );
  }
}
