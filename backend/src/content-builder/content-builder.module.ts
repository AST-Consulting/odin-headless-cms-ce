import { Module, OnApplicationBootstrap, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EntriesModule } from '@entries/entries.module';
import {
  ContentType,
  contentTypeSchema,
} from './schemas/content-type.schema';
import { Component, componentSchema } from './schemas/component.schema';
import { ContentTypeService } from './content-type.service';
import { ContentTypeController } from './content-type.controller';
import { ComponentService } from './component.service';
import { ComponentController } from './component.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContentType.name, schema: contentTypeSchema },
      { name: Component.name, schema: componentSchema },
    ]),
    forwardRef(() => EntriesModule),
  ],
  controllers: [ContentTypeController, ComponentController],
  providers: [ContentTypeService, ComponentService],
  exports: [ContentTypeService, ComponentService],
})
export class ContentBuilderModule implements OnApplicationBootstrap {
  constructor(private readonly _contentTypeService: ContentTypeService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this._contentTypeService.bootstrapAll();
  }
}
