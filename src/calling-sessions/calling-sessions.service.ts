import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallingSessionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(scope?: string, userId?: string) {
    const where: any = {};
    if (scope === 'mine' && userId) {
      where.createdBy = userId;
    }
    return this.prisma.callingSession.findMany({
      where,
      orderBy: { lastActivity: 'desc' },
      take: 500,
      include: {
        people: {
          include: { person: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const session = await this.prisma.callingSession.findUnique({
      where: { id },
      include: {
        people: {
          include: { person: true },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async create(data: {
    name: string;
    peopleIds?: string[];
    createdBy: string;
    creatorName?: string;
    assignedById?: string;
    assignedByName?: string;
    folkGuideId?: string;
    coEnablerIds?: string[];
  }) {
    const session = await this.prisma.callingSession.create({
      data: {
        name: data.name,
        status: 'active',
        current_index: 0,
        createdBy: data.createdBy,
        creatorName: data.creatorName || '',
        assignedById: data.assignedById,
        assignedByName: data.assignedByName || '',
        folkGuideId: data.folkGuideId,
        coEnablerIds: JSON.stringify(data.coEnablerIds || []),
        people: data.peopleIds?.length
          ? {
              create: data.peopleIds.map(personId => ({
                personId,
              })),
            }
          : undefined,
      },
      include: {
        people: true,
      },
    });
    return session;
  }

  async update(id: string, data: { currentIndex?: number; status?: string; name?: string }) {
    const updateData: any = { ...data, lastActivity: new Date() };
    return this.prisma.callingSession.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.prisma.callingSession.delete({ where: { id } });
    return { success: true };
  }

  async getSessionsForPerson(personId: string) {
    return this.prisma.callingSession.findMany({
      where: {
        people: {
          some: { personId },
        },
        status: 'active',
      },
      take: 10,
      orderBy: { lastActivity: 'desc' },
    });
  }
}
