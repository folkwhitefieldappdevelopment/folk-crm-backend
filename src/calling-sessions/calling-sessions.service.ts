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
        enablers: {
          include: { user: true },
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
        enablers: {
          include: { user: true },
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
        people: data.peopleIds?.length
          ? {
              create: data.peopleIds.map(personId => ({
                personId,
              })),
            }
          : undefined,
        enablers: data.coEnablerIds?.length
          ? {
              create: data.coEnablerIds.map(userId => ({
                userId,
              })),
            }
          : undefined,
      },
      include: {
        people: true,
        enablers: true,
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

  /**
   * Log a call result for a person in a session.
   * Writes to call_logs table with all rating and follow-up fields.
   */
  async updatePersonCall(data: {
    personId: string;
    sessionId?: string;
    status: string;
    remark?: string;
    calledBy?: string;
    calledById?: string;
    sgRating?: number;
    maRating?: number;
    frpRating?: number;
    nextFollowUpAt?: Date;
  }) {
    // Write to call_logs table
    const callLog = await this.prisma.callLog.create({
      data: {
        personId: data.personId,
        sessionId: data.sessionId,
        status: data.status,
        remark: data.remark,
        calledBy: data.calledBy,
        calledById: data.calledById,
        sgRating: data.sgRating ?? 0,
        maRating: data.maRating ?? 0,
        frpRating: data.frpRating ?? 0,
        nextFollowUpAt: data.nextFollowUpAt,
      },
    });

    // Update denormalized call stats on person
    await this.prisma.person.update({
      where: { id: data.personId },
      data: {
        lastCallAt: new Date(),
        lastCallStatus: data.status,
        lastCallRemark: data.remark,
        nextFollowUpAt: data.nextFollowUpAt,
      },
    });

    // Advance session index
    if (data.sessionId) {
      const session = await this.prisma.callingSession.findUnique({
        where: { id: data.sessionId },
        select: { current_index: true, _count: { select: { people: true } } },
      });
      if (session && session.current_index < session._count.people - 1) {
        await this.prisma.callingSession.update({
          where: { id: data.sessionId },
          data: {
            current_index: { increment: 1 },
            lastActivity: new Date(),
          },
        });
      }
    }

    return callLog;
  }
}
