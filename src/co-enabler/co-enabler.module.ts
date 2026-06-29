import { Module } from '@nestjs/common';
import { CoEnablerController } from './co-enabler.controller';
import { CoEnablerService } from './co-enabler.service';

@Module({
  controllers: [CoEnablerController],
  providers: [CoEnablerService],
  exports: [CoEnablerService],
})
export class CoEnablerModule {}
