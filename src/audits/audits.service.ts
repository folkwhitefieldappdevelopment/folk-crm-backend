import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditsService {
  constructor(private prisma: PrismaService) {}

  async findAll(skip = 0, take = 100) {
    return this.prisma.audit.findMany({
      orderBy: { timestamp: 'desc' },
      skip,
      take,
    });
  }

  async create(data: { userId?: string; userName?: string; action: string; details?: string }) {
    return this.prisma.audit.create({
      data: {
        userId: data.userId || 'system',
        userName: data.userName || 'System',
        action: data.action,
        details: data.details || '',
      },
    });
  }
}
