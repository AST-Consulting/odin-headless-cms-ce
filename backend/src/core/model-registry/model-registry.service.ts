import { Article } from '@articles/schemas/article.schema';
import { Menu } from '@cms/menu/schema/menu.schema';
import { Slug } from '@cms/slug/entities/slug.schema';
import { StaticPage } from '@cms/static-page/entities/static-page.schema';
import { FAQ } from '@faqs/schema/faq.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Tag } from '@tags/entities/tags.schema';
import { User } from '@user/entities/user.schema';
import { FileUpload } from '@utilities/file-upload/entities/fileUpload.schema';
import { Model } from 'mongoose';
import { BannerType } from 'src/banner/banner-type/entities/banner-type.schema';
import { Banner } from 'src/banner/entities/banner.schema';
import { Category } from 'src/category/entities/category.schema';
import { Section } from 'src/section/entities/section.entity';

@Injectable()
export class ModelRegistryService {
  private readonly _models: Record<string, any>;

  constructor(
    @InjectModel(Tag.name)
    private readonly _tagModel: Model<Tag>,
    @InjectModel(FAQ.name)
    private readonly _faqModel: Model<FAQ>,
    @InjectModel(StaticPage.name)
    private readonly _staticPageModel: Model<StaticPage>,
    @InjectModel(Banner.name)
    private readonly _bannerModel: Model<Banner>,
    @InjectModel(Section.name)
    private readonly _sectionModel: Model<Section>,
    @InjectModel(BannerType.name)
    private readonly _bannerTypeModel: Model<BannerType>,
    @InjectModel(Menu.name)
    private readonly _menuModel: Model<Menu>,
    @InjectModel(User.name)
    private readonly _userModel: Model<User>,
    @InjectModel(Category.name)
    private readonly _categoryModel: Model<Category>,
    @InjectModel(FileUpload.name)
    private readonly _fileUploadModel: Model<FileUpload>,
    @InjectModel(Slug.name)
    private readonly _slugModel: Model<Slug>,
    @InjectModel(Article.name)
    private readonly _articleModel: Model<Article>,
  ) {
    this._models = {
      tag: this._tagModel,
      faq: this._faqModel,
      staticPage: this._staticPageModel,
      banner: this._bannerModel,
      section: this._sectionModel,
      bannerType: this._bannerTypeModel,
      menu: this._menuModel,
      user: this._userModel,
      category: this._categoryModel,
      file: this._fileUploadModel,
      slug: this._slugModel,
      article: this._articleModel,
    };
  }

  getModel(modelName: string): Model<any> {
    const model = this._models[modelName];
    if (!model) {
      throw new Error(`Model ${modelName} not found in registry.`);
    }
    return model;
  }
}
