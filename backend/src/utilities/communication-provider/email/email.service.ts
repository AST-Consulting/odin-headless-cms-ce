import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email.provider';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

@Injectable()
export class EmailService {
  private readonly _logger = new Logger('Email');
  constructor(private readonly _emailProvider: EmailProvider) {}

  async sendEmail(
    subject: string,
    sender: { name: string; email: string },
    to: { name: string; email: string }[],
    replyTo: { name: string; email: string },
    htmlContent: string,
    attachments?: EmailAttachment[],
    cc?: { name: string; email: string }[],
    bcc?: { name: string; email: string }[]
  ) {
    try {
      const { SENDER_NAME, SENDER_MAIL } = process.env;
      const sender = {
        name: SENDER_NAME,
        email: SENDER_MAIL,
      };
      this._logger.log(`Broadcasting email to: ${to.map((r) => r.email).join(', ')} with subject: ${subject}`);
      await this._emailProvider.sendEmail(
        subject,
        sender,
        to,
        sender,
        htmlContent,
        attachments,
        cc,
        bcc
      );
    } catch (error) {
      this._emailProvider.handleEmailError(error, to);
    }
  }

  async sendMail(
    subject: string,
    template: string,
    recipient: { name: string; email: string }
  ): Promise<void> {
    const { SENDER_NAME, SENDER_MAIL } = process.env;
    const sender = {
      name: SENDER_NAME,
      email: SENDER_MAIL,
    };

    this._logger.log(`Sending email to: ${recipient.email} with subject: ${subject}`);
    await this.sendEmail(subject, sender, [recipient], sender, template);
  }

  // // Test method to verify CC/BCC functionality
  //  @Cron('40 13 * * *', {
  //   timeZone: 'Asia/Kolkata',
  // })
  async testCcBccEmail(): Promise<void> {
    try {
      this._logger.log('Testing CC/BCC email functionality...');

      const currentTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      const { SENDER_NAME, SENDER_MAIL } = process.env;
      const sender = {
        name: SENDER_NAME || 'Test Sender',
        email: SENDER_MAIL || 'test@example.com',
      };

      const htmlContent = `
        <html>
          <body>
            <h2>CC/BCC Email Test</h2>
            <p>This is a test email to verify CC and BCC functionality.</p>
            <p><strong>Test Time:</strong> ${currentTime}</p>
            <p><strong>Purpose:</strong> Verify that CC recipients receive this email</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              This is an automated test email. If you receive this in CC, the functionality is working correctly.
            </p>
          </body>
        </html>
      `;

      const ccRecipients = [
        { name: 'Sumit', email: 'admin@example.com' },
        { name: 'Piyush', email: 'admin@example.com' },
      ];

      const bccRecipients = [{ name: 'Test BCC', email: 'admin@example.com' }];

      await this.sendEmail(
        `CC/BCC Email Test - ${currentTime}`,
        sender,
        [{ name: 'Primary Recipient', email: 'piyush9695@gmail.com' }],
        sender,
        htmlContent,
        undefined, // no attachments
        ccRecipients,
        bccRecipients
      );

      this._logger.log('CC/BCC test email sent successfully');
    } catch (error) {
      this._logger.error('Failed to send CC/BCC test email:', error.message);
    }
  }

  // Manual test method that can be called directly
  async manualTestCcBcc(): Promise<void> {
    this._logger.log('Manual CC/BCC test triggered');
    await this.testCcBccEmail();
  }
}
