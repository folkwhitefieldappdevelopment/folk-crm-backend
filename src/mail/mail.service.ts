import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService {
  constructor(private prisma: PrismaService) {}

  async create(data: { to: string[]; subject: string; html: string }) {
    return this.prisma.mail.create({
      data: {
        to: JSON.stringify(data.to),
        subject: data.subject,
        html: data.html,
      },
    });
  }

  async findAll(skip = 0, take = 50) {
    const items = await this.prisma.mail.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return items.map(item => ({
      ...item,
      to: JSON.parse(item.to),
    }));
  }
}
