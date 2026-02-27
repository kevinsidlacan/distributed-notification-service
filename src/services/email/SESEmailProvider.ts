import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailProvider } from './EmailProvider';

export class SESEmailProvider implements EmailProvider {
  private client: SESClient;

  constructor() {
    this.client = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    });
  }

  /**
   * Sends a real email using AWS Simple Email Service (SES).
   * Note: If the AWS account is in the sandbox, both the sender and recipient must be verified in the AWS console.
   */
  async sendEmail(to: string, subject: string, textBody: string): Promise<void> {
    const fromAddress = process.env.FROM_EMAIL;
    
    if (!fromAddress) {
      throw new Error('FROM_EMAIL environment variable is missing for SES provider.');
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials missing. Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    }

    const command = new SendEmailCommand({
      Source: fromAddress,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      await this.client.send(command);
      console.log(`[SES] Real email sent to ${to}: "${subject}"`);
    } catch (error: any) {
      console.error(`[SES] AWS SES Error sending to ${to}:`, error.message);
      throw new Error(`AWS SES API Error: ${error.message}`);
    }
  }
}
