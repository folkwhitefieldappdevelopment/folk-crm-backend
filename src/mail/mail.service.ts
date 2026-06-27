import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private prisma: PrismaService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async create(data: { to: string[]; subject: string; html: string }) {
    return this.prisma.mail.create({
      data: {
        to: JSON.stringify(data.to),
        subject: data.subject,
        html: data.html,
      },
    });
  }

  async findAll(skip = 0, take = 50) {
    const items = await this.prisma.mail.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return items.map(item => ({
      ...item,
      to: JSON.parse(item.to),
    }));
  }

  async send(data: { to: string[]; subject: string; html: string }) {
    if (!this.transporter) {
      console.warn('[MailService] SMTP not configured — skipping send. Set SMTP_HOST, SMTP_USER, SMTP_PASS env vars.');
      await this.create(data);
      return { queued: true, sent: false, reason: 'SMTP not configured' };
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@folk-crm.app';
    try {
      await this.transporter.sendMail({
        from,
        to: data.to.join(', '),
        subject: data.subject,
        html: data.html,
      });
      await this.create(data);
      return { queued: true, sent: true };
    } catch (err) {
      console.error('[MailService] Send failed:', err);
      await this.create(data);
      return { queued: true, sent: false, reason: (err as Error).message };
    }
  }
}
