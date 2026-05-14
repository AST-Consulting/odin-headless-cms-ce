import { isNotEmpty } from 'class-validator';
import { comparisonOperators, DATE_FIELDS, TComparisonOperators } from '../../core/utils/utilVars';
import { Model, Types } from 'mongoose';

/**
 * Escapes special regex metacharacters to prevent injection attacks.
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
export function escapeRegex(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sensitive fields that should never be exposed via API field selection or sorting.
 * These fields are blocked to prevent information leakage.
 */
const BLOCKED_FIELDS = [
  'password',
  'refreshToken',
  'accessToken',
  'hashedToken',
  'otp',
  'otpExpiry',
  '__v',
  'resetPasswordToken',
  'resetPasswordExpires',
];

export class APIFeatures<T> {
  private _query: any;

  constructor(
    private _model: Model<any>,
    private _queryObj: any
  ) {
    this._query = this._model.find();
  }
  filter(): this {
    const filters = { ...this._queryObj };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'sortOrder', 'searchTerm', 'lastId'];
    excludedFields.forEach((el) => delete filters[el]);

    // Handle wildcard searches, date range filters, and day-based date checks separately
    Object.keys(filters).forEach((field) => {
      const value = filters[field];

      // Check if value is not empty
      if (isNotEmpty(value)) {
        // Handle multiple values separated by commas
        if (typeof value === 'string' && value.includes('*')) {
          // Escape regex metacharacters before replacing wildcards to prevent injection
          const escapedValue = escapeRegex(value).replace(/\\\*/g, '.*');
          filters[field] = {
            $regex: `^${escapedValue}`,
            $options: 'i',
          };
        } else if (typeof value === 'string' && value.includes(',')) {
          const valuesArray = value.split(',').map((val) => val.trim());
          filters[field] = { $in: valuesArray };
        } else if (comparisonOperators.some((op) => field.includes(`.${op}`))) {
          // Handle range queries like createdAt.gte
          const [fieldName, operator] = field.split('.');
          const dateValue = new Date(value);
          switch (operator) {
            case TComparisonOperators.GTE:
              filters[fieldName] = { ...filters[fieldName], $gte: dateValue };
              break;
            case TComparisonOperators.LTE:
              // If a full ISO string with time is provided, use it exactly.
              // Otherwise, adjust to the end of the day for inclusive date filtering.
              if (typeof value === 'string' && value.includes('T')) {
                filters[fieldName] = { ...filters[fieldName], $lte: dateValue };
              } else {
                const endOfDay = new Date(dateValue);
                endOfDay.setDate(dateValue.getDate() + 1);
                endOfDay.setHours(0, 0, 0, 0);
                filters[fieldName] = { ...filters[fieldName], $lt: endOfDay };
              }
              break;
            case TComparisonOperators.GT:
              filters[fieldName] = { ...filters[fieldName], $gt: dateValue };
              break;
            case TComparisonOperators.LT:
              // If a full ISO string with time is provided, use it exactly.
              // Otherwise, adjust to the start of the day for exclusive date filtering.
              if (typeof value === 'string' && value.includes('T')) {
                filters[fieldName] = { ...filters[fieldName], $lt: dateValue };
              } else {
                const startOfDay = new Date(dateValue);
                startOfDay.setHours(0, 0, 0, 0);
                filters[fieldName] = { ...filters[fieldName], $lt: startOfDay };
              }
              break;
            default:
              break;
          }
          delete filters[field];
        } else if (DATE_FIELDS.includes(field)) {
          let dateValue;
          if (!value.includes('T')) {
            dateValue = new Date(value + 'T00:00:00.000Z');
          } else {
            dateValue = new Date(value);
          }
          const startOfDay = new Date(
            Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())
          );
          const endOfDay = new Date(
            Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate() + 1)
          );
          filters[field] = { $gte: startOfDay, $lt: endOfDay };
        } else {
          filters[field] = value;
        }
      } else {
        // Remove the field if value is empty
        delete filters[field];
      }
    });
    if (this._queryObj.lastId && Types.ObjectId.isValid(this._queryObj.lastId)) {
      const order = this._queryObj.sortOrder || 'desc';
      filters['_id'] = { [order === 'asc' ? '$gt' : '$lt']: new Types.ObjectId(this._queryObj.lastId) };
    }

    if (Object.keys(filters).length > 0) {
      this._query.find(filters);
    }

    return this;
  }

  search(): this {
    if (this._queryObj.searchTerm) {
      const searchQuery = Object.keys(this._queryObj)
        .filter((field) => !['page', 'sort', 'limit', 'fields', 'sortOrder'].includes(field))
        .map((field) => {
          // Security: Handle wildcards properly
          // 1. Replace * with placeholder before escaping
          // 2. Escape all regex special characters
          // 3. Replace placeholder with .* for wildcard matching
          const WILDCARD_PLACEHOLDER = '\x00WILDCARD\x00';
          const rawTerm = String(this._queryObj.searchTerm);
          const withPlaceholder = rawTerm.replace(/\*/g, WILDCARD_PLACEHOLDER);
          const escapedTerm = escapeRegex(withPlaceholder);
          const searchTerm = escapedTerm.replace(new RegExp(WILDCARD_PLACEHOLDER, 'g'), '.*');
          return {
            [field]: { $regex: `^${searchTerm}`, $options: 'i' },
          };
        });

      if (searchQuery.length > 0) {
        this._query.or(searchQuery);
      }
    }
    return this;
  }

  sort(): this {
    if (this._queryObj.sort) {
      // Filter out blocked/sensitive fields from sort
      const sortFields = this._queryObj.sort
        .split(',')
        .map((f: string) => f.trim())
        .filter((f: string) => !BLOCKED_FIELDS.includes(f.replace('-', '')));

      if (sortFields.length > 0) {
        const sortBy = sortFields.join(' ');
        const sortOrder = this._queryObj.sortOrder === 'desc' ? '-' : '';
        this._query.sort(`${sortOrder}${sortBy}`);
      } else {
        this._query.sort('-updatedAt');
      }
    } else {
      this._query.sort('-updatedAt');
    }
    return this;
  }

  limitFields(): this {
    if (this._queryObj.fields) {
      // Filter out blocked/sensitive fields from selection
      const requestedFields = this._queryObj.fields
        .split(',')
        .map((f: string) => f.trim())
        .filter((f: string) => !BLOCKED_FIELDS.includes(f.replace('-', '')));

      if (requestedFields.length > 0) {
        let fields = requestedFields.join(' ');
        if (!fields.includes('_id')) {
          fields = `-_id ${fields}`.trim();
        }
        this._query.select(fields);
      } else {
        this._query.select('-__v');
      }
    } else {
      this._query.select('-__v');
    }
    // Always exclude sensitive fields
    this._query.select(BLOCKED_FIELDS.map((f) => `-${f}`).join(' '));
    return this;
  }

  paginate(): this {
    const page = this._queryObj.page * 1 || 1;
    const limit = this._queryObj.limit * 1;
    const lastId = this._queryObj.lastId;

    if (limit) {
      if (lastId && Types.ObjectId.isValid(lastId)) {
        // If lastId is provided, we use cursor-based pagination.
        // The filter() method already added { _id: { $gt: lastId } }.
        // Therefore, we don't need to skip any records from this point.
        this._query = this._query.limit(limit);
      } else if (page) {
        // Fallback to traditional offset-based pagination
        const skip = (page - 1) * limit * 1;
        this._query = this._query.skip(skip).limit(limit);
      }
    }

    return this;
  }

  getQuery(): any {
    return this._query;
  }
}
export function validateAndTransformName(value: string): string {
  // Trim the value
  const trimmedValue = value.trim();

  // Check for leading/trailing commas or empty values
  if (
    trimmedValue === '' ||
    trimmedValue.startsWith(',') ||
    trimmedValue.endsWith(',') ||
    /^,+$/.test(trimmedValue)
  ) {
    throw new Error('Name must be a non-empty string without leading or trailing commas.');
  }

  return trimmedValue; // Return the cleaned value
}
