import { Global, Module } from '@nestjs/common';
import { OnDeleteCascadeService } from './on-delete-cascade.service';
import { ModelRegistryModule } from '../model-registry/model-registry.module';
import { ElasticModule } from '../elastic/elastic.module';

@Global()
@Module({
  imports: [ModelRegistryModule, ElasticModule],
  providers: [OnDeleteCascadeService],
  exports: [OnDeleteCascadeService],
})
export class OnDeleteCascadeModule {}
