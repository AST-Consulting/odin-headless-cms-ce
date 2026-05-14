// email.module.ts
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProvider } from './email.provider';

@Module({
  imports: [],
  providers: [EmailService, EmailProvider],
  exports: [EmailService],
})
export class EmailModule {}
