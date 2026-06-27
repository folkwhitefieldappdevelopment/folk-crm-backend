import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

function tryParseJson(val: string, fallback: any) {
  try { return JSON.parse(val); } catch { return fallback; }
}

function parsePersonJsonFields(person: any) {
  if (!person) return person;
  return {
    ...person,
    contactSource: typeof person.contactSource === 'string' ? tryParseJson(person.contactSource || '[]', []) : person.contactSource ?? [],
    progress: typeof person.progress === 'string' ? tryParseJson(person.progress || '[]', []) : person.progress ?? [],
    callHistory: typeof person.callHistory === 'string' ? tryParseJson(person.callHistory || '[]', []) : person.callHistory ?? [],
    attendanceHistory: typeof person.attendanceHistory === 'string' ? tryParseJson(person.attendanceHistory || '[]', []) : person.attendanceHistory ?? [],
    customData: typeof person.customData === 'string' ? tryParseJson(person.customData || '{}', {}) : person.customData ?? {},
  };
}

function preparePersonForDb(data: any) {
  const dbData = { ...data };
  if (dbData.contactSource && typeof dbData.contactSource !== 'string') dbData.contactSource = JSON.stringify(dbData.contactSource);
  if (dbData.progress && typeof dbData.progress !== 'string') dbData.progress = JSON.stringify(dbData.progress);
  if (dbData.callHistory && typeof dbData.callHistory !== 'string') dbData.callHistory = JSON.stringify(dbData.callHistory);
  if (dbData.attendanceHistory && typeof dbData.attendanceHistory !== 'string') dbData.attendanceHistory = JSON.stringify(dbData.attendanceHistory);
  if (dbData.customData && typeof dbData.customData !== 'string') dbData.customData = JSON.stringify(dbData.customData);
  return dbData;
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
    });
    return people.map(parsePersonJsonFields);
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
    });
    return parsePersonJsonFields(person);
  }

  async findByPhone(phone: string) {
    const person = await this.prisma.person.findFirst({
      where: { phone },
    });
    return parsePersonJsonFields(person);
  }

  async create(data: Prisma.PersonCreateInput) {
    const person = await this.prisma.person.create({
      data: preparePersonForDb(data),
    });
    return parsePersonJsonFields(person);
  }

  async update(id: string, data: Prisma.PersonUpdateInput) {
    const person = await this.prisma.person.update({
      where: { id },
      data: preparePersonForDb(data),
    });
    return parsePersonJsonFields(person);
  }

  async delete(id: string) {
    const person = await this.prisma.person.delete({
      where: { id },
    });
    return parsePersonJsonFields(person);
  }

  async softDelete(id: string) {
    const person = await this.prisma.person.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
    return parsePersonJsonFields(person);
  }

  async count(where?: Prisma.PersonWhereInput) {
    return this.prisma.person.count({
      where,
    });
  }

  async search(query: string) {
    const people = await this.prisma.person.findMany({
      where: {
        OR: [
          { fullName: { contains: query } },
          { phone: { contains: query } },
          { location: { contains: query } },
        ],
        isDeleted: false,
      },
      take: 50,
    });
    return people.map(parsePersonJsonFields);
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
}
