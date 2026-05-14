import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
@Injectable()
export class ElasticService {
  private readonly _mappingCache = new Map<string, any>();
  // Optional env-driven suffix so callers pass base names (`article`, `property`)
  // while ES actually sees `article-dev` etc. Keeps the rest of the app
  // environment-agnostic.
  private readonly _indexSuffix = process.env.ELASTICSEARCH_INDEX_SUFFIX || '';

  constructor(private readonly _elasticsearchService: ElasticsearchService) {}

  private _withSuffix(index: string): string {
    if (!this._indexSuffix || !index) return index;
    // Preserve the `all` / wildcard sentinels used by callers.
    if (index === 'all' || index === '*' || index.includes(',') || index.includes('*')) {
      return index;
    }
    return `${index}${this._indexSuffix}`;
  }

  private async _getCachedMapping(index: string): Promise<any> {
    const resolved = this._withSuffix(index);
    if (this._mappingCache.has(resolved)) {
      return this._mappingCache.get(resolved);
    }
    const mapping = await this._elasticsearchService.indices.getMapping({ index: resolved });
    const properties =
      mapping[resolved]?.mappings?.properties ||
      Object.values(mapping)[0]?.mappings?.properties ||
      {};
    this._mappingCache.set(resolved, properties);
    return properties;
  }

  async indexDocument(index: string, id: string, body: any) {
    // Validate inputs
    if (!id || id === 'undefined' || id === 'null') {
      const errorMsg = `Invalid document ID provided: ${id} (type: ${typeof id})`;
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    if (!index) {
      const errorMsg = 'Index name is required';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const result = await this._elasticsearchService.index({
        index: this._withSuffix(index),
        id,
        body,
      });

      return result;
    } catch (error) {
      console.error('❌ Error indexing document:', error.message);

      // Check for timeout errors specifically
      if (
        error.name === 'TimeoutError' ||
        error.message.includes('timeout') ||
        error.message.includes('timed out')
      ) {
        console.error('🕐 TIMEOUT ERROR detected - check Elasticsearch connectivity');
      }

      throw error;
    }
  }

  // Method to search documents
  async search(index: string, query: any) {
    try {
      const result = await this._elasticsearchService.search({
        index: index === 'all' ? '*' : this._withSuffix(index),
        track_total_hits: true,
        ...query,
      });
      console.log('index', this._withSuffix(index));
      return result;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  // Method to update a document
  async updateDocument(index: string, id: string, body: Record<string, any>) {
    try {
      return await this._elasticsearchService.update({
        index: this._withSuffix(index),
        id,
        body: {
          doc: body as any,
          doc_as_upsert: true,
        },
      } as any);
    } catch (error) {
      console.error(`Error updating document in Elasticsearch: ${error.message}`, {
        index,
        id,
        body,
        error,
      });
      // You can throw the error or return a custom response
      throw new Error(`Failed to update document with ID ${id} in index ${index}. error: ${error}`);
    }
  }

  // Method to delete documents
  async deleteDocument(index: string, id: string) {
    try {
      const result = await this._elasticsearchService.delete({
        index: this._withSuffix(index),
        id,
      });
      return result;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // Implementation of the exists method
  async exists(id: string, index: string): Promise<boolean> {
    try {
      // Ensure you call the correct method on the elasticsearch author
      const response = await this._elasticsearchService.exists({
        index: this._withSuffix(index),
        id,
      });

      // Check if the response indicates the document exists
      return response || false; // 'found' will be true if the document exists
    } catch (error) {
      console.error('Error checking if document exists:', error);
      throw error; // Rethrow the error for handling at a higher level
    }
  }

  async findOneByField(index: string, field: string, value: string): Promise<any> {
    try {
      const response = await this._elasticsearchService.search({
        index: this._withSuffix(index.toLowerCase()),
        track_total_hits: true,
        query: {
          term: {
            [field]: value,
          },
        },
        size: 1,
      });
      const total =
        typeof response.hits.total === 'object' ? response.hits.total.value : response.hits.total;

      if (total === 0 || !response.hits.hits || response.hits.hits.length === 0) {
        return null;
      }

      const hit = response.hits.hits[0];
      return {
        ...(hit._source as any),
        _id: hit._id,
      };
    } catch (error) {
      console.error(`Error finding document in Elasticsearch by ${field}: ${error.message}`, {
        index,
        field,
        value,
        error,
      });
      throw error;
    }
  }

  async findOneByFieldKeyword(index: string, field: string, value: string): Promise<any> {
    try {
      const response = await this._elasticsearchService.search({
        index: this._withSuffix(index.toLowerCase()),
        track_total_hits: true,
        query: {
          term: {
            [`${field}.keyword`]: value,
          },
        },
        size: 1,
      });
      const total =
        typeof response.hits.total === 'object' ? response.hits.total.value : response.hits.total;

      if (total === 0 || !response.hits.hits || response.hits.hits.length === 0) {
        return null;
      }

      const hit = response.hits.hits[0];
      return {
        ...(hit._source as any),
        _id: hit._id,
      };
    } catch (error) {
      console.error(`Error finding document in Elasticsearch by ${field}: ${error.message}`, {
        index,
        field,
        value,
        error,
      });
      throw error;
    }
  }
  async getNestedFields(index: string) {
    const properties = await this._getCachedMapping(index);
    if (!properties) return [];

    const nestedFields: string[] = [];
    function findNestedFields(props: any, parentField = '') {
      Object.keys(props).forEach((key) => {
        const field = props[key];
        const fieldPath = parentField ? `${parentField}.${key}` : key;
        if (field.type === 'nested') nestedFields.push(fieldPath);
        if (field.properties) findNestedFields(field.properties, fieldPath);
      });
    }
    findNestedFields(properties);
    return nestedFields;
  }

  async getIntegerFields(index: string) {
    const resolved = this._withSuffix(index);
    // Fetch the mapping for the specified index
    const mapping = await this._elasticsearchService.indices.getMapping({
      index: resolved,
    });

    // Array to store all integer fields
    const integerFields: string[] = [];

    // Recursive function to find integer fields in the mapping properties
    function findIntegerFields(properties: any, parentField = '') {
      Object.keys(properties).forEach((key) => {
        const field = properties[key];
        const fieldPath = parentField ? `${parentField}.${key}` : key;

        // Check if the field type is 'integer' (you can add more types like 'long', 'short', etc.)
        if (field.type === 'integer' || field.type === 'long' || field.type === 'short') {
          integerFields.push(fieldPath); // Add integer field to the array
        }

        // Recursively check nested properties (if any)
        if (field.properties) {
          findIntegerFields(field.properties, fieldPath);
        }
      });
    }

    // Traverse the index mapping and find integer fields
    const properties =
      mapping[resolved]?.mappings?.properties || Object.values(mapping)[0]?.mappings?.properties;
    if (!properties) return [];
    findIntegerFields(properties);

    return integerFields;
  }

  async getKeywordFields(index: string): Promise<string[]> {
    const properties = await this._getCachedMapping(index);
    if (!properties) return [];

    const keywordFields: string[] = [];
    function findKeywordFields(props: any, parentField = ''): void {
      Object.keys(props).forEach((key) => {
        const field = props[key];
        const fieldPath = parentField ? `${parentField}.${key}` : key;
        if (field.type === 'keyword') keywordFields.push(fieldPath);
        if (field.properties) findKeywordFields(field.properties, fieldPath);
        if (field.fields) findKeywordFields(field.fields, fieldPath);
      });
    }
    findKeywordFields(properties);
    return keywordFields;
  }

  async getBooleanFields(index: string): Promise<string[]> {
    const properties = await this._getCachedMapping(index);
    if (!properties) return [];

    const booleanFields: string[] = [];
    function findBooleanFields(props: any, parentField = ''): void {
      Object.keys(props).forEach((key) => {
        const field = props[key];
        const fieldPath = parentField ? `${parentField}.${key}` : key;
        if (field.type === 'boolean') booleanFields.push(fieldPath);
        if (field.properties) findBooleanFields(field.properties, fieldPath);
      });
    }
    findBooleanFields(properties);
    return booleanFields;
  }

  async bulkIndex(index: string, documents: Array<{ id: string; body: any }>) {
    if (!documents || documents.length === 0) {
      throw new Error('No documents provided for bulk indexing');
    }

    try {
      const resolved = this._withSuffix(index);
      const operations = documents.flatMap((doc) => [
        { index: { _index: resolved, _id: doc.id } },
        doc.body,
      ]);

      const result = await this._elasticsearchService.bulk({
        operations,
      });

      // Check for errors in the bulk operation
      if (result.errors) {
        const failedItems = result.items.filter((item) => item.index?.error);
        console.error('❌ Some documents failed to index:', failedItems);
      }

      return result;
    } catch (error) {
      console.error('❌ Error during bulk indexing:', error.message);
      throw error;
    }
  }

  async listIndices() {
    try {
      const indices = await this._elasticsearchService.cat.indices({ format: 'json' });
      return indices;
    } catch (error) {
      console.error('Error listing indices:', error);
      throw error;
    }
  }
}
