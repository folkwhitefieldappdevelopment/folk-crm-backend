import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async getGroupEvents(groupId: string) {
    return this.prisma.groupEvent.findMany({
      where: { groupId },
      orderBy: { date: 'desc' },
    });
  }

  async createEvent(groupId: string, data: { name: string; date: string; linkInfo?: any }) {
    return this.prisma.groupEvent.create({
      data: {
        groupId,
        name: data.name,
        date: data.date,
        linkInfo: data.linkInfo ? JSON.stringify(data.linkInfo) : undefined,
      },
    });
  }

  async markAttendance(personId: string, groupId: string, eventId?: string, date?: string) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException('Person not found');

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    const existing = await this.prisma.attendance.findFirst({
      where: { personId, eventId: eventId || undefined, date: attendanceDate },
    });

    if (existing) {
      return { success: true, message: 'Already submitted.' };
    }

    await this.prisma.attendance.create({
      data: {
        personId,
        groupId,
        eventId,
        date: attendanceDate,
      },
    });

    if (eventId) {
      const count = await this.prisma.attendance.count({ where: { eventId } });
      await this.prisma.groupEvent.update({
        where: { id: eventId },
        data: { attendeeCount: count },
      });
    }

    return { success: true, message: 'Attendance marked.' };
  }

  async removeAttendance(personId: string, groupId: string, eventId: string) {
    await this.prisma.attendance.deleteMany({
      where: { personId, groupId, eventId },
    });

    if (eventId) {
      const count = await this.prisma.attendance.count({ where: { eventId } });
      await this.prisma.groupEvent.update({
        where: { id: eventId },
        data: { attendeeCount: count },
      });
    }

    return { success: true };
  }
}
