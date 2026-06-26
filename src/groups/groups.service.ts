import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.group.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            person: true,
          },
        },
        events: {
          orderBy: { date: 'desc' },
        },
      },
    });
  }

  async create(data: Prisma.GroupCreateInput) {
    return this.prisma.group.create({
      data,
    });
  }

  async update(id: string, data: Prisma.GroupUpdateInput) {
    return this.prisma.group.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.group.delete({
      where: { id },
    });
  }

  async addMembers(groupId: string, personIds: string[]) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    // Add members
    await this.prisma.groupMember.createMany({
      data: personIds.map(personId => ({
        groupId,
        personId,
      })),
    });

    // Update member count
    const memberCount = await this.prisma.groupMember.count({
      where: { groupId },
    });

    await this.prisma.group.update({
      where: { id: groupId },
      data: { memberCount },
    });

    return { success: true, memberCount };
  }

  async addMembersByPhone(groupId: string, phoneNumbers: string[]) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new Error('Group not found');

    const people = await this.prisma.person.findMany({
      where: { phone: { in: phoneNumbers }, isDeleted: false },
    });

    const foundPhones = new Set(people.map(p => p.phone));
    const notFound = phoneNumbers.filter(p => !foundPhones.has(p));

    const personIds = people.map(p => p.id);
    if (personIds.length > 0) {
      await this.prisma.groupMember.createMany({
        data: personIds.map(personId => ({ groupId, personId })),
      });
    }

    const memberCount = await this.prisma.groupMember.count({ where: { groupId } });
    await this.prisma.group.update({
      where: { id: groupId },
      data: { memberCount },
    });

    return { added: personIds.length, notFound: notFound.length, memberCount };
  }

  async removeMember(groupId: string, personId: string) {
    await this.prisma.groupMember.deleteMany({
      where: {
        groupId,
        personId,
      },
    });

    const memberCount = await this.prisma.groupMember.count({
      where: { groupId },
    });

    await this.prisma.group.update({
      where: { id: groupId },
      data: { memberCount },
    });

    return { success: true, memberCount };
  }
}
