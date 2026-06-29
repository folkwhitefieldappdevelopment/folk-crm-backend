import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleScheduledReports() {
    this.logger.log('Checking for scheduled group reports...');
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const groups = await this.prisma.group.findMany({
      where: { reportingEnabled: true },
      include: { reportRecipients: true },
    });

    for (const group of groups) {
      const reportTime = group.reportTime;
      if (!reportTime) continue;

      if (this.isTimeMatch(currentHHMM, reportTime)) {
        this.logger.log(`Sending scheduled report for group: ${group.name} (${group.id})`);
        try {
          await this.sendGroupReport(group.id);
        } catch (err) {
          this.logger.error(`Failed to send report for group ${group.name}:`, err);
        }
      }
    }
  }

  private isTimeMatch(current: string, scheduled: string): boolean {
    const [curH, curM] = current.split(':').map(Number);
    const [schH, schM] = scheduled.split(':').map(Number);
    if (isNaN(curH) || isNaN(schH)) return false;
    const curTotalMin = curH * 60 + curM;
    const schTotalMin = schH * 60 + schM;
    return Math.abs(curTotalMin - schTotalMin) <= 7;
  }

  async sendGroupReport(groupId: string): Promise<{ sent: boolean; reason?: string }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            person: {
              include: {
                callLogs: {
                  orderBy: { calledAt: 'desc' },
                  take: 50,
                },
                attendance: {
                  orderBy: { markedAt: 'desc' },
                },
              },
            },
          },
        },
        reportRecipients: true,
      },
    });

    if (!group) {
      return { sent: false, reason: 'Group not found' };
    }

    const recipients = group.reportRecipients.map(r => r.email);
    if (recipients.length === 0) {
      return { sent: false, reason: 'No recipients configured' };
    }

    const members = group.members.map(m => m.person).filter(Boolean);

    const html = this.generateReportHtml(group, members);

    return this.mailService.send({
      to: recipients,
      subject: `Outreach Report: ${group.name} — ${new Date().toLocaleDateString()}`,
      html,
    });
  }

  private generateReportHtml(group: any, people: any[]): string {
    const now = new Date();
    const dangerZone = people.filter(p => {
      const lastCall = p.lastCallAt ? new Date(p.lastCallAt) : null;
      const days = lastCall ? Math.floor((now.getTime() - lastCall.getTime()) / 86400000) : 999;
      return days >= 4 && !['A2 - Not Interested', 'A3 - Wrong Number'].includes(p.lastCallStatus || '');
    });

    const active = people.filter(p => {
      const lastCall = p.lastCallAt ? new Date(p.lastCallAt) : null;
      const days = lastCall ? Math.floor((now.getTime() - lastCall.getTime()) / 86400000) : 999;
      return days <= 7;
    });

    const emergency = people.filter(p => {
      const lastCall = p.lastCallAt ? new Date(p.lastCallAt) : null;
      const days = lastCall ? Math.floor((now.getTime() - lastCall.getTime()) / 86400000) : 999;
      return days >= 7 && p.chantingStatus === 0 && p.lastCallStatus !== 'A1 - Coming';
    });

    const memberRows = people.map(p => {
      const lastCall = p.lastCallAt ? new Date(p.lastCallAt) : null;
      const daysSince = lastCall ? Math.floor((now.getTime() - lastCall.getTime()) / 86400000) : 999;
      const callHistory = p.callLogs || [];
      const recentCalls = callHistory.filter((c: any) => {
        const d = c.calledAt ? new Date(c.calledAt) : null;
        return d && (now.getTime() - d.getTime()) < 30 * 86400000;
      });
      const attCount = p.attendance?.length || 0;

      let badge = '<span style="background:#4CAF50;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">Active</span>';
      if (daysSince > 7) {
        badge = '<span style="background:#f44336;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">Danger</span>';
      } else if (daysSince > 3) {
        badge = '<span style="background:#FF9800;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">At Risk</span>';
      }

      return `<tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">${p.fullName || 'Unknown'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${p.currentFolkStage || '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${p.phone || '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${daysSince >= 999 ? 'Never' : daysSince + 'd'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${p.lastCallStatus || '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${attCount}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${badge}</td>
      </tr>`;
    }).join('');

    const dangerRows = dangerZone.slice(0, 20).map(p => {
      const lastCall = p.lastCallAt ? new Date(p.lastCallAt) : null;
      const days = lastCall ? Math.floor((now.getTime() - lastCall.getTime()) / 86400000) : 999;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;font-weight:bold;">${p.fullName || 'Unknown'}</td>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;">${days}d</td>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;">${p.lastCallStatus || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;">${p.enablerInTouchWith || 'Unassigned'}</td>
      </tr>`;
    }).join('');

    const emergencyRows = emergency.slice(0, 20).map(p => {
      const lastCall = p.lastCallAt ? new Date(p.lastCallAt) : null;
      const days = lastCall ? Math.floor((now.getTime() - lastCall.getTime()) / 86400000) : 999;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;font-weight:bold;">${p.fullName || 'Unknown'}</td>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;">${days}d</td>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;">Chanting: ${p.chantingStatus || 0}</td>
        <td style="padding:8px;border-bottom:1px solid #ffcdd2;">${p.location || '—'}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f5f5f5;">
<div style="max-width:800px;margin:auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#3F51B5,#5C6BC0);color:#fff;padding:30px;border-radius:15px 15px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;text-transform:uppercase;letter-spacing:2px;">FOLK Group Report</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${group.name} — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div style="background:#fff;padding:30px;border-radius:0 0 15px 15px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">

    <div style="display:flex;gap:15px;margin-bottom:30px;flex-wrap:wrap;">
      <div style="flex:1;min-width:120px;background:#E8F5E9;padding:15px;border-radius:10px;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#2E7D32;">${people.length}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;">Total Members</div>
      </div>
      <div style="flex:1;min-width:120px;background:#E3F2FD;padding:15px;border-radius:10px;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#1565C0;">${active.length}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;">Active (7d)</div>
      </div>
      <div style="flex:1;min-width:120px;background:#FFF3E0;padding:15px;border-radius:10px;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#E65100;">${dangerZone.length}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;">Danger Zone</div>
      </div>
      <div style="flex:1;min-width:120px;background:#FFEBEE;padding:15px;border-radius:10px;text-align:center;">
        <div style="font-size:28px;font-weight:bold;color:#C62828;">${emergency.length}</div>
        <div style="font-size:11px;color:#666;text-transform:uppercase;">Emergency</div>
      </div>
    </div>

    ${dangerZone.length > 0 ? `
    <div style="margin-bottom:30px;border:2px solid #f44336;border-radius:10px;padding:20px;background:#FFF5F5;">
      <h2 style="margin:0 0 5px;font-size:16px;color:#f44336;text-transform:uppercase;">⚠ Danger Zone</h2>
      <p style="font-size:12px;color:#666;margin-bottom:15px;">These members haven't been reached in 4+ days.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f44336;color:#fff;"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Days</th><th style="padding:8px;text-align:left;">Status</th><th style="padding:8px;text-align:left;">Enabler</th></tr></thead>
        <tbody>${dangerRows}</tbody>
      </table>
    </div>` : ''}

    ${emergency.length > 0 ? `
    <div style="margin-bottom:30px;border:2px solid #C62828;border-radius:10px;padding:20px;background:#FFF0F0;">
      <h2 style="margin:0 0 5px;font-size:16px;color:#C62828;text-transform:uppercase;">🚨 Emergency Attention</h2>
      <p style="font-size:12px;color:#666;margin-bottom:15px;">Not chanting, not attending, not meeting FG — needs immediate follow-up.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#C62828;color:#fff;"><th style="padding:8px;text-align:left;">Name</th><th style="padding:8px;text-align:left;">Days</th><th style="padding:8px;text-align:left;">Chanting</th><th style="padding:8px;text-align:left;">Location</th></tr></thead>
        <tbody>${emergencyRows}</tbody>
      </table>
    </div>` : ''}

    <div style="margin-bottom:20px;">
      <h2 style="font-size:16px;color:#3F51B5;text-transform:uppercase;margin-bottom:10px;">Full Member Overview</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#3F51B5;color:#fff;">
          <th style="padding:10px;text-align:left;">Name</th>
          <th style="padding:10px;text-align:left;">Stage</th>
          <th style="padding:10px;text-align:left;">Phone</th>
          <th style="padding:10px;text-align:left;">Last Call</th>
          <th style="padding:10px;text-align:left;">Status</th>
          <th style="padding:10px;text-align:left;">Events</th>
          <th style="padding:10px;text-align:left;">Status</th>
        </tr></thead>
        <tbody>${memberRows}</tbody>
      </table>
    </div>

    <div style="text-align:center;font-size:10px;color:#999;margin-top:40px;border-top:1px solid #eee;padding-top:20px;">
      Automated report from FOLK Spiritual Gems CRM.<br>
      Generated on ${now.toLocaleString()}
    </div>
  </div>
</div>
</body>
</html>`;
  }
}
