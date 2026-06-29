import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }

  async create(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    senderId?: string;
    senderName?: string;
    personId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        senderId: data.senderId,
        senderName: data.senderName,
        personId: data.personId,
      },
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async clearAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { success: true };
  }

  async broadcast(data: {
    title: string;
    message: string;
    targetRoles?: string[];
    senderId?: string;
    senderName?: string;
  }) {
    const users = await this.prisma.user.findMany();
    const targetUsers = data.targetRoles?.length
      ? users.filter(u => {
          const roles = JSON.parse(u.role || '[]');
          return data.targetRoles!.some(r => roles.includes(r));
        })
      : users;

    await this.prisma.notification.createMany({
      data: targetUsers.map(u => ({
        userId: u.id,
        title: data.title,
        message: data.message,
        type: 'info',
        senderId: data.senderId,
        senderName: data.senderName,
      })),
    });

    return { sentCount: targetUsers.length };
  }

  async registerPushToken(userId: string, token: string, platform: string) {
    const existing = await this.prisma.pushToken.findFirst({
      where: { userId, token },
    });
    if (existing) return { success: true, message: 'Already registered' };
    await this.prisma.pushToken.create({
      data: { userId, token, platform },
    });
    return { success: true };
  }
}
