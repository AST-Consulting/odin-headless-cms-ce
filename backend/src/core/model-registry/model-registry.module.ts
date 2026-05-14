import { Module } from '@nestjs/common';
import { ModelRegistryService } from './model-registry.service';
import { Menu, MenuSchema } from '@cms/menu/schema/menu.schema';
import { Slug, slugSchema } from '@cms/slug/entities/slug.schema';
import { StaticPage, staticPageSchema } from '@cms/static-page/entities/static-page.schema';
import { FAQ, faqSchema } from '@faqs/schema/faq.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Tag, tagSchema } from '@tags/entities/tags.schema';
import { User, UserSchema } from '@user/entities/user.schema';
import { FileUpload, fileUploadSchema } from '@utilities/file-upload/entities/fileUpload.schema';
import { BannerType, bannerTypeSchema } from 'src/banner/banner-type/entities/banner-type.schema';
import { Banner, bannerSchema } from 'src/banner/entities/banner.schema';
import { Category, categorySchema } from 'src/category/entities/category.schema';
import { Section, SectionSchema } from 'src/section/entities/section.entity';
import { Article, ArticleSchema } from '@articles/schemas/article.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: Tag.name, schema: tagSchema },
      { name: Banner.name, schema: bannerSchema },
      { name: StaticPage.name, schema: staticPageSchema },
      { name: FAQ.name, schema: faqSchema },
      { name: Section.name, schema: SectionSchema },
      { name: BannerType.name, schema: bannerTypeSchema },
      { name: Menu.name, schema: MenuSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: categorySchema },
      { name: FileUpload.name, schema: fileUploadSchema },
      { name: Slug.name, schema: slugSchema },
    ]),
  ],
  providers: [ModelRegistryService],
  exports: [ModelRegistryService],
})
export class ModelRegistryModule {}
