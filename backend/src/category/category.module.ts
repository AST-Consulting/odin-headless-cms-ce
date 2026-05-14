import { Module, forwardRef } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, categorySchema } from './entities/category.schema';
import { AuditTrailModule } from 'src/core/audit-trail/audit-trail.module';
import { ElasticModule } from 'src/core/elastic/elastic.module';
import { SlugModule } from '@cms/slug/slug.module';
import { PropertyModule } from '@property/property.module';
import { OrganizationModule } from '@organization/organization.module';
import { WpCompatibleController } from './wp-compatible.controller';

@Module({
  imports: [
    forwardRef(() => SlugModule),
    AuditTrailModule,
    MongooseModule.forFeature([{ name: Category.name, schema: categorySchema }]),
    ElasticModule,
    forwardRef(() => PropertyModule),
    forwardRef(() => OrganizationModule),
    // OnDeleteCascadeModule,
  ],
  providers: [CategoryService],
  controllers: [CategoryController,WpCompatibleController],
  exports: [CategoryService],
})
export class CategoryModule { }
