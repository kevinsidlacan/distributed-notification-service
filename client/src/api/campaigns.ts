const API_BASE = 'http://localhost:3001';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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

export async function createCampaign(name: string, recipientCount: number, targetEmail?: string): Promise<{ campaignId: string }> {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, recipientCount, targetEmail }),
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error('Failed to create campaign');
  return res.json();
}

export async function retryFailedMessages(campaignId: string): Promise<{ retriedCount: number }> {
  const res = await fetch(`${API_BASE}/campaigns/${campaignId}/retry`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error('Failed to retry messages');
  return res.json();
}
