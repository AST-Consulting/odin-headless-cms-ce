import { Global, Module } from '@nestjs/common';
import { ApiConfigService } from './config.service';

@Global()
@Module({
  exports: [ApiConfigService],
  providers: [ApiConfigService],
})
export class ApiConfigModule {}
