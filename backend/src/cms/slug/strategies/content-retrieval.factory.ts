import { Injectable, BadRequestException, Inject, Logger } from '@nestjs/common';
import { IContentRetrievalStrategy } from './content-retrieval.strategy';
import { ArticleRetrievalStrategy } from './article-retrieval.strategy';
import { CategoryRetrievalStrategy } from './category-retrieval.strategy';
import { TagRetrievalStrategy } from './tag-retrieval.strategy';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * Factory class for creating content retrieval strategies
 * Implements the Factory Pattern to instantiate the correct strategy based on module type
 */
@Injectable()
export class ContentRetrievalStrategyFactory {
  private readonly _strategies: Map<string, IContentRetrievalStrategy>;

  constructor(
    private readonly _articleRetrievalStrategy: ArticleRetrievalStrategy,
    private readonly _categoryRetrievalStrategy: CategoryRetrievalStrategy,
    private readonly _tagRetrievalStrategy: TagRetrievalStrategy,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {
    // Initialize the strategies map with all available strategies
    this._strategies = new Map<string, IContentRetrievalStrategy>();
    this._registerStrategy(this._articleRetrievalStrategy);
    this._registerStrategy(this._categoryRetrievalStrategy);
    this._registerStrategy(this._tagRetrievalStrategy);

    this._logger.log(
      `[ContentRetrievalStrategyFactory] Registered ${this._strategies.size} strategies: ${Array.from(this._strategies.keys()).join(', ')}`,
      this.constructor.name
    );
  }

  /**
   * Register a strategy in the factory
   * @param strategy - The strategy to register
   */
  private _registerStrategy(strategy: IContentRetrievalStrategy): void {
    const moduleType = strategy.getModuleType();
    this._strategies.set(moduleType.toLowerCase(), strategy);
  }

  /**
   * Get the appropriate strategy based on module type
   * @param moduleType - The type of module (e.g., 'article', 'category', 'tag')
   * @returns The corresponding strategy
   * @throws BadRequestException if the module type is not supported
   */
  getStrategy(moduleType: string): IContentRetrievalStrategy {
    const normalizedModuleType = moduleType.toLowerCase().trim();

    this._logger.log(
      `[ContentRetrievalStrategyFactory] Getting strategy for module type: ${normalizedModuleType}`,
      this.constructor.name
    );

    const strategy = this._strategies.get(normalizedModuleType);

    if (!strategy) {
      const availableTypes = Array.from(this._strategies.keys()).join(', ');
      const errorMessage = `Unsupported module type: ${moduleType}. Available types: ${availableTypes}`;

      this._logger.error(
        `[ContentRetrievalStrategyFactory] ${errorMessage}`,
        '',
        this.constructor.name
      );

      throw new BadRequestException(errorMessage);
    }

    return strategy;
  }

  /**
   * Get all registered module types
   * @returns Array of supported module types
   */
  getSupportedModuleTypes(): string[] {
    return Array.from(this._strategies.keys());
  }
}
