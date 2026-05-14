import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { TArticleDocument } from 'src/articles/schemas/article.schema';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly _indexName = (() => {
    const suffix = process.env.ELASTICSEARCH_INDEX_SUFFIX || '';
    return suffix ? `content-v1${suffix}` : 'content-v1';
  })();

  constructor(private readonly esService: ElasticsearchService) {}

  async onModuleInit() {
    // You can create the index and mapping here if it doesn't exist
    // For now, we assume the index 'content-v1' is created with the correct mapping
  }

  async search(query: string, organizationId: string, lang: string, query_vector?: number[]) {
    const searchBody: any = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['title^3', 'body', 'dek'],
              },
            },
          ],
          filter: [{ term: { organizationId } }, { term: { lang } }],
        },
      },
      size: 20,
    };

    // Add kNN search if a query vector is provided
    if (query_vector) {
      searchBody.knn = {
        field: 'body_vec', // Or title_vec, depending on strategy
        query_vector,
        k: 100,
        num_candidates: 2000,
      };
      // Add Reciprocal Rank Fusion (RRF) for hybrid scoring
      searchBody.rank = {
        rrf: {
          window_size: 100,
          rank_constant: 60,
        },
      };
    }

    const { hits } = await this.esService.search({
      index: this._indexName,
      body: searchBody,
    });

    return hits.hits.map((hit) => hit._source);
  }

  async indexArticle(article: TArticleDocument) {
    const document = this.prepareArticleForES(article);
    return this.esService.index({
      index: this._indexName,
      id: article._id.toString(),
      body: document,
    });
  }

  async updateArticle(article: TArticleDocument) {
    const document = this.prepareArticleForES(article);
    return this.esService.update({
      index: this._indexName,
      id: article._id.toString(),
      doc: document,
    });
  }

  async removeArticle(articleId: string) {
    return this.esService.delete({
      index: this._indexName,
      id: articleId,
    });
  }

  private prepareArticleForES(article: TArticleDocument): any {
    // This is where you transform the MongoDB document into the ES document format
    // as defined in your schema.
    return {
      id: article._id.toString(),
      organizationId: article.organization.id,
      lang: article.lang,
      type: article.type,
      status: article.status,
      publishedAt: article.publishedAt,
      title: article.title,
      // dek: article.dek,
      body: article.richBlocks?.map((block) => (block as any).textPlain).join(' ') || article.body,
      // beats: article.beats,
      tags: article.tags,
      entities: article.entities,
      uv: article.metricsLatest?.uv,
      ctr: article.metricsLatest?.ctr,
      // TODO: Add recencyBoost and vector fields (title_vec, body_vec)
      // These would likely be computed by a separate service.
    };
  }
}
