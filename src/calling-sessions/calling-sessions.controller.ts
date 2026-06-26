import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { CallingSessionsService } from './calling-sessions.service';

@Controller('calling-sessions')
export class CallingSessionsController {
  constructor(private readonly sessionsService: CallingSessionsService) {}

  @Get()
  async findAll(@Query('scope') scope?: string, @Query('userId') userId?: string) {
    return this.sessionsService.findAll(scope, userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Post()
  async create(@Body() data: any) {
    return this.sessionsService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.sessionsService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sessionsService.remove(id);
  }

  @Get('by-person/:personId')
  async getByPerson(@Param('personId') personId: string) {
    return this.sessionsService.getSessionsForPerson(personId);
  }
}
