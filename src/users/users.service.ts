import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, photoUrl: true, createdAt: true,
        fgCode: true, reportsTo: true,
        pausedCallingSession: true, whatsappTemplate: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        role: true, photoUrl: true, createdAt: true,
        fgCode: true, reportsTo: true,
        pausedCallingSession: true, whatsappTemplate: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async getFolkGuides() {
    return this.prisma.user.findMany({
      where: {
        role: { contains: 'FolkGuide' },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getEnablers() {
    return this.prisma.user.findMany({
      where: {
        role: { contains: 'FolkEnabler' },
      },
      orderBy: { name: 'asc' },
    });
  }
}
