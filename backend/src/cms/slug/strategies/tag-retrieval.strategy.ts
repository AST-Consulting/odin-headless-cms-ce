import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { IContentRetrievalStrategy } from './content-retrieval.strategy';
import { TagsService } from '@tags/tags.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * Concrete Strategy for Tag Content Retrieval
 * Implements the strategy for fetching tag data by slug
 */
@Injectable()
export class TagRetrievalStrategy implements IContentRetrievalStrategy {
    constructor(
        @Inject(forwardRef(() => TagsService)) private readonly _tagsService: TagsService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
    ) { }

    /**
     * Retrieve tag content by slug
     * Uses the TagsService's findOneFromElastic method
     */
    async getContentBySlug(slug: string): Promise<any> {
        this._logger.log(
            `[TagRetrievalStrategy] Fetching tag with slug: ${slug}`,
            this.constructor.name
        );

        try {
            const tag = await this._tagsService.findOneFromElastic('slug', slug);

            this._logger.log(
                `[TagRetrievalStrategy] Successfully retrieved tag: ${tag?._id}`,
                this.constructor.name
            );

            return tag;
        } catch (error) {
            this._logger.error(
                `[TagRetrievalStrategy] Failed to fetch tag with slug: ${slug}`,
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
        return 'tag';
    }
}
