import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

function tryParseJson(val: string, fallback: any) {
  try { return JSON.parse(val); } catch { return fallback; }
}

const personInclude = {
  callLogs: {
    orderBy: { calledAt: 'desc' as const },
    take: 20,
  },
  attendance: {
    orderBy: { markedAt: 'desc' as const },
  },
  stageHistory: {
    orderBy: { changedAt: 'desc' as const },
  },
  contactSources: {
    include: { contactSource: true },
  },
  coEnablerSession: true,
  coEnablerSessionPeople: {
    include: { session: true },
  },
  enabler: true,
  folkGuideUser: true,
  groupMembers: {
    include: { group: true },
  },
};

function formatPerson(person: any) {
  if (!person) return person;
  return {
    ...person,
    callHistory: person.callLogs ?? [],
    attendanceHistory: person.attendance ?? [],
    progress: person.stageHistory ?? [],
    contactSource: person.contactSources?.map((cs: any) => cs.contactSource.name) ?? [],
    customData: typeof person.customData === 'string' ? tryParseJson(person.customData || '{}', {}) : person.customData ?? {},
  };
}

@Injectable()
export class PeopleService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.PersonWhereUniqueInput;
    where?: Prisma.PersonWhereInput;
    orderBy?: Prisma.PersonOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    const people = await this.prisma.person.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include: personInclude,
    });
    return people.map(formatPerson);
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: personInclude,
    });
    return formatPerson(person);
  }

  async findByPhone(phone: string) {
    const person = await this.prisma.person.findFirst({
      where: { phone },
      include: personInclude,
    });
    return formatPerson(person);
  }

  async create(data: any) {
    const { contactSource, progress, callHistory, attendanceHistory, customData, contactSources, ...personData } = data;

    const person = await this.prisma.person.create({
      data: {
        ...personData,
        customData: typeof customData === 'object' ? JSON.stringify(customData || {}) : (customData || '{}'),
        contactSources: contactSource?.length
          ? {
              create: await this.resolveContactSources(contactSource),
            }
          : undefined,
      },
      include: personInclude,
    });
    return formatPerson(person);
  }

  async update(id: string, data: any) {
    const { contactSource, progress, callHistory, attendanceHistory, customData, ...personData } = data;

    // Handle contact sources replacement
    if (contactSource !== undefined) {
      await this.prisma.personContactSource.deleteMany({ where: { personId: id } });
      if (Array.isArray(contactSource) && contactSource.length > 0) {
        const sources = await this.resolveContactSources(contactSource);
        await this.prisma.personContactSource.createMany({
          data: sources.map(s => ({ personId: id, contactSourceId: s.contactSourceId })),
        });
      }
    }

    const person = await this.prisma.person.update({
      where: { id },
      data: {
        ...personData,
        customData: customData !== undefined
          ? (typeof customData === 'object' ? JSON.stringify(customData) : customData)
          : undefined,
      },
      include: personInclude,
    });
    return formatPerson(person);
  }

  async delete(id: string) {
    const person = await this.prisma.person.delete({
      where: { id },
      include: personInclude,
    });
    return formatPerson(person);
  }

  async softDelete(id: string) {
    const person = await this.prisma.person.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      include: personInclude,
    });
    return formatPerson(person);
  }

  async count(where?: Prisma.PersonWhereInput) {
    return this.prisma.person.count({ where });
  }

  async search(query: string) {
    const people = await this.prisma.person.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { location: { contains: query } },
        ],
        isDeleted: false,
      },
      take: 50,
      include: personInclude,
    });
    return people.map(formatPerson);
  }

  async getStats() {
    const total = await this.prisma.person.count();
    const active = await this.prisma.person.count({ where: { isDeleted: false } });
    const deleted = await this.prisma.person.count({ where: { isDeleted: true } });

    const byStage = await this.prisma.person.groupBy({
      by: ['currentFolkStage'],
      _count: true,
      where: { isDeleted: false },
    });

    return {
      total,
      active,
      deleted,
      byStage: byStage.map(s => ({
        stage: s.currentFolkStage,
        count: s._count,
      })),
    };
  }

  async addCallLog(personId: string, data: { status: string; remark?: string; calledBy?: string; sessionId?: string }) {
    return this.prisma.callLog.create({
      data: {
        personId,
        status: data.status,
        remark: data.remark,
        calledBy: data.calledBy,
        sessionId: data.sessionId,
      },
    });
  }

  async addStageHistory(personId: string, data: { stage: string; note?: string; changedBy?: string }) {
    return this.prisma.personStageHistory.create({
      data: {
        personId,
        stage: data.stage,
        note: data.note,
        changedBy: data.changedBy,
      },
    });
  }

  private async resolveContactSources(sources: string[]): Promise<{ contactSourceId: string }[]> {
    const result: { contactSourceId: string }[] = [];
    for (const name of sources) {
      const cs = await this.prisma.contactSource.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      result.push({ contactSourceId: cs.id });
    }
    return result;
  }
}
