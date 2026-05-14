import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { EmailService } from '../utilities/communication-provider/email/email.service';
import { POST_STATUS } from 'src/core/constants/enums.constants';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { ArticlesService } from 'src/articles/articles.service';
import { PropertyService } from 'src/property/property.service';
@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly _articleService: ArticlesService,
    private readonly _analyticsService: AnalyticsService,
    private readonly _propertyService: PropertyService
  ) {}

  async sendDailyReport(
    configArray: any[] = [],
    userEmail: string = '',
    userId: string = ''
  ): Promise<void> {
    // Only process reports for specific user email
    // if (userEmail !== 'admin@example.com') {
    //   this.logger.log(
    //     `Skipping daily report generation for user: ${userEmail} - not authorized`,
    //   );
    //   return;
    // }

    // Create a local recipient array for this specific report
    const recipientEmails = ['admin@example.com', 'admin@example.com'];
    try {
      this.logger.log(`Starting daily report generation for user: ${userEmail}`);

      const now = DateTime.now().setZone('Asia/Kolkata');

      // Generate reports for all blog types using previous day's date
      const reportData = await this.generateAllReports(configArray);

      // Generate view counts for all properties
      const viewCounts = await this.generateViewCounts(configArray, userId);

      // Check if there are any posted or scheduled blogs across all sites
      const hasPostedOrScheduledBlogs = reportData.some(
        (data) => data.publishedBlogs > 0 || data.scheduledBlogs > 0
      );

      // If no posted or scheduled blogs found, skip sending the email
      if (!hasPostedOrScheduledBlogs) {
        this.logger.log(`No posted or scheduled blogs found for ${userEmail}. Skipping email.`);
        return;
      }

      // Create email content with report statistics and view counts
      const htmlContent = this.createEmailTemplate(reportData, now, viewCounts);

      // Send email to the specific recipient only
      await Promise.all(
        recipientEmails.map((email) =>
          this.emailService.sendMail('Daily Blog Activity Report', htmlContent, {
            email,
            name: 'Manager',
          })
        )
      );

      this.logger.log(`Daily report sent successfully to: ${userEmail}`);
    } catch (error) {
      this.logger.error(`Error sending daily report: ${error.message}`, error.stack);
    }
  }
  /**
   * Generates reports for all blog types using the previous day's date
   * @returns Array of report data including site names and statistics
   */
  async generateAllReports(configArray: any[]): Promise<any[]> {
    try {
      // Array of blog types to process`
      const BLOG_TYPES = configArray;

      // Dynamically generate site names for display in email
      const siteNames = {};
      BLOG_TYPES.forEach(({ siteSlug }) => {
        siteNames[siteSlug] = siteSlug
          .split(/[-_]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      });

      this.logger.log(`Generated site names: ${JSON.stringify(siteNames, null, 2)}`);

      // Get yesterday's date properly in Kolkata timezone
      const nowKolkata = DateTime.now().setZone('Asia/Kolkata');
      const yesterdayKolkata = nowKolkata.minus({ days: 1 });

      // Create a Date object for yesterday at start of day in Kolkata timezone
      const yesterdayDateString = yesterdayKolkata.toFormat('yyyy-MM-dd');
      const yesterday = new Date(yesterdayDateString + 'T00:00:00.000Z');

      this.logger.log(`Current time in Kolkata: ${nowKolkata.toFormat('yyyy-MM-dd HH:mm:ss')}`);
      this.logger.log(`Yesterday in Kolkata: ${yesterdayKolkata.toFormat('yyyy-MM-dd')}`);
      this.logger.log(`Yesterday date for query: ${yesterdayDateString}`);
      this.logger.log(`Yesterday Date object: ${yesterday.toISOString()}`);
      this.logger.log(`Yesterday date string for query: ${yesterday.toISOString().split('T')[0]}`);

      // For storing report data
      const reportData = [];

      // Process all blog types concurrently using Promise.all
      const reportPromises = BLOG_TYPES.map(async (config) => {
        try {
          const { siteSlug } = config;
          const reportInfo = await this.processBlogTypeStats(yesterday, config);

          if (reportInfo.totalBlogs > 0) {
            this.logger.log(
              `Stats for ${siteSlug} processed successfully: ${reportInfo.totalBlogs} blogs found`
            );
          } else {
            this.logger.warn(
              `No blogs found for ${siteSlug} on ${yesterday.toISOString().split('T')[0]} - this is normal`
            );
          }

          // Return report data with proper siteName
          const siteName = siteNames[siteSlug] || siteSlug;
          this.logger.log(`Processing ${siteSlug}: siteName = ${siteName}`);

          return {
            siteName: siteName,
            siteType: siteSlug,
            totalBlogs: reportInfo.totalBlogs,
            publishedBlogs: reportInfo.publishedBlogs,
            generatedBlogs: reportInfo.generatedBlogs,
            scheduledBlogs: reportInfo.scheduledBlogs,
            authors: reportInfo.uniqueAuthors,
          };
        } catch (error) {
          const { siteSlug } = config;
          // Log as warning instead of error for missing data
          this.logger.warn(`Could not retrieve stats for ${siteSlug}: ${error.message}`);

          // Return empty stats to maintain consistent report structure
          const siteName = siteNames[siteSlug] || siteSlug;
          return {
            siteName: siteName,
            siteType: siteSlug,
            totalBlogs: 0,
            publishedBlogs: 0,
            generatedBlogs: 0,
            scheduledBlogs: 0,
            authors: [],
          };
        }
      });

      // Wait for all promises to resolve
      const results = await Promise.all(reportPromises);
      reportData.push(...results);
      return reportData;
    } catch (error) {
      // Log as warning instead of error since this shouldn't stop the entire report
      this.logger.warn(`Issue generating some reports: ${error.message}`);
      // Return empty array if there's a critical error
      return [];
    }
  }
  /**
   * Processes blog topics for a specific date and config, and returns statistics
   * @param date The date to fetch blog topics for
   * @param config The property config object with siteSlug and propertyId
   * @returns Object with information about the processed blogs
   */ async processBlogTypeStats(date: Date, config: any): Promise<any> {
    try {
      // Add debug logging
      this.logger.log(`Processing blog stats for config: ${JSON.stringify(config)}`);
      this.logger.log(`Using date: ${date.toISOString().split('T')[0]}`);

      // Fetch blog topics for the specified date and config
      const blogPosts = await this._articleService.getTopicsByDate(
        date,
        config // Pass the entire config object which has propertyId
      );
      if (config.siteSlug === 'freecultr-com') {
        console.log('Blog posts for freecultr-com:', blogPosts);
      }

      if (!blogPosts || blogPosts.length === 0) {
        // Log as info instead of warning since this is normal
        this.logger.warn(
          `No blog posts found for ${config.siteSlug} on ${date.toISOString().split('T')[0]} - this is expected behavior`
        );
        return {
          totalBlogs: 0,
          publishedBlogs: 0,
          generatedBlogs: 0,
          scheduledBlogs: 0,
          uniqueAuthors: [],
        };
      }

      // Calculate statistics
      const totalBlogs = blogPosts.length;
      const publishedBlogs = blogPosts.filter((post) => post.status === POST_STATUS.POSTED).length;
      const generatedBlogs = blogPosts.filter(
        (post) => post.status === POST_STATUS.GENERATED
      ).length;
      const scheduledBlogs = blogPosts.filter(
        (post) => post.status === POST_STATUS.SCHEDULED
      ).length;

      // Extract unique authors
      const uniqueAuthors = [...new Set(blogPosts.map((post) => post.author))];

      // Return information about the processed blogs
      return {
        totalBlogs,
        publishedBlogs,
        generatedBlogs,
        scheduledBlogs,
        uniqueAuthors: uniqueAuthors,
      };
    } catch (error) {
      // Update error message to use config.siteSlug
      this.logger.warn(
        `Could not fetch blog data for ${config.siteSlug || config} on ${date.toISOString().split('T')[0]}: ${error.message}`
      );

      // Return empty stats instead of throwing error
      return {
        totalBlogs: 0,
        publishedBlogs: 0,
        generatedBlogs: 0,
        scheduledBlogs: 0,
        uniqueAuthors: [],
      };
    }
  }

  async sendConsolidatedDailyReport(): Promise<void> {
    const recipientEmails = [
      'admin@example.com',
      'admin@example.com',
      'admin@example.com',
      'admin@example.com',
    ];

    try {
      this.logger.log('Starting consolidated daily report generation');

      // Get ALL active properties from database
      const allProperties = await this._propertyService.getAllPropertiesForReport();

      if (!allProperties || allProperties.length === 0) {
        this.logger.log('No active properties found. Skipping consolidated report.');
        return;
      }

      // Transform properties to configArray format
      const configArray = allProperties.map((property) => ({
        name: property.name,
        propertyId: property._id.toString(),
        domain: property.domain,
        websiteName: property.websiteName || property.domain,
        googleAnalyticsPropertyId: property.googleAnalyticsPropertyId?.[0], // Take first GA property ID
      }));

      this.logger.log(`Config array created: ${JSON.stringify(configArray, null, 2)}`);

      const now = DateTime.now().setZone('Asia/Kolkata');

      // Generate reports for all properties
      const reportData = await this.generateAllReports(configArray);
      this.logger.log(`Report data generated: ${JSON.stringify(reportData, null, 2)}`);

      // Generate view counts for all properties (use first user's ID or system ID)
      const systemUserId = allProperties[0]?.user?.id || 'system';
      const viewCounts = await this.generateViewCounts(configArray, systemUserId);
      this.logger.log(`View counts generated: ${JSON.stringify(viewCounts, null, 2)}`);

      // Create consolidated report data
      const consolidatedData = this.createConsolidatedReportData(reportData, viewCounts);
      this.logger.log(`Consolidated data created: ${JSON.stringify(consolidatedData, null, 2)}`);

      // Create email content
      const htmlContent = this.createConsolidatedEmailTemplate(consolidatedData, now);

      // Send single email to super admins
      await Promise.all(
        recipientEmails.map((email) =>
          this.emailService.sendMail(
            'Daily Consolidated Blog Activity Report - All Properties',
            htmlContent,
            {
              email,
              name: 'Super Admin',
            }
          )
        )
      );

      this.logger.log('Consolidated daily report sent successfully to super admins');
    } catch (error) {
      this.logger.error(`Error sending consolidated daily report: ${error.message}`, error.stack);
    }
  }

  /**
   * Generates view counts for all properties using analytics service
   * @param configArray Array of config objects with propertyId
   * @param userId User ID for analytics filtering
   * @returns Array of view count data for each property
   */
  async generateViewCounts(configArray: any[], userId: string): Promise<any[]> {
    try {
      // Get yesterday's date for analytics
      const yesterday = DateTime.now()
        .setZone('Asia/Kolkata')
        .minus({ days: 1 })
        .toFormat('yyyy-MM-dd');

      const viewCountPromises = configArray.map(async (config) => {
        try {
          const { siteSlug, propertyId } = config;

          // Call analytics service to get view summary for this property
          const viewSummary = await this._analyticsService.getViewsSummary(userId, {
            property_id: propertyId,
            date: yesterday,
          });

          return {
            propertyName: siteSlug,
            propertyId: propertyId,
            views: viewSummary.totalViews || 0,
          };
        } catch (error) {
          this.logger.warn(
            `Could not fetch view count for property ${config.propertyId}: ${error.message}`
          );
          return {
            propertyName: config.siteSlug || 'Unknown',
            propertyId: config.propertyId,
            views: 0,
          };
        }
      });

      const viewCounts = await Promise.all(viewCountPromises);
      return viewCounts;
    } catch (error) {
      this.logger.error(`Error generating view counts: ${error.message}`);
      return [];
    }
  } /**
   * Creates an email template with report data
   * @param reportData Array of report data
   * @param date The date of the report
   * @returns HTML content for the email
   */
  private createEmailTemplate(reportData: any[], date: DateTime, viewCounts: any[] = []): string {
    const formattedDate = date.toFormat('dd MMM yyyy');

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">Daily Blog Activity Report - ${formattedDate}</h2>        <p style="color: #666;">Here's a summary of the blog activity across our websites for ${formattedDate}:</p>
    `;

    // Add each site's data
    reportData.forEach((data) => {
      htmlContent += `
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <h3 style="color: #333; margin-top: 0;">🌐 Website: ${typeof data.siteName.siteSlug === 'object' ? JSON.stringify(data.siteName.siteSlug) : data.siteName.siteSlug}</h3>
          <p style="margin: 10px 0;">📝 Total Blogs: ${data.totalBlogs || 0}</p>
          <p style="margin: 10px 0;">✅ Published Blogs: ${data.publishedBlogs || 0}</p>
          <p style="margin: 10px 0;">👨‍💻 Authors: ${data.authors?.length || 0}</p>
        </div>
      `;
    });

    // Add view counts table if data is available
    if (viewCounts && viewCounts.length > 0) {
      const totalViews = viewCounts.reduce((sum, item) => sum + item.views, 0);
      const totalPublishedBlogs = viewCounts.reduce((sum, item) => {
        // Find the matching reportData entry
        const report = reportData.find(
          (data) =>
            (data.siteName &&
              typeof data.siteName === 'object' &&
              data.siteName.siteSlug === item.propertyName) ||
            (typeof data.siteName === 'string' && data.siteName === item.propertyName)
        );
        return sum + (report ? report.publishedBlogs || 0 : 0);
      }, 0);
      const yesterdayDate = date.minus({ days: 1 }).toFormat('dd MMM yyyy');

      htmlContent += `
        <div style="margin: 30px 0; padding: 15px; background-color: #f0f8ff; border-radius: 5px;">
          <h3 style="color: #333; margin-top: 0;">👁️ Daily View Counts (${yesterdayDate})</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #e6f3ff;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Property Name</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Views</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">Published Blogs</th>
              </tr>
            </thead>
            <tbody>
      `;

      // Add rows for each property
      viewCounts.forEach((item) => {
        // Find the matching reportData entry
        const report = reportData.find(
          (data) =>
            (data.siteName &&
              typeof data.siteName === 'object' &&
              data.siteName.siteSlug === item.propertyName) ||
            (typeof data.siteName === 'string' && data.siteName === item.propertyName)
        );
        const publishedBlogs = report ? report.publishedBlogs || 0 : 0;
        htmlContent += `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.propertyName}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.views.toLocaleString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${publishedBlogs}</td>
              </tr>
        `;
      });

      // Add total row
      htmlContent += `
              <tr style="background-color: #f9f9f9; font-weight: bold;">
                <td style="border: 1px solid #ddd; padding: 8px;">Total</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalViews.toLocaleString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalPublishedBlogs}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // Close the template
    htmlContent += `
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated report generated by the Blog Management System.</p>
      </div>
    `;

    return htmlContent;
  }

  private createConsolidatedReportData(reportData: any[], viewCounts: any[]): any[] {
    return reportData.map((report) => {
      const matchingViewCount = viewCounts.find(
        (vc) => vc.propertyName === report.siteType || vc.propertyName === report.siteName
      );

      return {
        propertyName: report.siteName || report.siteType,
        postedBlogs: report.publishedBlogs || 0,
        views: matchingViewCount?.views || 0,
        totalBlogs: report.totalBlogs || 0,
        scheduledBlogs: report.scheduledBlogs || 0,
        authors: report.authors || [],
      };
    });
  }

  private createConsolidatedEmailTemplate(consolidatedData: any[], date: DateTime): string {
    const formattedDate = date.toFormat('dd MMM yyyy');
    const yesterdayDate = date.minus({ days: 1 }).toFormat('dd MMM yyyy');

    // Calculate totals
    const totalPostedBlogs = consolidatedData.reduce((sum, item) => sum + item.postedBlogs, 0);
    const totalViews = consolidatedData.reduce((sum, item) => sum + item.views, 0);
    const totalProperties = consolidatedData.length;

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #4CAF50; padding-bottom: 15px; margin-bottom: 25px;">
          📊 Daily Consolidated Blog Activity Report - ${formattedDate}
        </h2>
        
        <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin-bottom: 25px;">
          <h3 style="color: #333; margin-top: 0;">📈 Summary (${yesterdayDate})</h3>
          <div style="display: flex; justify-content: space-around; text-align: center;">
            <div>
              <h4 style="color: #4CAF50; margin: 5px 0;">${totalProperties}</h4>
              <p style="margin: 0; color: #666;">Total Properties</p>
            </div>
            <div>
              <h4 style="color: #2196F3; margin: 5px 0;">${totalPostedBlogs}</h4>
              <p style="margin: 0; color: #666;">Posted Blogs</p>
            </div>
            <div>
              <h4 style="color: #FF9800; margin: 5px 0;">${totalViews.toLocaleString()}</h4>
              <p style="margin: 0; color: #666;">Total Views</p>
            </div>
          </div>
        </div>

        <h3 style="color: #333; margin-bottom: 15px;">🌐 Property Performance Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background-color: #4CAF50; color: white;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold;">Property Name</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">Posted Blogs</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">Views</th>
            </tr>
          </thead>
          <tbody>
    `;

    // Add rows for each property
    consolidatedData.forEach((item, index) => {
      const rowStyle = index % 2 === 0 ? 'background-color: #f9f9f9;' : 'background-color: white;';
      htmlContent += `
            <tr style="${rowStyle}">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: 500;">${item.propertyName}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: #2196F3; font-weight: bold;">${item.postedBlogs}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: #FF9800; font-weight: bold;">${item.views.toLocaleString()}</td>
            </tr>
      `;
    });

    // Add total row
    htmlContent += `
            <tr style="background-color: #e8f5e8; font-weight: bold; border-top: 2px solid #4CAF50;">
              <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">TOTAL</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: #2196F3; font-weight: bold;">${totalPostedBlogs}</td>
              <td style="border: 1px solid #ddd; padding: 12px; text-align: center; color: #FF9800; font-weight: bold;">${totalViews.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px;">
          This is an automated consolidated report generated by the Blog Management System for all active properties.
        </p>
      </div>
    `;

    return htmlContent;
  }
}
