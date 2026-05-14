import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileUpload, TFileUploadDocument } from './entities/fileUpload.schema';
import * as mime from 'mime-types'; // Import the mime-types package
import * as contentDisposition from 'content-disposition';

// import { ApiConfigService } from 'src/core/config/config.service';
import { FileUploadQueryDto } from './dto/query-file-upload.dto';
import { IFile } from './entities/file.interface';
import { Response } from 'express';
import * as fs from 'fs';
import { join } from 'path';
import { TApiResponse } from 'src/core/types/response';
import { getFilters } from 'src/core/utils/getFilters';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { ElasticService } from '@core/elastic/elastic.service';
import { ModuleName } from '@core/constants/enums.constants';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import * as he from 'he';

@Injectable()
export class FileUploadService {
  constructor(
    // private readonly _configService: ApiConfigService,
    @InjectModel(FileUpload.name)
    private readonly _fileUploadModel: Model<TFileUploadDocument>,
    private readonly _elasticService: ElasticService
  ) { }

  async saveFileToDB(fileObj: IFile): Promise<TApiResponse> {
    try {
      const fileData = await this._fileUploadModel.create(fileObj);

      // Index the file in Elasticsearch
      await this._indexFileInElasticsearch(fileData);

      return {
        message: 'File Uploaded SuccessFully',
        data: fileData,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error While creating File in DB', error);
    }
  }

  async saveFilesToDB(fileObjs: IFile[]): Promise<{ data: TFileUploadDocument[] }> {
    if (!fileObjs || fileObjs.length === 0) {
      return { data: [] };
    }
    try {
      const savedFiles = await this._fileUploadModel.insertMany(fileObjs, { ordered: false });

      // Index all saved files in Elasticsearch (non-blocking, best-effort)
      await Promise.allSettled(
        savedFiles.map((fileData) => this._indexFileInElasticsearch(fileData))
      );

      return { data: savedFiles };
    } catch (error) {
      // insertMany with ordered:false may partially succeed
      const insertedDocs = (error as any)?.insertedDocs;
      if (Array.isArray(insertedDocs) && insertedDocs.length > 0) {
        await Promise.allSettled(
          insertedDocs.map((fileData) => this._indexFileInElasticsearch(fileData))
        );
        return { data: insertedDocs };
      }
      throw new InternalServerErrorException('Error while bulk creating files in DB', error);
    }
  }

  private async _indexFileInElasticsearch(fileData: TFileUploadDocument): Promise<void> {
    // Prepare the document to index in Elasticsearch
    const elasticFileDocument = {
      id: fileData.id,
      fileName: fileData.fileName,
      mimeType: fileData.mimeType,
      size: fileData.size,
      sizes: fileData.sizes,
      url: fileData.url,
      path: fileData.path,
      folderPath: fileData.folderPath,
      isPrivate: fileData.isPrivate,
      organization: fileData.organization,
      createdBy: fileData.createdBy,
      property: fileData.property,
      source: fileData.source,
      caption: fileData.caption,
      media_details: fileData.media_details,
      orientation: (() => {
        const w = fileData.media_details?.width;
        const h = fileData.media_details?.height;
        if (!w || !h) return 'landscape'; // Default fallback
        if (w > h) return 'landscape';
        if (h > w) return 'portrait';
        return 'square';
      })(),
      createdAt: (fileData as any).createdAt || new Date().toISOString(),
      updatedAt: (fileData as any).updatedAt || new Date().toISOString(),
    };

    // Index the document in Elasticsearch with error handling
    try {
      await this._elasticService.indexDocument(
        ModuleName.MEDIA, // Module type for the file upload
        fileData.id, // Unique ID for the file
        elasticFileDocument // The document to be indexed
      );
      console.log('File successfully indexed in Elasticsearch:', fileData.fileName);
    } catch (error) {
      console.error('Error indexing file in Elasticsearch:', error);
    }
  }

  async findAll(
    query: FileUploadQueryDto
  ): Promise<{ data: TFileUploadDocument[]; total: number }> {
    // Assuming getFilters and APIFeatures are custom implementations
    console.log("query", query);

    if (query.propertyId) {
      (query as any)['property.id'] = query.propertyId;
      delete query.propertyId;
    }

    if (query.author) {
      (query as any)['createdBy.userId'] = query.author;
      delete query.author;
    }

    const filters = getFilters(query);
    console.log("filters", filters);
    const total = await this._fileUploadModel.countDocuments(filters);
    const features = new APIFeatures(this._fileUploadModel, query)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();

    if (query.orientation) {
      const condition = query.orientation === 'portrait' ? '$gt' : '$lt';
      filters.$expr = {
        [condition]: [
          "$media_details.height",
          "$media_details.width"
        ]
      };
    }

    const files = await features.getQuery().exec();
    return { data: files, total: total };
  }
  async findOneById(id: string): Promise<TFileUploadDocument> {
    const file = await this._fileUploadModel.findById(id);

    return file;
  }

  async findOne(id: string, res: Response) {
    const file = await this._fileUploadModel.findById(id).exec();

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // // Check if file is private and enforce access control
    // if (file.isPrivate) {
    //   if (!user || (user.role !== 'admin' && user.role !== 'doctor')) {
    //     throw new ForbiddenException('Access Denied');
    //   }
    // }

    // Resolve the file path correctly
    const projectRoot = join(__dirname, '../../../../'); // Go up to the root project folder
    const filePath = join(projectRoot, file.path);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on the server');
    }

    // Set header to download the file with the correct filename (sanitized to prevent CRLF injection)
    res.setHeader('Content-Disposition', contentDisposition(file.fileName, { type: 'attachment' }));

    try {
      // Serve the file directly by streaming it to the response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error while reading the file:', error);
      throw new InternalServerErrorException('Failed to serve the file');
    }
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findAllFromElastic(query: FileUploadQueryDto): Promise<{
    data: Partial<TFileUploadDocument>[];
    total: number | SearchTotalHits;
  }> {
    try {
      if (query.propertyId) {
        (query as any)['property.id'] = query.propertyId;
        delete query.propertyId;
      }

      if (query.author) {
        (query as any)['createdBy.userId'] = query.author;
        delete query.author;
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      const elasticQuery = {
        page: query.page || 1,
        pageSize: query.limit || 20,
        q: query.searchTerm,
        fields: query.fields,
        ...query, // Include all other query parameters directly
      };
      const features = (
        await new ElasticAPIFeatures(
          ModuleName.MEDIA,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      if (query.orientation) {
        esQuery.query.bool.filter = esQuery.query.bool.filter || [];
        esQuery.query.bool.filter.push({
          bool: {
            should: [
              { term: { orientation: query.orientation } },
              {
                bool: {
                  must_not: { exists: { field: 'orientation' } },
                  filter: {
                    script: {
                      script: {
                        source: `def source = params._source; if (source == null || source.media_details == null) return false; def h = source.media_details.height; def w = source.media_details.width; if (h == null || w == null) return false; try { double hv = Double.parseDouble(h.toString()); double wv = Double.parseDouble(w.toString()); return hv ${query.orientation === 'portrait' ? '>' : '<'} wv; } catch (Exception e) { return false; }`,
                        lang: 'painless',
                      },
                    },
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        });
      }

      // Modify search to handle nested fields for media
      if (elasticQuery.q && esQuery.query?.bool) {
        delete esQuery.query.bool.minimum_should_match;
        delete esQuery.query.bool.should;

        // 1. Decode and Normalize
        let rawQuery = (elasticQuery.q || '').replace(/^"|"$/g, '').trim();
        try {
          if (rawQuery.includes('%')) rawQuery = decodeURIComponent(rawQuery);
        } catch (e) {}

        const cleanQuery = rawQuery.normalize('NFC').trim();

        // 2. Extract strict terms (must-haves)
        const strictTerms = cleanQuery
          .split(/[\s,._\-\।:!?()\"\'\[\]{}<>]+/)
          .filter((word) => word.length >= 3);

        const strictQuery = strictTerms.join(' ') || cleanQuery;

        // Generate slug-compatible version of the query:
        const slugQuery = cleanQuery
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-]/g, '');

        // Keep existing filters (like organizationId) that features.filter might have added to must
        esQuery.query.bool.must = esQuery.query.bool.must || [];

        /**
         * STRATEGY:
         * 1. MUST: For EVERY word in the strictQuery, it must exist in at least ONE field.
         * 2. SHOULD: Phrase match and boosts to control ranking.
         */

        //--- 1. GLOBAL CONSTRAINTS ---
        // Strategy: a document must satisfy EITHER
        //   (a) Its path/url contains the full query (handles filename searches like "2019_9largeimg11_Sep_2019_074006432")
        //   OR (b) Every split term individually matches at least one text field.
        // This avoids the problem where the standard/ngram tokenizer can't match long
        // underscore-separated filename tokens that aren't at the edge of the n-gram index.

        const lowerClean = cleanQuery.toLowerCase();
        const commonExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4', 'mp3', 'csv', 'xlsx', 'xls', 'doc', 'docx'];

        // Separate meaningful terms from common extensions
        const allTerms = cleanQuery
          .split(/[\s,._\-\।:!?()\"\'\[\]{}<>]+/)
          .filter((word) => word.length >= 2);

        const extensionTerms = allTerms.filter(t => commonExtensions.includes(t.toLowerCase()));
        const nameTerms = allTerms.filter(t => !commonExtensions.includes(t.toLowerCase()) && t.length >= 3);

        // If no name terms, use all terms that are at least 3 chars
        const termsToMust = nameTerms.length > 0 ? nameTerms : allTerms.filter(t => t.length >= 3);

        const createTermClause = (term: string) => ({
          bool: {
            minimum_should_match: 1,
            should: [
              { match: { 'fileName.text': { query: term, boost: 5 } } },
              { match: { fileName: { query: term, boost: 3 } } },
              { match: { caption: { query: term, boost: 2 } } },
              { match: { alt_text: { query: term, boost: 2 } } },
              { match: { source: { query: term, boost: 1 } } },
              { match: { 'createdBy.userName': { query: term, boost: 2 } } },
              { match: { 'createdBy.slug': { query: term, boost: 2 } } },
              { wildcard: { path: { value: `*${term.toLowerCase()}*`, case_insensitive: true, boost: 4 } } },
              { wildcard: { url: { value: `*${term.toLowerCase()}*`, case_insensitive: true, boost: 3 } } },
              { match: { mimeType: { query: term, boost: 2 } } }
            ],
          },
        });

        const mustClauses = termsToMust.map(createTermClause);
        const extensionShouldClauses = extensionTerms.map(createTermClause);

        esQuery.query.bool.must.push({
          bool: {
            minimum_should_match: 1,
            should: [
              // (a) Wildcard path/url match – catches exact filename lookups (Case Insensitive)
              { wildcard: { path: { value: `*${lowerClean}*`, case_insensitive: true } } },
              { wildcard: { url: { value: `*${lowerClean}*`, case_insensitive: true } } },
              { wildcard: { fileName: { value: `*${lowerClean}*`, case_insensitive: true } } },
              // (b) Required name terms must match
              ...(mustClauses.length > 0
                ? [{ bool: { must: mustClauses } }]
                : [{ match_all: {} }]),
            ],
          },
        });

        // Add extensions as optional boosts
        if (extensionShouldClauses.length > 0) {
          esQuery.query.bool.should = esQuery.query.bool.should || [];
          esQuery.query.bool.should.push(...extensionShouldClauses);
        }

        //--- 2. RANKING BOOSTS (Phrases and exactness) ---
        esQuery.query.bool.should = [
          ...(esQuery.query.bool.should || []),
          // Wildcard path/url get the highest boost for exact filename matches
          { wildcard: { path: { value: `*${lowerClean}*`, boost: 300, case_insensitive: true } } },
          { wildcard: { url: { value: `*${lowerClean}*`, boost: 280, case_insensitive: true } } },
          { wildcard: { fileName: { value: `*${lowerClean}*`, boost: 250, case_insensitive: true } } },
          // exact phrase gets massive boost
          { match_phrase: { fileName: { query: cleanQuery, boost: 200 } } },
          { match_phrase: { caption: { query: cleanQuery, boost: 100 } } },
          { match_phrase: { alt_text: { query: cleanQuery, boost: 100 } } },
          // multi-word matching boost
          {
            match: {
              fileName: {
                query: strictQuery,
                operator: 'and',
                boost: 50,
              },
            },
          },
          // Author name or slug boost
          { match: { 'createdBy.userName': { query: cleanQuery, boost: 40 } } },
          { match: { 'createdBy.slug': { query: cleanQuery, boost: 40 } } },
        ];

        // Ensure we handle slug matching in SHOULD too
        if (slugQuery) {
          esQuery.query.bool.should.push({
            match: { fileName: { query: slugQuery, boost: 50 } },
          });
        }

        // Override sort to prioritize relevance score
        esQuery.sort = [
          { _score: { order: 'desc' } },
          { updatedAt: { order: 'desc' } },
        ];
      }

      const result = await this._elasticService.search(ModuleName.MEDIA, esQuery);

      const files = result.hits.hits.map((hit) => {
        const source = hit._source as any;
        if (source.fileName) source.fileName = he.decode(source.fileName);
        if (source.caption) source.caption = he.decode(source.caption);
        return {
          _id: hit._id,
          ...source,
        };
      });

      return {
        data: files,
        total: result.hits.total,
      };
    } catch (error) {

      console.error('Error in fetching File from Elasticsearch and fallback to MongoDB:', error);
      const files = await this.findAll(query);
      return {
        data: files.data,
        total: files.total,
      };
    }
  }

  async findRelevantImages(
    searchTerms: string,
    organizationId?: string,
    propertyId?: string,
    limit: number = 5,
  ): Promise<Record<string, unknown>[]> {
    try {
      const must: Record<string, unknown>[] = [
        { prefix: { 'mimeType.keyword': 'image/' } },
        { term: { isPrivate: false } },
      ];

      if (organizationId) {
        must.push({ term: { 'organization.id': organizationId } });
      }
      if (propertyId) {
        must.push({ term: { 'property.id': propertyId } });
      }

      const should: Record<string, unknown>[] = [
        { match_phrase: { caption: { query: searchTerms, boost: 5 } } },
        { match_phrase: { alt_text: { query: searchTerms, boost: 4 } } },
        { match: { caption: { query: searchTerms, boost: 10, minimum_should_match: '40%' } } },
        { match: { alt_text: { query: searchTerms, boost: 8, minimum_should_match: '40%' } } },
        { match: { fileName: { query: searchTerms, boost: 5, minimum_should_match: '40%' } } },
      ];

      // Boost images from last 6 months for recency
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      should.push({
        range: {
          createdAt: {
            gte: sixMonthsAgo.toISOString(),
            boost: 10,
          },
        },
      });

      const esQuery = {
        query: {
          bool: {
            must,
            should,
            minimum_should_match: 1,
          },
        },
        min_score: 15,
        size: limit,
        sort: [{ _score: { order: 'desc' } }],
        _source: ['fileName', 'caption', 'alt_text', 'url', 'path', 'mimeType', 'sizes', 'media_details', 'createdAt'],
      };

      const result = await this._elasticService.search(ModuleName.MEDIA, esQuery);

      return result.hits.hits.map((hit) => ({
        _id: hit._id,
        _score: hit._score,
        ...(hit._source as Record<string, unknown>),
      }));
    } catch (error) {
      console.error('findRelevantImages failed:', (error as Error).message);
      return [];
    }
  }

  async findRelevantMedia(
    searchTerms: string,
    organizationId?: string,
    propertyId?: string,
    limit: number = 8,
    includeVideos: boolean = false
  ): Promise<Record<string, unknown>[]> {
    const rankCandidates = (items: Record<string, unknown>[]): Record<string, unknown>[] => {
      const tokenize = (value: string): string[] =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9\u0900-\u097f\s-]/g, ' ')
          .split(/[\s-]+/)
          .map((token) => token.trim())
          .filter((token) => token.length > 2);

      const queryTokens = new Set(tokenize(searchTerms || ''));
      if (!queryTokens.size) {
        return items;
      }

      return [...items]
        .map((item) => {
          const caption = String(item.caption || '');
          const alt = String((item as any).alt_text || '');
          const fileName = String(item.fileName || '');
          const source = String(item.source || '');
          const haystack = `${caption} ${alt} ${fileName} ${source}`.toLowerCase();
          const hayTokens = new Set(tokenize(haystack));
          let overlapScore = 0;
          queryTokens.forEach((token) => {
            if (hayTokens.has(token)) overlapScore += 3;
            else if (haystack.includes(token)) overlapScore += 1;
          });
          // Keep ES score as a signal but avoid over-dominating lexical intent.
          const elasticScore = Number((item as any)._score || 0);
          const recencyBoost = Number((item as any).createdAt ? 1 : 0);
          return {
            ...item,
            _rank: overlapScore * 10 + elasticScore + recencyBoost,
          };
        })
        .sort((a: any, b: any) => Number(b._rank || 0) - Number(a._rank || 0))
        .map((item) => {
          const { _rank, ...rest } = item as any;
          return rest as Record<string, unknown>;
        });
    };

    const runMongoFallback = async (): Promise<Record<string, unknown>[]> => {
      const escaped = String(searchTerms || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filter: Record<string, unknown> = {
        isPrivate: false,
      };
      if (organizationId) {
        (filter as any)['organization.id'] = organizationId;
      }
      if (propertyId) {
        (filter as any)['property.id'] = propertyId;
      }

      if (includeVideos) {
        filter.mimeType = { $regex: '^(image|video)/', $options: 'i' };
      } else {
        filter.mimeType = { $regex: '^image/', $options: 'i' };
      }

      const relevanceClauses =
        escaped.length > 1
          ? [
              { caption: { $regex: escaped, $options: 'i' } },
              { alt_text: { $regex: escaped, $options: 'i' } },
              { fileName: { $regex: escaped, $options: 'i' } },
              { path: { $regex: escaped, $options: 'i' } },
              { folderPath: { $regex: escaped, $options: 'i' } },
              { source_url: { $regex: escaped, $options: 'i' } },
            ]
          : [];

      // First pass: scoped + relevance text match.
      if (relevanceClauses.length) {
        const matched = await this._fileUploadModel
          .find({ ...filter, $or: relevanceClauses })
          .sort({ createdAt: -1 })
          .limit(Math.max(1, Math.min(limit, 20)))
          .select('fileName caption alt_text url path mimeType sizes media_details createdAt')
          .lean();
        if (matched.length) {
          return rankCandidates(
            matched.map((doc: any) => ({
              _id: String(doc._id),
              ...doc,
            }))
          );
        }
        // Had searchable text but no caption/alt/filename match — do not substitute unrelated
        // "latest uploads" or scene search will look random vs. stock providers.
        return [];
      }

      // No searchable string: return recent scoped media (browse-style).
      const recent = await this._fileUploadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(Math.max(1, Math.min(limit, 20)))
        .select('fileName caption alt_text url path mimeType sizes media_details createdAt')
        .lean();
      return rankCandidates(
        recent.map((doc: any) => ({
            _id: String(doc._id),
            ...doc,
        }))
      );
    };

    try {
      const mimeShould: Record<string, unknown>[] = [{ prefix: { 'mimeType.keyword': 'image/' } }];
      if (includeVideos) {
        mimeShould.push({ prefix: { 'mimeType.keyword': 'video/' } });
      }

      const must: Record<string, unknown>[] = [
        {
          bool: {
            should: mimeShould,
            minimum_should_match: 1,
          },
        },
        { term: { isPrivate: false } },
      ];

      if (organizationId) {
        must.push({ term: { 'organization.id': organizationId } });
      }
      if (propertyId) {
        must.push({ term: { 'property.id': propertyId } });
      }

      const should: Record<string, unknown>[] = [
        { match_phrase: { caption: { query: searchTerms, boost: 6 } } },
        { match_phrase: { alt_text: { query: searchTerms, boost: 5 } } },
        { match_phrase: { fileName: { query: searchTerms, boost: 7 } } },
        { match: { caption: { query: searchTerms, boost: 8, minimum_should_match: '40%' } } },
        { match: { alt_text: { query: searchTerms, boost: 6, minimum_should_match: '40%' } } },
        { match: { fileName: { query: searchTerms, boost: 7, minimum_should_match: '30%' } } },
        { match: { path: { query: searchTerms, boost: 6, minimum_should_match: '30%' } } },
        { match: { folderPath: { query: searchTerms, boost: 4, minimum_should_match: '30%' } } },
        { wildcard: { path: { value: `*${String(searchTerms || '').toLowerCase()}*`, case_insensitive: true, boost: 5 } } },
        { wildcard: { fileName: { value: `*${String(searchTerms || '').toLowerCase()}*`, case_insensitive: true, boost: 6 } } },
      ];
      // Do NOT put recency-only clauses in `should` with minimum_should_match: 1 — that would
      // match every scoped file from the last N months with no text overlap (video scene bug).

      const esQuery = {
        query: {
          bool: {
            must,
            should,
            minimum_should_match: 1,
          },
        },
        min_score: 0.5,
        size: Math.max(1, Math.min(limit, 20)),
        sort: [{ _score: { order: 'desc' } }],
        _source: [
          'fileName',
          'caption',
          'alt_text',
          'url',
          'path',
          'mimeType',
          'sizes',
          'media_details',
          'createdAt',
        ],
      };

      const result = await this._elasticService.search(ModuleName.MEDIA, esQuery);
      const mappedResults = result.hits.hits.map((hit) => ({
        _id: hit._id,
        _score: hit._score,
        ...(hit._source as Record<string, unknown>),
      }));
      if (mappedResults.length) {
        return rankCandidates(mappedResults);
      }

      return await runMongoFallback();
    } catch (error) {
      console.error('findRelevantMedia failed:', (error as Error).message);
      return await runMongoFallback();
    }
  }

  async findByPath(path: string, res: Response) {
    const file = await this._fileUploadModel.findOne({ path });
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Resolve the file path correctly
    const projectRoot = join(__dirname, '../../../../'); // Go up to the root project folder
    const filePath = join(projectRoot, file.path);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on the server');
    }

    // Determine the MIME type based on the file extension
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    // Set the appropriate Content-Type header for display
    res.setHeader('Content-Type', mimeType);

    // Remove problematic headers
    res.removeHeader('Content-Length'); // Avoid setting a fixed Content-Length for streams

    // Optionally set Content-Disposition to 'inline' to attempt to display the file (sanitized to prevent CRLF injection)
    res.setHeader('Content-Disposition', contentDisposition(file.fileName, { type: 'inline' }));

    try {
      // Serve the file directly by streaming it to the response
      const fileStream = fs.createReadStream(filePath);

      // Handle stream errors
      fileStream.on('error', (err) => {
        console.error('Error while reading the file:', err);
        if (!res.headersSent) {
          res.status(500).send('Error while reading the file');
        }
      });

      // Ensure the stream is fully piped and served
      fileStream
        .pipe(res)
        .on('finish', () => {
          res.end();
        })
        .on('error', (err) => {
          console.error('Error while piping the file:', err);
          if (!res.headersSent) {
            res.status(500).send('Error while serving the file');
          }
        });
    } catch (error) {
      console.error('Error while serving the file:', error);
      throw new InternalServerErrorException('Failed to serve the file');
    }
  }
}
