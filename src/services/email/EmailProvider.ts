export interface EmailProvider {
  /**
   * Sends an email notification.
   * @param to The recipient's email address.
   * @param subject The subject line of the email.
   * @param textBody The plaintext body of the email.
   * @returns A promise that resolves when the email is successfully sent, or throws an error.
   */
  sendEmail(to: string, subject: string, textBody: string): Promise<void>;
}
