import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PeopleModule } from './people/people.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { SettingsModule } from './settings/settings.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    PeopleModule,
    UsersModule,
    GroupsModule,
    SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
