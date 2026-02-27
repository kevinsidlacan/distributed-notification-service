import { EmailProvider } from './EmailProvider';

const FAILURE_RATE = 0.2;
const SIMULATED_LATENCY_MS = 200;

export class MockEmailProvider implements EmailProvider {
  /**
   * Simulates sending an email with artificial latency and a random failure rate.
   * This is used for load-testing recipient addresses (e.g. *@example.com).
   */
  async sendEmail(to: string, subject: string, textBody: string): Promise<void> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

    // Simulate random failures
    if (Math.random() < FAILURE_RATE) {
      throw new Error(`[Mock] Failed to deliver notification to ${to}`);
    }

    console.log(`[Mock] Sent to ${to}: "${subject}"`);
  }
}
