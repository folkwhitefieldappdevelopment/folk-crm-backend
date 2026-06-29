import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const sessionInclude = {
  people: {
    include: { person: true },
  },
};

function formatSession(session: any) {
  if (!session) return session;
  return {
    ...session,
    peopleIds: session.people?.map((sp: any) => sp.personId) ?? [],
  };
}

@Injectable()
export class CoEnablerService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const sessions = await this.prisma.coEnablerSession.findMany({
      orderBy: { expiresAt: 'desc' },
      include: sessionInclude,
    });
    return sessions.map(formatSession);
  }

  async findOne(id: string) {
    const session = await this.prisma.coEnablerSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!session) throw new NotFoundException('Co-enabler session not found');
    return formatSession(session);
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
    const session = await this.prisma.coEnablerSession.create({
      data: {
        name: data.name,
        task: data.task || '',
        type: data.type || 'external',
        expiresAt: new Date(data.expiresAt),
        creatorId: data.creatorId,
        creatorName: data.creatorName || '',
        people: data.peopleIds?.length
          ? {
              create: data.peopleIds.map(personId => ({
                personId,
              })),
            }
          : undefined,
      },
      include: sessionInclude,
    });
    return formatSession(session);
  }

  async update(id: string, data: { task?: string; type?: string; expiresAt?: string; peopleIds?: string[] }) {
    const updateData: any = {};
    if (data.task !== undefined) updateData.task = data.task;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);

    if (data.peopleIds !== undefined) {
      await this.prisma.coEnablerSessionPerson.deleteMany({ where: { sessionId: id } });
      if (data.peopleIds.length > 0) {
        await this.prisma.coEnablerSessionPerson.createMany({
          data: data.peopleIds.map(personId => ({ sessionId: id, personId })),
        });
      }
    }

    return this.prisma.coEnablerSession.update({
      where: { id },
      data: updateData,
      include: sessionInclude,
    }).then(formatSession);
  }

  async remove(id: string) {
    await this.prisma.coEnablerSession.delete({ where: { id } });
    return { success: true };
  }
}
