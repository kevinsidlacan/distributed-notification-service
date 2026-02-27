import { generateRecipients } from './generateRecipients';

describe('generateRecipients', () => {
  it('should generate the correct number of recipients', () => {
    const recipients = generateRecipients(5);
    expect(recipients).toHaveLength(5);
  });

  it('should generate emails in the correct format', () => {
    const recipients = generateRecipients(3);
    expect(recipients).toEqual([
      'user1@example.com',
      'user2@example.com',
      'user3@example.com',
    ]);
  });

  it('should return an empty array for count 0', () => {
    const recipients = generateRecipients(0);
    expect(recipients).toEqual([]);
  });

  it('should handle a count of 1', () => {
    const recipients = generateRecipients(1);
    expect(recipients).toEqual(['user1@example.com']);
  });

  it('should generate sequential user numbers starting from 1', () => {
    const recipients = generateRecipients(100);
    expect(recipients[0]).toBe('user1@example.com');
    expect(recipients[99]).toBe('user100@example.com');
  });
});
