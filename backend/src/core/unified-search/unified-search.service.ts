import { Injectable } from '@nestjs/common';
import { ElasticService } from '../elastic/elastic.service';

@Injectable()
export class UnifiedSearchService {
  constructor(private readonly _elasticService: ElasticService) {}
  async search(
    page: number,
    pageSize: number,
    query?: string[],
    index?: string,
    fields?: string[],
    filters?: string[],
    range?: string,
    rank?: string,
    sortField?: string,
    sortOrder?: 'asc' | 'desc'
  ) {
    // Parse the filters and ranges into usable objects
    const filterArray = this.parseFilters(filters);
    const dateRange = this.parseRange(range);

    // Call your Elasticsearch service with the constructed parameters
    const results = await this.performSearch(
      page,
      pageSize,
      query,
      index,
      fields,
      filterArray,
      dateRange,
      rank,
      sortField,
      sortOrder
    );

    return results;
  }

  private parseFilters(filters?: string[]): { key: string; value: string }[] {
    if (!filters) return [];
    // Split the filters by commas and create an array of filter objects
    return filters.map((filter) => {
      const [key, value] = filter.split(':');
      return { key, value }; // Adjust based on your filtering logic
    });
  }

  private parseRange(range?: string): any {
    if (!range) return null;
    // Parse the range query string into a usable object
    const rangeObj: Record<string, string> = {};
    // Split by commas to handle gte and lte values within the range parameter
    range.split(',').forEach((item) => {
      const [key, value] = item.split(':');
      if (key && value) {
        rangeObj[key] = value;
      }
    });
    // Return the parsed object in a format compatible with the Elasticsearch range query
    return {
      startDate: rangeObj.gte,
      endDate: rangeObj.lte,
    };
  }

  private async performSearch(
    page: number,
    pageSize: number,
    queries?: string[], // Changed to array to support multiple queries
    index?: string, // Changed to array to support multiple indices
    fields?: string[], // Changed to array to support multiple fields
    filterArray?: { key: string; value: string }[],
    dateRange?: any,
    rank?: string,
    sortField?: string, // New parameter for the sort field
    sortOrder?: 'asc' | 'desc' // New parameter for the sort order
  ) {
    // Handle null, undefined, or invalid values for page and pageSize
    const effectivePage = typeof page === 'number' && !isNaN(page) && page > 0 ? page : 1;
    const effectivePageSize =
      typeof pageSize === 'number' && !isNaN(pageSize) && pageSize > 0 ? pageSize : 10;

    const nestfields = await this._elasticService.getNestedFields(index);
    const integerFields = await this._elasticService.getIntegerFields(index);
    const esQuery = {
      from: (effectivePage - 1) * effectivePageSize, // Calculate the offset
      size: effectivePageSize, // Number of documents to retrieve
      query: {
        bool: {
          must: [],
          filter: [],
        },
      },
      sort: [],
      _source: true, // Return the source document
    };
    // Ensure that queries and fields arrays are available and have the same length
    if (queries && fields && queries.length === fields.length) {
      // Create a separate multi_match for each query and corresponding field
      queries.forEach((query, index) => {
        const field = fields[index]; // Corresponding field
        const parentField = field.split('.')[0]; // Remove anything after the first '.'

        // Check if the field is nested
        if (nestfields.includes(parentField)) {
          // Use nested query for nested fields
          esQuery.query.bool.must.push({
            nested: {
              path: parentField, // Nested path
              query: {
                multi_match: {
                  query: query, // Individual query term
                  fields: [field], // Search within all fields in the nested object
                  type: 'bool_prefix',
                  fuzziness: 'AUTO',
                },
              },
            },
          });
        } else if (integerFields.includes(field)) {
          // Use a term query for integer fields (no fuzziness)
          esQuery.query.bool.must.push({
            term: {
              [field]: parseInt(query, 10), // Ensure the query value is an integer
            },
          });
        } else {
          // Non-nested fields (regular fields)
          esQuery.query.bool.must.push({
            multi_match: {
              query: query, // Individual query term
              fields: [field], // Corresponding field for that query
              type: 'bool_prefix',
              fuzziness: 'AUTO',
            },
          });
        }
      });
    } else if (queries && fields) {
      console.log('Queries and fields must be of the same length.');
    } else if (queries && !fields) {
      // If no fields are provided, use '*' for all fields
      queries.forEach((query) => {
        esQuery.query.bool.must.push({
          multi_match: {
            query: query,
            fields: ['*'], // Search across all fields
            type: 'bool_prefix',
            fuzziness: 'AUTO',
          },
        });
      });
    }

    // Add filters to the "filter" clause
    if (filterArray && filterArray.length > 0) {
      filterArray.forEach((filter) => {
        esQuery.query.bool.filter.push({
          term: {
            [filter.key]: filter.value, // Example: { department: "Cardiology" }
          },
        });
      });
    }

    // Add date range filter if provided
    if (dateRange) {
      esQuery.query.bool.filter.push({
        range: {
          createdAt: {
            // Adjust field name based on your document structure
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      });
    }

    // Add rank filter if provided
    if (rank) {
      const [operator, value] = rank.split(':'); // Expecting format "gt:10" or "lt:5"
      const numericValue = parseInt(value, 10);

      if (operator === 'gt') {
        esQuery.query.bool.filter.push({
          range: {
            rank: {
              // Assuming your rank field is named 'rank'
              gt: numericValue, // Greater than condition
            },
          },
        });
      } else if (operator === 'lt') {
        esQuery.query.bool.filter.push({
          range: {
            rank: {
              lt: numericValue, // Less than condition
            },
          },
        });
      }
    }

    // Add sorting if provided
    if (sortField) {
      esQuery.sort.push({
        [sortField]: {
          order: sortOrder || 'asc', // Default to ascending if no order is specified
        },
      });
    }

    // Convert index array to a comma-separated string, default to 'all' if not provided
    const indexToSearch = index && index.length > 0 ? index : 'all';
    const esQueryString = JSON.stringify(esQuery, null, 2);

    // Execute the search in Elasticsearch (adjust this according to your service)
    const esResults = await this._elasticService.search(indexToSearch || 'all', esQuery);
    const total = esResults.hits.total.valueOf(); // Get total hits count

    const documents = esResults.hits.hits.map((hit) => {
      const { _source, _id } = hit;
      const restObj = _source;
      return Object.assign({ _id }, restObj);
    });
    return {
      total, // Return the total hits count
      data: documents, // Return only the documents without metadata
    };
  }

  async externalSearch(query?: string, index?: string[], fields?: string) {
    // Call your Elasticsearch service with the constructed parameters
    const results = await this.externalPerformSearch(query, index, fields);

    return results;
  }

  private async externalPerformSearch(
    query?: string, // Changed to array to support multiple queries
    index?: string[], // Changed to array to support multiple indices
    field?: string // Changed to array to support multiple fields
  ) {
    const esQuery = {
      query: {
        bool: {
          must: [
            {
              match: {
                [field]: {
                  query, // Query term
                  fuzziness: 'AUTO', // Enable fuzziness for flexible matching
                },
              },
            },
          ],
        },
      },
      sort: [],
      _source: true, // Return the source document
    };

    // Convert index array to a comma-separated string, default to 'all' if not provided
    const indexToSearch = index && index.length > 0 ? index.join(',') : '*';
    const esQueryString = JSON.stringify(esQuery, null, 2);

    // Execute the search in Elasticsearch (adjust this according to your service)
    const esResults = await this._elasticService.search(indexToSearch, esQuery);
    const total = esResults.hits.total.valueOf(); // Get total hits count

    const documents = esResults.hits.hits.map((hit) => {
      const { _source, _id, _index } = hit;
      const restObj = _source as Record<string, any>;
      // return Object.assign({ _id }, restObj);
      // Include the _index field in the document object
      return { _id, _index, ...restObj };
    });
    return {
      total, // Return the total hits count
      data: documents, // Return only the documents without metadata
    };
  }

  // Method to get all documents with pagination
  async getAllDocuments(index: string, page: number, pageSize: number) {
    const esQuery = {
      from: (page - 1) * pageSize, // Calculate the offset
      size: pageSize, // Number of documents to retrieve
      query: {
        match_all: {}, // Match all documents in the index
      },
    };

    const esResults = await this._elasticService.search(index, esQuery);
    return {
      total: esResults.hits.total.valueOf, // Total number of documents
      hits: esResults.hits.hits, // The retrieved documents
    };
  }
}
