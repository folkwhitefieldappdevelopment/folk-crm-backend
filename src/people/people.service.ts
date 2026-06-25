import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
    return this.prisma.person.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  async findOne(id: string) {
    return this.prisma.person.findUnique({
      where: { id },
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.person.findFirst({
      where: { phone },
    });
  }

  async create(data: Prisma.PersonCreateInput) {
    return this.prisma.person.create({
      data,
    });
  }

  async update(id: string, data: Prisma.PersonUpdateInput) {
    return this.prisma.person.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.person.delete({
      where: { id },
    });
  }

  async softDelete(id: string) {
    return this.prisma.person.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  async count(where?: Prisma.PersonWhereInput) {
    return this.prisma.person.count({
      where,
    });
  }

  async search(query: string) {
    return this.prisma.person.findMany({
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
