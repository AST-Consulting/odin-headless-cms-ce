/**
 * Strategy Pattern Implementation for Content Retrieval by Slug
 * 
 * This module exports all the components needed for the Strategy Pattern implementation:
 * - IContentRetrievalStrategy: The strategy interface
 * - Concrete strategies: ArticleRetrievalStrategy, CategoryRetrievalStrategy, TagRetrievalStrategy
 * - ContentRetrievalStrategyFactory: The factory for creating strategies
 * 
 * Usage Example:
 * ```typescript
 * constructor(
 *   private readonly strategyFactory: ContentRetrievalStrategyFactory
 * ) {}
 * 
 * async getContent(moduleType: string, slug: string) {
 *   const strategy = this.strategyFactory.getStrategy(moduleType);
 *   return await strategy.getContentBySlug(slug);
 * }
 * ```
 */

export { IContentRetrievalStrategy } from './content-retrieval.strategy';
export { ArticleRetrievalStrategy } from './article-retrieval.strategy';
export { CategoryRetrievalStrategy } from './category-retrieval.strategy';
export { TagRetrievalStrategy } from './tag-retrieval.strategy';
export { ContentRetrievalStrategyFactory } from './content-retrieval.factory';
