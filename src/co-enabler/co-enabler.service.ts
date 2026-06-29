import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoEnablerService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.coEnablerSession.findMany({
      orderBy: { expiresAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.coEnablerSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('Co-enabler session not found');
    return session;
  }

  async create(data: {
    name: string;
    task: string;
    type: string;
    expiresAt: string;
    creatorId?: string;
    creatorName?: string;
    peopleIds?: string[];
  }) {
    return this.prisma.coEnablerSession.create({
      data: {
        name: data.name,
        task: data.task || '',
        type: data.type || 'external',
        expiresAt: new Date(data.expiresAt),
        creatorId: data.creatorId,
        creatorName: data.creatorName || '',
        peopleIds: JSON.stringify(data.peopleIds || []),
      },
    });
  }

  async update(id: string, data: { task?: string; type?: string; expiresAt?: string; peopleIds?: string[] }) {
    const updateData: any = {};
    if (data.task !== undefined) updateData.task = data.task;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);
    if (data.peopleIds !== undefined) updateData.peopleIds = JSON.stringify(data.peopleIds);
    return this.prisma.coEnablerSession.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    await this.prisma.coEnablerSession.delete({ where: { id } });
    return { success: true };
  }
}
