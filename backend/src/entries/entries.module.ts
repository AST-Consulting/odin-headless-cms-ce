import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentBuilderModule } from '@content-builder/content-builder.module';
import {
  ContentType,
  contentTypeSchema,
} from '@content-builder/schemas/content-type.schema';
import { User, UserSchema } from 'src/user/entities/user.schema';
import {
  EmailFieldStrategy,
  PasswordFieldStrategy,
  RichtextFieldStrategy,
  StringFieldStrategy,
  TextFieldStrategy,
  UidFieldStrategy,
  UrlFieldStrategy,
} from './strategies/string-field.strategy';
import {
  DecimalFieldStrategy,
  FloatFieldStrategy,
  IntFieldStrategy,
} from './strategies/number-field.strategy';
import { BooleanFieldStrategy } from './strategies/boolean-field.strategy';
import {
  DateFieldStrategy,
  DateTimeFieldStrategy,
  TimeFieldStrategy,
} from './strategies/date-field.strategy';
import { EnumFieldStrategy, JsonFieldStrategy } from './strategies/json-field.strategy';
import { RelationFieldStrategy } from './strategies/relation-field.strategy';
import { MediaFieldStrategy } from './strategies/media-field.strategy';
import {
  ComponentFieldStrategy,
  DynamicZoneFieldStrategy,
} from './strategies/component-field.strategy';
import { RichblockFieldStrategy } from './strategies/richblock-field.strategy';
import { FieldTypeRegistry } from './registry/field-type.registry';
import { DynamicSchemaFactory } from './registry/dynamic-schema.factory';
import { DynamicModelRegistry } from './registry/dynamic-model.registry';
import { IndexManagerService } from './registry/index-manager.service';
import { EntryValidator } from './entry.validator';
import { FilterKeyTranslator } from './registry/filter-key.translator';
import { EntryService } from './entry.service';
import { EntryController } from './entry.controller';

const FIELD_STRATEGIES = [
  StringFieldStrategy,
  TextFieldStrategy,
  RichtextFieldStrategy,
  UidFieldStrategy,
  EmailFieldStrategy,
  UrlFieldStrategy,
  PasswordFieldStrategy,
  IntFieldStrategy,
  FloatFieldStrategy,
  DecimalFieldStrategy,
  BooleanFieldStrategy,
  DateFieldStrategy,
  DateTimeFieldStrategy,
  TimeFieldStrategy,
  JsonFieldStrategy,
  EnumFieldStrategy,
  RelationFieldStrategy,
  MediaFieldStrategy,
  ComponentFieldStrategy,
  DynamicZoneFieldStrategy,
  RichblockFieldStrategy,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContentType.name, schema: contentTypeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => ContentBuilderModule),
  ],
  controllers: [EntryController],
  providers: [
    ...FIELD_STRATEGIES,
    FieldTypeRegistry,
    DynamicSchemaFactory,
    DynamicModelRegistry,
    IndexManagerService,
    EntryValidator,
    FilterKeyTranslator,
    EntryService,
  ],
  exports: [
    FieldTypeRegistry,
    DynamicSchemaFactory,
    DynamicModelRegistry,
    IndexManagerService,
  ],
})
export class EntriesModule {}
