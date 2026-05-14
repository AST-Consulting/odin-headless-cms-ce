import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ArticleRichBlock, TArticleRichBlockDocument } from './schema/article-rich-block.schema';
import { UserInfo } from '@core/utils/utilVars';

@Injectable()
export class ArticleRichBlocksService {
  constructor(
    @InjectModel(ArticleRichBlock.name)
    private readonly richBlockModel: Model<TArticleRichBlockDocument>
  ) { }

  private isObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Returns all active blocks for an article ordered by `order` asc.
   * The `id` on each block is the MongoDB `_id`, matching `article.richBlocks[i].id`.
   *
   * For liveblog articles, blocks are stored as parent-child (timestamp blocks
   * hold their content in metadata.children). This method flattens them back
   * into a normal ordered sequence before returning.
   */
  async findByArticleId(articleId: string): Promise<any[]> {
    const docs = await this.richBlockModel
      .find({ articleId })
      .sort({ order: 1 })
      .lean()
      .exec();

    const flat: any[] = [];

    for (const doc of docs) {
      const children: any[] = doc.metadata?.children ?? [];
      const { children: _omit, ...metadataWithoutChildren } = doc.metadata ?? {};

      // Derive author metadata from timestamp props when createdBy/updatedBy are absent
      const props = doc.metadata?.props ?? {};
      const authorFromProps =
        props.authorId || props.authorName
          ? {
              id: String(props.authorId ?? ''),
              name: props.authorName ?? '',
              email: '',
              userType: 'author',
            }
          : null;

      const createdBy = doc.createdBy ?? authorFromProps;
      const updatedBy = doc.updatedBy ?? authorFromProps;

      flat.push({
        id: doc._id.toString(),
        type: doc.type,
        content: doc.content,
        metadata: children.length > 0 ? metadataWithoutChildren : doc.metadata,
        order: doc.order,
        status: doc.status,
        createdBy,
        updatedBy,
      });

      for (const child of children) {
        flat.push({
          ...child,
          createdBy: child.createdBy ?? createdBy,
          updatedBy: child.updatedBy ?? updatedBy,
        });
      }
    }

    return flat;
  }

  /**
   * Partial upsert — only touches blocks present in the incoming set.
   * Blocks not included in the payload are left unchanged.
   *
   * Returns idMap: { incomingId → mongoId } so callers can rewrite
   * `article.richBlocks[i].id` to the MongoDB _id.
   */
  async bulkUpsert(
    articleId: string,
    blocks: any[],
    editedBy?: UserInfo,
    author?: { id: string; name: string; slug?: string }
  ): Promise<Record<string, string>> {
    const idMap: Record<string, string> = {};

    for (const block of blocks) {
      const setPayload = {
        type: block.type,
        content: block.content ?? null,
        metadata: block.metadata ?? null,
        order: block.order ?? 0,
        status: block.status || 'active',
        updatedBy: editedBy ?? null,
      };

      let doc: TArticleRichBlockDocument;

      if (this.isObjectId(block.id)) {
        // Existing block — update by _id
        doc = await this.richBlockModel.findOneAndUpdate(
          { _id: block.id, articleId },
          { $set: setPayload },
          { new: true }
        );

        if (!doc) {
          // Defensive fallback: _id not found, treat as new
          doc = await this.richBlockModel.findOneAndUpdate(
            { articleId, blockId: block.id },
            { $set: setPayload, $setOnInsert: { createdBy: editedBy ?? null, author: author ?? null } },
            { upsert: true, new: true }
          );
        }
      } else {
        // New block — upsert by blockId
        doc = await this.richBlockModel.findOneAndUpdate(
          { articleId, blockId: block.id },
          { $set: setPayload, $setOnInsert: { createdBy: editedBy ?? null, author: author ?? null } },
          { upsert: true, new: true }
        );
      }

      idMap[block.id] = doc._id.toString();
    }

    return idMap;
  }

  /**
   * Soft-deletes a single block and returns its MongoDB _id for the caller
   * to remove from the article's embedded richBlocks array.
   */
  async softDeleteBlock(blockMongoId: string): Promise<void> {
    await this.richBlockModel.findByIdAndUpdate(blockMongoId, { $set: { status: 'deleted' } });
  }

  /**
   * Soft-deletes all blocks for an article (called when the article is deleted).
   */
  async deleteByArticleId(articleId: string): Promise<void> {
    await this.richBlockModel.updateMany({ articleId }, { $set: { status: 'deleted' } });
  }
}
