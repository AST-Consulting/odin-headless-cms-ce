import { Injectable, Logger } from '@nestjs/common';
import {
  EmailService,
  EmailAttachment,
} from '../utilities/communication-provider/email/email.service';
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'fs';
import * as path from 'path';
@Injectable()
export class EmailContentService {
  private readonly logger = new Logger(EmailContentService.name);

  constructor(private readonly emailService: EmailService) {}

  // async sendEmailContentWithDocx(
  //   userName: string,
  //   userEmail: string,
  //   docxBuffer: Buffer,
  //   filename: string,
  //   category: string,
  // ): Promise<void> {
  //   try {
  //     this.logger.log(`Starting to send DOCX file to user: ${userEmail}`);

  //     // Get current date in YYYY-MM-DD format
  //     const currentDate = new Date().toISOString().split('T')[0];

  //     // Prepare attachments array with the provided DOCX buffer
  //     const attachments: EmailAttachment[] = [{
  //       filename: filename,
  //       content: docxBuffer,
  //       contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  //     }];

  //     // Create email content
  //     const htmlContent = this.createDocumentsEmailTemplate(userName, currentDate, [filename], domain);

  //     // Send email with attachments
  //     const { SENDER_NAME, SENDER_MAIL } = process.env;
  //     const sender = {
  //       name: SENDER_NAME,
  //       email: SENDER_MAIL,
  //     };

  //     // Define CC recipients
  //     const ccRecipients = [
  //       { name: 'Ashok', email: 'admin@example.com' },
  //       { name: 'Piyush', email: 'admin@example.com' }
  //     ];

  //     await this.emailService.sendEmail(
  //       `Your Article on ${category} - Dated ${currentDate}`,
  //       sender,
  //       [{ name: userName, email: userEmail }],
  //       sender,
  //       htmlContent,
  //       attachments,
  //       ccRecipients
  //     );

  //     this.logger.log(`Successfully sent DOCX file to ${userEmail}`);

  //   } catch (error) {
  //     this.logger.error(`Error sending email content to user ${userEmail}: ${error.message}`, error.stack);
  //     throw error;
  //   }
  // }

  async sendEmailContent(
    siteSlug: string,
    userName: string,
    userEmail: string,
    domain: string
  ): Promise<void> {
    try {
      this.logger.log(`Starting to send daily DOCX files to user: ${userEmail}`);

      // Get current date in YYYY-MM-DD format
      const currentDate = new Date().toISOString().split('T')[0];

      // Get the root directory path and construct the user's folder path
      const rootDir = process.cwd();
      const userFolderPath = path.join(rootDir, 'public', siteSlug, currentDate);

      // Check if the user's date folder exists
      if (!existsSync(userFolderPath)) {
        this.logger.log(
          `No documents folder found for site ${siteSlug} on ${currentDate} - user not opted for email notifications. Skipping email.`
        );
        return; // Skip email sending - user not opted in
      }

      // Read all files in the user's date folder
      const files = readdirSync(userFolderPath);

      // Filter only DOCX files
      const docxFiles = files.filter((file) => file.toLowerCase().endsWith('.docx'));

      if (docxFiles.length === 0) {
        this.logger.warn(`No DOCX files found for user ${siteSlug} on ${currentDate}`);
        return;
      }

      // Use all DOCX files (no time-based filtering)
      const eligibleFiles = docxFiles;

      // Prepare attachments array
      const attachments: EmailAttachment[] = [];

      // Read each eligible DOCX file and add to attachments, also check for corresponding images
      eligibleFiles.forEach((filename) => {
        const filePath = path.join(userFolderPath, filename);
        try {
          // Add DOCX file
          const fileContent = readFileSync(filePath);
          attachments.push({
            filename: filename,
            content: fileContent,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });

          // Check for corresponding image file
          const baseFilename = filename.replace('.docx', '');
          const imageFilename = `${baseFilename}-featured.jpg`;
          const imagePath = path.join(userFolderPath, imageFilename);

          if (existsSync(imagePath)) {
            try {
              const imageContent = readFileSync(imagePath);
              attachments.push({
                filename: imageFilename,
                content: imageContent,
                contentType: 'image/jpeg',
              });
              this.logger.log(`Added image attachment: ${imageFilename}`);
            } catch (imageError) {
              this.logger.warn(
                `Found image file ${imageFilename} but failed to read it: ${imageError.message}`
              );
            }
          } else {
            this.logger.log(
              `No corresponding image found for ${filename} (looked for: ${imageFilename})`
            );
          }
        } catch (fileError) {
          this.logger.error(`Error reading file ${filename}: ${fileError.message}`);
        }
      });

      if (attachments.length === 0) {
        this.logger.warn(`No attachments could be prepared for user ${siteSlug}`);
        return;
      }

      // Create email content
      const htmlContent = this.createDocumentsEmailTemplate(
        userName,
        currentDate,
        eligibleFiles,
        domain
      );

      // Send email with attachments
      const { SENDER_NAME, SENDER_MAIL } = process.env;
      const sender = {
        name: SENDER_NAME,
        email: SENDER_MAIL,
      };

      // Define BCC recipients
      const bccRecipients = [
        { name: 'Ashok', email: 'admin@example.com' },
        { name: 'Piyush', email: 'admin@example.com' },
        { name: 'Sumit', email: 'admin@example.com' },
      ];

      await this.emailService.sendEmail(
        `Scheduled Documents Report - ${currentDate}`,
        sender,
        [{ name: userName, email: userEmail }],
        sender,
        htmlContent,
        attachments,
        undefined,
        bccRecipients
      );

      // Count DOCX and image files separately
      const docxCount = attachments.filter(
        (a) =>
          a.contentType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ).length;
      const imageCount = attachments.filter((a) => a.contentType === 'image/jpeg').length;

      this.logger.log(
        `Successfully sent ${docxCount} DOCX files and ${imageCount} image files (${attachments.length} total attachments) to ${userEmail}`
      );

      // Delete sent documents after successful delivery
      await this.deleteDeliveredDocuments(siteSlug, eligibleFiles, userFolderPath);
    } catch (error) {
      this.logger.error(
        `Error sending email content to site ${siteSlug}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Creates an email template for when documents are found
   */
  private createDocumentsEmailTemplate(
    userName: string,
    date: string,
    docxFiles: string[],
    domain: string
  ): string {
    // Calculate the previous hour range in IST (UTC+5:30)
    const now = new Date();

    // Convert UTC to IST by adding 5 hours and 30 minutes
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const currentHour = istTime.getHours();
    const nextHour = currentHour === 23 ? 0 : currentHour + 1;

    // Format hours to 12-hour format with AM/PM
    const formatHour = (hour: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:00 ${period}`;
    };

    const currentHourFormatted = formatHour(currentHour);
    const nextHourFormatted = formatHour(nextHour);
    const timeRange = `${currentHourFormatted} to ${nextHourFormatted} IST`;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
          📄 Scheduled Documents Report - ${date}
        </h2>
        
        <p style="color: #666;">Dear ${userName},</p>
        
        <p style="color: #666;">
          Greeting! Here are the articles generated for ${domain}. Please review and publish them. Please send your feedback on admin@example.com
        </p>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <h3 style="color: #333; margin-top: 0;">📋 Documents Included:</h3>
          <ul style="color: #666;">
            ${docxFiles.map((file) => `<li style=\"margin: 5px 0;\">${file}</li>`).join('')}
          </ul>
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e8; border-radius: 5px; border-left: 4px solid #4CAF50;">
          <p style="margin: 0; color: #2E7D32;">
            <strong>📎 Note:</strong> All documents are attached as DOCX files and can be opened with Microsoft Word or Google Docs. Featured images are also included as JPG files when available.
          </p>
        </div>
        
        <p style="color: #666;">
          If you have any questions or need assistance, please don't hesitate to contact our support team.
        </p>
        
        <p style="color: #666;">
          Best regards,<br>
          Blog Management System
        </p>
        
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
          This is an automated report generated by the Blog Management System.
        </p>
      </div>
    `;
  }

  /**
   * Creates an email template for when no documents are found
   */
  private createNoDocumentsEmailTemplate(userName: string, date: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
          📄 Daily Documents Report - ${date}
        </h2>
        
        <p style="color: #666;">Dear ${userName},</p>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;">
            <strong>ℹ️ No Documents Found</strong><br>
            No documents were generated on ${date}. This might be normal if no content was created today.
          </p>
        </div>
        
        <p style="color: #666;">
          If you were expecting documents and believe this is an error, please contact our support team.
        </p>
        
        <p style="color: #666;">
          Best regards,<br>
          Blog Management System
        </p>
        
        <p style="color: #888; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
          This is an automated report generated by the Blog Management System.
        </p>
      </div>
    `;
  }

  /**
   * Deletes documents and their corresponding images after successful email delivery
   */
  private async deleteDeliveredDocuments(
    siteSlug: string,
    docxFiles: string[],
    sourceFolderPath: string
  ): Promise<void> {
    try {
      let deletedDocxCount = 0;
      let deletedImageCount = 0;

      // Delete each DOCX file and its corresponding image after successful email delivery
      for (const filename of docxFiles) {
        const docxSourcePath = path.join(sourceFolderPath, filename);

        try {
          // Delete DOCX file
          if (existsSync(docxSourcePath)) {
            unlinkSync(docxSourcePath);
            deletedDocxCount++;
            this.logger.log(`Deleted document ${filename} after successful delivery`);
          } else {
            this.logger.warn(`Source DOCX file not found: ${docxSourcePath}`);
          }

          // Check for and delete corresponding image file
          const baseFilename = filename.replace('.docx', '');
          const imageFilename = `${baseFilename}-featured.jpg`;
          const imageSourcePath = path.join(sourceFolderPath, imageFilename);

          if (existsSync(imageSourcePath)) {
            try {
              unlinkSync(imageSourcePath);
              deletedImageCount++;
              this.logger.log(`Deleted image ${imageFilename} after successful delivery`);
            } catch (imageDeleteError) {
              this.logger.error(
                `Error deleting image file ${imageFilename}: ${imageDeleteError.message}`
              );
            }
          } else {
            this.logger.log(
              `No corresponding image found for ${filename} (looked for: ${imageFilename})`
            );
          }
        } catch (deleteError) {
          this.logger.error(`Error deleting file ${filename}: ${deleteError.message}`);
          // Continue with other files even if one fails
        }
      }

      this.logger.log(
        `Successfully deleted ${deletedDocxCount} DOCX files and ${deletedImageCount} image files after delivery for site ${siteSlug}`
      );
    } catch (error) {
      this.logger.error(
        `Error deleting documents after delivery for site ${siteSlug}: ${error.message}`,
        error.stack
      );
      // Don't throw the error as email was already sent successfully
    }
  }
}
