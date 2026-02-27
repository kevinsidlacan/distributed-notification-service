import { EmailProvider } from './EmailProvider';
import { MockEmailProvider } from './MockEmailProvider';
import { SESEmailProvider } from './SESEmailProvider';

export class EmailServiceFactory {
  private static mockProvider = new MockEmailProvider();
  private static sesProvider = new SESEmailProvider();

  /**
   * Returns the appropriate EmailProvider based on the recipient's email address.
   * - Uses MockEmailProvider for load test addresses ending in @example.com to avoid AWS bills.
   * - Uses SESEmailProvider for any real email addresses provided.
   */
  static getProvider(recipientEmail: string): EmailProvider {
    if (recipientEmail.toLowerCase().endsWith('@example.com')) {
      return this.mockProvider;
    }

    // For any real email address, use the real AWS provider.
    return this.sesProvider;
  }
}
