import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.setting.findUnique({
      where: { id: 'options' },
    });

    if (!settings) {
      settings = await this.prisma.setting.create({
        data: {
          id: 'options',
          contactSources: JSON.stringify(['Govinda Temple', 'ITPL', 'HK hill', 'Govinda Residency', 'Other']),
          folkStages: JSON.stringify(['Fresh Lead', 'FRJ', 'FRP', 'SGW', 'SGS', '21 Days Challenge']),
          occupationStatuses: JSON.stringify(['Working', 'Student', 'Searching for job', 'Self Employed']),
          stayingWithOptions: JSON.stringify(['PG / Hostel', 'Flat', 'Family', 'Temple Residency']),
          sgOptions: JSON.stringify(['Yes', 'No', 'Partial']),
          maOptions: JSON.stringify(['Yes', 'No', 'Partial']),
          frpOptions: JSON.stringify(['Yes', 'No', 'Partial']),
          customPersonFields: JSON.stringify([]),
          activityFieldLabels: JSON.stringify({ sg: 'SG', ma: 'MA', frp: 'FRP' }),
        },
      });
    }

    return settings;
  }

  async updateSettings(data: any) {
    return this.prisma.setting.update({
      where: { id: 'options' },
      data,
    });
  }

  async addContactSource(source: string) {
    const settings = await this.getSettings();
    const current = JSON.parse(settings.contactSources || '[]');
    const sources = [...new Set([...current, source])];
    return this.updateSettings({ contactSources: JSON.stringify(sources) });
  }

  async removeContactSource(source: string) {
    const settings = await this.getSettings();
    const current = JSON.parse(settings.contactSources || '[]');
    const sources = current.filter((s: string) => s !== source);
    return this.updateSettings({ contactSources: JSON.stringify(sources) });
  }
}
