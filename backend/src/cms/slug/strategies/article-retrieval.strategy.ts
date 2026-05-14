import { Injectable, Inject, Logger } from '@nestjs/common';
import { IContentRetrievalStrategy } from './content-retrieval.strategy';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ArticlesService } from '@articles/articles.service';

/**
 * Concrete Strategy for Article Content Retrieval
 * Implements the strategy for fetching article data by slug
 */
@Injectable()
export class ArticleRetrievalStrategy implements IContentRetrievalStrategy {
    constructor(
        @Inject('ARTICLES_SERVICE') private readonly _articlesService: ArticlesService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
    ) { }

    /**
     * Retrieve article content by slug
     * Uses the ArticlesService's findOneBySlugFromElastic method
     */
    async getContentBySlug(slug: string): Promise<any> {
        this._logger.log(
            `[ArticleRetrievalStrategy] Fetching article with slug: ${slug}`,
            this.constructor.name
        );

        try {
            const article = await this._articlesService.findOneBySlugFromElastic(slug);

            this._logger.log(
                `[ArticleRetrievalStrategy] Successfully retrieved article: ${article?._id}`,
                this.constructor.name
            );

            return article;
        } catch (error) {
            this._logger.error(
                `[ArticleRetrievalStrategy] Failed to fetch article with slug: ${slug}`,
                error.stack,
                this.constructor.name
            );
            throw error;
        }
    }

    /**
     * Returns the module type this strategy handles
     */
    getModuleType(): string {
        return 'article';
    }
}
