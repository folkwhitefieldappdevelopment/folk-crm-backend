import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('group/:groupId')
  async getGroupEvents(@Param('groupId') groupId: string) {
    return this.eventsService.getGroupEvents(groupId);
  }

  @Post('group/:groupId')
  async createEvent(@Param('groupId') groupId: string, @Body() data: { name: string; date: string; linkInfo?: any }) {
    return this.eventsService.createEvent(groupId, data);
  }

  @Post('attendance')
  async markAttendance(@Body() data: { personId: string; groupId: string; eventId?: string; date?: string }) {
    return this.eventsService.markAttendance(data.personId, data.groupId, data.eventId, data.date);
  }

  @Delete('attendance')
  async removeAttendance(@Body() data: { personId: string; groupId: string; eventId: string }) {
    return this.eventsService.removeAttendance(data.personId, data.groupId, data.eventId);
  }
}
