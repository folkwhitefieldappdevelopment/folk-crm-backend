import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleService } from '../people/people.service';

interface SyncPayload {
  entityType: 'contact' | 'callLog' | 'task';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  clientTimestamp: string;
}

interface SyncBatchRequest {
  operations: SyncPayload[];
  deviceId?: string;
}

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private peopleService: PeopleService,
  ) {}

  async processBatch(body: SyncBatchRequest) {
    const results = { processed: 0, failed: 0, errors: [] as { entityId: string; error: string }[] };

    for (const op of body.operations) {
      try {
        await this.processOperation(op);
        results.processed++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          entityId: op.entityId,
          error: err.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  private async processOperation(op: SyncPayload) {
    switch (op.entityType) {
      case 'contact':
        return this.processContactOp(op);
      case 'callLog':
        return this.processCallLogOp(op);
      case 'task':
        return this.processTaskOp(op);
      default:
        throw new Error(`Unknown entity type: ${op.entityType}`);
    }
  }

  private async processContactOp(op: SyncPayload) {
    switch (op.operation) {
      case 'create': {
        const existing = await this.prisma.person.findUnique({ where: { id: op.entityId } });
        if (existing) {
          // Update instead of creating duplicate
          return this.prisma.person.update({
            where: { id: op.entityId },
            data: this.mapContactData(op.data) as any,
          });
        }
        const contactData = this.mapContactData(op.data);
        if (!contactData.phone && !(op.data as any).phone) {
          contactData.phone = `sync-${op.entityId}`;
        }
        return this.prisma.person.create({
          data: {
            id: op.entityId,
            ...contactData,
          } as any,
        });
      }
      case 'update': {
        return this.prisma.person.update({
          where: { id: op.entityId },
          data: this.mapContactData(op.data) as any,
        });
      }
      case 'delete': {
        return this.prisma.person.update({
          where: { id: op.entityId },
          data: { isDeleted: true, deletedAt: new Date() },
        });
      }
      default:
        throw new Error(`Unknown operation: ${op.operation}`);
    }
  }

  private async processCallLogOp(op: SyncPayload) {
    const person = await this.prisma.person.findUnique({ where: { id: op.entityId } });
    if (!person) {
      throw new Error(`Person not found: ${op.entityId}`);
    }

    let callHistory: any[] = [];
    try {
      callHistory = JSON.parse(person.callHistory || '[]');
    } catch {}

    switch (op.operation) {
      case 'create':
      case 'update': {
        const logIndex = callHistory.findIndex((l: any) => l.id === (op.data as any).id);
        if (logIndex >= 0) {
          callHistory[logIndex] = { ...callHistory[logIndex], ...op.data };
        } else {
          callHistory.push(op.data);
        }
        break;
      }
      case 'delete': {
        callHistory = callHistory.filter((l: any) => l.id !== (op.data as any).id);
        break;
      }
    }

    return this.prisma.person.update({
      where: { id: op.entityId },
      data: { callHistory: JSON.stringify(callHistory), lastSyncTimestamp: BigInt(Date.now()) },
    });
  }

  private async processTaskOp(op: SyncPayload) {
    const person = await this.prisma.person.findUnique({ where: { id: op.entityId } });
    if (!person) {
      throw new Error(`Person not found: ${op.entityId}`);
    }

    let progress: any[] = [];
    try {
      progress = JSON.parse(person.progress || '[]');
    } catch {}

    switch (op.operation) {
      case 'create':
      case 'update': {
        const taskIndex = progress.findIndex((t: any) => t.id === (op.data as any).id);
        if (taskIndex >= 0) {
          progress[taskIndex] = { ...progress[taskIndex], ...op.data };
        } else {
          progress.push(op.data);
        }
        break;
      }
      case 'delete': {
        progress = progress.filter((t: any) => t.id !== (op.data as any).id);
        break;
      }
    }

    return this.prisma.person.update({
      where: { id: op.entityId },
      data: { progress: JSON.stringify(progress), lastSyncTimestamp: BigInt(Date.now()) },
    });
  }

  async getStatus() {
    const totalContacts = await this.prisma.person.count();
    return {
      queueDepth: 0,
      lastSyncAt: new Date().toISOString(),
      isOnline: true,
    };
  }

  private mapContactData(data: Record<string, unknown>) {
    const mapped: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      fullName: 'fullName',
      fullNameLowercase: 'fullNameLowercase',
      phone: 'phone',
      photoUrl: 'photoUrl',
      age: 'age',
      currentFolkStage: 'currentFolkStage',
      location: 'location',
      stayingWith: 'stayingWith',
      occupation: 'occupation',
      organisation: 'organisation',
      rentDetails: 'rentDetails',
      nativePlace: 'nativePlace',
      sgRating: 'sgRating',
      contactSource: 'contactSource',
      chantingStatus: 'chantingStatus',
      fromOtherCamp: 'fromOtherCamp',
      enablerInTouchWith: 'enablerInTouchWith',
      enablerId: 'enablerId',
      folkGuide: 'folkGuide',
      folkGuideId: 'folkGuideId',
      folkId: 'folkId',
      progress: 'progress',
      generalRemarks: 'generalRemarks',
      callHistory: 'callHistory',
      attendanceHistory: 'attendanceHistory',
      relationshipStatus: 'relationshipStatus',
      verifiedByFg: 'verifiedByFg',
      isDeleted: 'isDeleted',
      lastCallAt: 'lastCallAt',
      lastCallStatus: 'lastCallStatus',
      lastCallRemark: 'lastCallRemark',
      lastSg: 'lastSg',
      lastMa: 'lastMa',
      lastFrp: 'lastFrp',
      nextFollowUpAt: 'nextFollowUpAt',
      reminderSetName: 'reminderSetName',
      activeCoEnablerSessionId: 'activeCoEnablerSessionId',
      coEnablerId: 'coEnablerId',
      coEnablerName: 'coEnablerName',
      coEnablerExpiry: 'coEnablerExpiry',
      customData: 'customData',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined) {
        mapped[dbField] = value;
      }
    }

    if (!mapped.fullNameLowercase && mapped.fullName) {
      mapped.fullNameLowercase = String(mapped.fullName).toLowerCase();
    }

    return mapped;
  }
}
