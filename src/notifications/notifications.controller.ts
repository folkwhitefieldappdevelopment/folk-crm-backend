import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.notificationsService.findByUser(userId);
  }

  @Post()
  async create(@Body() data: any) {
    return this.notificationsService.create(data);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete('user/:userId')
  async clearAll(@Param('userId') userId: string) {
    return this.notificationsService.clearAll(userId);
  }

  @Post('broadcast')
  async broadcast(@Body() data: any) {
    return this.notificationsService.broadcast(data);
  }

  @Post('register')
  async registerPushToken(@Body() data: { userId: string; token: string; platform?: string }) {
    return this.notificationsService.registerPushToken(data.userId, data.token, data.platform || 'expo');
  }
}
