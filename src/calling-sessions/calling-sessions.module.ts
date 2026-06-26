import { Module } from '@nestjs/common';
import { CallingSessionsController } from './calling-sessions.controller';
import { CallingSessionsService } from './calling-sessions.service';

@Module({
  controllers: [CallingSessionsController],
  providers: [CallingSessionsService],
  exports: [CallingSessionsService],
})
export class CallingSessionsModule {}
