/**
 * NOTE [PORTFOLIO DESIGN CHOICE]: 
 * In a real production system, we would NOT generate emails on the fly. 
 * Instead, we would read from a Subscriber database table (e.g. `SELECT email FROM Subscriber`). 
 * However, fetching 100,000 rows from a database would require implementing paginated streaming cursors, 
 * and storing 100,000 real-looking users would bloat a local or free-tier database. 
 * By generating arrays dynamically in-memory, we can instantly simulate massive load spikes 
 * (to prove architecture/queue capabilities) without requiring a gigantic database seed file.
 */
export function generateRecipients(count: number): string[] {
  const recipients: string[] = [];
  for (let i = 0; i < count; i++) {
    recipients.push(`user${i + 1}@example.com`);
  }
  return recipients;
}
