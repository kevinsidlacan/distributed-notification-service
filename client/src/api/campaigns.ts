const API_BASE = 'http://localhost:3001';

export interface Campaign {
  id: string;
  name: string;
  totalMessages: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends Campaign {
  _count: { messages: number };
  progress: Record<string, number>;
}

export async function getCampaigns(): Promise<Campaign[]> {
  const res = await fetch(`${API_BASE}/campaigns`);
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export async function getCampaignById(id: string): Promise<CampaignDetail> {
  const res = await fetch(`${API_BASE}/campaigns/${id}`);
  if (!res.ok) throw new Error('Failed to fetch campaign');
  return res.json();
}

export async function createCampaign(name: string, recipientCount: number): Promise<{ campaignId: string }> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, recipientCount }),
  });
  if (!res.ok) throw new Error('Failed to create campaign');
  return res.json();
}

export async function retryFailedMessages(campaignId: string): Promise<{ retriedCount: number }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/retry`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to retry messages');
  return res.json();
}
