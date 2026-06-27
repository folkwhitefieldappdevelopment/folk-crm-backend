import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [ReportService],
})
export class ReportModule {}
