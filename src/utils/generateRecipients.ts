export function generateRecipients(count: number): string[] {
  const recipients: string[] = [];
  for (let i = 0; i < count; i++) {
    recipients.push(`user${i + 1}@example.com`);
  }
  return recipients;
}
