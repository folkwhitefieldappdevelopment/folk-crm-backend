import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PeopleModule } from '../people/people.module';
import { PeopleService } from '../people/people.service';

@Module({
  imports: [PeopleModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
