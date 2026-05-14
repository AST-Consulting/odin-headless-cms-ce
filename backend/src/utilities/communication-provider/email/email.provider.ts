import * as Brevo from '@getbrevo/brevo';
import { Injectable, Logger } from '@nestjs/common';
import { EmailAttachment } from './email.service';

@Injectable()
export class EmailProvider {
  private readonly apiInstance: Brevo.TransactionalEmailsApi;
  private readonly logger = new Logger(EmailProvider.name);

  constructor() {
    const apiKey = process.env.SIB_KEY;
    this.apiInstance = this.initializeApiClient(apiKey);
  }

  private initializeApiClient(apiKey: string): Brevo.TransactionalEmailsApi {
    const defaultClient = Brevo.ApiClient.instance;
    const apiKeyAuth = defaultClient.authentications['api-key'];
    apiKeyAuth.apiKey = apiKey;

    return new Brevo.TransactionalEmailsApi();
  }

  async sendEmail(
    subject: string,
    sender: { name: string; email: string },
    to: { email: string; name: string }[],
    replyTo: { email: string; name: string },
    htmlContent: string,
    attachments?: EmailAttachment[],
    cc?: { name: string; email: string }[],
    bcc?: { name: string; email: string }[]
  ): Promise<void> {
    const payload = this.createSendSmtpEmail(
      subject,
      sender,
      to,
      replyTo,
      htmlContent,
      attachments,
      cc,
      bcc
    );

    try {
      const response = await this.apiInstance.sendTransacEmail(payload);
      this.logger.log(`Email sent successfully: ${JSON.stringify(response)}`);
    } catch (error) {
      console.log(error);
      this.handleEmailError(error, to);
    }
  }

  private createSendSmtpEmail(
    subject: string,
    sender: { name: string; email: string },
    to: { email: string; name: string }[],
    replyTo: { email: string; name: string },
    htmlContent: string,
    attachments?: EmailAttachment[],
    cc?: { name: string; email: string }[],
    bcc?: { name: string; email: string }[]
  ): Brevo.SendSmtpEmail {
    const msg = new Brevo.SendSmtpEmail();
    msg.subject = subject;
    msg.htmlContent = htmlContent;
    msg.sender = sender;
    msg.to = to;
    msg.replyTo = replyTo;

    // Add CC if provided
    if (cc && cc.length > 0) {
      msg.cc = cc;
    }

    // Add BCC if provided
    if (bcc && bcc.length > 0) {
      msg.bcc = bcc;
    }

    if (attachments && attachments.length) {
      // Brevo expects Base64‐encoded content
      msg.attachment = attachments.map((att) => ({
        name: att.filename,
        content: Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : Buffer.from(att.content).toString('base64'),
        contentType: att.contentType,
      }));
    }

    return msg;
  }

  handleEmailError(error: any, to: { email: string; name: string }[]): void {
    console.log(error);
    this.logger.error(
      `Error sending email to ${JSON.stringify(to)}: ${error.message}`,
      error.stack
    );
    // Optionally rethrow or handle the error as needed
  }

  // async sendInvoiceEmail(data: InvoiceData, pdfBuffer: Buffer) {
  //   const sender = { email: process.env.SENDER_EMAIL, name: 'PersonaPilot' };
  //   const recipient = { email: data.userEmail, name: data.userName };

  //   const attachments = [
  //     {
  //       filename: `invoice-${data.id}.pdf`,
  //       content: pdfBuffer,
  //     },
  //   ];

  //   try {
  //     await this.sendEmail(
  //       `Your Invoice #${data.id}`,
  //       sender,
  //       [recipient],
  //       sender,
  //       `<p>Dear ${data.userName},</p><p>Please find your invoice attached.</p>`,
  //       attachments,
  //     );
  //   } catch (error) {
  //     console.error('Error sending email:', error);
  //     throw new BadRequestException('Failed to send invoice email');
  //   }
  // }
}
