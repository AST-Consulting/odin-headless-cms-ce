import { Model } from 'mongoose';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Analytics, TAnalyticsDocument } from './schemas/analytics.schema';
import { getFilters } from 'src/core/utils/getFilters';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary.dto';
import { ArticlesService } from 'src/articles/articles.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(Analytics.name)
    private readonly _analyticsModel: Model<TAnalyticsDocument>,
    private readonly _articlesService: ArticlesService,

    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {}

  async createAnalytics(blogId: string, property: string, publish_url: string): Promise<Analytics> {
    try {
      // Find the blog from articlesService
      const blog = await this._articlesService.getById(blogId);

      if (!blog) {
        throw new Error('Blog not found');
      }

      // Get today's date (start of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if analytics document exists for today
      const existingAnalytics = await this._analyticsModel.findOne({
        content_id: blogId,
        propertyName: property,
        date: today,
      });

      if (existingAnalytics) {
        // Update existing document - increment views by 1
        const updatedAnalytics = await this._analyticsModel.findOneAndUpdate(
          {
            content_id: blogId,
            propertyName: property,
            date: today,
          },
          {
            $inc: { views: 1 },
          },
          { new: true }
        );

        this.logger.log(
          `Analytics updated for blog ${blogId} on ${today.toISOString().split('T')[0]}`
        );
        return updatedAnalytics;
      } else {
        // Create new document for today
        const analyticsData = {
          content_id: blogId,
          published_url: publish_url,
          date: today,
          content_type: blog.type || 'blog',
          impression: 0,
          views: 1, // Start with 1 view
          category: blog.categories || '',
          author_id: blog.authors?.[0]?.id || '',
          organization_id: blog.organization.id || '',
          // client_id: blog.user?.id || '',
          property_id: blog.property.id || '',
          propertyName: property || '',
        };

        console.log('DEBUG: Analytics data being saved:', JSON.stringify(analyticsData, null, 2));

        const newAnalytics = new this._analyticsModel(analyticsData);
        const savedAnalytics = await newAnalytics.save();

        console.log('DEBUG: Saved analytics:', JSON.stringify(savedAnalytics, null, 2));

        this.logger.log(
          `New analytics created for blog ${blogId} on ${today.toISOString().split('T')[0]}`
        );
        return savedAnalytics;
      }
    } catch (error) {
      this.logger.error(`Error creating analytics for blog ${blogId}:`, error);
      throw error;
    }
  }

  async findAll(
    userId: string,
    query: QueryAnalyticsDto
  ): Promise<{ data: TAnalyticsDocument[]; total: number }> {
    // Apply the userId filter to query
    const userQuery = { ...query, client_id: userId };

    // Get filters from query parameters
    const filters = getFilters(userQuery);

    // Create a query with filtering, sorting, pagination, etc.
    const blogConfigs = new APIFeatures(this._analyticsModel as any, userQuery)
      .filter()
      .sort()
      .limitFields()
      .paginate()
      .sort();

    const total = await this._analyticsModel.countDocuments(filters);

    // Execute the query
    const blogConfig = await blogConfigs.getQuery().exec();

    return {
      data: blogConfig,
      total: total,
    };
  }

  async getViewsSummary(
    userId: string,
    params: AnalyticsSummaryQueryDto
  ): Promise<{ totalViews: number; breakdown?: Array<{ key: string; totalViews: number }> }> {
    const match: any = { client_id: userId };

    if (params.property_id) match.property_id = params.property_id;
    if (params.author_id) match.author_id = params.author_id;

    // Build date filter (stored dates are start-of-day).
    if (params.date) {
      const d = new Date(params.date);
      const start = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
      );
      const end = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
      );
      match.date = { $gte: start, $lte: end };
    } else if (params.startDate || params.endDate) {
      const start = params.startDate ? new Date(params.startDate) : undefined;
      const end = params.endDate ? new Date(params.endDate) : undefined;
      const range: any = {};
      if (start) {
        const s = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0)
        );
        range.$gte = s;
      }
      if (end) {
        const e = new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999)
        );
        range.$lte = e;
      }
      if (Object.keys(range).length) match.date = range;
    }

    // Pipeline always computes grand total
    const pipeline: any[] = [{ $match: match }];

    // If grouping requested, build breakdown first, also compute grand total in a second stage
    if (params.groupBy) {
      let groupId: any;
      if (params.groupBy === 'date') {
        groupId = {
          $dateToString: { format: '%Y-%m-%d', date: '$date' },
        };
      } else if (params.groupBy === 'property_id') {
        groupId = '$property_id';
      } else if (params.groupBy === 'author_id') {
        groupId = '$author_id';
      }

      pipeline.push(
        { $group: { _id: groupId, totalViews: { $sum: '$views' } } },
        { $sort: { _id: 1 } },
        // Preserve breakdown in a facet along with grand total
        {
          $facet: {
            breakdown: [{ $project: { _id: 0, key: '$_id', totalViews: 1 } }],
            grandTotal: [{ $group: { _id: null, totalViews: { $sum: '$totalViews' } } }],
          },
        },
        { $unwind: { path: '$grandTotal', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            totalViews: { $ifNull: ['$grandTotal.totalViews', 0] },
            breakdown: 1,
          },
        }
      );

      const res = await this._analyticsModel.aggregate(pipeline).exec();
      const first = res[0] ?? { totalViews: 0, breakdown: [] };
      return {
        totalViews: first.totalViews,
        breakdown: first.breakdown,
      };
    }

    // No grouping, just grand total
    pipeline.push({ $group: { _id: null, totalViews: { $sum: '$views' } } });
    const res = await this._analyticsModel.aggregate(pipeline).exec();
    return { totalViews: res[0]?.totalViews ?? 0 };
  }
}
