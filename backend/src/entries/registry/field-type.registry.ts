import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TFieldType } from '@content-builder/schemas/field.schema';
import { IFieldTypeStrategy } from '../strategies/field-type.strategy';
import {
  StringFieldStrategy,
  TextFieldStrategy,
  RichtextFieldStrategy,
  UidFieldStrategy,
  EmailFieldStrategy,
  UrlFieldStrategy,
  PasswordFieldStrategy,
} from '../strategies/string-field.strategy';
import {
  IntFieldStrategy,
  FloatFieldStrategy,
  DecimalFieldStrategy,
} from '../strategies/number-field.strategy';
import { BooleanFieldStrategy } from '../strategies/boolean-field.strategy';
import {
  DateFieldStrategy,
  DateTimeFieldStrategy,
  TimeFieldStrategy,
} from '../strategies/date-field.strategy';
import { JsonFieldStrategy, EnumFieldStrategy } from '../strategies/json-field.strategy';
import { RelationFieldStrategy } from '../strategies/relation-field.strategy';
import { MediaFieldStrategy } from '../strategies/media-field.strategy';
import {
  ComponentFieldStrategy,
  DynamicZoneFieldStrategy,
} from '../strategies/component-field.strategy';
import { RichblockFieldStrategy } from '../strategies/richblock-field.strategy';

@Injectable()
export class FieldTypeRegistry implements OnModuleInit {
  private readonly _strategies = new Map<TFieldType, IFieldTypeStrategy>();

  constructor(private readonly _moduleRef: ModuleRef) {}

  onModuleInit(): void {
    const strategyTypes = [
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

    for (const StrategyClass of strategyTypes) {
      const instance = this._moduleRef.get(StrategyClass, { strict: false });
      this._strategies.set(instance.type, instance);
    }
  }

  get(type: TFieldType): IFieldTypeStrategy {
    const strategy = this._strategies.get(type);
    if (!strategy) {
      throw new Error(`No strategy registered for field type "${type}"`);
    }
    return strategy;
  }

  has(type: TFieldType): boolean {
    return this._strategies.has(type);
  }
}
