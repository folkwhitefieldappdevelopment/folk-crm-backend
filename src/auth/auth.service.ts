import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Password not set. Please reset your password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: JSON.parse(user.role || '[]'),
        photoUrl: user.photoUrl,
        fgCode: user.fgCode,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let reportsTo = null;
    if (user.reportsTo) {
      try {
        const parsed = JSON.parse(user.reportsTo);
        reportsTo = {
          guideId: parsed.guideId,
          guideName: parsed.guideName,
          guideFgCode: parsed.guideFgCode,
        };
      } catch {}
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: JSON.parse(user.role || '[]'),
      photoUrl: user.photoUrl,
      createdAt: user.createdAt.toISOString(),
      fgCode: user.fgCode,
      reportsTo,
      whatsappTemplate: user.whatsappTemplate,
    };
  }

  async register(data: { name: string; email: string; password: string; phone?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || '',
      },
    });

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: JSON.parse(user.role || '[]'),
        photoUrl: user.photoUrl,
        fgCode: user.fgCode,
      },
    };
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: JSON.parse(user.role || '[]'),
        photoUrl: user.photoUrl,
        fgCode: user.fgCode,
      },
    };
  }

  async updateProfile(userId: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.fgCode !== undefined) updateData.fgCode = data.fgCode;
    if (data.whatsappTemplate !== undefined) updateData.whatsappTemplate = data.whatsappTemplate;
    if (data.reportsTo !== undefined) {
      updateData.reportsTo = JSON.stringify(data.reportsTo);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    let reportsTo = null;
    if (user.reportsTo) {
      try {
        const parsed = JSON.parse(user.reportsTo);
        reportsTo = {
          guideId: parsed.guideId,
          guideName: parsed.guideName,
          guideFgCode: parsed.guideFgCode,
        };
      } catch {}
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: JSON.parse(user.role || '[]'),
      photoUrl: user.photoUrl,
      createdAt: user.createdAt.toISOString(),
      fgCode: user.fgCode,
      reportsTo,
      whatsappTemplate: user.whatsappTemplate,
    };
  }

  async resetPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    // In production, send an email with a reset link
    // For now, just acknowledge
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async logout() {
    return { message: 'Logged out successfully' };
  }
}
