import { isNotEmpty } from 'class-validator';
import { comparisonOperators, TComparisonOperators } from './utilVars';
import { ObjectId } from 'mongodb'; // Import ObjectId from MongoDB
import { escapeRegex } from './apiFeatures.utils';

export function getFilters(query: any): any {
  const filters: any = {};
  const excludedFields = ['page', 'sort', 'limit', 'fields', 'sortOrder', 'searchTerm'];

  Object.keys(query).forEach((key) => {
    if (!excludedFields.includes(key)) {
      const value = query[key];

      // Ensure the value is not empty before proceeding
      if (isNotEmpty(value)) {
        // Handle range queries like createdAt.gte, createdAt.lte
        const parts = key.split('.');
        // Check if the key is split into exactly two parts and if the second part is one of the comparison operators.
        // This allows handling of fields with dot notation where the second part is an operator such as gte, gt, lte, or lt.
        // Handle multiple values separated by commas
        if (typeof value === 'string' && value.startsWith('-')) {
          filters[key] = value;
        } else if (typeof value === 'string' && value.includes(',') && key !== 'searchTerm') {
          const valuesArray = value.split(',').map((val) => val.trim());
          filters[key] = { $in: valuesArray };
        } else if (
          parts.length === 2 &&
          comparisonOperators.includes(parts[1] as TComparisonOperators)
        ) {
          const [field, operator] = parts;
          if (!filters[field]) filters[field] = {};

          const dateValue = new Date(value);

          switch (operator) {
            case TComparisonOperators.GTE:
              filters[field] = { ...filters[field], $gte: dateValue };
              break;
            case TComparisonOperators.LTE:
              // If a full ISO string with time is provided, use it exactly.
              // Otherwise, adjust to the end of the day for inclusive date filtering.
              if (typeof value === 'string' && value.includes('T')) {
                filters[field] = { ...filters[field], $lte: dateValue };
              } else {
                const endOfDay = new Date(dateValue);
                endOfDay.setUTCDate(dateValue.getUTCDate() + 1);
                endOfDay.setUTCHours(0, 0, 0, 0);
                filters[field] = { ...filters[field], $lt: endOfDay };
              }
              break;
            case TComparisonOperators.GT:
              filters[field] = { ...filters[field], $gt: dateValue };
              break;
            case TComparisonOperators.LT:
              // If a full ISO string with time is provided, use it exactly.
              // Otherwise, adjust to the start of the day for exclusive date filtering.
              if (typeof value === 'string' && value.includes('T')) {
                filters[field] = { ...filters[field], $lt: dateValue };
              } else {
                const startOfDay = new Date(dateValue);
                startOfDay.setUTCHours(0, 0, 0, 0);
                filters[field] = { ...filters[field], $lt: startOfDay };
              }
              break;
            default:
              break;
          }
          delete filters[key];
        } else if (key === 'createdAt') {
          // Handle day-based date filter for createdAt field
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
          filters[key] = { $gte: startOfDay, $lt: endOfDay };
        } else if (key === 'lastId') {
          // Handle lastId as a MongoDB ObjectId and add filter based on sort order
          if (ObjectId.isValid(value)) {
            const order = query.sortOrder || 'desc';
            filters['_id'] = { [order === 'asc' ? '$gt' : '$lt']: new ObjectId(value) };
          }
        } else if (key === 'ids') {
          // Handle ids array - convert each to ObjectId if valid
          if (Array.isArray(value)) {
            const objectIds = value
              .map((id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null))
              .filter((id: any) => id !== null);
            if (objectIds.length > 0) {
              filters['_id'] = { $in: objectIds };
            }
          }
        } else {
          // Handle wildcard searches
          if (typeof value === 'string' && value.includes('*')) {
            // Escape regex metacharacters before replacing wildcards to prevent injection
            const escapedValue = escapeRegex(value).replace(/\\\*/g, '.*');
            filters[key] = {
              $regex: `^${escapedValue}`,
              $options: 'i',
            };
          } else {
            filters[key] = value;
          }
        }
      }
    }
  });

  return filters;
}
