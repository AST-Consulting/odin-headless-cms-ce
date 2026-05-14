import { Module } from '@nestjs/common';
import { CommunicationProviderService } from './communication-provider.service';

@Module({
  providers: [CommunicationProviderService],
  exports: [CommunicationProviderService],
})
export class CommunicationProviderModule {}
