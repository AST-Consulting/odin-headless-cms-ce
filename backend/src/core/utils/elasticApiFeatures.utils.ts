import { STATUS } from '../constants/enums.constants';
import { ElasticService } from '../elastic/elastic.service';

export class ElasticAPIFeatures {
  private query: any;
  private queryString: any;
  private index: string;
  private sortOptions: any[];
  private sourceFields: string[];
  private keywordFields: string[];

  constructor(
    index: string,
    queryString: Record<string, any>,
    private readonly _elasticService?: ElasticService
  ) {
    this.index = index;
    this.queryString = queryString;
    this.query = {
      bool: {
        must: [],
        filter: [],
      },
    };
    this.sortOptions = [];
    this.sourceFields = [];
  }
  async filter(): Promise<this> {
    const queryObj = { ...this.queryString };
    const excludedFields = [
      'page',
      'sort',
      'limit',
      'fields',
      'search',
      'q',
      'pageSize',
      'sortField',
      'sortOrder',
      'searchTerm',
      'lastId',
      'lastSortValues',
    ];
    excludedFields.forEach((el) => delete queryObj[el]);
    const [nestedFields, keywordFields, booleanFields] = await Promise.all([
      this._elasticService.getNestedFields(this.index),
      this._elasticService.getKeywordFields(this.index),
      this._elasticService.getBooleanFields(this.index),
    ]);
    this.keywordFields = keywordFields;
    // Hardcoded fields that should always use exact matching (term queries)
    const exactMatchFields = ['slug', 'status', '_id', 'id'];

    // Handle all filters from queryObj
    Object.entries(queryObj).forEach(([key, value]) => {
      // Handle MongoDB-style $or operator
      if (key === '$or' && Array.isArray(value)) {
        const should = value.map((cond) => {
          const [subKey, subValue] = Object.entries(cond)[0];
          const isNumeric = !isNaN(Number(subValue)) && subValue !== '';
          const keywordSubfield = `${subKey}.keyword`;
          const fieldName = keywordFields.includes(keywordSubfield) ? keywordSubfield : subKey;

          if (isNumeric) {
            return { term: { [subKey]: Number(subValue) } };
          }
          return { term: { [fieldName]: subValue } };
        });

        this.query.bool.filter.push({
          bool: {
            should,
            minimum_should_match: 1,
          },
        });
      } else if (value !== undefined && value !== null && value !== '') {
        const hasWildcard = typeof value === 'string' && value.includes('*');

        // Handle range queries (gte, lte, gt, lt)
        if (
          key.includes('.gte') ||
          key.includes('.lte') ||
          key.includes('.gt') ||
          key.includes('.lt')
        ) {
          const [field, operator] = key.split('.');
          const rangeFilter = this.query.bool.filter.find((f) => f.range && f.range[field]) || {
            range: {
              [field]: {},
            },
          };

          if (!this.query.bool.filter.includes(rangeFilter)) {
            this.query.bool.filter.push(rangeFilter);
          }

          rangeFilter.range[field][operator] = value;

          if (field === 'createdAt' || field === 'updatedAt') {
            rangeFilter.range[field].format = 'strict_date_optional_time';

            // If it's a date-only string (no 'T' or ' '), expand to end of day for .lte filters
            if (operator === 'lte' && typeof value === 'string' && !value.includes('T') && !value.includes(' ')) {
              rangeFilter.range[field][operator] = `${value}T23:59:59.999Z`;
            }
          }
        }
        // Handle keyword and nested fields
        else if (keywordFields.includes(key) && nestedFields.includes(key.split('.')[0])) {
          const [parentField] = key.split('.');

          if (hasWildcard) {
            this.query.bool.filter.push({
              nested: {
                path: parentField,
                query: { wildcard: { [key]: value } },
              },
            });
          } else {
            this.query.bool.filter.push({
              nested: {
                path: parentField,
                query: { term: { [key]: value } },
              },
            });
          }
        }
        // Handle keyword fields (including dot notation like primaryCategory.id)
        else if (keywordFields.includes(key)) {
          if (hasWildcard) {
            this.query.bool.filter.push({
              wildcard: { [key]: value },
            });
          } else if (key === 'slug') {
            // Special handling for slug to allow prefix search even without wildcard
            this.query.bool.filter.push({
              prefix: { [key]: value.toString().toLowerCase() },
            });
          } else {
            this.query.bool.filter.push({
              term: { [key]: value },
            });
          }
        }
        // Handle boolean fields
        else if (booleanFields.includes(key)) {
          this.query.bool.filter.push({
            term: { [key]: value },
          });
        }
        // Handle nested field queries
        else if (key.includes('.')) {
          const [parentField] = key.split('.');
          // Check if the field is nested
          if (nestedFields.includes(parentField)) {
            if (hasWildcard) {
              this.query.bool.must.push({
                nested: {
                  path: parentField,
                  query: { wildcard: { [key]: value } },
                },
              });
            } else {
              this.query.bool.must.push({
                nested: {
                  path: parentField, // Nested path
                  query: {
                    multi_match: {
                      query: value, // Individual query term
                      fields: [key], // Search within all fields in the nested object
                      type: 'bool_prefix',
                      fuzziness: 'AUTO',
                    },
                  },
                },
              });
            }
          } else {
            // Non-nested fields (regular fields)
            if (hasWildcard) {
              this.query.bool.must.push({
                wildcard: { [key]: value },
              });
            } else {
              this.query.bool.must.push({
                multi_match: {
                  query: value,
                  fields: [key],
                  type: 'bool_prefix', // Use bool_prefix for partial matching
                  fuzziness: 'AUTO', // Allow some fuzziness (optional)
                },
              });
              this.query.bool.must.push({
                match_phrase: {
                  [key]: value,
                },
              });
            }
          }
         } else if (key === 'id') {
          this.query.bool.filter.push({
            term: { _id: value },
          });
        } else if (value && typeof value === 'object' && (value as any).$elemMatch) {
          // Handle MongoDB-style $elemMatch for nested fields
          const nestedPath = key;
          const elemMatch = (value as any).$elemMatch;
          const must = Object.entries(elemMatch).map(([subKey, subValue]) => {
            const fullPath = `${nestedPath}.${subKey}`;
            const keywordSubfield = `${fullPath}.keyword`;
            const fieldName = (this.keywordFields || []).includes(keywordSubfield) ? keywordSubfield : fullPath;

            if (Array.isArray(subValue)) {
              return { terms: { [fieldName]: subValue } };
            } else if (subValue && typeof subValue === 'object' && (subValue as any).$in) {
              return { terms: { [fieldName]: (subValue as any).$in } };
            } else {
              return { term: { [fieldName]: subValue } };
            }
          });

          this.query.bool.filter.push({
            nested: {
              path: nestedPath,
              query: {
                bool: {
                  must,
                },
              },
            },
          });
        } else {
          const isExactMatchField = exactMatchFields.includes(key);
          // Check if the value is numeric
          const isNumeric = !isNaN(Number(value)) && value !== '';

          const keywordSubfield = `${key}.keyword`;
          const fieldName = keywordFields.includes(keywordSubfield) ? keywordSubfield : key;

          if (hasWildcard) {
            // Special handling for mimeType wildcards (e.g., "video/*") on analyzed fields
            if (key === 'mimeType' && typeof value === 'string' && value.endsWith('/*')) {
              const type = value.split('/')[0];
              this.query.bool.must.push({
                match: { [key]: type },
              });
            } else {
              this.query.bool.filter.push({
                wildcard: { [fieldName]: value },
              });
            }
          } else if (isExactMatchField || isNumeric) {
            this.query.bool.filter.push({
              term: { [fieldName]: isNumeric ? Number(value) : value },
            });
          } else {
            // For text fields used as filters, we want reliable prefix matching.
            // Using bool_prefix is good, but adding a wildcard on the analyzed field
            // or simply relying on bool_prefix without match_phrase anchor is better.
            const queryValue = value.toString().toLowerCase();

            this.query.bool.must.push({
              multi_match: {
                query: queryValue,
                fields: [key],
                type: 'bool_prefix',
                fuzziness: 'AUTO',
              },
            });
          }
        }
      }
    });
    return this;
  }

  search(): this {
    if (this.queryString.q) {
      const value = this.queryString.q.trim();
      const hasWildcard = value.includes('*');

      // Fields to search across
      const fields = [
        'name^10',
        'email^8',
        'phone^8',
        'description^2',
        'location.city',
        'source',
        'user.name^5',
        'user.email^5',
        'user.phone^5',
        'title^10',
        'content',
        'slug^5',
      ];

      if (hasWildcard) {
        // If wildcard is present, query_string is the best way to handle complex patterns
        this.query.bool.must.push({
          query_string: {
            query: value,
            fields: fields,
            default_operator: 'AND',
            analyze_wildcard: true,
            allow_leading_wildcard: true,
          },
        });
      } else {
        // Split query into words to ensure each word matches something
        const words = value.split(/\s+/).filter(w => w.length > 0);

        if (words.length > 1) {
          // Multi-word case: Each word must match at least one field
          words.forEach(word => {
            this.query.bool.must.push({
              multi_match: {
                query: word,
                fields: fields,
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            });
          });
        } else {
          // Single word case: Use multiple strategies for high recall
          this.query.bool.must.push({
            bool: {
              should: [
                { multi_match: { query: value, fields: fields, type: 'phrase', boost: 10 } },
                { multi_match: { query: value, fields: fields, type: 'bool_prefix', boost: 5 } },
                { multi_match: { query: value, fields: fields, type: 'best_fields', fuzziness: 'AUTO', boost: 1 } },
                // Add explicit prefix match for keywords like slug in general search
                { prefix: { slug: { value: value.toLowerCase(), boost: 5 } } }
              ],
              minimum_should_match: 1
            }
          });
        }
      }
    }
    return this;
  }


  sort(): this {
    // Determine a stable tie-breaker field for search_after
    // We prefer id.keyword or id if they are keyword fields
    let tieBreaker = '_doc'; // Fallback to _doc which is least stable but won't crash

    if (this.keywordFields) {
      if (this.keywordFields.includes('id.keyword')) {
        tieBreaker = 'id.keyword';
      } else if (this.keywordFields.includes('id')) {
        tieBreaker = 'id';
      }
    }



    if (this.queryString.sort) {
      this.sortOptions.push(
        {
          [this.queryString.sort]: {
            order: this.queryString.sortOrder || 'desc',
          },
        },
        { [tieBreaker]: { order: 'desc' } }
      );
    } else {
      //default sort by updatedAt and tie-breaker
      this.sortOptions.push({ updatedAt: { order: 'desc' } }, { [tieBreaker]: { order: 'desc' } });
    }
    return this;
  }

  limitFields(): this {
    if (this.queryString.fields) {
      this.sourceFields = this.queryString.fields.split(',');
    }
    return this;
  }

  getQuery() {
    const page = this.queryString.page * 1 || 1;
    const limit = (this.queryString.pageSize || this.queryString.limit) * 1 || 10;
    const skip = (page - 1) * limit;

    const esQuery: any = {
      size: limit,
      query: this.query,
      sort: this.sortOptions,
    };

    //HYBRID LOGIC
    let lastSortValues = this.queryString.lastSortValues;
    if (typeof lastSortValues === 'string' && lastSortValues.startsWith('[')) {
      try {
        lastSortValues = JSON.parse(lastSortValues);
      } catch (e) {
        console.error('Failed to parse lastSortValues:', e);
        lastSortValues = null;
      }
    }
    if (lastSortValues && Array.isArray(lastSortValues) && lastSortValues.length > 0) {
      //cursor pagination
      esQuery.search_after = lastSortValues;
    } else {
      //offset pagination
      esQuery.from = skip;
    }


    if (this.sourceFields && this.sourceFields.length > 0) {
      esQuery._source = this.sourceFields;
    }

    // Log the constructed query for debugging
    // console.log(`Constructed ES Query for ${this.index}:`, JSON.stringify(esQuery, null, 2));

    return esQuery;
  }
}
