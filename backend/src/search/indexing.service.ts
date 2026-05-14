import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SearchService } from './search.service';

@Injectable()
export class IndexingService implements OnModuleInit {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly searchService: SearchService
  ) {}

  onModuleInit() {
    // IMPORTANT: MongoDB Change Streams require a replica set configuration.
    // This will fail on a standalone MongoDB instance.
    // The following code is commented out to allow the application to run
    // in a local development environment without a replica set.
    // For production, you MUST enable this and run MongoDB as a replica set
    // for real-time Elasticsearch indexing to work.

    this.logger.warn(
      'MongoDB Change Stream listener is disabled. Real-time indexing will not work.'
    );
    this.logger.warn(
      'To enable, uncomment the code in `indexing.service.ts` and run MongoDB as a replica set.'
    );

    /*
    const articleStream = this.connection.collection('articles').watch();

    articleStream.on('change', async (change) => {
      this.logger.log('Change detected in articles collection:', change.operationType);

      try {
        switch (change.operationType) {
          case 'insert':
            await this.searchService.indexArticle(change.fullDocument as unknown as ArticleDocument);
            break;
          case 'update':
          case 'replace':
            const updatedDoc = await this.connection.collection('articles').findOne({ _id: change.documentKey._id });
            if (updatedDoc) {
              await this.searchService.updateArticle(updatedDoc as unknown as ArticleDocument);
            }
            break;
          case 'delete':
            await this.searchService.removeArticle(change.documentKey._id.toString());
            break;
        }
      } catch (error) {
        this.logger.error('Error processing change stream event', error);
      }
    });

    articleStream.on('error', (error) => {
      this.logger.error('MongoDB Change Stream error:', error);
    });
    */
  }
}
