import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private prisma: PrismaService) {}

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

    const callData = op.data as any;

    switch (op.operation) {
      case 'create':
      case 'update': {
        await this.prisma.callLog.upsert({
          where: { id: callData.id || op.entityId },
          create: {
            id: callData.id || op.entityId,
            personId: op.entityId,
            status: callData.status || 'unknown',
            remark: callData.remark,
            calledBy: callData.calledBy || callData.callerId,
            calledAt: callData.calledAt ? new Date(callData.calledAt) : new Date(),
            sessionId: callData.sessionId,
          },
          update: {
            status: callData.status,
            remark: callData.remark,
            calledBy: callData.calledBy || callData.callerId,
          },
        });

        // Update denormalized call stats
        await this.prisma.person.update({
          where: { id: op.entityId },
          data: {
            lastCallAt: new Date(),
            lastCallStatus: callData.status || person.lastCallStatus,
            lastCallRemark: callData.remark ?? person.lastCallRemark,
            lastSyncTimestamp: BigInt(Date.now()),
          },
        });
        break;
      }
      case 'delete': {
        await this.prisma.callLog.deleteMany({
          where: { id: callData.id || op.entityId, personId: op.entityId },
        });
        break;
      }
    }

    return { success: true };
  }

  private async processTaskOp(op: SyncPayload) {
    const person = await this.prisma.person.findUnique({ where: { id: op.entityId } });
    if (!person) {
      throw new Error(`Person not found: ${op.entityId}`);
    }

    const taskData = op.data as any;

    switch (op.operation) {
      case 'create':
      case 'update': {
        await this.prisma.personStageHistory.upsert({
          where: { id: taskData.id || op.entityId },
          create: {
            id: taskData.id || op.entityId,
            personId: op.entityId,
            stage: taskData.stage || person.currentFolkStage,
            note: taskData.note || taskData.remark,
            changedBy: taskData.changedBy,
            changedAt: taskData.changedAt ? new Date(taskData.changedAt) : new Date(),
          },
          update: {
            stage: taskData.stage,
            note: taskData.note || taskData.remark,
            changedBy: taskData.changedBy,
          },
        });
        break;
      }
      case 'delete': {
        await this.prisma.personStageHistory.deleteMany({
          where: { id: taskData.id || op.entityId, personId: op.entityId },
        });
        break;
      }
    }

    return this.prisma.person.update({
      where: { id: op.entityId },
      data: { lastSyncTimestamp: BigInt(Date.now()) },
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
      chantingStatus: 'chantingStatus',
      fromOtherCamp: 'fromOtherCamp',
      enablerInTouchWith: 'enablerInTouchWith',
      enablerId: 'enablerId',
      folkGuide: 'folkGuide',
      folkGuideId: 'folkGuideId',
      folkId: 'folkId',
      generalRemarks: 'generalRemarks',
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
      coEnablerSessionId: 'coEnablerSessionId',
      customData: 'customData',
    };

    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined) {
        mapped[dbField] = value;
      }
    }

    return mapped;
  }
}
