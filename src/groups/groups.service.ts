import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const groupInclude = {
  _count: {
    select: { members: true },
  },
  sharedUsers: {
    include: { user: true },
  },
  reportRecipients: true,
  owner: true,
  assigner: true,
};

const groupDetailInclude = {
  members: {
    include: { person: true },
  },
  events: {
    orderBy: { date: 'desc' as const },
  },
  sharedUsers: {
    include: { user: true },
  },
  reportRecipients: true,
  owner: true,
  assigner: true,
};

function formatGroup(group: any) {
  if (!group) return group;
  return {
    ...group,
    sharedWithUserIds: group.sharedUsers?.map((su: any) => su.userId) ?? [],
    reportRecipients: group.reportRecipients?.map((rr: any) => rr.email) ?? [],
  };
}

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const groups = await this.prisma.group.findMany({
      orderBy: { name: 'asc' },
      include: groupInclude,
    });
    return groups.map(formatGroup);
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: groupDetailInclude,
    });
    return formatGroup(group);
  }

  async create(data: any) {
    const { sharedWithUserIds, reportRecipients, ...groupData } = data;

    const group = await this.prisma.group.create({
      data: {
        ...groupData,
        sharedUsers: sharedWithUserIds?.length
          ? { create: sharedWithUserIds.map((userId: string) => ({ userId })) }
          : undefined,
        reportRecipients: reportRecipients?.length
          ? { create: reportRecipients.map((email: string) => ({ email })) }
          : undefined,
      },
      include: groupInclude,
    });
    return formatGroup(group);
  }

  async update(id: string, data: any) {
    const { sharedWithUserIds, reportRecipients, ...groupData } = data;

    // Replace shared users if provided
    if (sharedWithUserIds !== undefined) {
      await this.prisma.groupSharedUser.deleteMany({ where: { groupId: id } });
      if (Array.isArray(sharedWithUserIds) && sharedWithUserIds.length > 0) {
        await this.prisma.groupSharedUser.createMany({
          data: sharedWithUserIds.map((userId: string) => ({ groupId: id, userId })),
        });
      }
    }

    // Replace report recipients if provided
    if (reportRecipients !== undefined) {
      await this.prisma.groupReportRecipient.deleteMany({ where: { groupId: id } });
      if (Array.isArray(reportRecipients) && reportRecipients.length > 0) {
        await this.prisma.groupReportRecipient.createMany({
          data: reportRecipients.map((email: string) => ({ groupId: id, email })),
        });
      }
    }

    const group = await this.prisma.group.update({
      where: { id },
      data: groupData,
      include: groupInclude,
    });
    return formatGroup(group);
  }

  async delete(id: string) {
    return this.prisma.group.delete({ where: { id } });
  }

  async getMembers(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { person: true },
        },
      },
    });
    if (!group) throw new Error('Group not found');
    return group.members.map(m => m.person);
  }

  async addMembers(groupId: string, personIds: string[]) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Group not found');

    await this.prisma.groupMember.createMany({
      data: personIds.map(personId => ({ groupId, contactId: personId })),
    });

    const memberCount = await this.prisma.groupMember.count({ where: { groupId } });
    await this.prisma.group.update({ where: { id: groupId }, data: { memberCount } });

    return { success: true, memberCount };
  }

  async addMembersByPhone(groupId: string, phoneNumbers: string[]) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Group not found');

    const people = await this.prisma.person.findMany({
      where: { phone: { in: phoneNumbers }, isDeleted: false },
    });

    const foundPhones = new Set(people.map(p => p.phone));
    const notFound = phoneNumbers.filter(p => !foundPhones.has(p));

    const personIds = people.map(p => p.id);
    if (personIds.length > 0) {
      await this.prisma.groupMember.createMany({
        data: personIds.map(personId => ({ groupId, contactId: personId })),
      });
    }

    const memberCount = await this.prisma.groupMember.count({ where: { groupId } });
    await this.prisma.group.update({ where: { id: groupId }, data: { memberCount } });

    return { added: personIds.length, notFound: notFound.length, memberCount };
  }

  async removeMember(groupId: string, personId: string) {
    await this.prisma.groupMember.deleteMany({ where: { groupId, contactId: personId } });

    const memberCount = await this.prisma.groupMember.count({ where: { groupId } });
    await this.prisma.group.update({ where: { id: groupId }, data: { memberCount } });

    return { success: true, memberCount };
  }
}
