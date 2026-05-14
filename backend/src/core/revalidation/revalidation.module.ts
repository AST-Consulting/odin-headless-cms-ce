import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RevalidationService } from './revalidation.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
