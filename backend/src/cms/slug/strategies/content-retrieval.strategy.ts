/**
 * Strategy Interface for Content Retrieval
 * This interface defines the contract that all content retrieval strategies must implement
 */
export interface IContentRetrievalStrategy {
    /**
     * Retrieve content by slug
     * @param slug - The slug to search for
     * @returns The retrieved content
     */
    getContentBySlug(slug: string): Promise<any>;

    /**
     * Get the module type this strategy handles
     * @returns The module type (e.g., 'article', 'category', 'tag')
     */
    getModuleType(): string;
}
