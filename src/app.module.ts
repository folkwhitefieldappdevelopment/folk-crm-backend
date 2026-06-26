import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PeopleModule } from './people/people.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { SettingsModule } from './settings/settings.module';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { CallingSessionsModule } from './calling-sessions/calling-sessions.module';
import { EventsModule } from './events/events.module';
import { AuditsModule } from './audits/audits.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    PeopleModule,
    UsersModule,
    GroupsModule,
    SettingsModule,
    AuthModule,
    SyncModule,
    CallingSessionsModule,
    EventsModule,
    AuditsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
