import { Injectable } from '@nestjs/common';
import { Field, TFieldType } from '@content-builder/schemas/field.schema';
import { SchemaDefinitionProperty } from 'mongoose';
import { IFieldTypeStrategy, IFieldValidationResult } from './field-type.strategy';

type TStringVariant = 'string' | 'text' | 'richtext' | 'uid' | 'email' | 'url' | 'password';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/i;

abstract class BaseStringStrategy implements IFieldTypeStrategy {
  abstract readonly type: TFieldType;

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return {
      type: String,
      required: !!field.required,
      unique: field.unique || undefined,
      sparse: field.sparse || undefined,
      default: field.default ?? undefined,
    };
  }

  validate(value: any, field: Field): IFieldValidationResult {
    if (value === undefined || value === null) {
      return field.required ? { valid: false, error: `${field.name} is required` } : { valid: true };
    }
    if (typeof value !== 'string') {
      return { valid: false, error: `${field.name} must be a string` };
    }
    const v = field.validation || ({} as any);
    if (v.minLength != null && value.length < v.minLength) {
      return { valid: false, error: `${field.name} must be at least ${v.minLength} characters` };
    }
    if (v.maxLength != null && value.length > v.maxLength) {
      return { valid: false, error: `${field.name} must be at most ${v.maxLength} characters` };
    }
    if (v.regex) {
      try {
        if (!new RegExp(v.regex).test(value)) {
          return { valid: false, error: `${field.name} does not match required pattern` };
        }
      } catch {
        return { valid: false, error: `${field.name} has invalid regex config` };
      }
    }
    if (v.enumValues?.length && !v.enumValues.includes(value)) {
      return { valid: false, error: `${field.name} must be one of ${v.enumValues.join(', ')}` };
    }
    return this.customValidate(value, field);
  }

  protected customValidate(_value: string, _field: Field): IFieldValidationResult {
    return { valid: true };
  }
}

@Injectable()
export class StringFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'string';
}

@Injectable()
export class TextFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'text';
}

@Injectable()
export class RichtextFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'richtext';
}

@Injectable()
export class UidFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'uid';
}

@Injectable()
export class PasswordFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'password';

  buildSchemaDefinition(field: Field): SchemaDefinitionProperty {
    return { ...(super.buildSchemaDefinition(field) as any), select: false };
  }
}

@Injectable()
export class EmailFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'email';
  protected customValidate(value: string, field: Field): IFieldValidationResult {
    return EMAIL_REGEX.test(value)
      ? { valid: true }
      : { valid: false, error: `${field.name} must be a valid email` };
  }
}

@Injectable()
export class UrlFieldStrategy extends BaseStringStrategy {
  readonly type: TFieldType = 'url';
  protected customValidate(value: string, field: Field): IFieldValidationResult {
    return URL_REGEX.test(value)
      ? { valid: true }
      : { valid: false, error: `${field.name} must be a valid URL` };
  }
}
