import { Module } from '@nestjs/common';
import { ElasticService } from './elastic.service';
import { ApiConfigService } from '../config/config.service';
import { ElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      useFactory: (configService: ApiConfigService) => {
        const node = configService.elasticSearch.node;
        const username = configService.elasticSearch.username;
        const password = configService.elasticSearch.password;

        return {
          node,
          auth: {
            username,
            password,
          },
          maxRetries: 3,
          requestTimeout: 30000, // 30 seconds
          pingTimeout: 10000, // 10 seconds
          sniffOnStart: false,
          sniffOnConnectionFault: false,
          tls: {
            rejectUnauthorized: false, // Ignore self-signed certificate verification
          },
        };
      },
      inject: [ApiConfigService],
    }),
  ],
  providers: [ElasticService],
  exports: [ElasticService],
})
export class ElasticModule {}
