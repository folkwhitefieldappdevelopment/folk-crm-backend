import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(params: {
    userId?: string;
    from?: string;
    to?: string;
    targetFolkGuideId?: string;
  }) {
    const { userId, from, to, targetFolkGuideId } = params;

    const baseWhere: any = { isDeleted: false };
    if (targetFolkGuideId && targetFolkGuideId !== 'all') {
      baseWhere.OR = [
        { folkGuideId: targetFolkGuideId },
        { folkGuideId: null, enablerId: null },
      ];
    }

    const myWhere: any = { ...baseWhere };
    if (userId) {
      myWhere.OR = [
        { enablerId: userId },
        { folkGuideId: null, enablerId: null },
      ];
    }

    const startDate = from ? new Date(from) : new Date();
    const endDate = to ? new Date(to) : from ? new Date(from) : new Date();

    const [
      totalCount,
      myCount,
      allNewCount,
      myNewCount,
    ] = await Promise.all([
      this.prisma.person.count({ where: baseWhere }),
      this.prisma.person.count({ where: myWhere }),
      this.prisma.person.count({
        where: { ...baseWhere, createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.person.count({
        where: { ...myWhere, createdAt: { gte: startDate, lte: endDate } },
      }),
    ]);

    const activePeople = await this.prisma.person.findMany({
      where: {
        ...baseWhere,
        lastCallAt: { gte: startDate, lte: endDate },
      },
      take: 1000,
    });

    const activePersonList = activePeople.map(p => ({
      ...p,
      callHistory: JSON.parse(p.callHistory || '[]'),
      attendanceHistory: JSON.parse(p.attendanceHistory || '[]'),
      progress: JSON.parse(p.progress || '[]'),
    }));

    const report = this.buildCallingReport(activePersonList, userId || undefined, startDate, endDate);

    const byEnabler: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    const byChanting: Record<string, number> = {
      '0-1 R': 0, '2-3 R': 0, '4-7 R': 0, '8-15 R': 0, '16+ R': 0,
    };

    activePersonList.forEach(p => {
      const e = (p as any).enablerInTouchWith || 'Unassigned';
      byEnabler[e] = (byEnabler[e] || 0) + 1;

      const year = (p as any).folkId?.split('/')?.[1] || 'N/A';
      if (year !== 'N/A') byYear[year] = (byYear[year] || 0) + 1;

      const r = (p as any).chantingStatus || 0;
      if (r >= 16) byChanting['16+ R']++;
      else if (r >= 8) byChanting['8-15 R']++;
      else if (r >= 4) byChanting['4-7 R']++;
      else if (r >= 2) byChanting['2-3 R']++;
      else byChanting['0-1 R']++;
    });

    return {
      stats: {
        myContactsCount: myCount,
        totalContactsCount: totalCount,
        myNewInRange: myNewCount,
        allNewInRange: allNewCount,
        byEnabler,
        byYear,
        byChantingCategory: byChanting,
      },
      callingReportAll: report.allReport,
      callingReportMy: report.myReport,
    };
  }

  private buildCallingReport(
    people: any[],
    userIdFilter: string | undefined,
    start: Date,
    end: Date,
  ) {
    const build = (personList: any[], userFilter?: string) => {
      const report: any = {
        totalCalls: 0,
        picked: 0,
        notPicked: 0,
        eliminated: 0,
        percentages: { picked: 0, notPicked: 0, eliminated: 0 },
        daily: {},
        byEnabler: {},
        subCategories: {},
        detailedBreakdown: {},
      };

      const statuses = [
        'A1 - Coming', 'A2 - Not Interested', 'A3 - Wrong Number',
        'A4 - Tentative', 'B - Not Answering', 'G - Completely Shifted to Another city',
        'Z - Already Attended', 'D - Done',
      ];
      statuses.forEach(s => {
        report.subCategories[s] = 0;
        report.detailedBreakdown[s] = {};
      });

      personList.forEach(p => {
        const logsInRange = (p.callHistory || []).filter((log: any) => {
          const date = log.calledAt ? new Date(log.calledAt) : null;
          const matchesUser = !userFilter || log.callerId === userFilter;
          return date && date >= start && date <= end && matchesUser;
        });

        logsInRange.forEach((log: any) => {
          const status = log.status || 'B - Not Answering';
          const eventName = log.event || 'Manual Call';
          const callerName = log.callerName || 'System';

          report.totalCalls++;
          const isSuccess = ['A1 - Coming', 'Z - Already Attended', 'A4 - Tentative'].includes(status);
          const isEliminated = ['A2 - Not Interested', 'A3 - Wrong Number', 'G - Completely Shifted to Another city'].includes(status);

          if (isSuccess) report.picked++;
          else report.notPicked++;
          if (isEliminated) report.eliminated++;

          if (report.subCategories.hasOwnProperty(status)) {
            report.subCategories[status]++;
            const uniqueKey = `${eventName}_${callerName}`;
            if (!report.detailedBreakdown[status][uniqueKey]) {
              report.detailedBreakdown[status][uniqueKey] = {
                count: 0, event: eventName, callerName,
                enablerName: p.enablerInTouchWith,
                fgName: p.folkGuide,
                coEnablerName: (p as any).coEnablerName,
              };
            }
            report.detailedBreakdown[status][uniqueKey].count++;
          }
        });
      });

      if (report.totalCalls > 0) {
        report.percentages.picked = Math.round((report.picked / report.totalCalls) * 100);
        report.percentages.notPicked = Math.round((report.notPicked / report.totalCalls) * 100);
        report.percentages.eliminated = Math.round((report.eliminated / report.totalCalls) * 100);
      }

      return report;
    };

    return {
      allReport: build(people),
      myReport: build(people, userIdFilter),
    };
  }
}
