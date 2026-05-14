import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Menu, MenuSchema } from './schema/menu.schema';
import { SlugModule } from '@cms/slug/slug.module';
import { AuditTrailModule } from '@core/audit-trail/audit-trail.module';
import { ElasticModule } from '@core/elastic/elastic.module';
import { OnDeleteCascadeModule } from '@core/on-delete-cascade/on-delete-cascade.module';
import { OrganizationModule } from '@organization/organization.module';
import { PropertyModule } from '@property/property.module';
import { WpCompatibleController } from './wp-compatible.controller';
import { ArticlesModule } from '@articles/articles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Menu.name,
        schema: MenuSchema,
      },
    ]),
    SlugModule,
    AuditTrailModule,
    OrganizationModule,
    PropertyModule,
    ElasticModule,
    OnDeleteCascadeModule,
    PropertyModule,
    OrganizationModule,
    ArticlesModule,
  ],
  providers: [MenuService],
  controllers: [MenuController,WpCompatibleController],
  exports: [MenuService],
})
export class MenuModule {}
