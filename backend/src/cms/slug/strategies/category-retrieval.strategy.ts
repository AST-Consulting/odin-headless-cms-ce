import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { IContentRetrievalStrategy } from './content-retrieval.strategy';
import { CategoryService } from 'src/category/category.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * Concrete Strategy for Category Content Retrieval
 * Implements the strategy for fetching category data by slug
 */
@Injectable()
export class CategoryRetrievalStrategy implements IContentRetrievalStrategy {
    constructor(
        @Inject(forwardRef(() => CategoryService)) private readonly _categoryService: CategoryService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
    ) { }

    /**
     * Retrieve category content by slug
     * Uses the CategoryService's findOneFromElastic method
     */
    async getContentBySlug(slug: string): Promise<any> {
        this._logger.log(
            `[CategoryRetrievalStrategy] Fetching category with slug: ${slug}`,
            this.constructor.name
        );

        try {
            const category = await this._categoryService.findOneFromElastic('slug', slug);

            this._logger.log(
                `[CategoryRetrievalStrategy] Successfully retrieved category: ${category?._id}`,
                this.constructor.name
            );

            return category;
        } catch (error) {
            this._logger.error(
                `[CategoryRetrievalStrategy] Failed to fetch category with slug: ${slug}`,
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
        return 'category';
    }
}
